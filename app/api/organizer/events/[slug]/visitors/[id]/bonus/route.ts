import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: { slug: string; id: string } }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { amount: number; reason?: string }
  if (!body.amount || body.amount === 0) {
    return NextResponse.json({ error: 'amount обязателен' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: visitor } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('bonus_balance')
    .eq('id', params.id)
    .eq('event_id', event.id)
    .maybeSingle()

  if (!visitor) {
    return NextResponse.json({ error: 'Посетитель не найден' }, { status: 404 })
  }

  const newBalance = (visitor.bonus_balance ?? 0) + body.amount

  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitors')
    .update({ bonus_balance: newBalance })
    .eq('id', params.id)
    .select('*, tier:tier_id(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.schema('hub').from('event_visitor_bonus_log').insert({
    visitor_id: params.id,
    amount: body.amount,
    reason: body.reason?.trim() || 'manual',
  })

  return NextResponse.json({ data })
}
