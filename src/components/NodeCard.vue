<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, getStatus, getUptimeDays } from '@/utils/helper'
import { getDiskPercentage, getMemoryPercentage, getTrafficUsed, getTrafficUsedPercentage, hasTrafficLimit } from '@/utils/nodeMetricsHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatCurrencyValue, formatPrice, getBillingCycleText, getDaysUntilExpired, getExpireStatus, getRemainingValue, isFreePrice, parseTags } from '@/utils/tagHelper'

const props = withDefaults(defineProps<{
  node: NodeData
  gadget?: string
  reduceMotion?: boolean
  pingEnabled?: boolean
}>(), {
  reduceMotion: false,
  pingEnabled: true,
})
const emit = defineEmits<{
  click: []
  pingClick: []
}>()
const appStore = useAppStore()
const isFavorite = computed(() => appStore.isFavoriteNode(props.node.uuid))

function toggleFavorite(): void {
  appStore.toggleFavoriteNode(props.node.uuid)
}

function handleKeyboardOpen(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  handleCardClick()
}

function handleCardClick(): void {
  emit('click')
}

interface RemainingInfoTag {
  icon: string
  text?: string
  prefix?: string
  value?: string
  unit?: string
  className?: string
}

const NODE_METRIC_ICONS = {
  cpu: 'tabler:propeller',
  memory: 'mdi:pocket',
  disk: 'mdi:treasure-chest',
  traffic: 'tabler:door',
} as const

const isMiniNodeCard = computed(() => appStore.nodeCardSize === 'mini')
const nodeCardXSize = computed(() => appStore.nodeCardSize === 'large' ? 'large' : 'medium')
const nodeCardContentClass = computed(() => appStore.nodeCardSize === 'large' ? 'gap-4' : isMiniNodeCard.value ? 'gap-2' : 'gap-3')
const nodeCardContentPaddingClass = computed(() => isMiniNodeCard.value ? 'pb-2' : '')
const nodeCardMetricGridClass = 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(5.5rem,1.1fr)]'
const nodeCardMetricBoxClass = computed(() => isMiniNodeCard.value
  ? 'px-1 py-1'
  : appStore.nodeCardSize === 'compact' ? 'px-1.5 py-1.5' : 'px-2 py-1.5')
const nodeCardPanelClass = computed(() => appStore.nodeCardSize === 'large' ? 'h-14' : appStore.nodeCardSize === 'comfortable' ? 'h-12' : isMiniNodeCard.value ? 'h-7' : 'h-11')
const nodeCardPingPanelClass = computed(() => isMiniNodeCard.value ? 'gap-1 p-1' : 'gap-1.5 p-2')

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => getMemoryPercentage(props.node))
const memStatus = computed(() => getStatus(memPercentage.value))
const swapTooltip = computed(() => {
  const used = formatBytes(Math.max(0, props.node.swap ?? 0))
  const total = Math.max(0, props.node.swap_total ?? 0)
  return total > 0 ? `备用口袋（Swap）已用 ${used} / 总计 ${formatBytes(total)}` : `备用口袋（Swap）已用 ${used}`
})
const diskPercentage = computed(() => getDiskPercentage(props.node))
const diskStatus = computed(() => getStatus(diskPercentage.value))

const {
  latencyRenderBars,
  lossRenderBars,
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
  taskSummaries,
} = useNodePingDisplay(() => props.node.uuid, { enabled: () => props.pingEnabled })

const trafficUsedPercentage = computed(() => getTrafficUsedPercentage(props.node))
const trafficUsed = computed(() => getTrafficUsed(props.node))
const nodeMessage = computed(() => props.node.message?.trim() ?? '')
const nodeMessageTooltip = computed(() => {
  const message = nodeMessage.value
  if (!message)
    return ''
  const updatedAt = props.node.status_updated_at ? `\n更新时间：${formatDateTime(props.node.status_updated_at)}` : ''
  return `${message}${updatedAt}`
})

// 流量状态颜色
const trafficStatus = computed(() => {
  if (!hasTrafficLimit(props.node))
    return 'success'
  if (trafficUsedPercentage.value >= 95)
    return 'error'
  if (trafficUsedPercentage.value >= 80)
    return 'warning'
  if (trafficUsedPercentage.value >= 60)
    return 'info'
  return 'success'
})

