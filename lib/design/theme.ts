import { parseEventSettings, type EventSettings } from '@/lib/hub/event-settings'

export type HeroBgType = 'gradient' | 'image' | 'solid'

export type OrganizerContacts = {
  email?: string
  phone?: string
  website?: string
}

export function buildHeroBg(settings: EventSettings): string {
  const type = settings.hero_bg_type ?? 'gradient'

  if (type === 'image' && settings.hero_image_url) {
    return `url('${settings.hero_image_url}')`
  }

  if (type === 'solid' && settings.hero_bg_solid) {
    return settings.hero_bg_solid
  }

  if (settings.hero_bg) {
    return settings.hero_bg
  }

  const from = settings.hero_bg_gradient_from ?? '#F8FAFC'
  const to = settings.hero_bg_gradient_to ?? '#EFF6FF'
  const angle = settings.hero_bg_gradient_angle ?? 135
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`
}

export function isHeroImage(settings: EventSettings): boolean {
  const parsed = parseEventSettings(settings as Record<string, unknown>)
  return (parsed.hero_bg_type ?? 'gradient') === 'image' && !!parsed.hero_image_url
}

export function buildEventThemeStyle(
  raw: Record<string, unknown> | null | undefined
): React.CSSProperties {
  const settings = parseEventSettings(raw)
  const heroBg = buildHeroBg(settings)

  return {
    '--accent': settings.accent_color ?? '#3B82F6',
    '--brand': settings.brand_color ?? '#0F172A',
    '--hero-bg': heroBg,
    '--bg': '#FFFFFF',
    '--surface': '#FFFFFF',
    '--surface2': '#F8FAFC',
    '--text': '#0F172A',
    '--muted': '#64748B',
    '--subtle': '#94A3B8',
    '--border': '#E2E8F0',
    '--border2': '#CBD5E1',
    '--success': '#16A34A',
    '--warning': '#D97706',
    '--error': '#DC2626',
    '--info': '#0284C7',
    '--tier-default': '#6366F1',
    '--shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.05)',
    '--shadow-md': '0 4px 12px rgba(15, 23, 42, 0.08)',
    '--shadow-lg': '0 8px 24px rgba(15, 23, 42, 0.12)',
    '--shadow-xl': '0 16px 48px rgba(15, 23, 42, 0.16)',
  } as React.CSSProperties
}
