import type { CompanyCacheRow } from '@/types/company-cache'
import type { ListingCacheRow } from '@/types/listing-cache'

export type MarketplaceSearchFilter = {
  keywords: string | null
  categories: string[]
  tags: string[]
  country: string | null
  city: string | null
}

export type MarketplaceTenantResult = CompanyCacheRow & {
  result_type: 'tenant'
  tenant_slug: string | null
  rank: number
}

export type MarketplaceListingResult = ListingCacheRow & {
  result_type: 'listing'
  tenant_slug: string | null
  tenant_name: string | null
  logo_url: string | null
  rank: number
}

export type MarketplaceSearchResult = MarketplaceTenantResult | MarketplaceListingResult

/** @deprecated alias for tenant-only results */
export type MarketplaceTenantSearchResult = MarketplaceTenantResult

export type MarketplaceSearchResponse = {
  filter: MarketplaceSearchFilter
  parsed_by_ai: boolean
  results: MarketplaceSearchResult[]
}

export type MarketplaceListingSearchResponse = {
  filter: MarketplaceSearchFilter
  parsed_by_ai: boolean
  results: MarketplaceListingResult[]
}
