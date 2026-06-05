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

type RouteParams = { params: { slug: string } }

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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_maps')
    .select('*')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as {
    pavilion?: string
    floor?: number
    svg_content?: string
    sort_order?: number
  }

  if (!body.svg_content?.trim()) {
    return NextResponse.json({ error: 'svg_content required' }, { status: 400 })
  }

  const sizeError = validateSvgSize(body.svg_content)
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 })
  }

  const sanitized = ensureSvgViewBox(sanitizeSvg(body.svg_content))
  if (!isValidSvg(sanitized)) {
    return NextResponse.json({ error: 'Invalid SVG' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_maps')
    .insert({
      event_id: event.id,
      pavilion: body.pavilion ?? 'main',
      floor: body.floor ?? 1,
      svg_content: sanitized,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
