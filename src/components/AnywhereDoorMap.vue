<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed, onMounted, ref } from 'vue'
import { useNodeGeoClusters } from '@/composables/useNodeGeoClusters'
import { getCoordByCode } from '@/utils/geoHelper'
import { getRegionDisplayName } from '@/utils/regionHelper'

type Position = [number, number]
type PolygonCoordinates = Position[][]
type MultiPolygonCoordinates = Position[][][]

interface GeoFeature {
  properties: Record<string, unknown>
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: PolygonCoordinates | MultiPolygonCoordinates
  }
}

interface MapCountry {
  id: string
  code: string
  name: string
  path: string
}

interface CountryMarker {
  code: string
  highlightCode: string
  label: string
  servers: number
  onlineServers: number
  x: number
  y: number
}

const props = defineProps<{ nodes?: NodeData[], paused?: boolean }>()
const MAP_WIDTH = 1000
const MAP_HEIGHT = 500
const LATITUDE_TOP = 84
const LATITUDE_BOTTOM = -60
const ISO_COUNTRY_CODE_REGEX = /^[A-Z]{2}$/
const countries = ref<MapCountry[]>([])
const activeCode = ref('')
const activeMarkerCode = ref('')
const mapLoadFailed = ref(false)

const { regionClusters, totalServers, onlineServers } = useNodeGeoClusters({ nodes: () => props.nodes })

const COUNTRY_HIGHLIGHT_FALLBACK: Record<string, string> = {
  HK: 'CN',
  MO: 'CN',
}

function project(position: Position): { x: number, y: number } {
  const [longitude, latitude] = position
  return {
    x: ((longitude + 180) / 360) * MAP_WIDTH,
    y: ((LATITUDE_TOP - Math.max(LATITUDE_BOTTOM, Math.min(LATITUDE_TOP, latitude))) / (LATITUDE_TOP - LATITUDE_BOTTOM)) * MAP_HEIGHT,
  }
}

function ringPath(ring: Position[]): string {
  return `${ring.map((position, index) => {
    const point = project(position)
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
  }).join(' ')} Z`
}

function geometryPath(feature: GeoFeature): string {
  if (feature.geometry.type === 'Polygon')
    return (feature.geometry.coordinates as PolygonCoordinates).map(ringPath).join(' ')
  return (feature.geometry.coordinates as MultiPolygonCoordinates)
    .flatMap(polygon => polygon.map(ringPath))
    .join(' ')
}

function featureCode(properties: Record<string, unknown>): string {
  const preferred = String(properties.ISO_A2_EH || '').toUpperCase()
  const fallback = String(properties.ISO_A2 || '').toUpperCase()
  return ISO_COUNTRY_CODE_REGEX.test(preferred) ? preferred : (ISO_COUNTRY_CODE_REGEX.test(fallback) ? fallback : '')
}

const markers = computed<CountryMarker[]>(() => {
  const countryTotals = new Map<string, { servers: number, onlineServers: number, label: string, coord: [number, number] }>()

  for (const cluster of regionClusters.value) {
    const code = cluster.code.toUpperCase()
    if (!ISO_COUNTRY_CODE_REGEX.test(code))
      continue
    const existing = countryTotals.get(code)
    const coord = getCoordByCode(code) ?? cluster.coord
    if (existing) {
      existing.servers += cluster.servers
      existing.onlineServers += cluster.onlineServers
    }
    else {
      countryTotals.set(code, {
        servers: cluster.servers,
        onlineServers: cluster.onlineServers,
        label: getRegionDisplayName(code) || cluster.label || code,
        coord,
      })
    }
  }

  return Array.from(countryTotals.entries()).map(([code, data]) => {
    const point = project([data.coord[1], data.coord[0]])
    return {
      code,
      highlightCode: COUNTRY_HIGHLIGHT_FALLBACK[code] ?? code,
      label: data.label,
      servers: data.servers,
      onlineServers: data.onlineServers,
      ...point,
    }
  })
})

const activeMarker = computed(() => markers.value.find(marker => marker.code === activeMarkerCode.value) ?? null)

function activateMarker(marker: CountryMarker): void {
  activeCode.value = marker.highlightCode
  activeMarkerCode.value = marker.code
}

