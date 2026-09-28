/**
 * 主题内部使用的数据类型与数据访问接口
 *
 * 类型沿用主题原有的结构（节点信息 Client、实时状态 NodeStatus、历史记录等），
 * 数据全部来自极简探针 hub 的公开接口，转换逻辑见 ./hub.ts。
 */

import type { HubHistory, HubPingRow } from '@/utils/hub'
import {
  ADMIN_HISTORY_HOURS,
  fetchNodeHistory,
  getKnownProbes,
  HubError,
  PUBLIC_HISTORY_HOURS,
  rememberProbes,
} from '@/utils/hub'

// ==================== 类型定义 ====================

export interface Client {
  uuid: string
  token?: string
  name: string
  cpu_name: string
  virtualization: string
  arch: string
  cpu_cores: number
  cpu_physical_cores?: number
  os: string
  kernel_version: string
  gpu_name?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: string
  created_at: string
  updated_at: string
}

/**
 * 单个 Ping 任务的最新探测汇总
 * 注意：该字段在 getNodesLatestStatus 响应中实际存在，但官方文档与旧类型定义遗漏，键为 task_id 字符串
 */
export interface NodeStatusPing {
  name: string
  /** 最新探测延迟（毫秒）；<0 表示丢包，与 PingRecord.value === -1 同义 */
  latest: number
  avg: number
  tail: number
  /** 丢包率（%） */
  loss: number
  min: number
  max: number
}

export interface GpuDetailedInfo {
  name?: string
  device_name?: string
  device_index?: number
  memory_total?: number
  memory_used?: number
  utilization?: number
  usage?: number
  temperature?: number
}

/** 节点状态 */
export interface NodeStatus {
  client: string
  time: string
  cpu: number
  gpu: number
  gpu_count?: number
  gpu_average_usage?: number
  gpu_detailed_info?: GpuDetailedInfo[]
  ram: number
  ram_total: number
  swap: number
  swap_total: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  disk_total: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  traffic_up?: number
  traffic_down?: number
  process: number
  connections: number
  connections_udp: number
  online: boolean
  uptime: number
  message?: string
  updated_at?: string
  /** 各 Ping 任务最新探测汇总，键为 task_id 字符串 */
  ping?: Record<string, NodeStatusPing>
}

/** 状态记录 */
export interface StatusRecord {
  client: string
  time: string
  cpu: number
  gpu: number
  gpu_count?: number
  gpu_average_usage?: number
  gpu_detailed_info?: GpuDetailedInfo[]
  ram: number
  ram_total: number
  swap: number
  swap_total: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  disk_total: number
  net_in: number
  net_out: number
  /** 桶内最高网速（hub 历史提供） */
  net_in_max?: number
  net_out_max?: number
  net_total_up: number
  net_total_down: number
  traffic_up?: number
  traffic_down?: number
  process: number
  connections: number
  connections_udp: number
}

/** Ping 记录 */
export interface PingRecord {
  client: string
  task_id: number
  time: string
  value: number
}

/** Ping 任务摘要 */
export interface PingTaskInfo {
  id: number
  weight?: number
  name: string
  interval: number
  loss: number
  default_on?: boolean
  clients?: string[]
  p99?: number
  p50?: number
  p99_p50_ratio?: number
  min?: number
  max?: number
  avg?: number
  latest?: number
  total?: number
  valid?: number
  stddev?: number
  loss_approximate?: boolean
  type?: string
}

export interface MetricDefinition {
  name: string
  description: string | Record<string, string>
  type: string
  unit?: string
  retention_days: number
  metadata?: Record<string, string>
  created_at?: string
  updated_at?: string
}

export interface MetricPoint {
  time: string
  value: number | null
  count?: number
  /** @deprecated legacy alias; prefer tags. */
  tag?: Record<string, unknown>
  tags?: Record<string, unknown>
  labels?: Record<string, unknown>
}

export interface MetricSeries {
  metric_key: string
  entity_id: string
  type?: string
  unit?: string
  retention_days?: number
  /** @deprecated legacy alias; prefer tags. */
  tag?: Record<string, unknown>
  tags?: Record<string, unknown>
  downsampled: boolean
  downsample_algorithm?: string
  fill_empty?: boolean
  max_points?: number
  interval_seconds?: number
  count: number
  points: MetricPoint[]
}

