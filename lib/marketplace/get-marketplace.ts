import { createAdminClient } from '@/lib/supabase/admin'
import {
  normalizeMarketplaceHost,
  resolveMarketplaceHost,
} from '@/lib/marketplace/marketplace-host'
import type { I18nMap } from '@/types/hub-event'

export type HubMarketplace = {
  id: string
  slug: string
  name: I18nMap
  description: I18nMap | null
  theme_slugs: string[]
  settings: Record<string, unknown>
  is_active: boolean
  subdomain: string | null
  custom_domain: string | null
  created_at: string
}

function getMarketplaceRoot(): string {
  return normalizeMarketplaceHost(
    process.env.NEXT_PUBLIC_MARKETPLACE_ROOT ?? 'microp.app'
  )
}

export async function getActiveMarketplaceBySlug(
  slug: string
): Promise<HubMarketplace | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('marketplaces')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[getActiveMarketplaceBySlug]', slug, error.message)
    return null
  }

  if (!data) return null

  return data as HubMarketplace
}

export async function getMarketplaceByHost(host: string): Promise<HubMarketplace | null> {
  const normalizedHost = normalizeMarketplaceHost(host)
  const resolution = resolveMarketplaceHost(normalizedHost, getMarketplaceRoot())
  if (!resolution) return null

  const supabase = createAdminClient()

  if (resolution.kind === 'flagship') {
    const { data, error } = await supabase
      .schema('hub')
      .from('marketplaces')
      .select('*')
      .is('subdomain', null)
      .is('custom_domain', null)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[getMarketplaceByHost] flagship', normalizedHost, error.message)
      return null
    }

    return data ? (data as HubMarketplace) : null
  }

  if (resolution.kind === 'subdomain') {
    const { data, error } = await supabase
      .schema('hub')
      .from('marketplaces')
      .select('*')
      .eq('subdomain', resolution.subdomain)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[getMarketplaceByHost] subdomain', resolution.subdomain, error.message)
      return null
    }

    return data ? (data as HubMarketplace) : null
  }

  const { data, error } = await supabase
    .schema('hub')
    .from('marketplaces')
    .select('*')
    .eq('custom_domain', resolution.domain)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[getMarketplaceByHost] custom_domain', resolution.domain, error.message)
    return null
  }

  return data ? (data as HubMarketplace) : null
}
