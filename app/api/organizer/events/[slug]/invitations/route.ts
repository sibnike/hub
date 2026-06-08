import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { hubBaseUrl, loadEventBySlug } from '@/lib/hub/organizer-event'
import { generateSecureToken } from '@/lib/visitor/tokens'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: { slug: string } }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_invitations')
    .select('*, tier:tier_id(*)')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const base = hubBaseUrl()
  const withUrls = (data ?? []).map((inv) => ({
    ...inv,
    invite_url: `${base}/e/${event.slug}/invite/${inv.invite_token}`,
  }))

  return NextResponse.json({ data: withUrls })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { tier_id?: string; name?: string }
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema('hub')
    .from('event_invitations')
    .insert({
      event_id: event.id,
      tier_id: body.tier_id ?? null,
      invite_token: generateSecureToken(),
      name: body.name?.trim() || null,
    })
    .select('*, tier:tier_id(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteUrl = `${hubBaseUrl()}/e/${event.slug}/invite/${data.invite_token}`
  return NextResponse.json({ data: { ...data, invite_url: inviteUrl } })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { id: string; is_active?: boolean; name?: string }
  if (!body.id) {
    return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.name !== undefined) updates.name = body.name?.trim() || null

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_invitations')
    .update(updates)
    .eq('id', body.id)
    .eq('event_id', event.id)
    .select('*, tier:tier_id(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
