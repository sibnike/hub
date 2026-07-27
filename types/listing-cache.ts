export type ListingAvailableSlot = {
  date: string
  remaining?: number | null
  total?: number | null
}

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
  cover_image_url?: string | null
  images?: string[]
  market_booking_mode?: 'seats' | 'slots' | null
  next_departure_date?: string | null
  seats_total?: number | null
  seats_left?: number | null
  available_slots?: ListingAvailableSlot[]
  booking_config_id?: string | null
  availability_synced_at?: string | null
  market_discount_tiers?: {
    public: number
    silver: number
    gold: number
  }
}
