/**
 * 极简探针 hub 数据层
 *
 * 主题只使用 hub 公开的五个读取接口：
 *   GET /api/me、GET /api/nodes、GET /api/nodes/{id}/metrics、GET /api/ws、
 *   GET /api/themes/{short}/config
 * 这里把 hub 的节点快照转换成主题组件原本使用的 Client / NodeStatus 结构，
 * 其余界面代码因此不需要感知数据来自哪一种后端。
 *
 * 字段一律按「这个 key 可能不存在」处理：匿名访问时地址、备注等字段根本不存在，
 * 离线节点 metrics 为 null，刚连上的节点 online 为 true 但 metrics 仍为 null。
 */

import type { Client, NodeStatus } from '@/utils/rpc'
import manifest from '../../theme.json'

// ==================== hub 响应类型 ====================

export interface HubMe {
  authed: boolean
  github?: boolean
  site_name?: string
  public_page?: boolean
  site?: string
}

export interface HubMetrics {
  uptime?: number
  cpu?: number
  load?: number[]
  mem_total?: number
  mem_used?: number
  swap_total?: number
  swap_used?: number
  disk_total?: number
  disk_used?: number
  net_rx?: number
  net_tx?: number
  tcp?: number
  udp?: number
  procs?: number
  total_rx?: number
  total_tx?: number
  month_rx?: number
  month_tx?: number
}

export interface HubNode {
  id: number
  name: string
  country?: string
  group?: string
  sort?: number
  public?: boolean
  online?: boolean
  last_seen?: number
  metrics?: HubMetrics | null
  os?: string
  kernel?: string
  arch?: string
  virt?: string
  cpu_name?: string
  cpu_cores?: number
  mem_total?: number
  swap_total?: number
  disk_total?: number
  agent_version?: string
  price?: number
  currency?: string
  billing_cycle?: string
  expires_at?: string | null
  expires_in?: number | null
  traffic_limit?: number
  traffic_mode?: string
  traffic_reset_day?: number
  total_rx?: number
  total_tx?: number
  month_rx?: number
  month_tx?: number
  month_used?: number
  month_start?: number
  day_rx?: number
  day_tx?: number
  // 仅登录后存在
  hostname?: string
  ipv4?: string
  ipv6?: string
  addresses?: Array<{ address: string, source: string }>
  remark?: string
}

export interface HubSnapshot {
  nodes: HubNode[]
  admin?: boolean
}

export interface HubMetricRow {
  ts: number
  cpu: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
}

export interface HubPingRow {
  task_id: number
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}

export interface HubHistory {
  metrics: HubMetricRow[]
  ping: HubPingRow[]
  probes: Record<string, string>
  loss: Record<string, number>
}

// ==================== 错误 ====================

export class HubError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HubError'
  }
}

async function readError(res: Response): Promise<HubError> {
  let text = ''
  try {
    text = (await res.text()).trim()
  }
  catch {}
  return new HubError(res.status, text || `HTTP ${res.status}`)
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', signal, headers: { accept: 'application/json' } })
  if (!res.ok)
    throw await readError(res)
  return await res.json() as T
}

// ==================== 基础读取 ====================

export const THEME_SHORT = manifest.short

export function fetchMe(signal?: AbortSignal): Promise<HubMe> {
  return getJson<HubMe>('/api/me', signal)
}

export async function fetchNodes(signal?: AbortSignal): Promise<HubSnapshot> {
  const data = await getJson<HubSnapshot | HubNode[]>('/api/nodes', signal)
  // 防御性兼容：直接返回数组的实现
  if (Array.isArray(data))
    return { nodes: data }
  return { nodes: Array.isArray(data?.nodes) ? data.nodes : [], admin: data?.admin }
}

// ---- 主题设置 ----

interface ConfigField {
  key?: string
  type: string
  default?: unknown
  options?: Array<{ value: string }>
  min?: number
  max?: number
}

/** theme.json 中声明的设置项（去掉分组标题） */
export const configFields = (manifest.config as ConfigField[]).filter(
  (field): field is ConfigField & { key: string } => field.type !== 'title' && typeof field.key === 'string',
)

/** 与面板同一套取值检查：保存的值可能来自旧版本主题，对不上的当作没保存过 */
function fits(field: ConfigField, value: unknown): boolean {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        && value >= (field.min ?? Number.NEGATIVE_INFINITY) && value <= (field.max ?? Number.POSITIVE_INFINITY)
    case 'select':
      return !!field.options?.some(option => option.value === value)
    default:
      return typeof value === 'string'
  }
}

