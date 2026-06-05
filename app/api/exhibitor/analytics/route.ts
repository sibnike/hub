import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { aggregateEventComparison } from '@/lib/analytics/aggregate'
import type { TrackType } from '@/types/analytics'

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id')

  if (!tenantId || !(await assertTenantAdmin(tenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: participations, error: partError } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('event_id, events:event_id(slug, name, dates)')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 })
  }

  if (!participations?.length) {
    return NextResponse.json({ events: [] })
  }

  const eventIds = participations.map((p) => String(p.event_id))

  const { data: tracks, error: tracksError } = await supabase
    .schema('hub')
    .from('track_events')
    .select('event_id, type, source')
    .eq('tenant_id', tenantId)
    .in('event_id', eventIds)

  if (tracksError) {
    return NextResponse.json({ error: tracksError.message }, { status: 500 })
  }

  const events = aggregateEventComparison(
    participations.map((p) => ({
      event_id: String(p.event_id),
      events: Array.isArray(p.events)
        ? (p.events[0] as { slug: string; name: Record<string, string>; dates: string | null })
        : (p.events as { slug: string; name: Record<string, string>; dates: string | null } | null),
    })),
    (tracks ?? []).map((t) => ({
      event_id: String(t.event_id),
      type: t.type as TrackType,
      source: typeof t.source === 'string' ? t.source : null,
    }))
  )

  return NextResponse.json({ events })
}
