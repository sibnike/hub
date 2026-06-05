import { createAdminClient } from '@/lib/supabase/admin'
import type { CompanyCacheRow } from '@/types/company-cache'
import type { CatalogParticipant } from '@/types/catalog'

function normalizeCache(row: Record<string, unknown>): CompanyCacheRow {
  return {
    tenant_id: String(row.tenant_id),
    name: typeof row.name === 'string' ? row.name : null,
    logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
    short_description:
      row.short_description && typeof row.short_description === 'object'
        ? (row.short_description as CompanyCacheRow['short_description'])
        : {},
    categories: Array.isArray(row.categories)
      ? row.categories.filter((c): c is string => typeof c === 'string')
      : [],
    tags: Array.isArray(row.tags)
      ? row.tags.filter((t): t is string => typeof t === 'string')
      : [],
    country: typeof row.country === 'string' ? row.country : null,
    website: typeof row.website === 'string' ? row.website : null,
    social_links:
      row.social_links && typeof row.social_links === 'object'
        ? (row.social_links as Record<string, string>)
        : {},
    contact_persons: Array.isArray(row.contact_persons)
      ? (row.contact_persons as CompanyCacheRow['contact_persons'])
      : [],
    vitrina_page_slug:
      typeof row.vitrina_page_slug === 'string' ? row.vitrina_page_slug : null,
    synced_at: typeof row.synced_at === 'string' ? row.synced_at : null,
  }
}

export async function getCatalogParticipants(
  eventId: string
): Promise<CatalogParticipant[]> {
  const supabase = createAdminClient()

  const { data: participations, error: partError } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('id, tenant_id')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .not('tenant_id', 'is', null)

  if (partError) {
    console.error('[getCatalogParticipants] participations', partError.message)
    return []
  }

  if (!participations?.length) return []

  const tenantIds = Array.from(
    new Set(
      participations
        .map((p) => p.tenant_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  const [cacheRes, standsRes, tenantsRes] = await Promise.all([
    supabase.schema('hub').from('company_cache').select('*').in('tenant_id', tenantIds),
    supabase
      .schema('hub')
      .from('event_stands')
      .select('tenant_id, stand_number, pavilion, floor')
      .eq('event_id', eventId)
      .in('tenant_id', tenantIds),
    supabase.from('tenants').select('id, slug').in('id', tenantIds),
  ])

  const cacheByTenant = new Map(
    (cacheRes.data ?? []).map((row) => [
      String(row.tenant_id),
      normalizeCache(row as Record<string, unknown>),
    ])
  )

  const standByTenant = new Map<
    string,
    { stand_number: string | null; pavilion: string | null; floor: number | null }
  >()
  for (const stand of standsRes.data ?? []) {
    const tid = String(stand.tenant_id)
    if (!standByTenant.has(tid)) {
      standByTenant.set(tid, {
        stand_number: typeof stand.stand_number === 'string' ? stand.stand_number : null,
        pavilion: typeof stand.pavilion === 'string' ? stand.pavilion : null,
        floor: typeof stand.floor === 'number' ? stand.floor : null,
      })
    }
  }

  const slugByTenant = new Map(
    (tenantsRes.data ?? []).map((t) => [String(t.id), String(t.slug)])
  )

  const result: CatalogParticipant[] = []

  for (const part of participations) {
    const tenantId = String(part.tenant_id)
    const cache = cacheByTenant.get(tenantId)
    const tenantSlug = slugByTenant.get(tenantId)
    if (!cache || !tenantSlug) continue

    result.push({
      id: String(part.id),
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      cache,
      stand: standByTenant.get(tenantId) ?? null,
    })
  }

  return result
}
