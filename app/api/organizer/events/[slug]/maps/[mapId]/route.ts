import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { validateSvgSize } from '@/lib/svg/limits'
import {
  ensureSvgViewBox,
  isValidSvg,
  sanitizeSvg,
} from '@/lib/svg/sanitize'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string; mapId: string } }

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

async function authorizeMap(supabase: Awaited<ReturnType<typeof createClient>>, mapId: string, eventId: string) {
  const { data: map, error } = await supabase
    .schema('hub')
    .from('event_maps')
    .select('id, event_id, pavilion, floor')
    .eq('id', mapId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return map
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    pavilion?: string
    floor?: number
    sort_order?: number
    svg_content?: string
  }

  const supabase = await createClient()
  const map = await authorizeMap(supabase, params.mapId, event.id)
  if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (body.pavilion !== undefined) patch.pavilion = body.pavilion
  if (body.floor !== undefined) patch.floor = body.floor
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order

  if (body.svg_content !== undefined) {
    const sizeError = validateSvgSize(body.svg_content)
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 413 })
    }

    const sanitized = ensureSvgViewBox(sanitizeSvg(body.svg_content))
    if (!isValidSvg(sanitized)) {
      return NextResponse.json({ error: 'Invalid SVG' }, { status: 400 })
    }
    patch.svg_content = sanitized
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const oldPavilion = map.pavilion
  const oldFloor = map.floor

  const { data, error } = await supabase
    .schema('hub')
    .from('event_maps')
    .update(patch)
    .eq('id', params.mapId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pavilionChanged =
    body.pavilion !== undefined && body.pavilion !== oldPavilion
  const floorChanged = body.floor !== undefined && body.floor !== oldFloor

  return NextResponse.json({
    data,
    warning:
      pavilionChanged || floorChanged
        ? 'Стенды с прежним павильоном/этажом больше не привязаны к этой карте. Обновите их вручную.'
        : null,
  })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema('hub')
    .from('event_maps')
    .delete()
    .eq('id', params.mapId)
    .eq('event_id', event.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
