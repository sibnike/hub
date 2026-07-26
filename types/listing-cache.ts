export type ListingCacheRow = {
  id: string
  tenant_id: string
  page_slug: string
  title: Record<string, string>
  short_text: Record<string, string>
  categories: string[]
  synced_at: string | null
  marketplace_themes?: string[]
  marketplace_slugs?: string[]
  price_from?: number | null
  price_currency?: string | null
}