export interface MetricQueryParams {
  [key: string]: unknown
  metric_key?: string
  metric_keys?: string[]
  metrics?: string[]
  entity_id?: string
  entity_ids?: string[]
  start?: string | number
  start_time?: string | number
  end?: string | number
  end_time?: string | number
  hours?: number
  tags?: Record<string, unknown>
  downsample?: boolean
  server_downsample?: boolean
  downsample_by_metric?: Record<string, boolean>
  server_downsample_by_metric?: Record<string, boolean>
  fill_empty?: boolean
  max_points?: number
  downsample_points?: number
  max_points_by_metric?: Record<string, number>
  points_by_metric?: Record<string, number>
  aggregation?: string
  downsample_algorithm?: string
  algorithm?: string
  aggregation_by_metric?: Record<string, string>
  downsample_algorithm_by_metric?: Record<string, string>
  algorithm_by_metric?: Record<string, string>
}

export interface MetricQueryResponse {
  start: string
  end: string
  server_downsample_default?: boolean
  default_points?: number
  series: MetricSeries[]
  count: number
}

export interface PingMetricStatsParams {
  [key: string]: unknown
  uuid?: string
  entity_id?: string
  entity_ids?: string[]
  task_id?: string | number
  task_ids?: Array<string | number>
  start?: string | number
  start_time?: string | number
  end?: string | number
  end_time?: string | number
  hours?: number
  max_points?: number
  downsample_points?: number
}

export interface PingMetricTaskStats {
  entity_id: string
  task_id: string
  name?: string
  type?: string
  interval?: number
  tags: Record<string, unknown>
  total: number
  valid: number
  loss: number
  loss_approximate: boolean
  min?: number
  max?: number
  avg?: number
  latest?: number
  p50?: number
  p99?: number
  stddev?: number
  p99_p50_ratio?: number
}

export interface PingMetricStatsResponse {
  start: string
  end: string
  interval_seconds: number
  stats: PingMetricTaskStats[]
  count: number
}

