import { createAdminClient } from '@/lib/supabase/admin'
import type { I18nMap } from '@/types/hub-event'

export type HubMarketplace = {
  id: string
  slug: string
  name: I18nMap
  description: I18nMap | null
  theme_slugs: string[]
  settings: Record<string, unknown>
  is_active: boolean
  created_at: string
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
