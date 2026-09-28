import type { PingRecord, PingTaskInfo, StatusRecord } from '@/utils/rpc'
import { requestManager } from '@/services/request.service'
import { ApiError } from '@/utils/api'
import { getSharedRpc, RpcError } from '@/utils/rpc'

/** hub 历史里没有的指标以 NaN 标记，保留下来让图表按「无数据」处理，而不是画成 0 */
function numberOrMissing(value: unknown): number {
  if (typeof value === 'number')
    return Number.isNaN(value) || Number.isFinite(value) ? value : 0
  return 0
}

function normalizeHours(hours: number): number {
  return Math.max(1, Math.floor(hours))
}

function normalizeMaxCount(maxCount: number | null | undefined): number | undefined {
  if (typeof maxCount !== 'number' || !Number.isFinite(maxCount) || maxCount <= 0)
    return undefined
  return Math.floor(maxCount)
}

function cachePart(value: string | number | undefined): string {
  return value === undefined ? 'all' : String(value)
}

function shouldRetryHistoryRequest(error: unknown): boolean {
  if (error instanceof RpcError)
    return error.code !== 401 && error.code !== 403
  if (error instanceof ApiError)
    return error.code !== 401 && error.code !== 403
  return true
}

type StatusRecordsPayload = Array<Partial<StatusRecord>> | Record<string, Array<Partial<StatusRecord>>>

function isStatusRecordsMap(records: StatusRecordsPayload): records is Record<string, Array<Partial<StatusRecord>>> {
  return !Array.isArray(records)
}

export function normalizeStatusRecordsPayload(records: StatusRecordsPayload | undefined): StatusRecord[] {
  if (!records)
    return []

  if (Array.isArray(records))
    return normalizeStatusRecords(records)

  if (isStatusRecordsMap(records))
    return Object.values(records).flatMap(clientRecords => normalizeStatusRecords(clientRecords))

  return []
}

export function getLoadRecordsRequestKey(uuid: string | undefined, hours: number, maxCount?: number): string {
  return `history:load:${cachePart(uuid)}:${normalizeHours(hours)}:${cachePart(normalizeMaxCount(maxCount))}`
}

export function getNodeLoadRecordsRequestKey(uuid: string, hours: number, maxCount?: number): string {
  return `history:node-load:${uuid}:${normalizeHours(hours)}:${cachePart(normalizeMaxCount(maxCount))}`
}

export function getPingRecordsRequestKey(hours: number, maxCount?: number, uuid?: string): string {
  return `history:ping:${cachePart(uuid)}:${normalizeHours(hours)}:${cachePart(normalizeMaxCount(maxCount))}`
}

export function abortLoadRecords(uuid: string | undefined, hours: number, maxCount?: number): void {
  requestManager.abort(getLoadRecordsRequestKey(uuid, hours, maxCount))
}

export function abortNodeLoadRecords(uuid: string, hours: number, maxCount?: number): void {
  requestManager.abort(getNodeLoadRecordsRequestKey(uuid, hours, maxCount))
}

export function abortPingRecords(hours: number, maxCount?: number, uuid?: string): void {
  requestManager.abort(getPingRecordsRequestKey(hours, maxCount, uuid))
  requestManager.abort(`${getPingRecordsRequestKey(hours, maxCount, uuid)}:tasks`)
}

