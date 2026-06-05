import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import type { EventLocation, I18nMap } from '@/types/hub-event'

type RouteParams = { params: { slug: string } }

async function loadEvent(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEvent(params.slug)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ data: event })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEvent(params.slug)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: I18nMap
    dates?: { from?: string; to?: string }
    location?: EventLocation
    status?: 'draft' | 'published' | 'archived'
    settings?: Record<string, unknown>
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) patch.name = body.name
  if (body.location !== undefined) patch.location = body.location
  if (body.status !== undefined) patch.status = body.status
  if (body.dates?.from && body.dates?.to) {
    patch.dates = `[${body.dates.from},${body.dates.to}]`
  }
  if (body.settings !== undefined) {
    const current =
      event.settings && typeof event.settings === 'object'
        ? (event.settings as Record<string, unknown>)
        : {}
    patch.settings = { ...current, ...body.settings }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .update(patch)
    .eq('id', event.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEvent(params.slug)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema('hub')
    .from('events')
    .delete()
    .eq('id', event.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
