import type { I18nMap } from '@/types/hub-event'

export type EventSettings = {
  theme?: string
  accent_color?: string
  font?: string
  locales?: string[]
  logo_url?: string
  custom_domain?: string
  custom_domain_prefix?: string
  brand_logo_url?: string
  brand_color?: string
  brand_footer_text?: string
  welcome_message?: I18nMap
  hero_image_url?: string
}

export function parseEventSettings(raw: Record<string, unknown> | null | undefined): EventSettings {
  if (!raw || typeof raw !== 'object') return {}
  const locales = Array.isArray(raw.locales)
    ? raw.locales.filter((l): l is string => typeof l === 'string')
    : undefined
  return {
    theme: typeof raw.theme === 'string' ? raw.theme : undefined,
    accent_color: typeof raw.accent_color === 'string' ? raw.accent_color : undefined,
    font: typeof raw.font === 'string' ? raw.font : undefined,
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
  }
}

export function getEventLocales(settings: EventSettings): string[] {
  if (settings.locales && settings.locales.length > 0) return settings.locales
  return ['ru', 'en']
}

export function getDefaultAccentColor(settings: EventSettings): string {
  return settings.brand_color ?? settings.accent_color ?? '#4f46e5'
}

export function getEventLogoUrl(settings: EventSettings): string | undefined {
  return settings.brand_logo_url ?? settings.logo_url
}

export function isWhiteLabelHost(host: string | null, settings: EventSettings): boolean {
  if (!host || !settings.custom_domain) return false
  return host === settings.custom_domain
}

export type EventNameMap = I18nMap