const trafficPercentageClass = computed(() => {
  if (!hasTrafficLimit(props.node))
    return 'text-muted-foreground'
  if (trafficUsedPercentage.value >= 95)
    return 'text-destructive'
  if (trafficUsedPercentage.value >= 80)
    return 'text-warning'
  if (trafficUsedPercentage.value >= 60)
    return 'text-warning'
  return 'text-success'
})

// 是否显示金额：未登录且开启「未登录隐藏价格」时不显示价格 / 剩余价值，
// 但在线天数、剩余天数等非金额信息仍然展示
const showPrice = computed(() => appStore.privateFeaturesAllowed || !appStore.hidePriceWhenLoggedOut)

const uptimeDaysText = computed(() => {
  const days = getUptimeDays(props.node.uptime)
  return appStore.lang === 'zh-CN' ? `道具连续工作 ${days} 天` : `ON DUTY · ${days} DAYS`
})

const priceText = computed(() => {
  const node = props.node
  if (node.price === 0 || !showPrice.value)
    return ''
  if (isFreePrice(node.price))
    return appStore.lang === 'zh-CN' ? '免费道具' : 'FREE GADGET'

  const price = formatPrice(node.price, node.currency, appStore.lang)
  const cycle = getBillingCycleText(node.billing_cycle, appStore.lang)
  if (appStore.lang !== 'zh-CN')
    return `${cycle} RENTAL · ${price}`

  const themedCycles: Record<string, string> = {
    月: '月租道具',
    季: '季租道具',
    半年: '半年租道具',
    年: '年租道具',
    两年: '两年租道具',
    三年: '三年租道具',
    五年: '五年租道具',
    一次性: '买断道具',
  }
  return `${themedCycles[cycle] ?? `${cycle}租道具`} · ${price}`
})

// 第三列：剩余天数（始终） + 剩余价值（仅在允许显示金额时），带图标与相邻列对齐
const remainingInfoTags = computed<RemainingInfoTag[]>(() => {
  const node = props.node
  if (node.price === 0)
    return []
  const lang = appStore.lang
  const days = getDaysUntilExpired(node.expired_at)
  const status = getExpireStatus(node.expired_at)
  const items: RemainingInfoTag[] = []
  const expiryClass = status === 'expired' || status === 'critical'
    ? 'text-destructive'
    : status === 'warning' ? 'text-warning' : 'text-muted-foreground'

  if (status === 'unknown') {
    items.push({ icon: 'tabler:calendar-stats', text: '-', className: expiryClass })
  }
  else if (status === 'expired') {
    items.push({ icon: 'tabler:calendar-stats', text: lang === 'zh-CN' ? '租约已到期' : 'RENTAL ENDED', className: expiryClass })
  }
  else if (status === 'long_term') {
    items.push({ icon: 'tabler:calendar-stats', text: lang === 'zh-CN' ? '长期租约' : 'LONG-TERM', className: expiryClass })
  }
  else if (lang === 'zh-CN') {
    items.push({ icon: 'tabler:calendar-stats', prefix: '余期', value: String(days), unit: '天', className: expiryClass })
  }
  else {
    items.push({ icon: 'tabler:calendar-stats', prefix: 'RENT', value: String(days), unit: 'D LEFT', className: expiryClass })
  }

  if (showPrice.value) {
    const value = isFreePrice(node.price)
      ? lang === 'zh-CN' ? '无' : 'N/A'
      : formatCurrencyValue(getRemainingValue(node.price, node.billing_cycle, node.expired_at), node.currency)
    items.push({ icon: 'tabler:coins', prefix: lang === 'zh-CN' ? '余值' : 'VALUE', value })
  }
  return items
})

const customTags = computed(() => parseTags(props.node.tags).map(t => t.text))
const gadgetLabel = computed(() => props.gadget || '神奇道具')

function getRegionAltText(region: string): string {
  return getRegionDisplayName(region) || getRegionCode(region)
}

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}
</script>

