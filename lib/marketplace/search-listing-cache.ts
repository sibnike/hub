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

type ListingExtraRow = {
  id: string
  marketplace_themes: string[] | null
  price_from: number | null
  price_currency: string | null
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
    price_from: typeof extra?.price_from === 'number' ? extra.price_from : null,
    price_currency: extra?.price_currency ?? null,
    synced_at: row.synced_at,
  }
}

export async function searchListingCache(
  filter: MarketplaceSearchFilter,
  limit = 20
): Promise<MarketplaceListingResult[]> {
  if (isFilterEmpty(filter)) return []

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
      .select('id, marketplace_themes, price_from, price_currency')
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
