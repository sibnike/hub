import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
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
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    pavilion?: string
    floor?: number
  }

  const supabase = await createClient()
  const { data: stand, error: standError } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('id')
    .eq('id', params.standId)
    .eq('event_id', event.id)
    .maybeSingle()

  if (standError) {
    return NextResponse.json({ error: standError.message }, { status: 500 })
  }
  if (!stand) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {
    map_x: 0,
    map_y: 0,
  }
  if (body.pavilion !== undefined) patch.pavilion = body.pavilion
  if (body.floor !== undefined) patch.floor = body.floor

  const { data, error } = await supabase
    .schema('hub')
    .from('event_stands')
    .update(patch)
    .eq('id', params.standId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
