import type { Plugin } from 'vite'
import { execFileSync, execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import vueDevTools from 'vite-plugin-vue-devtools'

interface ThemeManifest {
  short?: unknown
  version?: unknown
}

const THEME_SHORT_REGEX = /^[\w-]+$/
const themeJsonPath = resolve(__dirname, 'theme.json')
// 开发服务器把 /api 和 WebSocket 代理到这个 hub，不设时代理到本机 9911
const hubTarget = process.env.MONITOR_HUB || 'http://127.0.0.1:9911'

function readThemeManifest(): ThemeManifest {
  if (!existsSync(themeJsonPath))
    throw new Error('theme.json not found')

  return JSON.parse(readFileSync(themeJsonPath, 'utf-8')) as ThemeManifest
}

function getThemeVersion(): string {
  const version = readThemeManifest().version

  if (typeof version !== 'string' || !version.trim())
    throw new TypeError('theme.json does not contain a top-level string version field')

  return version.trim()
}

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return 'unknown'
  }
}

/**
 * Vite 插件：构建后打包极简探针主题
 * hub 安装时在包的根目录找 theme.json，所以文件直接放在根目录，不套一层目录：
 * theme.tar.gz
 * ├── theme.json
 * ├── preview.png
 * └── dist/
 */
function monitorThemePackage(): Plugin {
  return {
    name: 'monitor-theme-package',
    apply: 'build',
    closeBundle: () => {
      const short = readThemeManifest().short
      if (typeof short !== 'string' || !THEME_SHORT_REGEX.test(short))
        throw new TypeError('theme.json short must use letters, digits, - or _')

      const distDir = resolve(__dirname, 'dist')
      if (!existsSync(distDir)) {
        console.log('[monitor-theme] dist directory not found, skipping package')
        return
      }

      const stage = mkdtempSync(join(tmpdir(), 'monitor-theme-'))
      const entries = ['theme.json', 'dist']
      cpSync(themeJsonPath, join(stage, 'theme.json'))
      const previewPath = resolve(__dirname, 'preview.png')
      if (existsSync(previewPath)) {
        cpSync(previewPath, join(stage, 'preview.png'))
        entries.push('preview.png')
      }
      cpSync(distDir, join(stage, 'dist'), { recursive: true })

      const output = resolve(__dirname, 'theme.tar.gz')
      execFileSync('tar', ['-czf', output, '-C', stage, ...entries])
      rmSync(stage, { recursive: true, force: true })
      const sizeMB = (statSync(output).size / 1024 / 1024).toFixed(2)
      console.log(`[monitor-theme] Created theme.tar.gz (${short} v${getThemeVersion()}, ${sizeMB} MB)`)
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(getThemeVersion()),
    __BUILD_GIT_HASH__: JSON.stringify(getCommitHash()),
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    monitorThemePackage(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: hubTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: ['es2018', 'safari15.4'],
    cssTarget: 'safari15.4',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'reka-ui': ['reka-ui'],
          'vueuse': ['@vueuse/core'],
          'v3-services': [
            './src/services/history.service.ts',
            './src/services/metrics.service.ts',
            './src/services/request.service.ts',
            './src/services/cache.service.ts',
            './src/utils/osImageHelper.ts',
            './src/utils/metricSeries.ts',
            './src/composables/useNodePingDisplay.ts',
          ],
        },
      },
    },
  },
})