/** RPC 错误 */
export class RpcError extends Error {
  code: number
  data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

/** 方法不存在（与 JSON-RPC 的 -32601 一致），调用方据此回落到兼容路径 */
const METHOD_NOT_FOUND = -32601

function toRpcError(error: unknown): unknown {
  if (error instanceof HubError)
    return new RpcError(error.status, error.message)
  return error
}

// ==================== 节点上下文 ====================

/**
 * 历史记录里只有已用量，总量来自节点快照；汇总查询需要知道当前可见的节点。
 * 由 init 在每次拿到快照时更新。
 */
interface NodeContext {
  mem_total: number
  swap_total: number
  disk_total: number
}

const nodeContext = new Map<string, NodeContext>()
let visibleNodeIds: string[] = []
let historyCeiling = PUBLIC_HISTORY_HOURS

export function updateNodeContext(statuses: Record<string, NodeStatus>, authed: boolean): void {
  historyCeiling = authed ? ADMIN_HISTORY_HOURS : PUBLIC_HISTORY_HOURS
  visibleNodeIds = Object.keys(statuses)
  for (const [uuid, status] of Object.entries(statuses)) {
    nodeContext.set(uuid, {
      mem_total: status.ram_total,
      swap_total: status.swap_total,
      disk_total: status.disk_total,
    })
    recordLiveSample(status)
  }
}

export function getHistoryCeilingHours(): number {
  return historyCeiling
}

// ==================== 实时采样缓冲 ====================

/**
 * 实时图表使用浏览器收到的每一帧快照，这样负载、TCP/UDP、进程数等 hub 历史里没有的
 * 指标在实时视图中也有曲线。刚打开页面、缓冲还不够时，用最近 1 小时的历史补齐。
 */
const LIVE_BUFFER_SIZE = 150
const liveSamples = new Map<string, StatusRecord[]>()

function recordLiveSample(status: NodeStatus): void {
  if (!status.online || status.message === 'unavailable' || !status.time)
    return
  const buffer = liveSamples.get(status.client) ?? []
  const last = buffer.at(-1)
  if (last && last.time >= status.time)
    return
  buffer.push({
    client: status.client,
    time: status.time,
    cpu: status.cpu,
    gpu: Number.NaN,
    ram: status.ram,
    ram_total: status.ram_total,
    swap: status.swap,
    swap_total: status.swap_total,
    load: status.load,
    load5: status.load5,
    load15: status.load15,
    temp: Number.NaN,
    disk: status.disk,
    disk_total: status.disk_total,
    net_in: status.net_in,
    net_out: status.net_out,
    net_total_up: status.net_total_up,
    net_total_down: status.net_total_down,
    traffic_up: status.traffic_up,
    traffic_down: status.traffic_down,
    process: status.process,
    connections: status.connections,
    connections_udp: status.connections_udp,
  })
  if (buffer.length > LIVE_BUFFER_SIZE)
    buffer.splice(0, buffer.length - LIVE_BUFFER_SIZE)
  liveSamples.set(status.client, buffer)
}

// ==================== 历史转换 ====================

/** hub 历史只保存 CPU、内存、磁盘和网速；其余指标以 NaN 表示「没有数据」，图表会跳过 */
function historyToStatusRecords(uuid: string, history: HubHistory): StatusRecord[] {
  const context = nodeContext.get(uuid)
  return history.metrics.map(row => ({
    client: uuid,
    time: new Date(row.ts * 1000).toISOString(),
    cpu: row.cpu,
    gpu: Number.NaN,
    ram: row.mem_used,
    ram_total: context?.mem_total ?? 0,
    swap: Number.NaN,
    swap_total: context?.swap_total ?? 0,
    load: Number.NaN,
    load5: Number.NaN,
    load15: Number.NaN,
    temp: Number.NaN,
    disk: row.disk_used,
    disk_total: context?.disk_total ?? 0,
    net_in: row.net_rx,
    net_out: row.net_tx,
    net_in_max: row.net_rx_max,
    net_out_max: row.net_tx_max,
    net_total_up: Number.NaN,
    net_total_down: Number.NaN,
    process: Number.NaN,
    connections: Number.NaN,
    connections_udp: Number.NaN,
  }))
}

/**
 * 兼容路径的延迟记录：每个时间桶一条，桶内全部丢失时记为 -1。
 * 桶内部分丢失的比例只有指标路径（ping.loss）能表达，见 queryPublicMetrics。
 */
function pingRowsToRecords(uuid: string, rows: HubPingRow[]): PingRecord[] {
  return rows.map(row => ({
    client: uuid,
    task_id: row.task_id,
    time: new Date(row.ts * 1000).toISOString(),
    value: typeof row.latency === 'number' ? row.latency : -1,
  }))
}

function percentile(sorted: number[], p: number): number | undefined {
  if (!sorted.length)
    return undefined
  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const a = sorted[lower]!
  const b = sorted[upper]!
  return a + (b - a) * (position - lower)
}

function pingStatsFor(uuid: string, history: HubHistory): PingMetricTaskStats[] {
  const byTask = new Map<number, HubPingRow[]>()
  for (const row of history.ping) {
    const rows = byTask.get(row.task_id) ?? []
    rows.push(row)
    byTask.set(row.task_id, rows)
  }
  // 分配了监控但窗口内没有任何结果的，同样列出
  for (const id of Object.keys(history.probes)) {
    const numericId = Number(id)
    if (Number.isFinite(numericId) && !byTask.has(numericId))
      byTask.set(numericId, [])
  }

  return Array.from(byTask.entries(), ([taskId, rows]) => {
    const latencies = rows.map(row => row.latency).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const sorted = [...latencies].sort((a, b) => a - b)
    const avg = latencies.length ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length : undefined
    const stddev = avg !== undefined && latencies.length
      ? Math.sqrt(latencies.reduce((sum, v) => sum + (v - avg) ** 2, 0) / latencies.length)
      : undefined
    const p50 = percentile(sorted, 0.5)
    const p99 = percentile(sorted, 0.99)
    const latest = [...rows].reverse().find(row => typeof row.latency === 'number')?.latency ?? undefined
    return {
      entity_id: uuid,
      task_id: String(taskId),
      name: history.probes[String(taskId)] ?? `监控 ${taskId}`,
      tags: { task_id: String(taskId) },
      total: rows.length,
      valid: latencies.length,
      // hub 按整个窗口的样本数算出的丢包率，比按桶平均更准确；没有丢包的监控不在 loss 里
      loss: history.loss[String(taskId)] ?? 0,
      loss_approximate: false,
      min: sorted[0],
      max: sorted.at(-1),
      avg,
      latest: latest ?? undefined,
      p50,
      p99,
      stddev,
      p99_p50_ratio: p50 && p99 ? p99 / p50 : undefined,
    }
  })
}

/** 自定义时间段：hub 只接受「最近 N 小时」，取覆盖起点的窗口后再裁剪 */
function resolveRange(params: { hours?: number, start?: string | number, start_time?: string | number, end?: string | number, end_time?: string | number }): { hours: number, from: number, to: number } {
  const startValue = params.start ?? params.start_time
  const endValue = params.end ?? params.end_time
  const now = Date.now()
  if (startValue !== undefined) {
    const from = new Date(startValue).getTime()
    const to = endValue !== undefined ? new Date(endValue).getTime() : now
    if (Number.isFinite(from)) {
      const hours = Math.min(historyCeiling, Math.max(1, Math.ceil((now - from) / 3_600_000)))
      return { hours, from, to: Number.isFinite(to) ? to : now }
    }
  }
  const hours = Math.min(historyCeiling, Math.max(1, Math.floor(params.hours ?? 6)))
  return { hours, from: Number.NEGATIVE_INFINITY, to: Number.POSITIVE_INFINITY }
}

function withinRange(history: HubHistory, from: number, to: number): HubHistory {
  if (!Number.isFinite(from) && !Number.isFinite(to))
    return history
  const keep = (ts: number) => ts * 1000 >= from && ts * 1000 <= to
  return {
    ...history,
    metrics: history.metrics.filter(row => keep(row.ts)),
    ping: history.ping.filter(row => keep(row.ts)),
  }
}

const PING_LATENCY_KEY = 'ping.latency_ms'
const PING_LOSS_KEY = 'ping.loss'

// ==================== 数据访问 ====================

export class HubRpc {
  /** 单节点最近的状态：实时缓冲 + 最近 1 小时历史 */
  async getNodeRecentStatus(uuid: string): Promise<{ count: number, records: StatusRecord[] }> {
    const live = liveSamples.get(uuid) ?? []
    let records = [...live]
    if (live.length < LIVE_BUFFER_SIZE) {
      try {
        const history = await fetchNodeHistory(uuid, { hours: 1, series: 'metrics' })
        const firstLive = live[0]?.time
        const older = historyToStatusRecords(uuid, history).filter(record => !firstLive || record.time < firstLive)
        records = [...older, ...live].slice(-LIVE_BUFFER_SIZE)
      }
      catch (error) {
        if (!live.length)
          throw toRpcError(error)
      }
    }
    return { count: records.length, records }
  }

