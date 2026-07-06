import type { FontPairSlug } from '@/lib/event-fonts'
import type { HeroBgType } from '@/lib/design/theme'
import { getI18nText } from '@/lib/i18n/get-text'
import type { I18nMap } from '@/types/hub-event'

export type MarketplaceSettings = {
  accent_color?: string
  brand_color?: string
  font_pair?: FontPairSlug
  hero_bg_type?: HeroBgType
  hero_image_url?: string
  hero_bg_solid?: string
  hero_bg?: string
  hero_bg_gradient_from?: string
  hero_bg_gradient_to?: string
  hero_bg_gradient_angle?: number
  logo_url?: string
  favicon_url?: string
  display_name?: I18nMap
  hero_title?: I18nMap
  hero_subtitle?: I18nMap
  footer_text?: I18nMap
}

const FONT_PAIRS: FontPairSlug[] = ['modern', 'editorial', 'premium', 'tech', 'bold']

function parseI18nMap(raw: unknown): I18nMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const result: I18nMap = {}
  for (const loc of ['ru', 'kz', 'en'] as const) {
    const value = (raw as Record<string, unknown>)[loc]
    if (typeof value === 'string' && value.trim()) {
      result[loc] = value.trim()
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function parseMarketplaceSettings(
  raw: Record<string, unknown> | null | undefined
): MarketplaceSettings {
  if (!raw || typeof raw !== 'object') return {}

  const fontPair =
    typeof raw.font_pair === 'string' && FONT_PAIRS.includes(raw.font_pair as FontPairSlug)
      ? (raw.font_pair as FontPairSlug)
      : undefined

  const heroBgType =
    raw.hero_bg_type === 'gradient' || raw.hero_bg_type === 'image' || raw.hero_bg_type === 'solid'
      ? raw.hero_bg_type
      : undefined

  return {
    accent_color: typeof raw.accent_color === 'string' ? raw.accent_color : undefined,
    brand_color: typeof raw.brand_color === 'string' ? raw.brand_color : undefined,
    font_pair: fontPair,
    hero_bg_type: heroBgType,
    hero_image_url: typeof raw.hero_image_url === 'string' ? raw.hero_image_url : undefined,
    hero_bg_solid: typeof raw.hero_bg_solid === 'string' ? raw.hero_bg_solid : undefined,
    hero_bg: typeof raw.hero_bg === 'string' ? raw.hero_bg : undefined,
    hero_bg_gradient_from:
      typeof raw.hero_bg_gradient_from === 'string' ? raw.hero_bg_gradient_from : undefined,
    hero_bg_gradient_to:
      typeof raw.hero_bg_gradient_to === 'string' ? raw.hero_bg_gradient_to : undefined,
    hero_bg_gradient_angle:
      typeof raw.hero_bg_gradient_angle === 'number' ? raw.hero_bg_gradient_angle : undefined,
    logo_url: typeof raw.logo_url === 'string' ? raw.logo_url : undefined,
    favicon_url: typeof raw.favicon_url === 'string' ? raw.favicon_url : undefined,
    display_name: parseI18nMap(raw.display_name),
    hero_title: parseI18nMap(raw.hero_title),
    hero_subtitle: parseI18nMap(raw.hero_subtitle),
    footer_text: parseI18nMap(raw.footer_text),
  }
}

export function getMarketplaceDisplayName(
  settings: MarketplaceSettings,
  marketplaceName: I18nMap,
  locale: string,
  slug: string
): string {
  const fromSettings = getI18nText(settings.display_name, locale)
  if (fromSettings) return fromSettings
  return getI18nText(marketplaceName, locale, slug)
}
