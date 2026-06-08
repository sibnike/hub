import { notFound } from 'next/navigation'
import { GuideHome } from '@/components/visitor/guide-home'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getCurrentVisitor } from '@/lib/visitor/current'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventPollRow } from '@/types/visitor'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function GuideHomePage({ params }: PageProps) {
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
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .schema('hub')
      .from('event_poll_answers')
      .select('poll_id')
      .eq('visitor_id', visitor.id),
  ])

  const answeredPollIds = (answers ?? []).map((a) => a.poll_id)

  return (
    <GuideHome
      event={event}
      visitor={visitor}
      activePolls={(polls ?? []) as EventPollRow[]}
      answeredPollIds={answeredPollIds}
    />
  )
}
