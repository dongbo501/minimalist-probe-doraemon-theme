<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import VisitorInfo from '@/components/VisitorInfo.vue'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = '/images/doraemon/doraemon.svg'

const actionButtons = computed(() => {
  const nextThemeTitle = appStore.isDark ? '切换到晴空模式' : '切换到夜空充电模式'
  const themeIcon = appStore.isDark ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon'

  const buttons: Array<{ title: string, icon: string, action: string, pressed?: boolean }> = []

  if (router.currentRoute.value.name === 'home' && appStore.homeToolsEnabled) {
    buttons.push({
      title: appStore.homeAdvancedToolsVisible ? '收起道具工具箱' : '打开道具工具箱',
      icon: 'tabler:tools',
      action: 'toggleHomeTools',
      pressed: appStore.homeAdvancedToolsVisible,
    })
  }

  buttons.push({
    title: nextThemeTitle,
    icon: themeIcon,
    action: 'toggleTheme',
  })

  if (!appStore.loading && (appStore.privateFeaturesAllowed || !appStore.hideAdminEntryWhenLoggedOut)) {
    buttons.push({
      title: '后台管理',
      icon: 'icon-park-outline:setting',
      action: 'jumpToSetting',
    })
  }
  return buttons
})

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      break
    case 'toggleHomeTools':
      appStore.homeAdvancedToolsVisible = !appStore.homeAdvancedToolsVisible
      break
    case 'jumpToSetting':
      location.href = '/admin'
      break
  }
}

function revealPocketEasterEgg(): void {
  window.dispatchEvent(new CustomEvent('dora:easter-egg', {
    detail: { variant: 'pocket' },
  }))
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'Monitor')
</script>

<template>
  <!-- 访客 IP 组件，全局悬浮 -->
  <VisitorInfo v-if="!appStore.loading && appStore.visitorInfoEnabled" />

  <div
    class="dora-header sticky top-0 z-10 px-4 pt-2.5 max-w-[1280px] mx-auto max-sm:px-3 max-sm:pt-2"
    :class="isScrolled && 'dora-header--scrolled'"
  >
    <div class="dora-header__bar flex-between h-14 pl-2 pr-3" :class="isScrolled && 'dora-header__bar--scrolled'">
      <div class="flex items-center gap-2.5 cursor-pointer" @click="router.push('/')">
        <button
          type="button"
          data-dora-easter-trigger="pocket"
          class="dora-brand__mark"
          title="摸摸哆啦A梦的铃铛，打开四次元口袋"
          aria-label="打开四次元口袋彩蛋"
          @click.stop="revealPocketEasterEgg"
        >
          <img :src="siteFavicon" alt="" width="46" height="49">
        </button>
        <div class="dora-brand__copy">
          <h1 class="sr-only">
            {{ sitename }}
          </h1>
          <span>哆啦A梦<b>·</b>探针</span>
          <small>{{ sitename }} · 22 世纪道具监控站</small>
        </div>
      </div>
      <TooltipProvider :delay-duration="200">
        <div class="flex items-center gap-1.5">
          <Tooltip v-for="button in actionButtons" :key="button.action">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="dora-header__action"
                :aria-label="button.title"
                :aria-pressed="button.pressed"
                @click="handleButtonClick(button.action)"
              >
                <Icon :icon="button.icon" :width="18" :height="18" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ button.title }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </div>
</template>
