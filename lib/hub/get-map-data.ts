import { createAdminClient } from '@/lib/supabase/admin'
import type { CompanyCacheRow } from '@/types/company-cache'
import type { EventMapRow, MapStandRow } from '@/types/map'

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

export async function getEventMaps(eventId: string): Promise<EventMapRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_maps')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getEventMaps]', error.message)
    return []
  }

  return (data ?? []) as EventMapRow[]
}

export async function getMapStands(eventId: string): Promise<MapStandRow[]> {
  const supabase = createAdminClient()

  const { data: participations, error: partError } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('id, tenant_id')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')

  if (partError) {
    console.error('[getMapStands] participations', partError.message)
    return []
  }

  if (!participations?.length) return []

  const participationIds = participations.map((p) => String(p.id))
  const tenantIds = Array.from(
    new Set(
      participations
        .map((p) => p.tenant_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )

  const [standsRes, cacheRes, tenantsRes] = await Promise.all([
    supabase
      .schema('hub')
      .from('event_stands')
      .select('*')
      .eq('event_id', eventId)
      .in('participation_id', participationIds),
    tenantIds.length > 0
      ? supabase.schema('hub').from('company_cache').select('*').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tenantIds.length > 0
      ? supabase.from('tenants').select('id, slug').in('id', tenantIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ])

  const cacheByTenant = new Map(
    (cacheRes.data ?? []).map((row) => [
      String(row.tenant_id),
      normalizeCache(row as Record<string, unknown>),
    ])
  )

  const slugByTenant = new Map(
    (tenantsRes.data ?? []).map((t) => [String(t.id), String(t.slug)])
  )

  return (standsRes.data ?? []).map((stand) => {
    const tenantId = stand.tenant_id ? String(stand.tenant_id) : null
    return {
      id: String(stand.id),
      participation_id: String(stand.participation_id),
      event_id: String(stand.event_id),
      tenant_id: tenantId,
      tenant_slug: tenantId ? slugByTenant.get(tenantId) ?? null : null,
      stand_number: typeof stand.stand_number === 'string' ? stand.stand_number : null,
      pavilion: typeof stand.pavilion === 'string' ? stand.pavilion : null,
      floor: typeof stand.floor === 'number' ? stand.floor : 1,
      map_x: typeof stand.map_x === 'number' ? stand.map_x : 0,
      map_y: typeof stand.map_y === 'number' ? stand.map_y : 0,
      map_width: typeof stand.map_width === 'number' ? stand.map_width : 5,
      map_height: typeof stand.map_height === 'number' ? stand.map_height : 5,
      cache: tenantId ? cacheByTenant.get(tenantId) ?? null : null,
    }
  })
}

export function countUnplacedStands(stands: MapStandRow[]): number {
  return stands.filter((s) => s.map_x === 0 && s.map_y === 0).length
}
