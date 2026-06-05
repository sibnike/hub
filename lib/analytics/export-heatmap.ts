import type { HeatmapPoint } from '@/types/heatmap'
import type { HeatmapStandRow } from '@/types/heatmap'

function heatCircle(
  p: HeatmapPoint,
  max: number,
  width: number,
  height: number
): string {
  const intensity = p.value / max
  const color =
    intensity < 0.33
      ? 'rgba(59,130,246,0.4)'
      : intensity < 0.66
        ? 'rgba(245,158,11,0.5)'
        : 'rgba(239,68,68,0.6)'
  const radius = ((4 + intensity * 8) / 100) * width
  const cx = (p.x / 100) * width
  const cy = (p.y / 100) * height
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" />`
}

function standOutline(s: HeatmapStandRow, width: number, height: number): string {
  const x = (s.map_x / 100) * width
  const y = (s.map_y / 100) * height
  const w = (s.map_width / 100) * width
  const h = (s.map_height / 100) * height
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2" rx="4" />`
}

export function buildHeatmapSvg(
  mapSvgContent: string,
  points: HeatmapPoint[],
  max: number,
  stands: HeatmapStandRow[],
  viewBox?: { width: number; height: number } | null
): string {
  const width = viewBox?.width ?? 1000
  const height = viewBox?.height ?? 700
  const overlay = points.map((p) => heatCircle(p, max, width, height)).join('')
  const outlines = stands.map((s) => standOutline(s, width, height)).join('')
  const heatmapLayer = `<g id="heatmap-overlay">${overlay}${outlines}</g>`

  if (mapSvgContent.includes('</svg>')) {
    return mapSvgContent.replace('</svg>', `${heatmapLayer}</svg>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${heatmapLayer}</svg>`
}

export function downloadHeatmapSvg(
  content: string,
  filename: string
): void {
  const blob = new Blob([content], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
