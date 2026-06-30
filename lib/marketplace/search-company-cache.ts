import { createAdminClient } from '@/lib/supabase/admin'
import { joinTenants } from '@/lib/hub/join-tenants'
import { isFilterEmpty } from '@/lib/marketplace/normalize-search-filter'
import type { CompanyCacheRow } from '@/types/company-cache'
import type {
  MarketplaceSearchFilter,
  MarketplaceSearchResult,
} from '@/types/marketplace-search'

type SearchRpcRow = {
  tenant_id: string
  name: string | null
  logo_url: string | null
  short_description: Record<string, string> | null
  categories: string[] | null
  tags: string[] | null
  country: string | null
  city: string | null
  website: string | null
  social_links: Record<string, string> | null
  contact_persons: CompanyCacheRow['contact_persons'] | null
  vitrina_page_slug: string | null
  synced_at: string | null
  rank: number | null
}

function toCacheRow(row: SearchRpcRow): CompanyCacheRow {
  return {
    tenant_id: String(row.tenant_id),
    name: row.name,
    logo_url: row.logo_url,
    short_description:
      row.short_description && typeof row.short_description === 'object'
        ? row.short_description
        : {},
    categories: Array.isArray(row.categories) ? row.categories : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    country: row.country,
    city: row.city,
    website: row.website,
    social_links:
      row.social_links && typeof row.social_links === 'object' ? row.social_links : {},
    contact_persons: Array.isArray(row.contact_persons) ? row.contact_persons : [],
    vitrina_page_slug: row.vitrina_page_slug,
    synced_at: row.synced_at,
  }
}

export async function searchCompanyCache(
  filter: MarketplaceSearchFilter,
  limit = 20
): Promise<MarketplaceSearchResult[]> {
  if (isFilterEmpty(filter)) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase.schema('hub').rpc('search_company_cache', {
    p_keywords: filter.keywords,
    p_categories: filter.categories.length > 0 ? filter.categories : null,
    p_tags: filter.tags.length > 0 ? filter.tags : null,
    p_country: filter.country,
    p_city: filter.city,
    p_limit: limit,
  })

  if (error) {
    console.error('[searchCompanyCache]', error.message)
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SearchRpcRow[]
  if (!rows.length) return []

  const withTenants = await joinTenants(
    rows.map((row) => ({ tenant_id: String(row.tenant_id) }))
  )
  const slugByTenant = new Map(
    withTenants.map((r) => [String(r.tenant_id), r.tenant?.slug ?? null])
  )

  return rows.map((row) => ({
    ...toCacheRow(row),
    result_type: 'tenant' as const,
    tenant_slug: slugByTenant.get(String(row.tenant_id)) ?? null,
    rank: typeof row.rank === 'number' ? row.rank : 0,
  }))
}