function clearMarker(): void {
  activeCode.value = ''
  activeMarkerCode.value = ''
}

onMounted(async () => {
  try {
    const response = await fetch('/data/world-countries.geojson')
    if (!response.ok)
      throw new Error(`Map data request failed: ${response.status}`)
    const collection = await response.json() as { features: GeoFeature[] }
    countries.value = collection.features.map((feature, index) => ({
      id: `${featureCode(feature.properties) || 'country'}-${index}`,
      code: featureCode(feature.properties),
      name: String(feature.properties.ADMIN || ''),
      path: geometryPath(feature),
    }))
  }
  catch {
    mapLoadFailed.value = true
  }
})
</script>

<template>
  <div class="door-map" :class="{ 'door-map--paused': paused }">
    <div class="door-map__heading">
      <span><i class="door-map__door-icon" aria-hidden="true" />任意门传送网络</span>
      <small>{{ markers.length }} 个目的地 · {{ onlineServers }} / {{ totalServers }} 件道具元气满满</small>
    </div>

    <svg
      class="door-map__svg"
      viewBox="0 0 1000 500"
      role="img"
      aria-label="节点所在国家与地区的任意门传送网络地图"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="door-map-nose" cx="34%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.22" stop-color="#ff5a66" />
          <stop offset="0.7" stop-color="#e60012" />
          <stop offset="1" stop-color="#a3000d" />
        </radialGradient>
        <radialGradient id="door-map-bell" cx="34%" cy="30%" r="75%">
          <stop offset="0" stop-color="#fffbe0" />
          <stop offset="0.3" stop-color="#ffe45c" />
          <stop offset="1" stop-color="#d9a400" />
        </radialGradient>
      </defs>

      <g class="door-map__grid" aria-hidden="true">
        <path v-for="x in [125, 250, 375, 500, 625, 750, 875]" :key="`x-${x}`" :d="`M${x},15 V485`" />
        <path v-for="y in [100, 200, 300, 400]" :key="`y-${y}`" :d="`M20,${y} H980`" />
      </g>

      <g v-if="!mapLoadFailed" class="door-map__countries">
        <path
          v-for="country in countries"
          :key="country.id"
          :d="country.path"
          :data-country-code="country.code || undefined"
          :aria-label="country.name"
          :class="{ 'is-active': country.code && country.code === activeCode }"
        />
      </g>

      <g class="door-map__markers">
        <g
          v-for="marker in markers"
          :key="marker.code"
          class="door-map__marker"
          :class="{ 'is-active': marker.code === activeMarkerCode, 'is-offline': marker.onlineServers === 0 }"
          :transform="`translate(${marker.x} ${marker.y})`"
          :data-map-marker-code="marker.code"
          role="button"
          tabindex="0"
          :aria-label="`${marker.label}，${marker.onlineServers}/${marker.servers} 件道具元气满满`"
          @mouseenter="activateMarker(marker)"
          @mouseleave="clearMarker"
          @focus="activateMarker(marker)"
          @blur="clearMarker"
        >
          <circle class="door-map__pulse" r="13" />
          <circle class="door-map__halo" r="8.5" />
          <circle class="door-map__dot" r="5" />
        </g>
      </g>
    </svg>

    <div class="door-map__status" aria-live="polite">
      <template v-if="activeMarker">
        <strong>{{ activeMarker.label }}</strong>
        <span :class="{ 'is-offline': activeMarker.onlineServers === 0 }">
          {{ activeMarker.onlineServers > 0
            ? `${activeMarker.onlineServers} / ${activeMarker.servers} 元气满满`
            : `${activeMarker.servers} 件道具待机充电中` }}
        </span>
      </template>
      <template v-else>
        <strong>任意门目的地</strong>
        <span>移到红鼻子上，打开这扇任意门</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.door-map {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 76% 34%, rgb(255 255 255 / 0.9), transparent 42%),
    linear-gradient(180deg, #f3fbff 0%, #dff3ff 100%);
}

.door-map__heading {
  position: absolute;
  z-index: 2;
  top: 0.9rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  color: #0b2540;
  font-family: var(--font-display);
  pointer-events: none;
}