/**
 * 读取站点级主题设置：theme.json 默认值 + hub 中站长保存的值。
 * 401、404 与网络错误一律按默认值渲染，不报错。
 */
export async function loadThemeConfig(): Promise<Record<string, unknown>> {
  let saved: Record<string, unknown> = {}
  try {
    const res = await fetch(`/api/themes/${THEME_SHORT}/config`, { credentials: 'same-origin' })
    if (res.ok) {
      const body = await res.json()
      if (body && typeof body === 'object' && !Array.isArray(body))
        saved = body as Record<string, unknown>
    }
  }
  catch {
    // 断网同样按默认值
  }
  return Object.fromEntries(configFields.map(field => [field.key, fits(field, saved[field.key]) ? saved[field.key] : field.default]))
}

// ==================== 历史查询队列 ====================

/**
 * hub 同时只处理 4 个历史查询，超出直接返回 503。首页每张节点卡片都会取延迟历史，
 * 所以这里在浏览器侧排队，最多并行 3 个，并在 503 时退避重试。
 */
const HISTORY_CONCURRENCY = 3
const HISTORY_RETRIES = 4
let historyActive = 0
const historyWaiters: Array<() => void> = []

async function acquireHistorySlot(signal?: AbortSignal): Promise<void> {
  if (historyActive < HISTORY_CONCURRENCY) {
    historyActive += 1
    return
  }
  await new Promise<void>((resolve, reject) => {
    function grant(): void {
      signal?.removeEventListener('abort', onAbort)
      historyActive += 1
      resolve()
    }
    function onAbort(): void {
      const index = historyWaiters.indexOf(grant)
      if (index >= 0)
        historyWaiters.splice(index, 1)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    historyWaiters.push(grant)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function releaseHistorySlot(): void {
  historyActive = Math.max(0, historyActive - 1)
  historyWaiters.shift()?.()
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

/** 匿名访客最多查询 7 天，登录后 90 天；超出时 hub 会静默收窄 */
export const PUBLIC_HISTORY_HOURS = 168
export const ADMIN_HISTORY_HOURS = 2160

export interface HistoryQuery {
  hours: number
  points?: number
  series?: 'metrics' | 'ping'
}

const historyCache = new Map<string, { at: number, promise: Promise<HubHistory> }>()
const HISTORY_CACHE_MS = 15_000

export function fetchNodeHistory(id: string | number, query: HistoryQuery, signal?: AbortSignal): Promise<HubHistory> {
  const hours = Math.max(1, Math.floor(query.hours))
  const points = query.points ? Math.min(1440, Math.max(60, Math.floor(query.points))) : undefined
  const params = new URLSearchParams({ hours: String(hours) })
  if (points)
    params.set('points', String(points))
  if (query.series)
    params.set('series', query.series)
  const url = `/api/nodes/${encodeURIComponent(String(id))}/metrics?${params}`

  // 同一窗口的请求在短时间内合并，避免卡片、详情页和统计各自重复查询
  const cached = historyCache.get(url)
  if (cached && Date.now() - cached.at < HISTORY_CACHE_MS)
    return cached.promise

  const promise = (async () => {
    for (let attempt = 0; ; attempt++) {
      await acquireHistorySlot(signal)
      let res: Response
      try {
        res = await fetch(url, { credentials: 'same-origin', signal, headers: { accept: 'application/json' } })
      }
      finally {
        releaseHistorySlot()
      }
      if (res.status === 503 && attempt < HISTORY_RETRIES) {
        await sleep(400 * 2 ** attempt + Math.random() * 300, signal)
        continue
      }
      if (!res.ok)
        throw await readError(res)
      const body = await res.json() as Partial<HubHistory>
      return {
        metrics: Array.isArray(body.metrics) ? body.metrics : [],
        ping: Array.isArray(body.ping) ? body.ping : [],
        probes: body.probes && typeof body.probes === 'object' ? body.probes : {},
        loss: body.loss && typeof body.loss === 'object' ? body.loss : {},
      } satisfies HubHistory
    }
  })()

  historyCache.set(url, { at: Date.now(), promise })
  promise.catch(() => {
    if (historyCache.get(url)?.promise === promise)
      historyCache.delete(url)
  })
  return promise
}

// ==================== 延迟监控名称 ====================

/** 已见过的延迟监控，按 hub 返回的先后顺序（即面板里的顺序）排列 */
const knownProbes = new Map<number, string>()

export function rememberProbes(history: HubHistory): void {
  // ping 行按面板顺序排列，先按行出现顺序登记，再补上没有数据的监控
  for (const row of history.ping) {
    const name = history.probes[String(row.task_id)]
    if (!knownProbes.has(row.task_id))
      knownProbes.set(row.task_id, name ?? `监控 ${row.task_id}`)
  }
  for (const [id, name] of Object.entries(history.probes)) {
    const numericId = Number(id)
    if (Number.isFinite(numericId))
      knownProbes.set(numericId, name)
  }
}

export function getKnownProbes(): Array<{ id: number, name: string }> {
  return Array.from(knownProbes.entries(), ([id, name]) => ({ id, name }))
}

// ==================== 字段转换 ====================

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/
const MONTH_CYCLE_REGEX = /^\d+m$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** ISO 3166 两位代码 → 旗帜 emoji（主题的地区工具以 emoji 为键） */
export function countryToFlag(code: string | undefined): string {
  const cc = (code ?? '').trim().toUpperCase()
  if (!COUNTRY_CODE_REGEX.test(cc))
    return ''
  return String.fromCodePoint(...Array.from(cc, ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  EUR: '€',
  GBP: '£',
  RUB: '₽',
  CHF: '₣',
  INR: '₹',
  VND: '₫',
  THB: '฿',
  CAD: 'CA$',
}

/** hub 的币种是三位 ISO 代码；主题按「符号 + 金额」显示，未收录的代码保留原样并加空格 */
export function currencySymbol(code: string | undefined): string {
  const cc = (code ?? '').trim().toUpperCase()
  if (!cc)
    return '¥'
  return CURRENCY_SYMBOL[cc] ?? `${cc} `
}

const NAMED_CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
}

/** hub 付款周期（monthly / 60m / once…）→ 主题使用的天数，-1 表示一次性 */
export function billingCycleDays(cycle: string | undefined): number {
  const value = (cycle ?? '').trim()
  if (value === 'once')
    return -1
  const months = NAMED_CYCLE_MONTHS[value] ?? (MONTH_CYCLE_REGEX.test(value) ? Number(value.slice(0, -1)) : Number.NaN)
  if (!Number.isFinite(months) || months <= 0)
    return 30
  switch (months) {
    case 1: return 30
    case 3: return 90
    case 6: return 180
    case 12: return 365
    case 24: return 730
    case 36: return 1095
    case 60: return 1825
    default: return Math.round(months * 30.4375)
  }
}

/**
 * 到期时间。优先用 hub 按自己的日历算好的 expires_in（0 为今天到期，负数为已过期天数），
 * 不拿 expires_at 按访客时钟算，避免访客时区不同导致在线节点提前显示「已过期」。
 *
 * 主题按 ceil(剩余毫秒 / 一天) 显示天数，所以这里构造一个剩余 (N-1, N] 天的时刻：
 * 以当前整点为锚加 N 天。锚在整点上，每轮轮询得到的字符串不变，不会触发重渲染。
 * 今天到期（0）按剩余不足一天处理，显示为临近到期而不是已过期。
 * 旧 hub 没有 expires_in 时才按 expires_at 自己算。null 表示没有到期日。
 */
export function expiryMoment(node: HubNode): string {
  if (node.expires_in !== undefined) {
    if (node.expires_in === null || !Number.isFinite(node.expires_in))
      return ''
    const anchor = new Date()
    anchor.setMinutes(0, 0, 0)
    const days = node.expires_in === 0 ? 23 / 24 : node.expires_in
    return new Date(anchor.getTime() + days * 86_400_000).toISOString()
  }
  const date = str(node.expires_at)
  if (!DATE_REGEX.test(date))
    return ''
  return new Date(`${date}T23:59:59`).toISOString()
}

const TRAFFIC_MODES = new Set(['up', 'down', 'max', 'sum'])

export function hubNodeToClient(node: HubNode): Client {
  const v4 = node.addresses?.find(item => !item.address.includes(':'))?.address ?? str(node.ipv4)
  const v6 = node.addresses?.find(item => item.address.includes(':'))?.address ?? str(node.ipv6)
  return {
    uuid: String(node.id),
    name: str(node.name) || `#${node.id}`,
    cpu_name: str(node.cpu_name),
    virtualization: str(node.virt),
    arch: str(node.arch),
    cpu_cores: num(node.cpu_cores),
    os: str(node.os),
    kernel_version: str(node.kernel),
    ipv4: v4 || undefined,
    ipv6: v6 || undefined,
    region: countryToFlag(node.country),
    remark: str(node.remark) || undefined,
    public_remark: '',
    mem_total: num(node.mem_total),
    swap_total: num(node.swap_total),
    disk_total: num(node.disk_total),
    version: str(node.agent_version) || undefined,
    weight: num(node.sort),
    price: num(node.price),
    billing_cycle: billingCycleDays(node.billing_cycle),
    auto_renewal: false,
    currency: currencySymbol(node.currency),
    expired_at: expiryMoment(node),
    group: str(node.group),
    tags: '',
    hidden: node.public === false,
    traffic_limit: num(node.traffic_limit),
    traffic_limit_type: TRAFFIC_MODES.has(str(node.traffic_mode)) ? str(node.traffic_mode) : 'sum',
    created_at: '',
    updated_at: '',
  }
}

/** 指标完整时返回它，缺失或格式不对时返回 null，由调用方显示为「不可用」 */
function usableMetrics(metrics: HubNode['metrics']): HubMetrics | null {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics))
    return null
  if (typeof metrics.cpu !== 'number' || !Number.isFinite(metrics.cpu))
    return null
  return metrics
}

export function hubNodeToStatus(node: HubNode): NodeStatus {
  const metrics = usableMetrics(node.metrics)
  const load = Array.isArray(metrics?.load) ? metrics.load : []
  const lastSeen = num(node.last_seen)
  return {
    client: String(node.id),
    time: lastSeen > 0 ? new Date(lastSeen * 1000).toISOString() : '',
    cpu: num(metrics?.cpu),
    gpu: 0,
    ram: num(metrics?.mem_used),
    ram_total: num(metrics?.mem_total, num(node.mem_total)),
    swap: num(metrics?.swap_used),
    swap_total: num(metrics?.swap_total, num(node.swap_total)),
    load: num(load[0]),
    load5: num(load[1]),
    load15: num(load[2]),
    temp: 0,
    disk: num(metrics?.disk_used),
    disk_total: num(metrics?.disk_total, num(node.disk_total)),
    net_in: num(metrics?.net_rx),
    net_out: num(metrics?.net_tx),
    // 本期（按流量重置日）流量，与 traffic_limit 配额对应
    net_total_up: num(node.month_tx, num(metrics?.month_tx)),
    net_total_down: num(node.month_rx, num(metrics?.month_rx)),
    // hub 记录以来的累计流量
    traffic_up: num(node.total_tx, num(metrics?.total_tx)),
    traffic_down: num(node.total_rx, num(metrics?.total_rx)),
    process: num(metrics?.procs),
    connections: num(metrics?.tcp),
    connections_udp: num(metrics?.udp),
    online: node.online === true,
    uptime: num(metrics?.uptime),
    // 已连接但尚未上报，或上报的数据不完整
    message: node.online === true && !metrics ? 'unavailable' : undefined,
  }
}

export function snapshotToMaps(snapshot: HubSnapshot): { clients: Record<string, Client>, statuses: Record<string, NodeStatus> } {
  const clients: Record<string, Client> = {}
  const statuses: Record<string, NodeStatus> = {}
  for (const node of snapshot.nodes) {
    if (!node || typeof node.id !== 'number')
      continue
    try {
      const uuid = String(node.id)
      clients[uuid] = hubNodeToClient(node)
      statuses[uuid] = hubNodeToStatus(node)
    }
    catch (error) {
      // 单个节点的坏数据不影响其他节点
      console.warn('[hub] skipped malformed node', node, error)
    }
  }
  return { clients, statuses }
}

// ==================== WebSocket ====================

export interface LiveSocketHandlers {
  onSnapshot: (snapshot: HubSnapshot) => void
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
}

/** 订阅 /api/ws：hub 每 2 秒推送一次与 /api/nodes 相同的快照 */
export function openLiveSocket(handlers: LiveSocketHandlers): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${location.host}/api/ws`)
  socket.addEventListener('open', () => handlers.onOpen?.())
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string')
      return
    try {
      const data = JSON.parse(event.data) as HubSnapshot
      if (data && Array.isArray(data.nodes))
        handlers.onSnapshot(data)
    }
    catch (error) {
      console.warn('[hub] bad websocket frame', error)
    }
  })
  socket.addEventListener('close', event => handlers.onClose?.(event))
  return socket
}
