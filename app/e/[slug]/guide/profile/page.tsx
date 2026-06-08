import { notFound } from 'next/navigation'
import { ProfilePage } from '@/components/visitor/profile-page'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getCurrentVisitor } from '@/lib/visitor/current'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BonusLogRow } from '@/types/visitor'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function GuideProfilePage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const visitor = await getCurrentVisitor(event.id)
  if (!visitor) notFound()

  const supabase = createAdminClient()
  const { data: bonusLog } = await supabase
    .schema('hub')
    .from('event_visitor_bonus_log')
    .select('*')
    .eq('visitor_id', visitor.id)
    .order('created_at', { ascending: false })

  return (
    <ProfilePage
      eventId={event.id}
      eventSlug={event.slug}
      visitor={visitor}
      bonusLog={(bonusLog ?? []) as BonusLogRow[]}
    />
  )
}
