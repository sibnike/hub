import type { I18nMap } from '@/types/hub-event'

export function getI18nText(
  map: I18nMap | null | undefined,
  locale: string,
  fallback?: string
): string {
  if (!map || typeof map !== 'object') return fallback ?? ''
  return (
    map[locale] ??
    map.ru ??
    map.en ??
    Object.values(map).find((v) => typeof v === 'string' && v.trim()) ??
    fallback ??
    ''
  )
}