.door-map__heading span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.door-map__door-icon {
  display: inline-block;
  width: 0.72rem;
  height: 1.05rem;
  background: url('/images/doraemon/door.svg') center / contain no-repeat;
}

.door-map__heading small {
  margin-top: 0.2rem;
  color: #3d5873;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
}

.door-map__svg {
  position: absolute;
  inset: 2.6rem 0 1.9rem;
  width: 100%;
  height: calc(100% - 4.5rem);
}

.door-map__grid path {
  fill: none;
  stroke: rgb(0 150 224 / 0.16);
  stroke-dasharray: 2 8;
  stroke-width: 0.9;
}

.door-map__countries path {
  fill: rgb(0 150 224 / 0.16);
  fill-rule: evenodd;
  stroke: rgb(0 112 184 / 0.45);
  stroke-linejoin: round;
  stroke-width: 0.7;
  transition:
    fill 180ms ease,
    stroke 180ms ease,
    stroke-width 180ms ease;
}

.door-map__countries path.is-active {
  fill: rgb(255 215 0 / 0.6);
  stroke: #b38600;
  stroke-width: 1.8;
}

.door-map__marker {
  cursor: pointer;
  outline: none;
}

.door-map__pulse {
  fill: none;
  stroke: #0096e0;
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
  animation: door-map-pulse 2.2s ease-out infinite;
}

.door-map__halo {
  fill: #ffffff;
  stroke: rgb(0 112 184 / 0.35);
  stroke-width: 1;
}

.door-map__dot {
  fill: url(#door-map-nose);
}

.door-map__marker.is-active .door-map__halo {
  stroke: #b38600;
  stroke-width: 2;
}

.door-map__marker.is-active .door-map__dot {
  fill: url(#door-map-bell);
}

.door-map__marker.is-offline .door-map__pulse {
  stroke: #8a99a8;
  animation: none;
  opacity: 0;
}

.door-map__marker.is-offline .door-map__dot {
  fill: #9aa8b6;
}

.door-map__status {
  position: absolute;
  z-index: 2;
  right: 1rem;
  bottom: 0.7rem;
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  font-family: var(--font-display);
  pointer-events: none;
}

.door-map__status strong {
  color: #0b2540;
  font-size: 0.78rem;
  font-weight: 800;
}

.door-map__status span {
  color: #0070b8;
  font-size: 0.62rem;
  font-weight: 700;
}

.door-map__status span.is-offline {
  color: #e60012;
}

:global(.dark .door-map) {
  background:
    radial-gradient(circle at 76% 34%, rgb(0 150 224 / 0.22), transparent 42%),
    linear-gradient(180deg, #06243f 0%, #041a30 100%);
}

:global(.dark .door-map__heading),
:global(.dark .door-map__status strong) {
  color: #eef8ff;
}

:global(.dark .door-map__heading small) {
  color: #b6d3ea;
}

:global(.dark .door-map__grid path) {
  stroke: rgb(76 195 255 / 0.12);
}

:global(.dark .door-map__countries path) {
  fill: rgb(76 195 255 / 0.12);
  stroke: rgb(76 195 255 / 0.4);
}

:global(.dark .door-map__countries path.is-active) {
  fill: rgb(255 215 0 / 0.38);
  stroke: #ffd700;
}

:global(.dark .door-map__halo) {
  fill: #0a2c4a;
  stroke: rgb(76 195 255 / 0.5);
}

:global(.dark .door-map__pulse) {
  stroke: #4cc3ff;
}

:global(.dark .door-map__status span) {
  color: #4cc3ff;
}

:global(.dark .door-map__status span.is-offline) {
  color: #ff6b75;
}

.door-map--paused .door-map__pulse {
  animation-play-state: paused;
}

@keyframes door-map-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.5);
  }
  72%,
  100% {
    opacity: 0;
    transform: scale(1.6);
  }
}

@media (max-width: 767px) {
  .door-map__heading {
    top: 0.75rem;
    left: 0.8rem;
  }
  .door-map__svg {
    inset: 2.8rem 0 2.1rem;
    height: calc(100% - 4.9rem);
  }
  .door-map__status {
    right: 0.75rem;
    bottom: 0.6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .door-map__pulse {
    animation: none;
    opacity: 0.6;
  }
}
</style>
