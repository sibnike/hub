import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/current-tenant'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string; standId: string } }

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as HubEventRow | null
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await requireTenantAdmin(event.organizer_tenant_id)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: access.status }
    )
  }

  const body = (await request.json()) as {
    map_x?: number
    map_y?: number
    map_width?: number
    map_height?: number
  }

  const supabase = await createClient()
  const { data: stand, error: standError } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('id, event_id')
    .eq('id', params.standId)
    .eq('event_id', event.id)
    .maybeSingle()

  if (standError) {
    return NextResponse.json({ error: standError.message }, { status: 500 })
  }
  if (!stand) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .schema('hub')
    .from('event_stands')
    .update({
      map_x: body.map_x,
      map_y: body.map_y,
      map_width: body.map_width,
      map_height: body.map_height,
    })
    .eq('id', params.standId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
