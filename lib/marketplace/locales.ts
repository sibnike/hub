export const MARKETPLACE_LOCALES = ['ru', 'kz', 'en'] as const

export type MarketplaceLocale = (typeof MARKETPLACE_LOCALES)[number]

export const MARKETPLACE_LOCALE_LABELS: Record<MarketplaceLocale, string> = {
  ru: 'Русский',
  kz: 'Қазақша',
  en: 'English',
}
