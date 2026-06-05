import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import type { TrackRow } from '@/types/analytics'

type RouteParams = { params: { slug: string } }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenant_id')

  if (!tenantId || !(await assertTenantAdmin(tenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: event, error: eventError } = await supabase
    .schema('hub')
    .from('events')
    .select('id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 })
  }
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const days = parseInt(searchParams.get('days') ?? '30', 10)
  const since =
    days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  let query = supabase
    .schema('hub')
    .from('track_events')
    .select('type, source, ts')
    .eq('event_id', event.id)
    .eq('tenant_id', tenantId)

  if (since) query = query.gte('ts', since)

  const { data: tracks, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tracks: (tracks ?? []) as TrackRow[] })
}
