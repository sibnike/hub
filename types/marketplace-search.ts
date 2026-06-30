import type { CompanyCacheRow } from '@/types/company-cache'

export type MarketplaceSearchFilter = {
  keywords: string | null
  categories: string[]
  tags: string[]
  country: string | null
  city: string | null
}

export type MarketplaceSearchResult = CompanyCacheRow & {
  tenant_slug: string | null
  rank: number
}

export type MarketplaceSearchResponse = {
  filter: MarketplaceSearchFilter
  parsed_by_ai: boolean
  results: MarketplaceSearchResult[]
}
