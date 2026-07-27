import { createAdminClient } from '@/lib/supabase/admin'
import { isFilterEmpty } from '@/lib/marketplace/normalize-search-filter'
import type { ListingCacheRow } from '@/types/listing-cache'
import type {
  MarketplaceListingResult,
  MarketplaceSearchFilter,
} from '@/types/marketplace-search'

type SearchRpcRow = {
  id: string
  tenant_id: string
  page_slug: string
  title: Record<string, string> | null
  short_text: Record<string, string> | null
  categories: string[] | null
  synced_at: string | null
  rank: number | null
}

type ListingAvailableSlot = {
  date: string
  remaining?: number | null
  total?: number | null
}

type ListingExtraRow = {
  id: string
  page_slug: string
  marketplace_themes: string[] | null
  marketplace_slugs: string[] | null
  price_from: number | null
  price_currency: string | null
  calculator_pricing?: ListingCacheRow['calculator_pricing']
  cover_image_url?: string | null
  images?: string[] | null
  tenant_id: string
  title?: Record<string, string> | null
  short_text?: Record<string, string> | null
  categories?: string[] | null
  synced_at?: string | null
  market_booking_mode?: 'seats' | 'slots' | null
  next_departure_date?: string | null
  seats_total?: number | null
  seats_left?: number | null
  available_slots?: ListingAvailableSlot[] | null
  booking_config_id?: string | null
  availability_synced_at?: string | null
  market_discount_tiers?: {
    public: number
    silver: number
    gold: number
  } | null
}

type CompanyExtraRow = {
  tenant_id: string
  logo_url: string | null
  city: string | null
}

function toListingRow(row: SearchRpcRow, extra?: ListingExtraRow): ListingCacheRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    page_slug: row.page_slug,
    title: row.title && typeof row.title === 'object' ? row.title : {},
    short_text: row.short_text && typeof row.short_text === 'object' ? row.short_text : {},
    categories: Array.isArray(row.categories) ? row.categories : [],
    marketplace_themes: Array.isArray(extra?.marketplace_themes) ? extra.marketplace_themes : [],
    marketplace_slugs: Array.isArray(extra?.marketplace_slugs) ? extra.marketplace_slugs : [],
    price_from: typeof extra?.price_from === 'number' ? extra.price_from : null,
    price_currency: extra?.price_currency ?? null,
    calculator_pricing:
      extra?.calculator_pricing && typeof extra.calculator_pricing === 'object'
        ? extra.calculator_pricing
        : null,
    cover_image_url:
      typeof extra?.cover_image_url === 'string' && extra.cover_image_url.trim()
        ? extra.cover_image_url.trim()
        : null,
    images: Array.isArray(extra?.images)
      ? extra.images.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [],
    synced_at: row.synced_at,
    market_booking_mode: extra?.market_booking_mode ?? null,
    next_departure_date: extra?.next_departure_date ?? null,
    seats_total: typeof extra?.seats_total === 'number' ? extra.seats_total : null,
    seats_left: typeof extra?.seats_left === 'number' ? extra.seats_left : null,
    available_slots: Array.isArray(extra?.available_slots) ? extra.available_slots : [],
    booking_config_id: extra?.booking_config_id ?? null,
    availability_synced_at: extra?.availability_synced_at ?? null,
    market_discount_tiers:
      extra?.market_discount_tiers && typeof extra.market_discount_tiers === 'object'
        ? {
            public: Number((extra.market_discount_tiers as { public?: number }).public) || 0,
            silver: Number((extra.market_discount_tiers as { silver?: number }).silver) || 0,
            gold: Number((extra.market_discount_tiers as { gold?: number }).gold) || 0,
          }
        : { public: 0, silver: 0, gold: 0 },
  }
}

const LISTING_SELECT =
  'id, tenant_id, page_slug, title, short_text, categories, marketplace_themes, marketplace_slugs, price_from, price_currency, calculator_pricing, cover_image_url, images, synced_at, market_booking_mode, next_departure_date, seats_total, seats_left, available_slots, booking_config_id, availability_synced_at, market_discount_tiers'

async function loadApprovedSellerTenantIds(
  marketplaceSlug: string
): Promise<Set<string> | null> {
  const supabase = createAdminClient()
  const { data: market } = await supabase
    .schema('hub')
    .from('marketplaces')
    .select('id')
    .eq('slug', marketplaceSlug)
    .maybeSingle()
  if (!market) return new Set()

  const { data: sellers } = await supabase
    .schema('hub')
    .from('marketplace_sellers')
    .select('tenant_id')
    .eq('marketplace_id', market.id)
    .eq('status', 'approved')

  return new Set((sellers ?? []).map((s) => String(s.tenant_id)))
}