  /** 负载历史。未指定节点时逐个查询当前可见节点（经过并发队列） */
  async getLoadRecords(uuid?: string, hours = 6, _loadType?: string, maxCount?: number, signal?: AbortSignal): Promise<{ records: StatusRecord[] | Record<string, StatusRecord[]> }> {
    const safeHours = Math.min(historyCeiling, Math.max(1, Math.floor(hours)))
    const points = maxCount ? Math.min(1440, maxCount) : undefined
    const ids = uuid ? [uuid] : visibleNodeIds
    try {
      const entries = await Promise.all(ids.map(async (id) => {
        const history = await fetchNodeHistory(id, { hours: safeHours, points, series: 'metrics' }, signal)
        return [id, historyToStatusRecords(id, history)] as const
      }))
      if (uuid)
        return { records: entries[0]?.[1] ?? [] }
      return { records: Object.fromEntries(entries) }
    }
    catch (error) {
      throw toRpcError(error)
    }
  }

  /** 延迟历史（兼容路径） */
  async getPingRecords(taskId?: number, hours = 6, maxCount?: number, signal?: AbortSignal, uuid?: string): Promise<{ records: PingRecord[], tasks?: PingTaskInfo[] }> {
    const safeHours = Math.min(historyCeiling, Math.max(1, Math.floor(hours)))
    const points = maxCount ? Math.min(1440, maxCount) : undefined
    const ids = uuid ? [uuid] : visibleNodeIds
    try {
      const histories = await Promise.all(ids.map(async id => [id, await fetchNodeHistory(id, { hours: safeHours, points, series: 'ping' }, signal)] as const))
      const records: PingRecord[] = []
      const taskMap = new Map<number, PingTaskInfo>()
      for (const [id, history] of histories) {
        rememberProbes(history)
        const rows = taskId === undefined ? history.ping : history.ping.filter(row => row.task_id === taskId)
        records.push(...pingRowsToRecords(id, rows))
        for (const stat of pingStatsFor(id, history)) {
          const numericId = Number(stat.task_id)
          if (!taskMap.has(numericId))
            taskMap.set(numericId, { id: numericId, name: stat.name ?? `监控 ${numericId}`, interval: 0, loss: stat.loss })
        }
      }
      return { records, tasks: [...taskMap.values()] }
    }
    catch (error) {
      throw toRpcError(error)
    }
  }

  /** 已知的延迟监控（名称随各节点的历史一起返回，按面板顺序） */
  async getPublicPingTasks(): Promise<PingTaskInfo[]> {
    return getKnownProbes().map(probe => ({ id: probe.id, name: probe.name, interval: 0, loss: 0 }))
  }

  /** 指标目录：hub 按桶给出延迟中位数和丢包率，对应主题的 ping 指标 */
  async listPublicMetricDefinitions(): Promise<MetricDefinition[]> {
    return [
      { name: PING_LATENCY_KEY, description: '延迟', type: 'gauge', unit: 'ms', retention_days: 0 },
      { name: PING_LOSS_KEY, description: '丢包率', type: 'gauge', unit: 'ratio', retention_days: 0 },
    ]
  }

