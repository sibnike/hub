import { createAdminClient } from '@/lib/supabase/admin'
import { isTenantAvailableOnDate } from '@/lib/marketplace/check-tenant-availability'
import type {
  GuidedSearchParams,
  MarketplaceListingOffer,
} from '@/types/marketplace-guided-search'

type SearchRpcRow = {
  id: string
  tenant_id: string
  page_slug: string
  title: Record<string, string> | null
  short_text: Record<string, string> | null
  categories: string[] | null
  marketplace_themes: string[] | null
  price_from: number | null
  price_currency: string | null
  synced_at: string | null
  rank: number | null
}

async function loadBookingConfigIdsByTenant(
  tenantIds: string[]
): Promise<Map<string, string[]>> {
  if (!tenantIds.length) return new Map()

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('booking_configs')
    .select('id, tenant_id')
    .in('tenant_id', tenantIds)
    .eq('is_active', true)

  const map = new Map<string, string[]>()
  for (const row of data ?? []) {
    const tid = String(row.tenant_id)
    const list = map.get(tid) ?? []
    list.push(String(row.id))
    map.set(tid, list)
  }
  return map
}

export async function searchMarketplaceListings(input: {
  marketplaceThemeSlugs: string[]
  presetThemeSlug: string
  params: GuidedSearchParams
  limit?: number
  checkAvailability?: boolean
}): Promise<MarketplaceListingOffer[]> {
  const supabase = createAdminClient()
  const limit = input.limit ?? 30
  const keywords =
    input.params.search.keywords ??
    input.params.notes ??
    (input.params.search.tags.join(' ') || null)

  const { data, error } = await supabase.schema('hub').rpc('search_marketplace_listings', {
    p_keywords: keywords,
    p_city: input.params.city,
    p_theme_slug: input.presetThemeSlug,
    p_marketplace_themes: input.marketplaceThemeSlugs,
    p_limit: limit,
  })

  if (error) {
    console.error('[searchMarketplaceListings]', error.message)
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SearchRpcRow[]
  if (!rows.length) return []

  const tenantIds = Array.from(new Set(rows.map((r) => String(r.tenant_id))))

  const [{ data: tenants }, { data: companies }, configIdsByTenant] = await Promise.all([
    supabase.from('tenants').select('id, name, slug').in('id', tenantIds),
    supabase
      .schema('hub')
      .from('company_cache')
      .select('tenant_id, logo_url')
      .in('tenant_id', tenantIds),
    loadBookingConfigIdsByTenant(tenantIds),
  ])

  const tenantById = new Map(tenants?.map((t) => [String(t.id), t]) ?? [])
  const logoByTenant = new Map(
    companies?.map((c) => [String(c.tenant_id), c.logo_url as string | null]) ?? []
  )

  const checkDate = input.params.date_from
  const shouldCheck = input.checkAvailability !== false && Boolean(checkDate)

  const offers: MarketplaceListingOffer[] = []

  for (const row of rows) {
    const tenantId = String(row.tenant_id)
    const tenant = tenantById.get(tenantId)
    let available: boolean | null = null
    let availabilityChecked = false

    if (shouldCheck && checkDate) {
      availabilityChecked = true
      const configIds = configIdsByTenant.get(tenantId) ?? []
      available = await isTenantAvailableOnDate(configIds, checkDate)
    }

    offers.push({
      id: String(row.id),
      tenant_id: tenantId,
      page_slug: row.page_slug,
      title: row.title && typeof row.title === 'object' ? row.title : {},
      short_text: row.short_text && typeof row.short_text === 'object' ? row.short_text : {},
      categories: Array.isArray(row.categories) ? row.categories : [],
      marketplace_themes: Array.isArray(row.marketplace_themes) ? row.marketplace_themes : [],
      price_from: row.price_from != null ? Number(row.price_from) : null,
      price_currency: row.price_currency ?? null,
      tenant_slug: tenant?.slug ?? null,
      tenant_name: tenant?.name ?? null,
      logo_url: logoByTenant.get(tenantId) ?? null,
      rank: typeof row.rank === 'number' ? row.rank : 0,
      available,
      availability_checked: availabilityChecked,
    })
  }

  return offers
}

export function sortListingOffers(
  offers: MarketplaceListingOffer[],
  sort: 'price_asc' | 'price_desc' | 'availability'
): MarketplaceListingOffer[] {
  const copy = [...offers]

  if (sort === 'price_asc') {
    copy.sort((a, b) => {
      const pa = a.price_from ?? Number.MAX_SAFE_INTEGER
      const pb = b.price_from ?? Number.MAX_SAFE_INTEGER
      return pa - pb || b.rank - a.rank
    })
    return copy
  }

  if (sort === 'price_desc') {
    copy.sort((a, b) => {
      const pa = a.price_from ?? -1
      const pb = b.price_from ?? -1
      return pb - pa || b.rank - a.rank
    })
    return copy
  }

  copy.sort((a, b) => {
    const av = a.available === false ? 1 : 0
    const bv = b.available === false ? 1 : 0
    if (av !== bv) return av - bv
    const pa = a.price_from ?? Number.MAX_SAFE_INTEGER
    const pb = b.price_from ?? Number.MAX_SAFE_INTEGER
    return pa - pb || b.rank - a.rank
  })

  return copy
}

export function filterListingOffersByAvailability(
  offers: MarketplaceListingOffer[],
  filter: 'all' | 'available' | 'unavailable'
): MarketplaceListingOffer[] {
  if (filter === 'all') return offers
  if (filter === 'available') {
    return offers.filter((o) => o.available !== false)
  }
  return offers.filter((o) => o.available === false)
}
