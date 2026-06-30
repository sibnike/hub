import { createAdminClient } from '@/lib/supabase/admin'
import { isTenantAvailableOnDate } from '@/lib/marketplace/check-tenant-availability'
import { searchCompanyCache } from '@/lib/marketplace/search-company-cache'
import { searchListingCache } from '@/lib/marketplace/search-listing-cache'
import type { MatchedRequestTenant, MarketplaceRequestParsed } from '@/types/marketplace-request'

export const DEFAULT_REQUEST_TARGET_LIMIT = 8

type Candidate = MatchedRequestTenant & {
  companyRank: number
  listingRank: number
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

function mergeCandidates(
  companies: Awaited<ReturnType<typeof searchCompanyCache>>,
  listings: Awaited<ReturnType<typeof searchListingCache>>
): Candidate[] {
  const byTenant = new Map<string, Candidate>()

  for (const row of companies) {
    if (row.result_type !== 'tenant') continue
    byTenant.set(row.tenant_id, {
      tenant_id: row.tenant_id,
      tenant_slug: row.tenant_slug,
      tenant_name: row.name,
      rank: row.rank,
      source: 'company',
      companyRank: row.rank,
      listingRank: 0,
    })
  }

  for (const row of listings) {
    const existing = byTenant.get(row.tenant_id)
    if (existing) {
      existing.listingRank = row.rank
      existing.rank = Math.max(existing.rank, row.rank)
      existing.source = 'both'
      if (!existing.tenant_name && row.tenant_name) {
        existing.tenant_name = row.tenant_name
      }
      continue
    }
    byTenant.set(row.tenant_id, {
      tenant_id: row.tenant_id,
      tenant_slug: row.tenant_slug,
      tenant_name: row.tenant_name,
      rank: row.rank,
      source: 'listing',
      companyRank: 0,
      listingRank: row.rank,
    })
  }

  return Array.from(byTenant.values()).sort((a, b) => b.rank - a.rank)
}

export async function matchRequestTenants(
  parsed: MarketplaceRequestParsed,
  limit = DEFAULT_REQUEST_TARGET_LIMIT
): Promise<MatchedRequestTenant[]> {
  const searchLimit = Math.min(Math.max(limit * 2, limit), 50)

  const [companies, listings] = await Promise.all([
    searchCompanyCache(parsed.search, searchLimit),
    searchListingCache(parsed.search, searchLimit),
  ])

  const merged = mergeCandidates(companies, listings)
  if (!merged.length) return []

  const configIdsByTenant = await loadBookingConfigIdsByTenant(
    merged.map((c) => c.tenant_id)
  )

  const available: MatchedRequestTenant[] = []

  for (const candidate of merged) {
    if (available.length >= limit) break

    const configIds = configIdsByTenant.get(candidate.tenant_id) ?? []
    const ok = await isTenantAvailableOnDate(configIds, parsed.requested_date)
    if (!ok) continue

    available.push({
      tenant_id: candidate.tenant_id,
      tenant_slug: candidate.tenant_slug,
      tenant_name: candidate.tenant_name,
      rank: candidate.rank,
      source: candidate.source,
    })
  }

  return available
}
