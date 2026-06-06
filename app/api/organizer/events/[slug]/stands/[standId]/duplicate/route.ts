import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
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

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: stand, error: standError } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('*')
    .eq('id', params.standId)
    .eq('event_id', event.id)
    .maybeSingle()

  if (standError) {
    return NextResponse.json({ error: standError.message }, { status: 500 })
  }
  if (!stand) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .schema('hub')
    .from('event_stands')
    .insert({
      participation_id: stand.participation_id,
      event_id: stand.event_id,
      tenant_id: stand.tenant_id,
      stand_number: stand.stand_number,
      pavilion: stand.pavilion,
      floor: stand.floor,
      map_x: Math.min(98, (stand.map_x ?? 0) + 2),
      map_y: Math.min(98, (stand.map_y ?? 0) + 2),
      map_width: stand.map_width,
      map_height: stand.map_height,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
