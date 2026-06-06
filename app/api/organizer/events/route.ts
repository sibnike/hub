import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  assertTenantAdminOrPlatform,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { generateSalt } from '@/lib/access-code'
import { isValidEventSlug } from '@/lib/hub/slug-from-title'
import type { EventLocation, I18nMap } from '@/types/hub-event'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await resolveActiveTenantId(
    request.nextUrl.searchParams.get('organizer_tenant_id')
  )
  if (!tenantId || !(await assertTenantAdminOrPlatform(tenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: events, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('organizer_tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventIds = (events ?? []).map((e) => e.id)
  const counts: Record<string, number> = {}

  if (eventIds.length > 0) {
    const { data: parts } = await supabase
      .schema('hub')
      .from('event_participations')
      .select('event_id')
      .in('event_id', eventIds)

    for (const p of parts ?? []) {
      counts[p.event_id] = (counts[p.event_id] ?? 0) + 1
    }
  }

  const data = (events ?? []).map((e) => ({
    ...e,
    participants_count: counts[e.id] ?? 0,
  }))

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    organizer_tenant_id?: string
    slug?: string
    name?: I18nMap
    dates?: { from?: string; to?: string }
    location?: EventLocation
  }

  const organizerTenantId = body.organizer_tenant_id
  if (!organizerTenantId || !(await assertTenantAdminOrPlatform(organizerTenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const slug = String(body.slug ?? '')
    .trim()
    .toLowerCase()
  if (!isValidEventSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const supabase = await createClient()
  const dates =
    body.dates?.from && body.dates?.to
      ? `[${body.dates.from},${body.dates.to}]`
      : null

  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .insert({
      organizer_tenant_id: organizerTenantId,
      slug,
      name: body.name ?? {},
      dates,
      location: body.location ?? {},
      access_code_salt: generateSalt(),
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
