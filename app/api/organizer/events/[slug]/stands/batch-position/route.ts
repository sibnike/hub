import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string } }

type PositionUpdate = {
  standId: string
  map_x: number
  map_y: number
  map_width: number
  map_height: number
}

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

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await requireTenantAdminOrPlatform(event.organizer_tenant_id)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: access.status }
    )
  }

  const body = (await request.json()) as { updates?: PositionUpdate[] }
  const updates = body.updates ?? []
  if (updates.length === 0) {
    return NextResponse.json({ error: 'updates required' }, { status: 400 })
  }

  const supabase = await createClient()

  for (const u of updates) {
    const { error } = await supabase
      .schema('hub')
      .from('event_stands')
      .update({
        map_x: u.map_x,
        map_y: u.map_y,
        map_width: u.map_width,
        map_height: u.map_height,
      })
      .eq('id', u.standId)
      .eq('event_id', event.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
