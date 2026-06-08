import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVisitorConfirmEmail } from '@/lib/email/templates/visitor-confirm'
import { setVisitorSessionCookie } from '@/lib/visitor/cookie'
import { generateSecureToken } from '@/lib/visitor/tokens'
import type { VisitorTierRow } from '@/types/visitor'

type RegisterBody = {
  invitation_token: string
  email: string
  name: string
  phone?: string
  country?: string
  city?: string
  language?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterBody
  const email = body.email?.trim().toLowerCase()
  const name = body.name?.trim()

  if (!body.invitation_token || !email || !name) {
    return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: invitation } = await supabase
    .schema('hub')
    .from('event_invitations')
    .select('*, tier:tier_id(*), event:event_id(id, slug, name, status)')
    .eq('invite_token', body.invitation_token)
    .eq('is_active', true)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.json({ error: 'Приглашение недействительно' }, { status: 403 })
  }

  const event = invitation.event as {
    id: string
    slug: string
    name: Record<string, string>
    status: string
  } | null

  if (!event || event.status !== 'published') {
    return NextResponse.json({ error: 'Событие недоступно' }, { status: 404 })
  }

  const tier = invitation.tier as VisitorTierRow | null

  const { data: existing } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('*')
    .eq('event_id', event.id)
    .eq('email', email)
    .maybeSingle()

  if (existing?.email_confirmed) {
    await setVisitorSessionCookie(existing.id, event.id)
    return NextResponse.json({
      ok: true,
      status: 'already_registered',
      redirect: `/e/${event.slug}/guide`,
    })
  }

  if (existing && !existing.email_confirmed) {
    const confirmToken = generateSecureToken()
    await supabase
      .schema('hub')
      .from('event_visitors')
      .update({
        name,
        phone: body.phone?.trim() || null,
        country: body.country?.trim() || null,
        city: body.city?.trim() || null,
        language: body.language ?? 'ru',
        confirm_token: confirmToken,
      })
      .eq('id', existing.id)

    await sendVisitorConfirmEmail({
      email,
      name,
      eventSlug: event.slug,
      eventName: event.name,
      confirmToken,
    })

    return NextResponse.json({ ok: true, status: 'check_email' })
  }

  const sessionToken = generateSecureToken()
  const confirmToken = generateSecureToken()
  const welcomeBonus = tier?.welcome_bonus ?? 0

  const { data: visitor, error: insertError } = await supabase
    .schema('hub')
    .from('event_visitors')
    .insert({
      event_id: event.id,
      tier_id: invitation.tier_id,
      invitation_id: invitation.id,
      email,
      name,
      phone: body.phone?.trim() || null,
      country: body.country?.trim() || null,
      city: body.city?.trim() || null,
      language: body.language ?? 'ru',
      session_token: sessionToken,
      email_confirmed: false,
      confirm_token: confirmToken,
      bonus_balance: welcomeBonus,
    })
    .select('id')
    .single()

  if (insertError || !visitor) {
    return NextResponse.json({ error: insertError?.message ?? 'Ошибка регистрации' }, { status: 500 })
  }

  if (welcomeBonus > 0) {
    await supabase.schema('hub').from('event_visitor_bonus_log').insert({
      visitor_id: visitor.id,
      amount: welcomeBonus,
      reason: 'welcome',
    })
  }

  await supabase
    .schema('hub')
    .from('event_invitations')
    .update({ uses_count: (invitation.uses_count ?? 0) + 1 })
    .eq('id', invitation.id)

  await sendVisitorConfirmEmail({
    email,
    name,
    eventSlug: event.slug,
    eventName: event.name,
    confirmToken,
  })

  return NextResponse.json({ ok: true, status: 'check_email' })
}
