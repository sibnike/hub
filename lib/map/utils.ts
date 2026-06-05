import { createClient } from '@/lib/supabase/server'
import type { EventMapRow, MapStandRow } from '@/types/map'

export const DEFAULT_PLACEHOLDER_SVG = `<svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="700" fill="#f4f4f5"/><text x="500" y="350" text-anchor="middle" fill="#71717a" font-size="24" font-family="sans-serif">Загрузите SVG карты</text></svg>`

const CATEGORY_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
]

export function snap(value: number, gridSize = 1): number {
  return Math.round(value / gridSize) * gridSize
}

export function formatMapTabLabel(map: Pick<EventMapRow, 'pavilion' | 'floor'>): string {
  if (map.floor > 1) return `${map.pavilion} · Этаж ${map.floor}`
  return map.pavilion
}

export function standMatchesMap(
  stand: Pick<MapStandRow, 'pavilion' | 'floor'>,
  map: Pick<EventMapRow, 'pavilion' | 'floor'>
): boolean {
  return (stand.pavilion ?? 'main') === map.pavilion && (stand.floor ?? 1) === map.floor
}

export function hasMapForStand(stand: MapStandRow, maps: EventMapRow[]): boolean {
  return maps.some((m) => standMatchesMap(stand, m))
}

export function categoryColor(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

export function dominantCategory(categories: string[] | undefined): string | null {
  return categories?.[0] ?? null
}

export type StandPosition = {
  id: string
  map_x: number
  map_y: number
  map_width: number
  map_height: number
}

export function alignLeft(stands: StandPosition[]): StandPosition[] {
  const minX = Math.min(...stands.map((s) => s.map_x))
  return stands.map((s) => ({ ...s, map_x: minX }))
}

export function alignRight(stands: StandPosition[]): StandPosition[] {
  const maxRight = Math.max(...stands.map((s) => s.map_x + s.map_width))
  return stands.map((s) => ({ ...s, map_x: maxRight - s.map_width }))
}

export function alignTop(stands: StandPosition[]): StandPosition[] {
  const minY = Math.min(...stands.map((s) => s.map_y))
  return stands.map((s) => ({ ...s, map_y: minY }))
}

export function alignBottom(stands: StandPosition[]): StandPosition[] {
  const maxBottom = Math.max(...stands.map((s) => s.map_y + s.map_height))
  return stands.map((s) => ({ ...s, map_y: maxBottom - s.map_height }))
}

export function distributeHorizontally(stands: StandPosition[]): StandPosition[] {
  if (stands.length < 3) return stands
  const sorted = [...stands].sort((a, b) => a.map_x - b.map_x)
  const minX = sorted[0].map_x
  const maxX = sorted[sorted.length - 1].map_x
  const step = (maxX - minX) / (sorted.length - 1)
  return sorted.map((s, i) => ({ ...s, map_x: minX + step * i }))
}

export function exportMapWithStands(
  svgContent: string,
  stands: MapStandRow[],
  viewBox: { width: number; height: number }
): string {
  const rects = stands
    .filter((s) => s.map_x > 0 || s.map_y > 0)
    .map((s) => {
      const x = (s.map_x / 100) * viewBox.width
      const y = (s.map_y / 100) * viewBox.height
      const w = (s.map_width / 100) * viewBox.width
      const h = (s.map_height / 100) * viewBox.height
      const label = s.stand_number ?? ''
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(99,102,241,0.3)" stroke="#6366f1" stroke-width="2" rx="4"/><text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-family="sans-serif" fill="#1e1b4b">${label}</text>`
    })
    .join('')

  if (svgContent.includes('</svg>')) {
    return svgContent.replace('</svg>', `${rects}</svg>`)
  }
  return svgContent + rects
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function ensurePlaceholderMaps(
  supabase: SupabaseClient,
  eventId: string,
  pavilionFloorPairs: Array<{ pavilion: string; floor: number }>
) {
  for (const { pavilion, floor } of pavilionFloorPairs) {
    const { data: existing } = await supabase
      .schema('hub')
      .from('event_maps')
      .select('id')
      .eq('event_id', eventId)
      .eq('pavilion', pavilion)
      .eq('floor', floor)
      .maybeSingle()

    if (!existing) {
      const { count } = await supabase
        .schema('hub')
        .from('event_maps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

      await supabase.schema('hub').from('event_maps').insert({
        event_id: eventId,
        pavilion,
        floor,
        svg_content: DEFAULT_PLACEHOLDER_SVG,
        sort_order: count ?? 0,
      })
    }
  }
}
