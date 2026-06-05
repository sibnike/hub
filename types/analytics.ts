export type TrackType =
  | 'profile_view'
  | 'stand_view'
  | 'qr_scan'
  | 'catalog_view'
  | 'map_view'
  | 'save'
  | 'form_submit'

export type TrackSource = 'catalog' | 'map' | 'qr' | 'direct' | 'search'

export type TrackRow = {
  type: TrackType
  source: string | null
  tenant_id: string | null
  ts: string
}

export type CompanyCacheBrief = {
  tenant_id: string
  name: string | null
  logo_url: string | null
}

export type CompanyStats = {
  tenant_id: string
  name: string
  logo_url: string | null
  profile_view: number
  qr_scan: number
  stand_view: number
  total: number
}

export type EventComparisonRow = {
  event_id: string
  slug: string
  name: Record<string, string>
  dates: string | null
  profile_view: number
  qr_scan: number
  stand_view: number
  form_submit: number
  top_source: string | null
}
