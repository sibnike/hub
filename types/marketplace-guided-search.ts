import type { I18nMap } from '@/types/hub-event'
import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

export type SearchPresetParam = 'city' | 'dates' | 'people'

export type SearchPresetRow = {
  id: string
  marketplace_id: string
  theme_slug: string
  name: I18nMap
  hint_template: I18nMap
  required_params: SearchPresetParam[]
  clarify_hints: Record<string, I18nMap>
  sort_order: number
  is_active: boolean
  created_at: string
}

export type GuidedSearchParams = {
  city: string | null
  date_from: string | null
  date_to: string | null
  people: number | null
  notes: string | null
  search: MarketplaceSearchFilter
}

export type MarketplaceListingOffer = {
  id: string
  tenant_id: string
  page_slug: string
  title: Record<string, string>
  short_text: Record<string, string>
  categories: string[]
  marketplace_themes: string[]
  price_from: number | null
  price_currency: string | null
  tenant_slug: string | null
  tenant_name: string | null
  logo_url: string | null
  rank: number
  available: boolean | null
  availability_checked: boolean
}

export type CartItemInput = {
  listing_id: string
  tenant_slug: string
  page_slug: string
  title: string
  date_from: string | null
  date_to: string | null
  people: number | null
}

export type BookingDispatchResult = {
  listing_id: string
  tenant_slug: string
  page_slug: string
  ok: boolean
  submission_id?: string
  duplicate?: boolean
  error?: string
}

export type MarketplaceSearchResultsResponse = {
  results: MarketplaceListingOffer[]
  params: GuidedSearchParams
}

export type MarketplaceBookResponse = {
  results: BookingDispatchResult[]
  booked_count: number
}
