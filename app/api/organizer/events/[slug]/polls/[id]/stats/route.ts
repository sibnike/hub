import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { createClient } from '@/lib/supabase/server'
import type { PollOption } from '@/types/visitor'

type RouteParams = { params: { slug: string; id: string } }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: poll } = await supabase
    .schema('hub')
    .from('event_polls')
    .select('*')
    .eq('id', params.id)
    .eq('event_id', event.id)
    .maybeSingle()

  if (!poll) {
    return NextResponse.json({ error: 'Опрос не найден' }, { status: 404 })
  }

  const { data: answers } = await supabase
    .schema('hub')
    .from('event_poll_answers')
    .select('selected_option_ids')
    .eq('poll_id', params.id)

  const options = (poll.options as PollOption[]) ?? []
  const counts = new Map<string, number>()
  for (const opt of options) counts.set(opt.id, 0)

  for (const answer of answers ?? []) {
    for (const optId of answer.selected_option_ids) {
      counts.set(optId, (counts.get(optId) ?? 0) + 1)
    }
  }

  const total = answers?.length ?? 0
  const stats = options.map((opt) => {
    const count = counts.get(opt.id) ?? 0
    return {
      option_id: opt.id,
      label: opt.label,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })

  return NextResponse.json({ data: { poll, total_answers: total, stats } })
}
