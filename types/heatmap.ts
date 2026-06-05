export type HeatmapPoint = {
  x: number
  y: number
  value: number
  stand_id: string
  tenant_id: string | null
}

export type HeatmapStandRow = {
  stand_id: string
  tenant_id: string | null
  stand_number: string | null
  name: string
  map_x: number
  map_y: number
  map_width: number
  map_height: number
  profile_view: number
  qr_scan: number
  stand_view: number
  total: number
}

export type HeatmapResponse = {
  points: HeatmapPoint[]
  max: number
  topStands: HeatmapStandRow[]
}

export type HeatmapMetric = 'all' | 'profile_view' | 'qr_scan' | 'stand_view'
