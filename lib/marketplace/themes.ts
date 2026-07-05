import { createAdminClient } from '@/lib/supabase/admin'
import type { I18nMap } from '@/types/hub-event'

export type MarketplaceTheme = {
  slug: string
  name: I18nMap
  description: I18nMap | null
  sort_order: number
  is_active: boolean
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cache: { themes: MarketplaceTheme[]; expiresAt: number } | null = null

export async function getMarketplaceThemes(): Promise<MarketplaceTheme[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.themes
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('marketplace_themes')
    .select('slug, name, description, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getMarketplaceThemes]', error.message)
    return cache?.themes ?? []
  }

  const themes = (data ?? []) as MarketplaceTheme[]
  cache = { themes, expiresAt: Date.now() + CACHE_TTL_MS }
  return themes
}

export function clearMarketplaceThemesCache(): void {
  cache = null
}
