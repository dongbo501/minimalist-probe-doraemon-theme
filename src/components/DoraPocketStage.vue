<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AnywhereDoorMap from '@/components/AnywhereDoorMap.vue'
import { useAppStore } from '@/stores/app'

type EasterVariant = 'pocket' | 'door'

const props = defineProps<{ nodes?: NodeData[] }>()
const appStore = useAppStore()
const easterActive = ref(false)
const easterVariant = ref<EasterVariant>('pocket')
let easterTimer: ReturnType<typeof setTimeout> | null = null

// 从口袋里飞出的道具：图标 + 名称，沿不同角度抛出
const POCKET_GADGETS = [
  { icon: 'tabler:propeller', name: '竹蜻蜓' },
  { icon: 'tabler:door', name: '任意门' },
  { icon: 'tabler:clock-play', name: '时光机' },
  { icon: 'tabler:bulb', name: '缩小灯' },
  { icon: 'tabler:bread', name: '记忆面包' },
  { icon: 'tabler:language', name: '翻译魔芋' },
  { icon: 'tabler:wind', name: '空气炮' },
  { icon: 'tabler:cookie', name: '铜锣烧' },
] as const

const onlineCount = computed(() => (props.nodes ?? []).filter(node => node.online).length)
const totalCount = computed(() => (props.nodes ?? []).length)
const isDoorEaster = computed(() => easterVariant.value === 'door')
const easterTitle = computed(() => isDoorEaster.value ? '任意门，去往任何地方！' : '当当当～四次元口袋！')
const easterSubtitle = computed(() => {
  if (totalCount.value === 0)
    return '口袋里暂时还没有道具'
  if (onlineCount.value === totalCount.value)
    return `${totalCount.value} 件道具全部元气满满`
  return `${onlineCount.value} / ${totalCount.value} 件道具元气满满，其余正在待机充电`
})

function revealEasterEgg(event?: Event): void {
  const detail = event instanceof CustomEvent ? event.detail as { variant?: string } | undefined : undefined
  easterVariant.value = detail?.variant === 'door' ? 'door' : 'pocket'
  easterActive.value = false
  requestAnimationFrame(() => easterActive.value = true)
  if (easterTimer)
    clearTimeout(easterTimer)
  easterTimer = setTimeout(() => easterActive.value = false, 6200)
}

function openDoor(): void {
  revealEasterEgg(new CustomEvent('dora:easter-egg', { detail: { variant: 'door' } }))
}

onMounted(() => window.addEventListener('dora:easter-egg', revealEasterEgg))
onBeforeUnmount(() => {
  window.removeEventListener('dora:easter-egg', revealEasterEgg)
  if (easterTimer)
    clearTimeout(easterTimer)
})
</script>

<template>
  <section class="dora-stage" aria-label="任意门传送网络地图">
    <AnywhereDoorMap :nodes="props.nodes" :paused="appStore.stopEarth" />
    <button
      type="button"
      data-dora-easter-trigger="door"
      class="dora-stage__egg"
      title="打开任意门"
      aria-label="打开任意门彩蛋"
      @click="openDoor"
    >
      <span class="dora-stage__egg-door" aria-hidden="true" />
      <small>任意门</small>
    </button>

    <Teleport to="body">
      <Transition name="dora-awakening">
        <button
          v-if="easterActive"
          type="button"
          class="dora-easter"
          :class="isDoorEaster ? 'dora-easter--door' : 'dora-easter--pocket'"
          aria-label="关闭彩蛋"
          @click="easterActive = false"
        >
          <span class="dora-easter__sky" aria-hidden="true" />

          <!-- 任意门：门板向外打开，门后透出光 -->
          <span v-if="isDoorEaster" class="dora-easter__doorway" aria-hidden="true">
            <span class="dora-easter__door-light" />
            <span class="dora-easter__door-leaf"><i /></span>
          </span>

          <!-- 四次元口袋：道具依次从口袋里飞出 -->
          <span v-else class="dora-easter__pocket-wrap" aria-hidden="true">
            <span
              v-for="(gadget, index) in POCKET_GADGETS"
              :key="gadget.name"
              class="dora-easter__gadget"
              :style="{ '--gadget-index': index, '--gadget-angle': `${-150 + index * (120 / (POCKET_GADGETS.length - 1))}deg` }"
            >
              <Icon :icon="gadget.icon" width="28" height="28" />
              <small>{{ gadget.name }}</small>
            </span>
            <span class="dora-easter__pocket" />
          </span>

          <span class="dora-easter__content">
            <span class="dora-easter__bell" aria-hidden="true" />
            <strong>{{ easterTitle }}</strong>
            <em>{{ easterSubtitle }}</em>
            <small>点击任意位置收起</small>
          </span>
        </button>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.dora-stage {
  position: relative;
  isolation: isolate;
  min-height: 16.5rem;
  overflow: hidden;
  border: 3px solid #ffffff;
  border-radius: 1.4rem;
  background: #f3fbff;
  box-shadow:
    0 0 0 3px var(--dora-red),
    0 4px 0 3px rgb(163 0 13 / 0.6),
    0 18px 36px rgb(0 60 110 / 0.28);
}

