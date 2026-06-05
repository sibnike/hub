import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { hashAccessCode } from '@/lib/access-code'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    event_slug?: string
    access_code?: string
    tenant_id?: string
  }

  const { event_slug, access_code, tenant_id } = body
  if (!event_slug || !access_code || !tenant_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!(await assertTenantAdmin(tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('id, access_code_salt')
    .eq('slug', event_slug)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const codeHash = hashAccessCode(access_code)

  const { data: participation } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('*')
    .eq('event_id', event.id)
    .eq('access_code', codeHash)
    .eq('status', 'pending')
    .maybeSingle()

  if (!participation) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .schema('hub')
    .from('event_participations')
    .update({
      tenant_id,
      status: 'confirmed',
      joined_at: new Date().toISOString(),
    })
    .eq('id', participation.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase
    .schema('hub')
    .from('event_stands')
    .update({ tenant_id })
    .eq('participation_id', participation.id)

  return NextResponse.json({ ok: true, participation_id: participation.id })
}
