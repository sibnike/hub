import type { CompanyCacheRow } from '@/types/company-cache'

export type EventMapRow = {
  id: string
  event_id: string
  pavilion: string
  floor: number
  svg_content: string | null
  sort_order: number
  created_at: string
}

export type MapStandRow = {
  id: string
  participation_id: string
  event_id: string
  tenant_id: string | null
  tenant_slug: string | null
  stand_number: string | null
  pavilion: string | null
  floor: number
  map_x: number
  map_y: number
  map_width: number
  map_height: number
  cache: CompanyCacheRow | null
}
