import { notFound } from 'next/navigation'
import { EventThemeShell } from '@/components/design/event-theme-shell'
import { RegistrationForm } from '@/components/visitor/registration-form'
import { InvalidInvite } from '@/components/visitor/invalid-invite'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventInvitationRow } from '@/types/visitor'
import type { HubEventRow } from '@/types/hub-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; token: string }
}

export default async function InvitePage({ params }: PageProps) {
  const supabase = createAdminClient()

  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!event) notFound()

  const { data: invitation } = await supabase
    .schema('hub')
    .from('event_invitations')
    .select('*, tier:tier_id(*)')
    .eq('invite_token', params.token)
    .maybeSingle()

  const shell = (content: React.ReactNode) => (
    <EventThemeShell settings={event.settings as Record<string, unknown>}>
      {content}
    </EventThemeShell>
  )

  if (!invitation || invitation.event_id !== event.id) {
    return shell(<InvalidInvite slug={params.slug} reason="invalid" />)
  }

  if (!invitation.is_active) {
    return shell(<InvalidInvite slug={params.slug} reason="inactive" />)
  }

  return shell(
    <RegistrationForm
      event={event as HubEventRow}
      invitation={invitation as EventInvitationRow}
      inviteToken={params.token}
    />
  )
}
