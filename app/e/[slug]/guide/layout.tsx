import { redirect, notFound } from 'next/navigation'
import { GuideHeader } from '@/components/visitor/guide-header'
import { EventThemeShell } from '@/components/design/event-theme-shell'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getCurrentVisitor } from '@/lib/visitor/current'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type LayoutProps = {
  children: React.ReactNode
  modal: React.ReactNode
  params: { slug: string }
}

export default async function GuideLayout({ children, modal, params }: LayoutProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const visitor = await getCurrentVisitor(event.id)
  if (!visitor) {
    redirect(`/e/${params.slug}?need_invite=1`)
  }

  const supabase = createAdminClient()
  await supabase
    .schema('hub')
    .from('event_visitors')
    .update({ last_visit_at: new Date().toISOString() })
    .eq('id', visitor.id)

  return (
    <EventThemeShell settings={event.settings}>
      <GuideHeader
        slug={event.slug}
        name={event.name}
        dates={event.dates}
        location={event.location ?? {}}
        settings={event.settings}
        visitor={visitor}
      />
      {children}
      {modal}
    </EventThemeShell>
  )
}
