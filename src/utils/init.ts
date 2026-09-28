/**
 * 应用初始化模块
 * 负责启动时的并行请求，以及之后的实时数据：HTTP 轮询 /api/nodes 或订阅 /api/ws。
 */

import type { HubSnapshot } from '@/utils/hub'
import { REALTIME_CONFIG } from '@/constants/realtime'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getSharedApi } from '@/utils/api'
import { fetchNodes, HubError, openLiveSocket, snapshotToMaps } from '@/utils/hub'
import { updateNodeContext } from '@/utils/rpc'

const WS_RECONNECT_INTERVAL_MS = REALTIME_CONFIG.websocket.reconnectInterval
const WS_MAX_RECONNECT_ATTEMPTS = REALTIME_CONFIG.websocket.maxReconnectAttempts
const POST_FAILURE_THRESHOLD = REALTIME_CONFIG.polling.postFailureThreshold

class InitManager {
  private appStore = useAppStore()
  private nodesStore = useNodesStore()
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private socket: WebSocket | null = null
  private useWebSocket = false
  private isPolling = false
  private destroyed = false
  private isInitialized = false
  private failureCount = 0
  private redirecting = false

  async init(): Promise<void> {
    this.destroyed = false
    if (this.isInitialized)
      return

    try {
      await this.runStartupRequests()
      if (this.destroyed || this.redirecting)
        return
      // 首次请求失败也启动实时连接，以便自动恢复
      this.startRealtime()
      this.isInitialized = true
    }
    catch (error) {
      console.error('[InitManager] Initialization failed:', error)
      this.appStore.connectionError = true
      throw error
    }
    finally {
      this.appStore.loading = false
    }
  }

  /** /api/me、主题设置、/api/nodes 三者并行，任一失败不阻断其他 */
  private async runStartupRequests(): Promise<boolean> {
    const api = getSharedApi()
    const [, , nodesResult] = await Promise.allSettled([
      api.getPublicSettings().then((settings) => {
        this.appStore.publicSettings = settings
      }),
      api.getMe().then((me) => {
        this.appStore.updateLoginState(me.logged_in, me)
      }).catch(() => {
        this.appStore.updateLoginState(false)
      }),
      fetchNodes(),
    ])

    if (this.destroyed)
      return false

    if (nodesResult.status === 'rejected') {
      const error = nodesResult.reason
      // 公开状态页已关闭且未登录：交给 hub 内置的后台登录页
      if (error instanceof HubError && error.status === 401) {
        this.redirecting = true
        location.href = '/admin'
        return false
      }
      console.error('[InitManager] Failed to fetch nodes:', error)
      this.appStore.connectionError = true
      return false
    }

    this.applySnapshot(nodesResult.value, true)
    this.appStore.connectionError = false
    this.failureCount = 0
    return true
  }

  async retry(): Promise<boolean> {
    if (this.destroyed || this.redirecting)
      return false
    const recovered = await this.runStartupRequests()
    if (!this.isInitialized && !this.destroyed && !this.redirecting) {
      this.startRealtime()
      this.isInitialized = true
    }
    return recovered
  }

  private applySnapshot(snapshot: HubSnapshot, initial = false): void {
    const { clients, statuses } = snapshotToMaps(snapshot)
    const authed = snapshot.admin ?? this.appStore.isLoggedIn
    updateNodeContext(statuses, authed)
    if (initial) {
      this.nodesStore.initNodes(clients, statuses)
    }
    else {
      this.nodesStore.updateNodeClients(clients)
      this.nodesStore.updateNodeStatuses(statuses)
    }
  }

  // ==================== 实时数据 ====================

  private startRealtime(): void {
    this.useWebSocket = this.appStore.rpcTransportMode === 'websocket' && typeof WebSocket !== 'undefined'
    if (this.useWebSocket)
      this.connectWebSocket()
    else
      this.schedulePoll()
  }

  private connectWebSocket(): void {
    if (this.destroyed || !this.useWebSocket)
      return

    this.nodesStore.updateWsState('connecting', this.nodesStore.wsReconnectAttempts)
    let opened = false
    this.socket = openLiveSocket({
      onOpen: () => {
        opened = true
        this.nodesStore.updateWsState('connected', 0)
        this.appStore.connectionError = false
      },
      onSnapshot: (snapshot) => {
        this.applySnapshot(snapshot)
        this.failureCount = 0
        this.appStore.connectionError = false
      },
      onClose: () => {
        this.socket = null
        if (this.destroyed || !this.useWebSocket)
          return
        // 登录会话失效或公开页被关闭时 hub 会主动断开，重新确认一次登录状态
        void getSharedApi().getMe().then(me => this.appStore.updateLoginState(me.logged_in, me)).catch(() => {})
        this.nodesStore.updateWsState('disconnected')
        this.scheduleReconnect(opened)
      },
    })
  }

  private scheduleReconnect(wasOpen: boolean): void {
    if (this.destroyed || this.reconnectTimer)
      return

    const attempts = wasOpen ? 0 : this.nodesStore.wsReconnectAttempts
    if (attempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      this.fallbackToPolling()
      return
    }
    if (attempts === 0 && !wasOpen)
      window.$message?.error('WebSocket 建立失败，正在尝试重连。')

    const next = attempts + 1
    this.nodesStore.updateWsState('reconnecting', next)
    const backoff = Math.min(WS_RECONNECT_INTERVAL_MS * 2 ** Math.max(0, next - 1), 30_000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectWebSocket()
    }, backoff)
  }

  private fallbackToPolling(): void {
    console.error('[InitManager] WebSocket unavailable, falling back to HTTP polling')
    this.useWebSocket = false
    this.nodesStore.updateWsState('disconnected', WS_MAX_RECONNECT_ATTEMPTS)
    window.$message?.warning('WebSocket 无法连接，已改用 HTTP 轮询。')
    this.schedulePoll()
  }

  private schedulePoll(): void {
    if (this.pollTimer)
      clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(async () => {
      await this.poll()
      if (!this.destroyed && !this.useWebSocket)
        this.schedulePoll()
    }, this.appStore.dataUpdateInterval * 1000)
  }

  private async poll(): Promise<void> {
    if (this.isPolling)
      return
    this.isPolling = true
    try {
      this.applySnapshot(await fetchNodes())
      this.failureCount = 0
      this.appStore.connectionError = false
    }
    catch (error) {
      console.error('[InitManager] Poll error:', error)
      this.failureCount += 1
      this.appStore.connectionError = this.failureCount >= POST_FAILURE_THRESHOLD
    }
    finally {
      this.isPolling = false
    }
  }

  destroy(): void {
    this.destroyed = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.useWebSocket = false
    this.socket?.close()
    this.socket = null
    this.nodesStore.clearNodes()
    this.isInitialized = false
  }
}

let initManager: InitManager | null = null

export async function initApp(): Promise<void> {
  if (!initManager)
    initManager = new InitManager()
  await initManager.init()
}

export async function retryInitApp(): Promise<boolean> {
  if (!initManager)
    initManager = new InitManager()
  return initManager.retry()
}

export function destroyInitManager(): void {
  if (initManager) {
    initManager.destroy()
    initManager = null
  }
}