<template>
  <CardX
    hoverable
    :size="nodeCardXSize"
    :content-class="nodeCardContentPaddingClass"
    class="node-card w-full cursor-pointer border-none shadow-[0_0_0_3px] shadow-transparent transition-all duration-200 rounded-xl"
    :header-class="['dora-node-head', !props.node.online && 'dora-node-head--sleeping']"
    role="button"
    tabindex="0"
    :aria-label="`查看节点 ${props.node.name} 详情`"
    @click="handleCardClick"
    @keydown="handleKeyboardOpen"
  >
    <!-- 头部：在线点 + 名称 -->
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="dora-node-nose shrink-0"
          :class="props.node.online ? 'dora-node-nose--online' : 'dora-node-nose--sleeping'"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-bold min-w-0 truncate">{{ props.node.name }}</span>
          <span class="dora-node-state" :class="!props.node.online && 'dora-node-state--sleeping'">{{ props.node.online ? '元气满满' : '待机充电中' }}</span>
        </div>
        <DataTooltip
          v-if="nodeMessage"
          :content="nodeMessageTooltip"
          placement="top"
          as="span"
          class="inline-flex shrink-0 text-amber-500"
          content-class="w-56 whitespace-pre-line leading-snug text-left"
        >
          <Icon icon="tabler:alert-triangle-filled" width="14" height="14" aria-label="节点消息" />
        </DataTooltip>
      </div>
    </template>

    <!-- 头部右侧：OS + 国旗 -->
    <template #header-extra>
      <div class="flex gap-1.5 items-center shrink-0">
        <button
          type="button"
          class="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-slate-500/10 hover:text-amber-500"
          :class="isFavorite && 'text-amber-500'"
          :aria-label="isFavorite ? `取消收藏 ${props.node.name}` : `收藏 ${props.node.name}`"
          :title="isFavorite ? '取消收藏' : '收藏节点'"
          @click.stop="toggleFavorite"
          @keydown.stop
        >
          <Icon :icon="isFavorite ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
        </button>
        <span class="dora-node-chip">
          <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-3.5">
        </span>
        <img
          v-if="hasRegion(props.node.region)"
          :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionAltText(props.node.region)"
          class="dora-node-flag size-5 shrink-0"
        >
      </div>
    </template>

    <template #default>
      <div class="flex flex-col relative" :class="nodeCardContentClass">
        <!-- 在线天数固定展示，价格独立展示，避免不同主机卡片高度不一致 -->
        <div class="relative z-20 flex items-center gap-1.5 -mt-1 h-[19px] overflow-hidden">
          <span class="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-muted-foreground leading-tight">
            {{ uptimeDaysText }}
          </span>
          <span
            v-if="priceText"
            class="min-w-0 truncate text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-muted-foreground leading-tight"
          >
            {{ priceText }}
          </span>
        </div>

        <!-- 四项进度条 -->
        <div v-if="isMiniNodeCard" class="grid grid-cols-[3fr_2fr] gap-x-4 gap-y-2">
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-xs">
                <span class="inline-flex items-center text-sky-500" role="img" title="竹蜻蜓转速（CPU）" aria-label="竹蜻蜓转速（CPU）">
                  <Icon :icon="NODE_METRIC_ICONS.cpu" data-node-metric-icon="cpu" width="12" height="12" aria-hidden="true" />
                </span>
                <span class="tabular-nums font-medium">{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
              </div>
              <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            </div>

            <div class="flex flex-col gap-1" :title="swapTooltip">
              <div class="flex justify-between text-xs">
                <span class="inline-flex items-center text-emerald-500" role="img" title="四次元口袋（内存）" aria-label="四次元口袋（内存）">
                  <Icon :icon="NODE_METRIC_ICONS.memory" data-node-metric-icon="memory" width="12" height="12" aria-hidden="true" />
                </span>
                <span class="tabular-nums font-medium">{{ memPercentage.toFixed(1) }}%</span>
              </div>
              <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            </div>

            <div class="col-span-2 text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.traffic" data-node-metric-icon="traffic" width="12" height="12" class="shrink-0 text-violet-500" aria-hidden="true" />
                <span class="truncate" title="任意门流量">任意门</span>
              </span>
              <span class="tabular-nums font-medium" :class="trafficPercentageClass">
                {{ hasTrafficLimit(props.node) ? `${trafficUsedPercentage.toFixed(1)}%` : '∞' }}
              </span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" :status="trafficStatus" :height="4" />
            <div class="text-[11px] truncate" :class="trafficUsedPercentage >= 95 ? 'text-destructive' : 'text-muted-foreground'">
              {{ formatBytes(trafficUsed) }}
              <template v-if="hasTrafficLimit(props.node)">
                / {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                / ∞
              </template>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <!-- 竹蜻蜓转速（CPU） -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.cpu" data-node-metric-icon="cpu" width="13" height="13" class="shrink-0 text-sky-500" aria-hidden="true" />
                <span class="truncate" title="竹蜻蜓转速（CPU）">竹蜻蜓转速</span>
              </span>
              <span class="tabular-nums font-medium">{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate" title="铜锣烧消耗指数（1 / 5 / 15 分钟负载）">
              铜锣烧 {{ (props.node.load ?? 0).toFixed(2) }}, {{ (props.node.load5 ?? 0).toFixed(2) }}, {{ (props.node.load15 ?? 0).toFixed(2) }}
            </div>
          </div>

          <!-- 四次元口袋（内存） -->
          <div class="flex flex-col gap-1" :title="swapTooltip">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.memory" data-node-metric-icon="memory" width="13" height="13" class="shrink-0 text-emerald-500" aria-hidden="true" />
                <span class="truncate" title="四次元口袋（内存）">四次元口袋</span>
              </span>
              <span class="tabular-nums font-medium">{{ memPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <!-- 百宝袋（硬盘） -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.disk" data-node-metric-icon="disk" width="13" height="13" class="shrink-0 text-orange-500" aria-hidden="true" />
                <span class="truncate" title="百宝袋（磁盘）">百宝袋</span>
              </span>
              <span class="tabular-nums font-medium">{{ diskPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
            </div>
          </div>

          <!-- 流量（分级颜色） -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <Icon :icon="NODE_METRIC_ICONS.traffic" data-node-metric-icon="traffic" width="13" height="13" class="shrink-0 text-violet-500" aria-hidden="true" />
                <span class="truncate" title="任意门流量">任意门</span>
              </span>
              <span class="tabular-nums font-medium" :class="trafficPercentageClass">
                {{ hasTrafficLimit(props.node) ? `${trafficUsedPercentage.toFixed(1)}%` : '∞' }}
              </span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" :status="trafficStatus" :height="4" />
            <div class="text-[11px] truncate" :class="trafficUsedPercentage >= 95 ? 'text-destructive' : 'text-muted-foreground'">
              {{ formatBytes(trafficUsed) }}
              <template v-if="hasTrafficLimit(props.node)">
                / {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                / ∞
              </template>
            </div>
          </div>
        </div>

        <!-- 三列：网速 / 总流量 / 剩余天数+价格或负载 -->
        <div class="grid gap-1.5" :class="nodeCardMetricGridClass">
          <!-- 实时网速 -->
          <div class="flex flex-col gap-0.5 rounded-lg bg-slate-500/5 min-w-0 overflow-hidden" :class="nodeCardMetricBoxClass">
            <div class="text-[11px] text-success flex items-center gap-0.5" title="任意门传送 · 上行">
              <Icon icon="tabler:chevron-up" width="11" height="11" />
              <span data-node-compact-metric-value class="truncate min-w-0 overflow-hidden">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
            </div>
            <div class="text-[11px] text-blue-600 flex items-center gap-0.5" title="任意门传送 · 下行">
              <Icon icon="tabler:chevron-down" width="11" height="11" />
              <span data-node-compact-metric-value class="truncate min-w-0 overflow-hidden">{{ formatBytesPerSecond(props.node.net_in ?? 0) }}</span>
            </div>
          </div>

          <!-- 总流量 -->
          <div class="flex flex-col gap-0.5 rounded-lg bg-slate-500/5 min-w-0 overflow-hidden" :class="nodeCardMetricBoxClass">
            <div class="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon icon="tabler:upload" width="11" height="11" />
              <span data-node-compact-metric-value class="truncate min-w-0 overflow-hidden">{{ formatBytes(props.node.net_total_up ?? 0) }}</span>
            </div>
            <div class="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon icon="tabler:download" width="11" height="11" />
              <span data-node-compact-metric-value class="truncate min-w-0 overflow-hidden">{{ formatBytes(props.node.net_total_down ?? 0) }}</span>
            </div>
          </div>

          <!-- 第三列：有价格显示剩余天数+价格，否则显示负载 -->
          <div data-node-remaining-info class="flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg bg-slate-500/5 !px-1" :class="nodeCardMetricBoxClass">
            <template v-if="remainingInfoTags.length">
              <div
                v-for="(item, i) in remainingInfoTags" :key="i"
                data-node-remaining-info-row
                class="flex min-w-0 items-center gap-0 whitespace-nowrap text-[11px]"
                :class="item.className ?? 'text-muted-foreground'"
              >
                <Icon :icon="item.icon" width="11" height="11" class="shrink-0" />
                <span v-if="item.text" class="truncate min-w-0 overflow-hidden">{{ item.text }}</span>
                <template v-else>
                  <span v-if="item.prefix" class="shrink-0">{{ item.prefix }}</span>
                  <span v-if="item.value" class="shrink-0 tabular-nums">{{ item.value }}</span>
                  <span v-if="item.unit" class="shrink-0">{{ item.unit }}</span>
                </template>
              </div>
            </template>
            <template v-else>
              <div class="text-[11px] text-muted-foreground truncate" title="铜锣烧消耗指数（1 分钟负载）">
                <Icon icon="tabler:cookie" width="11" height="11" class="inline -mt-0.5 text-orange-500" />
                {{ (props.node.load ?? 0).toFixed(2) }}
              </div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ (props.node.load5 ?? 0).toFixed(2) }} / {{ (props.node.load15 ?? 0).toFixed(2) }}
              </div>
            </template>
          </div>
        </div>

        <!-- 延迟 + 丢包 -->
        <div
          v-if="taskSummaries.length > 1"
          class="node-ping-task-table min-w-0 overflow-hidden rounded-lg bg-slate-500/5 p-1.5"
          :class="!props.node.online ? 'blur-xs opacity-50' : ''"
          aria-label="分目标任意门延迟与迷路率"
        >
          <div class="node-ping-task-grid mb-1 px-1 text-[9px] leading-none text-muted-foreground/75">
            <span>探测目标</span>
            <span class="text-center">传送延迟</span>
            <span class="text-center">迷路率</span>
          </div>
          <button
            v-for="task in taskSummaries"
            :key="task.id"
            :data-node-ping-task-row="task.id"
            type="button"
            class="node-ping-task-grid w-full items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-slate-500/8"
            :title="`${task.name}\n平均传送延迟 ${Math.round(task.avgLatency)} ms\n平均迷路率 ${task.avgLoss.toFixed(1)}%`"
            :aria-label="`${task.name}，传送延迟 ${Math.round(task.avgLatency)} 毫秒，迷路率 ${task.avgLoss.toFixed(1)}%`"
            @click.stop="emit('pingClick')"
          >
            <span class="break-words pr-1 text-[10px] font-medium leading-tight text-muted-foreground">{{ task.name }}</span>
            <span class="group/panel flex min-w-0 flex-col gap-1 px-1">
              <span class="text-center text-[10px] font-medium leading-none tabular-nums">{{ task.latencyDisplay }}</span>
              <span
                data-node-ping-bars="latency"
                class="grid h-2 min-w-0 w-full items-end gap-[1px] opacity-85 group-hover/panel:opacity-100"
                :style="{ gridTemplateColumns: `repeat(${task.latencyBars.length}, minmax(0, 1fr))` }"
              >
                <DataTooltip
                  v-for="bar in task.latencyBars" :key="bar.key"
                  placement="top" :content="bar.tooltip" class="h-full w-full"
                >
                  <span
                    class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-140 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                    :class="bar.className"
                  />
                </DataTooltip>
              </span>
            </span>

            <span class="group/panel flex min-w-0 flex-col gap-1 px-1">
              <span class="text-center text-[10px] font-medium leading-none tabular-nums">{{ task.lossDisplay }}</span>
              <span
                data-node-ping-bars="loss"
                class="grid h-2 min-w-0 w-full items-end gap-[1px] opacity-85 group-hover/panel:opacity-100"
                :style="{ gridTemplateColumns: `repeat(${task.lossBars.length}, minmax(0, 1fr))` }"
              >
                <DataTooltip
                  v-for="bar in task.lossBars" :key="bar.key"
                  placement="top" :content="bar.tooltip" class="h-full w-full"
                >
                  <span
                    class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-140 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                    :class="bar.className"
                  />
                </DataTooltip>
              </span>
            </span>
          </button>
        </div>

        <div
          v-else-if="taskSummaries.length === 1"
          :data-node-ping-task-row="taskSummaries[0]?.id"
          class="min-w-0"
        >
          <div class="mb-1 truncate px-1 text-[10px] font-medium leading-none text-muted-foreground">
            {{ taskSummaries[0]?.name }}
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              class="group/panel relative flex flex-col rounded-lg bg-slate-500/5"
              :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
              :title="taskSummaries[0]?.hasData ? `${taskSummaries[0].name}\n平均传送延迟 ${Math.round(taskSummaries[0].avgLatency)} ms` : `${taskSummaries[0]?.name}\n暂无采样数据`"
              :aria-label="`${taskSummaries[0]?.name}，传送延迟 ${taskSummaries[0]?.latencyDisplay}`"
              @click.stop="emit('pingClick')"
            >
              <div class="flex items-center justify-between text-[11px] leading-none">
                <span class="text-muted-foreground">传送延迟</span>
                <span class="font-medium">{{ taskSummaries[0]?.latencyDisplay }}</span>
              </div>
              <div
                data-node-ping-bars="latency"
                class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                :style="{ gridTemplateColumns: `repeat(${taskSummaries[0]?.latencyBars.length ?? 0}, minmax(0, 1fr))` }"
              >
                <DataTooltip
                  v-for="bar in taskSummaries[0]?.latencyBars ?? []" :key="bar.key"
                  placement="top" :content="bar.tooltip" class="h-full w-full"
                >
                  <span
                    class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                    :class="bar.className"
                  />
                </DataTooltip>
              </div>
            </button>

            <button
              type="button"
              class="group/panel relative flex flex-col rounded-lg bg-slate-500/5"
              :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
              :title="taskSummaries[0]?.hasData ? `${taskSummaries[0].name}\n平均迷路率 ${taskSummaries[0].avgLoss.toFixed(1)}%` : `${taskSummaries[0]?.name}\n暂无采样数据`"
              :aria-label="`${taskSummaries[0]?.name}，迷路率 ${taskSummaries[0]?.lossDisplay}`"
              @click.stop="emit('pingClick')"
            >
              <div class="flex items-center justify-between text-[11px] leading-none">
                <span class="text-muted-foreground">迷路率</span>
                <span class="font-medium">{{ taskSummaries[0]?.lossDisplay }}</span>
              </div>
              <div
                data-node-ping-bars="loss"
                class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
                :style="{ gridTemplateColumns: `repeat(${taskSummaries[0]?.lossBars.length ?? 0}, minmax(0, 1fr))` }"
              >
                <DataTooltip
                  v-for="bar in taskSummaries[0]?.lossBars ?? []" :key="bar.key"
                  placement="top" :content="bar.tooltip" class="h-full w-full"
                >
                  <span
                    class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                    :class="bar.className"
                  />
                </DataTooltip>
              </div>
            </button>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            class="group/panel relative flex flex-col rounded-lg bg-slate-500/5"
            :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
            :title="latencyPanelTooltip"
            :aria-label="`${props.node.name} 延迟监测`"
            @click.stop="emit('pingClick')"
          >
            <div class="flex items-center justify-between text-[11px] leading-none">
              <span class="text-muted-foreground">传送延迟</span>
              <span class="font-medium">{{ latencyDisplay }}</span>
            </div>
            <div
              data-node-ping-bars="latency"
              class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
              :style="{ gridTemplateColumns: `repeat(${latencyRenderBars.length}, minmax(0, 1fr))` }"
            >
              <DataTooltip
                v-for="bar in latencyRenderBars" :key="bar.key"
                placement="top" :content="bar.tooltip" class="h-full w-full"
              >
                <span
                  class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                  :class="bar.className"
                />
              </DataTooltip>
            </div>
          </button>

          <button
            type="button"
            class="group/panel relative flex flex-col rounded-lg bg-slate-500/5"
            :class="[nodeCardPingPanelClass, nodeCardPanelClass, !props.node.online ? 'blur-xs opacity-50' : '']"
            :title="lossPanelTooltip"
            :aria-label="`${props.node.name} 丢包监测`"
            @click.stop="emit('pingClick')"
          >
            <div class="flex items-center justify-between text-[11px] leading-none">
              <span class="text-muted-foreground">迷路率</span>
              <span class="font-medium">{{ lossDisplay }}</span>
            </div>
            <div
              data-node-ping-bars="loss"
              class="grid min-h-0 min-w-0 w-full flex-1 items-end gap-[1px] opacity-80 group-hover/panel:opacity-100"
              :style="{ gridTemplateColumns: `repeat(${lossRenderBars.length}, minmax(0, 1fr))` }"
            >
              <DataTooltip
                v-for="bar in lossRenderBars" :key="bar.key"
                placement="top" :content="bar.tooltip" class="h-full w-full"
              >
                <span
                  class="block h-full w-full rounded-[1px] transition-transform duration-150 group-hover/data-tooltip:scale-y-160 group-hover/panel:opacity-60 group-hover/data-tooltip:!opacity-100"
                  :class="bar.className"
                />
              </DataTooltip>
            </div>
          </button>
        </div>

        <!-- 自定义标签 -->
        <div v-if="customTags.length > 0 || appStore.gadgetLabelsEnabled" class="flex flex-wrap gap-1">
          <Badge
            v-if="appStore.gadgetLabelsEnabled"
            variant="outline"
            class="dora-gadget-tag !text-[10px] rounded-full px-2 py-0"
            :title="`这台服务器的专属道具：${gadgetLabel}`"
          >
            <Icon icon="tabler:bell-filled" width="10" height="10" aria-hidden="true" />
            {{ gadgetLabel }}
          </Badge>
          <Badge
            v-for="(tag, i) in customTags" :key="i"
            variant="outline"
            class="!text-[11px] rounded-full text-muted-foreground border-muted-foreground/15 px-2 py-0"
          >
            {{ tag }}
          </Badge>
        </div>

        <!-- 离线遮罩 -->
        <div
          v-if="!props.node.online"
          class="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl bg-white/20 dark:bg-black/20 backdrop-blur-[2px]"
        >
          <div class="text-sm font-semibold text-destructive inline-flex items-center gap-1">
            <Icon icon="tabler:battery-charging" width="16" height="16" aria-hidden="true" />
            待机充电中
          </div>
          <div class="text-[11px] text-muted-foreground mt-1">
            {{ offlineTime }}
          </div>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  position: relative;
  overflow: hidden;
}

.dora-node-nose {
  display: inline-block;
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid #ffffff;
  border-radius: 999px;
}

.dora-node-chip {
  display: inline-grid;
  width: 1.25rem;
  height: 1.25rem;
  place-items: center;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 0 rgb(0 40 80 / 0.25);
}

.dora-node-flag {
  border-radius: 3px;
}

/* 在线：哆啦A梦的红鼻子，带高光，轻轻呼吸 */
.dora-node-nose--online {
  background: radial-gradient(circle at 34% 30%, #ffffff 0 18%, #ff5a66 22%, #e60012 62%, #a3000d 100%);
  box-shadow: 0 0 0 2px rgb(230 0 18 / 0.18);
  animation: dora-nose-pulse 2.4s ease-in-out infinite;
}

.dora-node-nose--sleeping {
  background: radial-gradient(circle at 34% 30%, #ffffff 0 16%, #aab7c4 22%, #6b7a89 100%);
}

.dora-node-state {
  align-self: flex-start;
  margin-top: 0.15rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.22);
  padding: 0.05rem 0.4rem;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.dora-node-state--sleeping {
  background: rgb(0 0 0 / 0.14);
  color: rgb(255 255 255 / 0.9);
}

.dora-gadget-tag {
  gap: 0.2rem;
  border-color: rgb(179 134 0 / 0.45) !important;
  background: #fff6c2;
  color: #6b4f00 !important;
}

:global(.dark .dora-gadget-tag) {
  border-color: rgb(255 215 0 / 0.4) !important;
  background: rgb(255 215 0 / 0.12);
  color: #ffe45c !important;
}

.node-ping-task-grid {
  display: grid;
  grid-template-columns: minmax(3rem, 0.62fr) minmax(0, 1fr) minmax(0, 1fr);
}

@keyframes dora-nose-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgb(230 0 18 / 0.18);
  }
  50% {
    box-shadow: 0 0 0 5px rgb(230 0 18 / 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dora-node-nose--online {
    animation: none;
  }
}
</style>
