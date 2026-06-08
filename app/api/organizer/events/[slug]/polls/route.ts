import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { createClient } from '@/lib/supabase/server'
import type { PollOption } from '@/types/visitor'

type RouteParams = { params: { slug: string } }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_polls')
    .select('*')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    question: Record<string, string>
    options: PollOption[]
    type: 'single' | 'multi'
    bonus_reward?: number
    sort_order?: number
  }

  if (!body.question || !body.options?.length || !body.type) {
    return NextResponse.json({ error: 'question, options и type обязательны' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_polls')
    .insert({
      event_id: event.id,
      question: body.question,
      options: body.options,
      type: body.type,
      bonus_reward: body.bonus_reward ?? 0,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    id: string
    question?: Record<string, string>
    options?: PollOption[]
    type?: 'single' | 'multi'
    bonus_reward?: number
    is_active?: boolean
    sort_order?: number
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.question !== undefined) updates.question = body.question
  if (body.options !== undefined) updates.options = body.options
  if (body.type !== undefined) updates.type = body.type
  if (body.bonus_reward !== undefined) updates.bonus_reward = body.bonus_reward
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_polls')
    .update(updates)
    .eq('id', body.id)
    .eq('event_id', event.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { id: string }
  if (!body.id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema('hub')
    .from('event_polls')
    .delete()
    .eq('id', body.id)
    .eq('event_id', event.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
