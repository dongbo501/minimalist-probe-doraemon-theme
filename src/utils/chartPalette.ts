export interface LoadChartPalette {
  primary: string
  primaryAreaStrong: string
  primaryAreaFaint: string
  secondary: string
  tertiary: string
  tertiaryAreaStrong: string
  tertiaryAreaFaint: string
  quaternary: string
  quinary: string
  senary: string
}

// 哆啦A梦配色：蓝（身体）、红（鼻子/项圈）、金（铃铛）、粉（任意门）
const DEFAULT_LOAD_CHART_PALETTE: LoadChartPalette = {
  primary: '#0096E0',
  primaryAreaStrong: 'rgba(0, 150, 224, 0.28)',
  primaryAreaFaint: 'rgba(0, 150, 224, 0.02)',
  secondary: '#E60012',
  tertiary: '#E0A800',
  tertiaryAreaStrong: 'rgba(224, 168, 0, 0.26)',
  tertiaryAreaFaint: 'rgba(224, 168, 0, 0.02)',
  quaternary: '#F27CA8',
  quinary: '#38BDF8',
  senary: '#0B4F8A',
}

const ACCESSIBLE_LOAD_CHART_PALETTE: LoadChartPalette = {
  primary: '#D55E00',
  primaryAreaStrong: 'rgba(213, 94, 0, 0.25)',
  primaryAreaFaint: 'rgba(213, 94, 0, 0.02)',
  secondary: '#E69F00',
  tertiary: '#009E73',
  tertiaryAreaStrong: 'rgba(0, 158, 115, 0.25)',
  tertiaryAreaFaint: 'rgba(0, 158, 115, 0.02)',
  quaternary: '#CC79A7',
  quinary: '#0072B2',
  senary: '#56B4E9',
}

const DEFAULT_SERIES_PALETTE = [
  '#0096E0',
  '#E60012',
  '#E0A800',
  '#F27CA8',
  '#0B4F8A',
  '#38BDF8',
  '#FF8A3D',
  '#7C8B99',
]

const ACCESSIBLE_SERIES_PALETTE = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#D55E00',
  '#56B4E9',
  '#F0C94A',
  '#6B7280',
]

export const ACCESSIBLE_LINE_TYPES = ['solid', 'dashed', 'dotted'] as const

export function getLoadChartPalette(accessible: boolean): LoadChartPalette {
  return accessible ? ACCESSIBLE_LOAD_CHART_PALETTE : DEFAULT_LOAD_CHART_PALETTE
}

export function getChartSeriesPalette(accessible: boolean): string[] {
  return [...(accessible ? ACCESSIBLE_SERIES_PALETTE : DEFAULT_SERIES_PALETTE)]
}
