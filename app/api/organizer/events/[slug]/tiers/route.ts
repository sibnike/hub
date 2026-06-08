import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: { slug: string } }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitor_tiers')
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
    slug: string
    name: Record<string, string>
    description?: Record<string, string>
    color?: string
    welcome_bonus?: number
    is_default?: boolean
    sort_order?: number
  }

  if (!body.slug?.trim() || !body.name) {
    return NextResponse.json({ error: 'slug и name обязательны' }, { status: 400 })
  }

  const supabase = await createClient()

  if (body.is_default) {
    await supabase
      .schema('hub')
      .from('event_visitor_tiers')
      .update({ is_default: false })
      .eq('event_id', event.id)
  }

  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitor_tiers')
    .insert({
      event_id: event.id,
      slug: body.slug.trim().toLowerCase(),
      name: body.name,
      description: body.description ?? null,
      color: body.color ?? null,
      welcome_bonus: body.welcome_bonus ?? 0,
      is_default: body.is_default ?? false,
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
    slug?: string
    name?: Record<string, string>
    description?: Record<string, string> | null
    color?: string | null
    welcome_bonus?: number
    is_default?: boolean
    sort_order?: number
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  }

  const supabase = await createClient()

  if (body.is_default) {
    await supabase
      .schema('hub')
      .from('event_visitor_tiers')
      .update({ is_default: false })
      .eq('event_id', event.id)
  }

  const updates: Record<string, unknown> = {}
  if (body.slug !== undefined) updates.slug = body.slug.trim().toLowerCase()
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.color !== undefined) updates.color = body.color
  if (body.welcome_bonus !== undefined) updates.welcome_bonus = body.welcome_bonus
  if (body.is_default !== undefined) updates.is_default = body.is_default
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitor_tiers')
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
    .from('event_visitor_tiers')
    .delete()
    .eq('id', body.id)
    .eq('event_id', event.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
