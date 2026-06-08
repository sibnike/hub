import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVisitorWelcomeEmail } from '@/lib/email/templates/visitor-confirm'
import { setVisitorSessionCookie } from '@/lib/visitor/cookie'
import { getI18nText } from '@/lib/i18n/get-text'
import type { VisitorTierRow } from '@/types/visitor'

type RouteParams = { params: { slug: string; token: string } }

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createAdminClient()

  const { data: visitor } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('id, event_id, name, email, bonus_balance, confirm_token, tier:tier_id(*)')
    .eq('confirm_token', params.token)
    .maybeSingle()

  if (!visitor) {
    redirect(`/e/${params.slug}/invalid-link`)
  }

  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('slug, name')
    .eq('id', visitor.event_id)
    .maybeSingle()

  if (!event || event.slug !== params.slug) {
    redirect(`/e/${params.slug}/invalid-link`)
  }

  await supabase
    .schema('hub')
    .from('event_visitors')
    .update({
      email_confirmed: true,
      confirm_token: null,
      last_visit_at: new Date().toISOString(),
    })
    .eq('id', visitor.id)

  await setVisitorSessionCookie(visitor.id, visitor.event_id)

  const tierRaw = visitor.tier
  const tier: VisitorTierRow | null = Array.isArray(tierRaw)
    ? (tierRaw[0] as VisitorTierRow | undefined) ?? null
    : (tierRaw as VisitorTierRow | null)
  void sendVisitorWelcomeEmail({
    email: visitor.email,
    name: visitor.name,
    eventSlug: event.slug,
    eventName: event.name as Record<string, string>,
    tierName: tier ? getI18nText(tier.name, 'ru', tier.slug) : undefined,
    tierDescription: tier?.description ? getI18nText(tier.description, 'ru') : undefined,
    bonusBalance: visitor.bonus_balance ?? 0,
  })

  redirect(`/e/${params.slug}/guide`)
}
