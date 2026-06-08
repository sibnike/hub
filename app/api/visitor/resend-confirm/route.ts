import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVisitorConfirmEmail } from '@/lib/email/templates/visitor-confirm'
import { generateSecureToken } from '@/lib/visitor/tokens'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email: string; event_slug: string }
  const email = body.email?.trim().toLowerCase()

  if (!email || !body.event_slug) {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('id, slug, name')
    .eq('slug', body.event_slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
  }

  const { data: visitor } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('id, name, email_confirmed')
    .eq('event_id', event.id)
    .eq('email', email)
    .maybeSingle()

  if (!visitor || visitor.email_confirmed) {
    return NextResponse.json({ ok: true })
  }

  const confirmToken = generateSecureToken()
  await supabase
    .schema('hub')
    .from('event_visitors')
    .update({ confirm_token: confirmToken })
    .eq('id', visitor.id)

  await sendVisitorConfirmEmail({
    email,
    name: visitor.name,
    eventSlug: event.slug,
    eventName: event.name as Record<string, string>,
    confirmToken,
  })

  return NextResponse.json({ ok: true })
}
