import type { CompanyCacheRow } from '@/types/company-cache'
import type { I18nMap } from '@/types/hub-event'

export type CatalogStand = {
  id?: string
  stand_number: string | null
  pavilion: string | null
  floor: number | null
}

export type CatalogParticipant = {
  id: string
  tenant_id: string
  tenant_slug: string
  cache: CompanyCacheRow
  stand: CatalogStand | null
}

export type IndustryCategory = {
  slug: string
  name: I18nMap
  sort_order: number
}
