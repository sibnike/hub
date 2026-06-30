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

function toListingRow(row: SearchRpcRow): ListingCacheRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    page_slug: row.page_slug,
    title:
      row.title && typeof row.title === 'object' ? row.title : {},
    short_text:
      row.short_text && typeof row.short_text === 'object' ? row.short_text : {},
    categories: Array.isArray(row.categories) ? row.categories : [],
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

  const tenantIds = Array.from(new Set(rows.map((r) => String(r.tenant_id))))

  const [{ data: tenants }, { data: companies }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug').in('id', tenantIds),
    supabase.schema('hub').from('company_cache').select('tenant_id, logo_url').in('tenant_id', tenantIds),
  ])

  const tenantById = new Map(tenants?.map((t) => [String(t.id), t]) ?? [])
  const logoByTenant = new Map(
    companies?.map((c) => [String(c.tenant_id), c.logo_url as string | null]) ?? []
  )

  return rows.map((row) => {
    const tenant = tenantById.get(String(row.tenant_id))
    return {
      ...toListingRow(row),
      result_type: 'listing' as const,
      tenant_slug: tenant?.slug ?? null,
      tenant_name: tenant?.name ?? null,
      logo_url: logoByTenant.get(String(row.tenant_id)) ?? null,
      rank: typeof row.rank === 'number' ? row.rank : 0,
    }
  })
}
