import { createAdminClient } from '@/lib/supabase/admin'
import type { CompanyCacheRow } from '@/types/company-cache'
import type { CatalogStand } from '@/types/catalog'
import type { HubEventRow } from '@/types/hub-event'
import { getPublishedEvent } from '@/lib/hub/get-published-event'

export type CompanyInEvent = {
  event: HubEventRow
  tenant_id: string
  tenant_slug: string
  cache: CompanyCacheRow
  stand: CatalogStand | null
}

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
    city: typeof row.city === 'string' ? row.city : null,
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

export async function getCompanyInEvent(
  eventSlug: string,
  tenantSlug: string
): Promise<CompanyInEvent | null> {
  const event = await getPublishedEvent(eventSlug)
  if (!event) return null

  const supabase = createAdminClient()

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (tenantError || !tenant) return null

  const { data: participation } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('id')
    .eq('event_id', event.id)
    .eq('tenant_id', tenant.id)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (!participation) return null

  const [{ data: cacheRow }, { data: standRow }] = await Promise.all([
    supabase
      .schema('hub')
      .from('company_cache')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    supabase
      .schema('hub')
      .from('event_stands')
      .select('id, stand_number, pavilion, floor')
      .eq('event_id', event.id)
      .eq('tenant_id', tenant.id)
      .limit(1)
      .maybeSingle(),
  ])

  if (!cacheRow) return null

  return {
    event,
    tenant_id: String(tenant.id),
    tenant_slug: String(tenant.slug),
    cache: normalizeCache(cacheRow as Record<string, unknown>),
    stand: standRow
      ? {
          id: typeof standRow.id === 'string' ? standRow.id : undefined,
          stand_number:
            typeof standRow.stand_number === 'string' ? standRow.stand_number : null,
          pavilion: typeof standRow.pavilion === 'string' ? standRow.pavilion : null,
          floor: typeof standRow.floor === 'number' ? standRow.floor : null,
        }
      : null,
  }
}
