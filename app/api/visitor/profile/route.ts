import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVisitorFromCookie } from '@/lib/visitor/current'

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('event_id')
  const payload = await getVisitorFromCookie()

  if (!eventId || !payload || payload.event_id !== eventId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: visitor, error } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('*, tier:tier_id(*)')
    .eq('id', payload.visitor_id)
    .maybeSingle()

  if (error || !visitor) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  }

  const { data: bonusLog } = await supabase
    .schema('hub')
    .from('event_visitor_bonus_log')
    .select('*')
    .eq('visitor_id', payload.visitor_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ data: { visitor, bonus_log: bonusLog ?? [] } })
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as {
    event_id: string
    name?: string
    phone?: string
    country?: string
    city?: string
    language?: string
  }

  const payload = await getVisitorFromCookie()
  if (!payload || payload.event_id !== body.event_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updates: Record<string, string | null> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.phone !== undefined) updates.phone = body.phone.trim() || null
  if (body.country !== undefined) updates.country = body.country.trim() || null
  if (body.city !== undefined) updates.city = body.city.trim() || null
  if (body.language !== undefined) updates.language = body.language

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitors')
    .update(updates)
    .eq('id', payload.visitor_id)
    .select('*, tier:tier_id(*)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
