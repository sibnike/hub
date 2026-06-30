import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

export function emptySearchFilter(): MarketplaceSearchFilter {
  return {
    keywords: null,
    categories: [],
    tags: [],
    country: null,
    city: null,
  }
}

export function normalizeSearchFilter(
  input: Partial<MarketplaceSearchFilter> | null | undefined,
  validCategorySlugs?: Set<string>
): MarketplaceSearchFilter {
  const keywords =
    typeof input?.keywords === 'string' && input.keywords.trim()
      ? input.keywords.trim()
      : null

  const categories = Array.isArray(input?.categories)
    ? input.categories.filter(
        (c): c is string =>
          typeof c === 'string' &&
          c.trim().length > 0 &&
          (!validCategorySlugs || validCategorySlugs.has(c))
      )
    : []

  const tags = Array.isArray(input?.tags)
    ? input.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []

  const country =
    typeof input?.country === 'string' && input.country.trim()
      ? input.country.trim()
      : null

  const city =
    typeof input?.city === 'string' && input.city.trim() ? input.city.trim() : null

  return { keywords, categories, tags, country, city }
}

export function isFilterEmpty(filter: MarketplaceSearchFilter): boolean {
  return (
    !filter.keywords &&
    filter.categories.length === 0 &&
    filter.tags.length === 0 &&
    !filter.country &&
    !filter.city
  )
}