  /** 指标查询：只支持延迟相关的两个 key，其他 key 没有序列，调用方会回落到负载历史 */
  async queryPublicMetrics(params: MetricQueryParams, signal?: AbortSignal): Promise<MetricQueryResponse> {
    const keys = new Set([...(params.metric_keys ?? []), ...(params.metrics ?? []), ...(params.metric_key ? [params.metric_key] : [])])
    const wantsLatency = keys.has(PING_LATENCY_KEY)
    const wantsLoss = keys.has(PING_LOSS_KEY)
    const entity = params.entity_id ?? params.entity_ids?.[0]
    const { hours, from, to } = resolveRange(params)
    if (!entity || (!wantsLatency && !wantsLoss))
      throw new RpcError(METHOD_NOT_FOUND, 'metric not available on this hub')

    const maxPoints = params.max_points ?? params.downsample_points
    let history: HubHistory
    try {
      history = withinRange(await fetchNodeHistory(entity, { hours, points: maxPoints, series: 'ping' }, signal), from, to)
    }
    catch (error) {
      throw toRpcError(error)
    }
    rememberProbes(history)

    const series: MetricSeries[] = []
    const byTask = new Map<number, HubPingRow[]>()
    for (const row of history.ping) {
      const rows = byTask.get(row.task_id) ?? []
      rows.push(row)
      byTask.set(row.task_id, rows)
    }
    for (const [taskId, rows] of byTask) {
      const tags = { task_id: String(taskId), name: history.probes[String(taskId)] ?? `监控 ${taskId}` }
      if (wantsLatency) {
        series.push({
          metric_key: PING_LATENCY_KEY,
          entity_id: entity,
          unit: 'ms',
          tags,
          downsampled: true,
          count: rows.length,
          points: rows.map(row => ({ time: new Date(row.ts * 1000).toISOString(), value: row.latency ?? null })),
        })
      }
      if (wantsLoss) {
        series.push({
          metric_key: PING_LOSS_KEY,
          entity_id: entity,
          unit: 'ratio',
          tags,
          downsampled: true,
          count: rows.length,
          // hub 的桶丢包率是百分比整数，主题的 ping.loss 是 0-1 比例
          points: rows.map(row => ({ time: new Date(row.ts * 1000).toISOString(), value: (row.loss ?? 0) / 100, count: 1 })),
        })
      }
    }

    return {
      start: new Date(Number.isFinite(from) ? from : Date.now() - hours * 3_600_000).toISOString(),
      end: new Date(Number.isFinite(to) ? to : Date.now()).toISOString(),
      series,
      count: series.length,
    }
  }

  /** 每个延迟监控在窗口内的统计 */
  async getPublicPingMetricStats(params: PingMetricStatsParams, signal?: AbortSignal): Promise<PingMetricStatsResponse> {
    const entity = params.uuid ?? params.entity_id ?? params.entity_ids?.[0]
    if (!entity)
      throw new RpcError(METHOD_NOT_FOUND, 'ping stats need a node')
    const { hours, from, to } = resolveRange(params)
    const maxPoints = params.max_points ?? params.downsample_points
    let history: HubHistory
    try {
      history = await fetchNodeHistory(entity, { hours, points: maxPoints, series: 'ping' }, signal)
    }
    catch (error) {
      throw toRpcError(error)
    }
    rememberProbes(history)
    const ranged = withinRange(history, from, to)
    // 裁剪过的自定义时间段不能沿用整窗的丢包率，改按桶估算
    const trimmed = ranged.ping.length !== history.ping.length
    const stats = pingStatsFor(entity, trimmed ? { ...ranged, loss: {} } : history).map((stat) => {
      if (!trimmed)
        return stat
      const rows = ranged.ping.filter(row => String(row.task_id) === stat.task_id)
      const loss = rows.length ? rows.reduce((sum, row) => sum + (row.loss ?? (row.latency === null ? 100 : 0)), 0) / rows.length : 0
      return { ...stat, loss, loss_approximate: true }
    })
    return {
      start: new Date(Number.isFinite(from) ? from : Date.now() - hours * 3_600_000).toISOString(),
      end: new Date(Number.isFinite(to) ? to : Date.now()).toISOString(),
      interval_seconds: 60,
      stats,
      count: stats.length,
    }
  }
}

// 单例实例
let sharedRpc: HubRpc | null = null

export function getSharedRpc(): HubRpc {
  if (!sharedRpc)
    sharedRpc = new HubRpc()
  return sharedRpc
}
