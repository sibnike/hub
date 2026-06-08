import { notFound } from 'next/navigation'
import { PollsPage } from '@/components/visitor/polls-page'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getCurrentVisitor } from '@/lib/visitor/current'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventPollRow } from '@/types/visitor'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function GuidePollsPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const visitor = await getCurrentVisitor(event.id)
  if (!visitor) notFound()

  const supabase = createAdminClient()
  const [{ data: polls }, { data: answers }] = await Promise.all([
    supabase
      .schema('hub')
      .from('event_polls')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true }),
    supabase
      .schema('hub')
      .from('event_poll_answers')
      .select('poll_id, selected_option_ids')
      .eq('visitor_id', visitor.id),
  ])

  const answeredMap = new Map<string, string[]>()
  for (const a of answers ?? []) {
    answeredMap.set(a.poll_id, a.selected_option_ids)
  }

  return (
    <PollsPage
      eventId={event.id}
      eventSlug={event.slug}
      polls={(polls ?? []) as EventPollRow[]}
      answeredMap={answeredMap}
      initialBalance={visitor.bonus_balance}
    />
  )
}
