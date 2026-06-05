import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { generateAccessCode } from '@/lib/access-code'
import { sendInvitation } from '@/lib/email/send-invitation'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string; id: string } }

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  return data as HubEventRow | null
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema('hub')
    .from('event_participations')
    .delete()
    .eq('id', params.id)
    .eq('event_id', event.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { action?: string }
  if (body.action !== 'resend') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: participation, error } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('invited_email')
    .eq('id', params.id)
    .eq('event_id', event.id)
    .maybeSingle()

  if (error || !participation?.invited_email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const code = generateAccessCode(
    event.id,
    participation.invited_email,
    event.access_code_salt
  )
  await sendInvitation(participation.invited_email, event, code)

  return NextResponse.json({ ok: true, code })
}
