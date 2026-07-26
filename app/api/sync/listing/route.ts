import { createAdminClient } from '@/lib/supabase/admin'
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

type ListingAvailableSlot = {
  date: string
  remaining?: number | null
  total?: number | null
}

type ListingSyncBody = {
  action: 'upsert' | 'delete'
  tenant_id: string
  page_slug: string
  title?: Record<string, string>
  short_text?: Record<string, string>
  categories?: string[]
  marketplace_themes?: string[]
  marketplace_slugs?: string[]
  price_from?: number | null
  price_currency?: string | null
  market_booking_mode?: 'seats' | 'slots' | null
  next_departure_date?: string | null
  seats_total?: number | null
  seats_left?: number | null
  available_slots?: ListingAvailableSlot[]
  booking_config_id?: string | null
  availability_synced_at?: string | null
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const signature = request.headers.get('x-vitrina-signature')
  const body = await request.text()

  const expected = createHmac('sha256', process.env.VITRINA_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== `sha256=${expected}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = JSON.parse(body) as ListingSyncBody

  if (!data.tenant_id || !data.page_slug || !data.action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (data.action === 'delete') {
    const { error } = await supabase
      .schema('hub')
      .from('listing_cache')
      .delete()
      .eq('tenant_id', data.tenant_id)
      .eq('page_slug', data.page_slug)

    if (error) {
      console.error('listing_cache delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  const row: Record<string, unknown> = {
    tenant_id: data.tenant_id,
    page_slug: data.page_slug,
    title: data.title ?? {},
    short_text: data.short_text ?? {},
    categories: data.categories ?? [],
    synced_at: new Date().toISOString(),
  }

  if (data.marketplace_themes !== undefined) {
    row.marketplace_themes = data.marketplace_themes
  }
  if (data.marketplace_slugs !== undefined) {
    row.marketplace_slugs = data.marketplace_slugs
  }
  if (data.price_from !== undefined) {
    row.price_from = data.price_from
  }
  if (data.price_currency !== undefined) {
    row.price_currency = data.price_currency
  }
  if (data.market_booking_mode !== undefined) {
    row.market_booking_mode = data.market_booking_mode
  }
  if (data.next_departure_date !== undefined) {
    row.next_departure_date = data.next_departure_date
  }
  if (data.seats_total !== undefined) {
    row.seats_total = data.seats_total
  }
  if (data.seats_left !== undefined) {
    row.seats_left = data.seats_left
  }
  if (data.available_slots !== undefined) {
    row.available_slots = data.available_slots
  }
  if (data.booking_config_id !== undefined) {
    row.booking_config_id = data.booking_config_id
  }
  if (data.availability_synced_at !== undefined) {
    row.availability_synced_at = data.availability_synced_at
  }

  const { error } = await supabase.schema('hub').from('listing_cache').upsert(row, {
    onConflict: 'tenant_id,page_slug',
  })

  if (error) {
    console.error('listing_cache upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
