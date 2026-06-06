import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import type { CompanyCacheBrief, TrackRow } from '@/types/analytics'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string } }

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('id, organizer_tenant_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Pick<HubEventRow, 'id' | 'organizer_tenant_id'> | null
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30', 10)
  const since =
    days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  const supabase = await createClient()
  let query = supabase
    .schema('hub')
    .from('track_events')
    .select('type, source, tenant_id, ts')
    .eq('event_id', event.id)

  if (since) query = query.gte('ts', since)

  const [{ data: tracks, error: tracksError }, { data: cache, error: cacheError }] =
    await Promise.all([
      query,
      supabase
        .schema('hub')
        .from('company_cache')
        .select('tenant_id, name, logo_url'),
    ])

  if (tracksError) {
    return NextResponse.json({ error: tracksError.message }, { status: 500 })
  }
  if (cacheError) {
    return NextResponse.json({ error: cacheError.message }, { status: 500 })
  }

  return NextResponse.json({
    tracks: (tracks ?? []) as TrackRow[],
    cache: (cache ?? []) as CompanyCacheBrief[],
  })
}
