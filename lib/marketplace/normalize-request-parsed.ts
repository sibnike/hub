import { emptySearchFilter, normalizeSearchFilter } from '@/lib/marketplace/normalize-search-filter'
import type { MarketplaceRequestParsed } from '@/types/marketplace-request'

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return trimmed
}

function normalizeQuantity(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function emptyRequestParsed(): MarketplaceRequestParsed {
  return {
    search: emptySearchFilter(),
    requested_date: null,
    quantity: null,
    requester_proposed_price: null,
  }
}

export function normalizeRequestParsed(
  input: Partial<MarketplaceRequestParsed> & { search?: Partial<MarketplaceRequestParsed['search']> } | null | undefined,
  validCategorySlugs?: Set<string>,
  fallbackText?: string
): MarketplaceRequestParsed {
  const search = normalizeSearchFilter(input?.search, validCategorySlugs)
  if (
    fallbackText &&
    !search.keywords &&
    search.categories.length === 0 &&
    search.tags.length === 0 &&
    !search.country &&
    !search.city
  ) {
    search.keywords = fallbackText.trim()
  }

  return {
    search,
    requested_date: normalizeIsoDate(input?.requested_date),
    quantity: normalizeQuantity(input?.quantity),
    requester_proposed_price: normalizePrice(input?.requester_proposed_price),
  }
}
