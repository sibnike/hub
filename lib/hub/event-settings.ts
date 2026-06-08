import type { FontPairSlug } from '@/lib/event-fonts'
import type { HeroBgType, OrganizerContacts } from '@/lib/design/theme'
import type { I18nMap } from '@/types/hub-event'

export type EventSettings = {
  theme?: string
  accent_color?: string
  font?: string
  font_pair?: FontPairSlug
  locales?: string[]
  logo_url?: string
  custom_domain?: string
  custom_domain_prefix?: string
  brand_logo_url?: string
  brand_color?: string
  brand_footer_text?: string
  welcome_message?: I18nMap
  hero_image_url?: string
  hero_bg?: string
  hero_bg_type?: HeroBgType
  hero_bg_gradient_from?: string
  hero_bg_gradient_to?: string
  hero_bg_gradient_angle?: number
  hero_bg_solid?: string
  organizer_contacts?: OrganizerContacts
}

const FONT_PAIRS: FontPairSlug[] = ['modern', 'editorial', 'premium', 'tech', 'bold']

export function parseEventSettings(raw: Record<string, unknown> | null | undefined): EventSettings {
  if (!raw || typeof raw !== 'object') return {}
  const locales = Array.isArray(raw.locales)
    ? raw.locales.filter((l): l is string => typeof l === 'string')
    : undefined

  const fontPair =
    typeof raw.font_pair === 'string' && FONT_PAIRS.includes(raw.font_pair as FontPairSlug)
      ? (raw.font_pair as FontPairSlug)
      : undefined

  const heroBgType =
    raw.hero_bg_type === 'gradient' || raw.hero_bg_type === 'image' || raw.hero_bg_type === 'solid'
      ? raw.hero_bg_type
      : undefined

  let organizer_contacts: OrganizerContacts | undefined
  if (raw.organizer_contacts && typeof raw.organizer_contacts === 'object') {
    const c = raw.organizer_contacts as Record<string, unknown>
    organizer_contacts = {
      email: typeof c.email === 'string' ? c.email : undefined,
      phone: typeof c.phone === 'string' ? c.phone : undefined,
      website: typeof c.website === 'string' ? c.website : undefined,
    }
  }

  return {
    theme: typeof raw.theme === 'string' ? raw.theme : undefined,
    accent_color: typeof raw.accent_color === 'string' ? raw.accent_color : undefined,
    font: typeof raw.font === 'string' ? raw.font : undefined,
    font_pair: fontPair,
    locales,
    logo_url: typeof raw.logo_url === 'string' ? raw.logo_url : undefined,
    custom_domain: typeof raw.custom_domain === 'string' ? raw.custom_domain : undefined,
    custom_domain_prefix:
      typeof raw.custom_domain_prefix === 'string' ? raw.custom_domain_prefix : undefined,
    brand_logo_url: typeof raw.brand_logo_url === 'string' ? raw.brand_logo_url : undefined,
    brand_color: typeof raw.brand_color === 'string' ? raw.brand_color : undefined,
    brand_footer_text:
      typeof raw.brand_footer_text === 'string' ? raw.brand_footer_text : undefined,
    welcome_message:
      raw.welcome_message && typeof raw.welcome_message === 'object'
        ? (raw.welcome_message as I18nMap)
        : undefined,
    hero_image_url:
      typeof raw.hero_image_url === 'string' ? raw.hero_image_url : undefined,
    hero_bg: typeof raw.hero_bg === 'string' ? raw.hero_bg : undefined,
    hero_bg_type: heroBgType,
    hero_bg_gradient_from:
      typeof raw.hero_bg_gradient_from === 'string' ? raw.hero_bg_gradient_from : undefined,
    hero_bg_gradient_to:
      typeof raw.hero_bg_gradient_to === 'string' ? raw.hero_bg_gradient_to : undefined,
    hero_bg_gradient_angle:
      typeof raw.hero_bg_gradient_angle === 'number' ? raw.hero_bg_gradient_angle : undefined,
    hero_bg_solid: typeof raw.hero_bg_solid === 'string' ? raw.hero_bg_solid : undefined,
    organizer_contacts,
  }
}

export function getEventLocales(settings: EventSettings): string[] {
  if (settings.locales && settings.locales.length > 0) return settings.locales
  return ['ru', 'en']
}

export function getDefaultAccentColor(settings: EventSettings): string {
  return settings.accent_color ?? settings.brand_color ?? '#3B82F6'
}

export function getEventLogoUrl(settings: EventSettings): string | undefined {
  return settings.brand_logo_url ?? settings.logo_url
}

export function isWhiteLabelHost(host: string | null, settings: EventSettings): boolean {
  if (!host || !settings.custom_domain) return false
  return host === settings.custom_domain
}

export type EventNameMap = I18nMap
