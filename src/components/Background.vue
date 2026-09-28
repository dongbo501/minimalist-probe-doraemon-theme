<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const isLoaded = ref(false)
const hasError = ref(false)

const showBackground = computed(() => appStore.backgroundEnabled)
const currentUrl = computed(() => showBackground.value ? appStore.currentBackgroundUrl : '')
const backgroundType = computed(() => appStore.backgroundType)
const hasCustomBackground = computed(() => showBackground.value && !!currentUrl.value)
const showBackgroundOverlay = computed(() => appStore.backgroundOverlay > 0)

const backgroundStyle = computed(() => {
  const blur = appStore.backgroundBlur
  return {
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    opacity: appStore.backgroundType === 'video' && !isLoaded.value ? 0 : 1,
  }
})

const backgroundContainerStyle = computed(() => {
  const overlay = appStore.backgroundOverlay
  if (overlay >= 0)
    return {}

  return { opacity: 1 - Math.abs(overlay) / 100 }
})

const overlayStyle = computed(() => {
  const overlay = appStore.backgroundOverlay
  if (overlay <= 0)
    return {}

  return { backgroundColor: `rgba(0, 0, 0, ${overlay / 100})` }
})

const showLoadedBackground = computed(() =>
  hasCustomBackground.value && isLoaded.value && !hasError.value,
)

const showMediaBackground = computed(() =>
  hasCustomBackground.value && !hasError.value && (backgroundType.value === 'video' || showLoadedBackground.value),
)

const showDefaultBackground = computed(() =>
  !hasCustomBackground.value || !showMediaBackground.value || hasError.value,
)

const showLoadingBackground = computed(() =>
  hasCustomBackground.value && backgroundType.value === 'video' && !isLoaded.value && !hasError.value,
)

const showFallbackBackground = computed(() =>
  hasCustomBackground.value && backgroundType.value === 'video' && hasError.value,
)

let imageLoader: HTMLImageElement | null = null

function clearImageLoader() {
  if (imageLoader) {
    imageLoader.onload = null
    imageLoader.onerror = null
    imageLoader = null
  }
}

function loadImage(url: string) {
  isLoaded.value = false
  hasError.value = false

  clearImageLoader()

  imageLoader = new Image()
  imageLoader.onload = () => {
    isLoaded.value = true
    hasError.value = false
  }
  imageLoader.onerror = () => {
    isLoaded.value = false
    hasError.value = true
  }
  imageLoader.src = url
}

const videoRef = ref<HTMLVideoElement | null>(null)

function resetBackgroundState() {
  clearImageLoader()

  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.removeAttribute('src')
    videoRef.value.load()
  }

  isLoaded.value = false
  hasError.value = false
}

function handleVideoLoaded() {
  isLoaded.value = true
  hasError.value = false
}
function handleVideoError() {
  isLoaded.value = false
  hasError.value = true
}

watch([showBackground, currentUrl, backgroundType], ([enabled, url, type]) => {
  if (!enabled || !url) {
    resetBackgroundState()
    return
  }

  if (type === 'image') {
    loadImage(url)
  }
  else if (type === 'video') {
    clearImageLoader()
    isLoaded.value = false
    hasError.value = false
  }
}, { immediate: true })

onUnmounted(() => {
  resetBackgroundState()
})
</script>

<template>
  <div class="background-container" :style="backgroundContainerStyle">
    <Transition name="fade">
      <div v-if="showDefaultBackground" class="default-background" aria-hidden="true">
        <div class="dora-sky-pattern" />
        <div class="dora-clouds" />
        <div class="dora-copter" />
      </div>
    </Transition>
    <Transition name="fade">
      <div v-if="showLoadingBackground" class="background-loading" />
    </Transition>
    <Transition name="fade">
      <div v-if="showFallbackBackground" class="background-loading" />
    </Transition>
    <Transition name="fade">
      <div v-if="showMediaBackground" class="background-media" :style="backgroundStyle">
        <div
          v-if="backgroundType === 'image'"
          class="background-image"
          :style="{ backgroundImage: `url(${currentUrl})` }"
        />
        <video
          v-else-if="backgroundType === 'video'"
          ref="videoRef"
          class="background-video"
          :src="currentUrl ?? undefined"
          autoplay
          loop
          muted
          preload="auto"
          playsinline
          @loadeddata="handleVideoLoaded"
          @canplay="handleVideoLoaded"
          @error="handleVideoError"
        />
      </div>
    </Transition>
    <div v-if="showBackgroundOverlay" class="background-overlay" :style="overlayStyle" />
  </div>
</template>

<style scoped>
.background-container {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
}