/** Channel-scoped listing browse (TourHub): slugs + approved sellers. */
async function searchByMarketplaceChannel(
  marketplaceSlug: string,
  limit: number
): Promise<MarketplaceListingResult[]> {
  const supabase = createAdminClient()
  const approved = await loadApprovedSellerTenantIds(marketplaceSlug)
  if (!approved || approved.size === 0) return []

  const { data: listings, error } = await supabase
    .schema('hub')
    .from('listing_cache')
    .select(LISTING_SELECT)
    .contains('marketplace_slugs', [marketplaceSlug])
    .limit(Math.min(limit * 3, 150))

  if (error) {
    console.error('[searchByMarketplaceChannel]', error.message)
    throw new Error(error.message)
  }

  const rows = ((listings ?? []) as ListingExtraRow[]).filter((l) =>
    approved.has(String(l.tenant_id))
  )
  const sliced = rows.slice(0, limit)
  if (!sliced.length) return []

  const tenantIds = Array.from(new Set(sliced.map((r) => String(r.tenant_id))))
  const [{ data: tenants }, { data: companies }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug').in('id', tenantIds),
    supabase
      .schema('hub')
      .from('company_cache')
      .select('tenant_id, logo_url, city')
      .in('tenant_id', tenantIds),
  ])

  const tenantById = new Map(tenants?.map((t) => [String(t.id), t]) ?? [])
  const companyByTenant = new Map(
    (companies as CompanyExtraRow[] | null)?.map((c) => [String(c.tenant_id), c]) ?? []
  )

  return sliced.map((row, index) => {
    const tenant = tenantById.get(String(row.tenant_id))
    const company = companyByTenant.get(String(row.tenant_id))
    const rpcLike: SearchRpcRow = {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      page_slug: row.page_slug,
      title: row.title ?? {},
      short_text: row.short_text ?? {},
      categories: row.categories ?? [],
      synced_at: row.synced_at ?? null,
      rank: 1 - index * 0.001,
    }
    return {
      ...toListingRow(rpcLike, row),
      result_type: 'listing' as const,
      tenant_slug: tenant?.slug ?? null,
      tenant_name: tenant?.name ?? null,
      logo_url: company?.logo_url ?? null,
      company_city: company?.city ?? null,
      rank: typeof rpcLike.rank === 'number' ? rpcLike.rank : 0,
    }
  })
}

export async function searchListingCache(
  filter: MarketplaceSearchFilter,
  limit = 20
): Promise<MarketplaceListingResult[]> {
  if (isFilterEmpty(filter)) return []

  if (filter.marketplace) {
    const channelResults = await searchByMarketplaceChannel(filter.marketplace, limit)
    if (
      !filter.keywords &&
      filter.categories.length === 0 &&
      filter.tags.length === 0 &&
      !filter.country &&
      !filter.city
    ) {
      return channelResults
    }
    // Intersect with theme/category filter when both present
    if (filter.categories.length > 0) {
      const catSet = new Set(filter.categories)
      return channelResults.filter(
        (r) =>
          (r.marketplace_themes ?? []).some((t) => catSet.has(t)) ||
          (r.categories ?? []).some((c) => catSet.has(c))
      )
    }
    return channelResults
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.schema('hub').rpc('search_listing_cache', {
    p_keywords: filter.keywords,
    p_categories: filter.categories.length > 0 ? filter.categories : null,
    p_tenant_id: null,
    p_limit: limit,
  })

  if (error) {
    console.error('[searchListingCache]', error.message)
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SearchRpcRow[]
  if (!rows.length) return []

  const listingIds = rows.map((r) => String(r.id))
  const tenantIds = Array.from(new Set(rows.map((r) => String(r.tenant_id))))

  const [{ data: tenants }, { data: companies }, { data: listingExtras }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug').in('id', tenantIds),
    supabase
      .schema('hub')
      .from('company_cache')
      .select('tenant_id, logo_url, city')
      .in('tenant_id', tenantIds),
    supabase
      .schema('hub')
      .from('listing_cache')
      .select(
        'id, tenant_id, marketplace_themes, marketplace_slugs, price_from, price_currency, calculator_pricing, cover_image_url, images, market_booking_mode, next_departure_date, seats_total, seats_left, available_slots, booking_config_id, availability_synced_at, market_discount_tiers'
      )
      .in('id', listingIds),
  ])

  const tenantById = new Map(tenants?.map((t) => [String(t.id), t]) ?? [])
  const companyByTenant = new Map(
    (companies as CompanyExtraRow[] | null)?.map((c) => [String(c.tenant_id), c]) ?? []
  )
  const listingExtraById = new Map(
    (listingExtras as ListingExtraRow[] | null)?.map((l) => [String(l.id), l]) ?? []
  )

  return rows.map((row) => {
    const tenant = tenantById.get(String(row.tenant_id))
    const company = companyByTenant.get(String(row.tenant_id))
    const extra = listingExtraById.get(String(row.id))
    return {
      ...toListingRow(row, extra),
      result_type: 'listing' as const,
      tenant_slug: tenant?.slug ?? null,
      tenant_name: tenant?.name ?? null,
      logo_url: company?.logo_url ?? null,
      company_city: company?.city ?? null,
      rank: typeof row.rank === 'number' ? row.rank : 0,
    }
  })
}
