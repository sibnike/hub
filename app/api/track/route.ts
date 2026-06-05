import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import type { TrackSource, TrackType } from '@/types/analytics'

const VALID_TYPES: TrackType[] = [
  'profile_view',
  'stand_view',
  'qr_scan',
  'catalog_view',
  'map_view',
  'save',
  'form_submit',
]

const VALID_SOURCES: TrackSource[] = ['catalog', 'map', 'qr', 'direct', 'search']

const DEDUP_VIEW_TYPES: TrackType[] = ['profile_view', 'catalog_view', 'map_view']

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`track:${ip}`, 60, 60_000)) {
    return NextResponse.json({ ok: true }, { status: 429 })
  }

  try {
    const body = (await request.json()) as {
      event_slug?: string
      tenant_id?: string
      type?: string
      source?: string
      session_id?: string
    }

    const { event_slug, tenant_id, type, source, session_id } = body

    if (!event_slug || !type || !VALID_TYPES.includes(type as TrackType)) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()
    const { data: event } = await supabase
      .schema('hub')
      .from('events')
      .select('id')
      .eq('slug', event_slug)
      .eq('status', 'published')
      .maybeSingle()

    if (!event) return NextResponse.json({ ok: true })

    if (
      session_id &&
      DEDUP_VIEW_TYPES.includes(type as TrackType)
    ) {
      let dedupQuery = supabase
        .schema('hub')
        .from('track_events')
        .select('id')
        .eq('event_id', event.id)
        .eq('type', type)
        .eq('session_id', session_id)

      if (tenant_id) {
        dedupQuery = dedupQuery.eq('tenant_id', tenant_id)
      } else {
        dedupQuery = dedupQuery.is('tenant_id', null)
      }

      const { data: existing } = await dedupQuery.maybeSingle()
      if (existing) return NextResponse.json({ ok: true })
    }

    await supabase.schema('hub').from('track_events').insert({
      event_id: event.id,
      tenant_id: tenant_id ?? null,
      type,
      source: source && VALID_SOURCES.includes(source as TrackSource) ? source : null,
      session_id: session_id ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