.default-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* 哆啦A梦蓝：上浅下深，像晴朗的天空 */
  background:
    radial-gradient(ellipse 60% 40% at 50% 108%, rgb(255 255 255 / 0.32), transparent 70%),
    linear-gradient(180deg, #33b5f0 0%, #0096e0 42%, #0081c9 100%);
}

.dark .default-background {
  /* 夜空：哆啦A梦在壁橱里待机充电 */
  background:
    radial-gradient(circle at 84% 12%, rgb(255 215 0 / 0.16) 0 3.2rem, transparent 3.3rem),
    radial-gradient(ellipse 70% 50% at 20% 110%, rgb(0 150 224 / 0.28), transparent 70%),
    linear-gradient(180deg, #021426 0%, #04213b 50%, #06305a 100%);
}

.dora-sky-pattern,
.dora-clouds,
.dora-copter {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 细碎的白色圆点，呼应哆啦A梦的圆润造型 */
.dora-sky-pattern {
  opacity: 0.16;
  background-image:
    radial-gradient(circle, #ffffff 0 2px, transparent 2.5px),
    radial-gradient(circle, #ffffff 0 1.2px, transparent 1.7px);
  background-position:
    0 0,
    23px 23px;
  background-size: 46px 46px;
}

.dark .dora-sky-pattern {
  opacity: 0.5;
  background-image:
    radial-gradient(circle at 18% 22%, #ffffff 0 1px, transparent 1.6px),
    radial-gradient(circle at 64% 35%, #a5e4ff 0 1px, transparent 1.7px),
    radial-gradient(circle at 34% 78%, #ffd700 0 1px, transparent 1.6px),
    radial-gradient(circle at 88% 67%, #ffffff 0 1px, transparent 1.5px);
  background-position: 0 0;
  background-size:
    180px 190px,
    260px 230px,
    310px 290px,
    220px 270px;
}

/* 白云：几组重叠圆组成，缓慢飘动 */
.dora-clouds {
  opacity: 0.92;
  background:
    radial-gradient(circle at 12% 18%, #fff 0 34px, transparent 35px),
    radial-gradient(circle at 15.5% 15%, #fff 0 44px, transparent 45px),
    radial-gradient(circle at 19% 19%, #fff 0 30px, transparent 31px),
    radial-gradient(circle at 78% 30%, #fff 0 26px, transparent 27px),
    radial-gradient(circle at 81% 27%, #fff 0 36px, transparent 37px),
    radial-gradient(circle at 84% 31%, #fff 0 24px, transparent 25px),
    radial-gradient(circle at 44% 86%, rgb(255 255 255 / 0.7) 0 30px, transparent 31px),
    radial-gradient(circle at 47% 83%, rgb(255 255 255 / 0.7) 0 40px, transparent 41px),
    radial-gradient(circle at 50% 87%, rgb(255 255 255 / 0.7) 0 28px, transparent 29px);
  filter: drop-shadow(0 6px 0 rgb(0 90 150 / 0.12));
  animation: dora-cloud-drift 48s ease-in-out infinite alternate;
}

.dark .dora-clouds {
  opacity: 0.08;
}

/* 竹蜻蜓在天空里悠闲地飞 */
.dora-copter {
  inset: auto;
  top: 16%;
  left: -64px;
  width: 44px;
  height: 44px;
  background: url('/images/doraemon/takecopter.svg') center / contain no-repeat;
  opacity: 0.85;
  animation: dora-copter-fly 38s linear infinite;
}

.dark .dora-copter {
  opacity: 0.35;
}

@keyframes dora-cloud-drift {
  to {
    transform: translate3d(-36px, 6px, 0);
  }
}

@keyframes dora-copter-fly {
  0% {
    transform: translate3d(0, 0, 0) rotate(-6deg);
  }
  25% {
    transform: translate3d(28vw, -26px, 0) rotate(4deg);
  }
  50% {
    transform: translate3d(56vw, 14px, 0) rotate(-4deg);
  }
  75% {
    transform: translate3d(84vw, -18px, 0) rotate(5deg);
  }
  100% {
    transform: translate3d(calc(100vw + 128px), 0, 0) rotate(-6deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dora-clouds,
  .dora-copter {
    animation: none;
  }
  .dora-copter {
    display: none;
  }
}

.background-loading {
  position: absolute;
  inset: 0;
  background-color: #04213b;
}

:root:not(.dark) .background-loading {
  background: linear-gradient(180deg, #33b5f0, #0081c9);
}

.background-media {
  position: absolute;
  inset: 0;
  transition: opacity 0.8s ease;
}

.background-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.background-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
