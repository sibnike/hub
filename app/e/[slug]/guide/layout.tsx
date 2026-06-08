import { redirect } from 'next/navigation'
import { GuideHeader } from '@/components/visitor/guide-header'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getCurrentVisitor } from '@/lib/visitor/current'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type LayoutProps = {
  children: React.ReactNode
  params: { slug: string }
}

export default async function GuideLayout({ children, params }: LayoutProps) {
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
    <>
      <GuideHeader
        slug={event.slug}
        name={event.name}
        dates={event.dates}
        location={event.location ?? {}}
        settings={event.settings}
        visitor={visitor}
      />
      {children}
    </>
  )
}
