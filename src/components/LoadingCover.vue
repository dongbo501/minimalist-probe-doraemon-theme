<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const hasCustomBackground = computed(() => appStore.backgroundEnabled && Boolean(appStore.currentBackgroundUrl))
</script>

<template>
  <div
    class="loading-cover flex items-center inset-0 justify-center fixed z-20"
    :class="hasCustomBackground ? 'loading-cover--custom-background' : ''"
    role="status"
    aria-live="polite"
  >
    <div class="loading-cover__indicator flex flex-col items-center gap-3">
      <!-- 竹蜻蜓：桨叶旋转，整体上下浮动 -->
      <span class="dora-copter-loader" :class="hasCustomBackground && 'dora-copter-loader--small'" aria-hidden="true">
        <span class="dora-copter-loader__blade" />
        <span class="dora-copter-loader__stick" />
        <span class="dora-copter-loader__cap" />
      </span>
      <span v-if="!hasCustomBackground" class="loading-cover__text">竹蜻蜓起飞中…</span>
      <span v-else class="sr-only">加载中</span>
    </div>
  </div>
</template>

<style scoped>
.loading-cover {
  background: linear-gradient(180deg, rgb(51 181 240 / 0.92), rgb(0 129 201 / 0.94));
}

:global(.dark .loading-cover) {
  background: linear-gradient(180deg, rgb(2 20 38 / 0.94), rgb(6 48 90 / 0.94));
}

.loading-cover__indicator {
  transition:
    opacity 240ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.loading-cover__text {
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 0 rgb(0 60 110 / 0.35);
}

.loading-cover--custom-background {
  background: rgb(0 60 110 / 0.12);
}

.dora-copter-loader {
  position: relative;
  display: block;
  width: 64px;
  height: 56px;
  animation: dora-copter-hover 1.4s ease-in-out infinite;
}

.dora-copter-loader--small {
  transform: scale(0.6);
}

.dora-copter-loader__blade {
  position: absolute;
  top: 6px;
  left: 0;
  width: 64px;
  height: 8px;
  border: 1.5px solid #8a5a00;
  border-radius: 50%;
  background: #f5b83d;
  animation: dora-copter-spin 0.32s linear infinite;
}

.dora-copter-loader__stick {
  position: absolute;
  top: 12px;
  left: 30px;
  width: 4px;
  height: 26px;
  border-radius: 2px;
  background: #8a5a00;
}

.dora-copter-loader__cap {
  position: absolute;
  bottom: 2px;
  left: 18px;
  width: 28px;
  height: 16px;
  border: 1.5px solid #8a5a00;
  border-radius: 14px 14px 3px 3px;
  background: #ffd700;
}

@keyframes dora-copter-spin {
  0%,
  100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(0.18);
  }
}

@keyframes dora-copter-hover {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dora-copter-loader,
  .dora-copter-loader__blade {
    animation: none;
  }
}
</style>