export function normalizeStatusRecord(record: Partial<StatusRecord>): StatusRecord | null {
  if (!record.client || !record.time)
    return null

  return {
    client: record.client,
    time: record.time,
    cpu: numberOrMissing(record.cpu),
    gpu: numberOrMissing(record.gpu),
    ram: numberOrMissing(record.ram),
    ram_total: numberOrMissing(record.ram_total),
    swap: numberOrMissing(record.swap),
    swap_total: numberOrMissing(record.swap_total),
    load: numberOrMissing(record.load),
    load5: numberOrMissing(record.load5 ?? record.load),
    load15: numberOrMissing(record.load15 ?? record.load5 ?? record.load),
    temp: numberOrMissing(record.temp),
    disk: numberOrMissing(record.disk),
    disk_total: numberOrMissing(record.disk_total),
    net_in: numberOrMissing(record.net_in),
    net_out: numberOrMissing(record.net_out),
    net_in_max: typeof record.net_in_max === 'number' ? record.net_in_max : undefined,
    net_out_max: typeof record.net_out_max === 'number' ? record.net_out_max : undefined,
    net_total_up: numberOrMissing(record.net_total_up),
    net_total_down: numberOrMissing(record.net_total_down),
    traffic_up: numberOrMissing(record.traffic_up),
    traffic_down: numberOrMissing(record.traffic_down),
    process: numberOrMissing(record.process),
    connections: numberOrMissing(record.connections),
    connections_udp: numberOrMissing(record.connections_udp),
  }
}

export function normalizeStatusRecords(records: Array<Partial<StatusRecord>> | undefined): StatusRecord[] {
  return (records ?? [])
    .map(normalizeStatusRecord)
    .filter((record): record is StatusRecord => Boolean(record))
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
}

export function buildRecordsByClient(records: StatusRecord[]): Map<string, StatusRecord[]> {
  const grouped = new Map<string, StatusRecord[]>()
  for (const record of records) {
    const clientRecords = grouped.get(record.client) ?? []
    clientRecords.push(record)
    grouped.set(record.client, clientRecords)
  }
  return grouped
}

export async function loadLoadRecords(uuid: string | undefined, hours: number, maxCount?: number): Promise<StatusRecord[]> {
  const safeHours = normalizeHours(hours)
  const safeMaxCount = normalizeMaxCount(maxCount)
  return requestManager.run(
    getLoadRecordsRequestKey(uuid, safeHours, safeMaxCount),
    async (signal) => {
      const result = await getSharedRpc().getLoadRecords(uuid, safeHours, undefined, safeMaxCount, signal)
      return normalizeStatusRecordsPayload(result.records)
    },
    { shouldRetry: shouldRetryHistoryRequest },
  )
}

export async function loadNodeLoadRecords(uuid: string, hours: number, maxCount?: number): Promise<StatusRecord[]> {
  const safeHours = normalizeHours(hours)
  const safeMaxCount = normalizeMaxCount(maxCount)
  return requestManager.run(
    getNodeLoadRecordsRequestKey(uuid, safeHours, safeMaxCount),
    async (signal) => {
      const result = await getSharedRpc().getLoadRecords(uuid, safeHours, undefined, safeMaxCount, signal)
      return normalizeStatusRecordsPayload(result.records)
    },
    { shouldRetry: shouldRetryHistoryRequest },
  )
}

export async function loadPingRecords(hours: number, maxCount?: number, uuid?: string): Promise<PingRecord[]> {
  const safeHours = normalizeHours(hours)
  const safeMaxCount = normalizeMaxCount(maxCount)
  return requestManager.run(
    getPingRecordsRequestKey(safeHours, safeMaxCount, uuid),
    async (signal) => {
      const result = await getSharedRpc().getPingRecords(undefined, safeHours, safeMaxCount, signal, uuid)
      return result.records ?? []
    },
    { shouldRetry: shouldRetryHistoryRequest },
  )
}

export async function loadPingRecordsWithTasks(hours: number, maxCount?: number, uuid?: string): Promise<{ records: PingRecord[], tasks: PingTaskInfo[] }> {
  const safeHours = normalizeHours(hours)
  const safeMaxCount = normalizeMaxCount(maxCount)
  return requestManager.run(
    `${getPingRecordsRequestKey(safeHours, safeMaxCount, uuid)}:tasks`,
    async (signal) => {
      const result = await getSharedRpc().getPingRecords(undefined, safeHours, safeMaxCount, signal, uuid)
      return {
        records: result.records ?? [],
        tasks: result.tasks ?? [],
      }
    },
    { shouldRetry: shouldRetryHistoryRequest },
  )
}
