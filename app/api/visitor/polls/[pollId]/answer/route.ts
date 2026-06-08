import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVisitorFromCookie } from '@/lib/visitor/current'

type RouteParams = { params: { pollId: string } }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const body = (await request.json()) as {
    event_id: string
    selected_option_ids: string[]
  }

  const payload = await getVisitorFromCookie()
  if (!payload || payload.event_id !== body.event_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!body.selected_option_ids?.length) {
    return NextResponse.json({ error: 'Выберите вариант ответа' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: poll } = await supabase
    .schema('hub')
    .from('event_polls')
    .select('*')
    .eq('id', params.pollId)
    .eq('event_id', body.event_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!poll) {
    return NextResponse.json({ error: 'Опрос не найден' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .schema('hub')
    .from('event_poll_answers')
    .select('id')
    .eq('poll_id', params.pollId)
    .eq('visitor_id', payload.visitor_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Вы уже ответили на этот опрос' }, { status: 409 })
  }

  const { error: answerError } = await supabase.schema('hub').from('event_poll_answers').insert({
    poll_id: params.pollId,
    visitor_id: payload.visitor_id,
    selected_option_ids: body.selected_option_ids,
  })

  if (answerError) {
    return NextResponse.json({ error: answerError.message }, { status: 500 })
  }

  const reward = poll.bonus_reward ?? 0
  if (reward > 0) {
    const { data: visitor } = await supabase
      .schema('hub')
      .from('event_visitors')
      .select('bonus_balance')
      .eq('id', payload.visitor_id)
      .single()

    const newBalance = (visitor?.bonus_balance ?? 0) + reward

    await supabase
      .schema('hub')
      .from('event_visitors')
      .update({ bonus_balance: newBalance })
      .eq('id', payload.visitor_id)

    await supabase.schema('hub').from('event_visitor_bonus_log').insert({
      visitor_id: payload.visitor_id,
      amount: reward,
      reason: `poll:${params.pollId}`,
    })
  }

  return NextResponse.json({ ok: true, bonus_reward: reward })
}