:global(.dark .dora-stage) {
  border-color: #0a2c4a;
  background: #06243f;
}

.dora-stage__egg {
  position: absolute;
  z-index: 6;
  top: 0.7rem;
  right: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border: 2px solid #8c2350;
  border-radius: 999px;
  background: #f27ca8;
  padding: 0.25rem 0.7rem 0.25rem 0.45rem;
  color: #ffffff;
  box-shadow: 0 3px 0 #8c2350;
  transition:
    transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 180ms ease;
}

.dora-stage__egg:hover {
  transform: translateY(-2px) rotate(-3deg);
  box-shadow: 0 5px 0 #8c2350;
}

.dora-stage__egg:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 #8c2350;
}

.dora-stage__egg-door {
  width: 0.8rem;
  height: 1.15rem;
  background: url('/images/doraemon/door.svg') center / contain no-repeat;
  filter: drop-shadow(0 0 1px #ffffff);
}

.dora-stage__egg small {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

/* ===== 彩蛋全屏层 ===== */
.dora-easter {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  overflow: hidden;
  place-items: center;
  border: 0;
  background: #0096e0;
  color: #ffffff;
  cursor: pointer;
}

.dora-easter__sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle, rgb(255 255 255 / 0.22) 0 2px, transparent 2.5px) 0 0 / 40px 40px,
    radial-gradient(ellipse 80% 60% at 50% 40%, #4cc3ff, #0096e0 60%, #0070b8 100%);
}

.dora-easter__content {
  position: absolute;
  z-index: 3;
  bottom: clamp(2rem, 9vh, 5rem);
  left: 50%;
  display: flex;
  width: min(94vw, 60rem);
  align-items: center;
  flex-direction: column;
  text-align: center;
  transform: translateX(-50%);
}

.dora-easter__bell {
  width: 3rem;
  height: 3rem;
  background: url('/images/doraemon/bell.svg') center / contain no-repeat;
  animation: dora-bell-ring 0.9s ease-in-out infinite;
  transform-origin: 50% 10%;
}

.dora-easter__content strong {
  margin-top: 0.7rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4.6vw, 3.2rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-shadow:
    0 4px 0 #0070b8,
    0 8px 18px rgb(0 40 80 / 0.35);
  animation: dora-title-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.dora-easter__content em {
  margin-top: 0.7rem;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.35rem 1rem;
  color: #0b2540;
  font-size: clamp(0.8rem, 1.8vw, 1rem);
  font-style: normal;
  font-weight: 700;
  box-shadow: 0 3px 0 rgb(0 90 150 / 0.4);
}

.dora-easter__content small {
  margin-top: 0.7rem;
  color: rgb(255 255 255 / 0.8);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
}

/* 四次元口袋 */
.dora-easter__pocket-wrap {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 50%;
  width: clamp(12rem, 34vw, 20rem);
  aspect-ratio: 3 / 2;
  transform: translate(-50%, -62%);
}

.dora-easter__pocket {
  position: absolute;
  inset: 0;
  background: url('/images/doraemon/pocket.svg') center / contain no-repeat;
  filter: drop-shadow(0 6px 0 rgb(0 60 110 / 0.3));
  animation: dora-pocket-wobble 900ms ease-in-out 2;
}

.dora-easter__gadget {
  position: absolute;
  z-index: -1;
  top: 18%;
  left: 50%;
  display: flex;
  width: 4.6rem;
  margin-left: -2.3rem;
  align-items: center;
  flex-direction: column;
  gap: 0.2rem;
  opacity: 0;
  animation: dora-gadget-out 1.2s calc(0.25s + var(--gadget-index) * 0.14s) cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.dora-easter__gadget :deep(svg) {
  box-sizing: content-box;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #ffd700;
  padding: 0.45rem;
  color: #0b2540;
  box-shadow: 0 3px 0 #b38600;
}

.dora-easter__gadget small {
  border-radius: 999px;
  background: #e60012;
  padding: 0.05rem 0.45rem;
  color: #ffffff;
  font-size: 0.66rem;
  font-weight: 800;
  white-space: nowrap;
}

/* 任意门 */
.dora-easter__doorway {
  position: absolute;
  z-index: 2;
  top: 38%;
  left: 50%;
  width: clamp(8rem, 18vw, 11rem);
  aspect-ratio: 2 / 3;
  border: 5px solid #8c2350;
  border-radius: 0.5rem;
  transform: translate(-50%, -50%);
  perspective: 900px;
}

.dora-easter__door-light {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 70%, #ffffff 0 18%, #fff6c2 40%, #ffd700 100%);
  box-shadow: 0 0 80px 30px rgb(255 246 194 / 0.7);
  animation: dora-door-glow 1.8s ease-in-out infinite alternate;
}

.dora-easter__door-leaf {
  position: absolute;
  inset: 0;
  border: 3px solid #ffd0e1;
  border-radius: 0.2rem;
  background: #f27ca8;
  transform-origin: left center;
  animation: dora-door-open 1.4s 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.dora-easter__door-leaf i {
  position: absolute;
  top: 50%;
  right: 12%;
  width: 14%;
  aspect-ratio: 1;
  border: 2px solid #8a5a00;
  border-radius: 999px;
  background: #ffd700;
}

.dora-awakening-enter-active,
.dora-awakening-leave-active {
  transition:
    opacity 320ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.dora-awakening-enter-from,
.dora-awakening-leave-to {
  opacity: 0;
  transform: scale(1.04);
}

@keyframes dora-bell-ring {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(14deg);
  }
  75% {
    transform: rotate(-14deg);
  }
}

@keyframes dora-title-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dora-pocket-wobble {
  0%,
  100% {
    transform: scale(1, 1);
  }
  30% {
    transform: scale(1.06, 0.94);
  }
  60% {
    transform: scale(0.97, 1.04);
  }
}

@keyframes dora-gadget-out {
  0% {
    opacity: 0;
    transform: rotate(var(--gadget-angle)) translateX(0) rotate(calc(var(--gadget-angle) * -1)) scale(0.3);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: rotate(var(--gadget-angle)) translateX(clamp(8rem, 24vw, 15rem)) rotate(calc(var(--gadget-angle) * -1))
      scale(1);
  }
}

@keyframes dora-door-open {
  to {
    transform: rotateY(-105deg);
  }
}

@keyframes dora-door-glow {
  from {
    filter: brightness(1);
  }
  to {
    filter: brightness(1.12);
  }
}

@media (max-width: 767px) {
  .dora-stage__egg {
    top: 0.6rem;
    right: 0.6rem;
  }
  .dora-easter__gadget small {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dora-easter__bell,
  .dora-easter__content strong,
  .dora-easter__pocket,
  .dora-easter__door-light {
    animation: none;
  }
  .dora-easter__gadget {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
  .dora-easter__door-leaf {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}
</style>
