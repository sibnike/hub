import { redirect } from 'next/navigation'
import { EventAnalyticsDashboard } from '@/components/organizer/event-analytics-dashboard'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { getEventMaps } from '@/lib/hub/get-map-data'
import { createClient } from '@/lib/supabase/server'
import type { HubEventRow } from '@/types/hub-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export default async function OrganizerAnalyticsPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    redirect('/organizer/events')
  }

  const hubEvent = event as HubEventRow
  const title = hubEvent.name.ru ?? hubEvent.name.en ?? hubEvent.slug
  const maps = await getEventMaps(hubEvent.id)

  return (
    <EventAnalyticsDashboard
      eventSlug={params.slug}
      eventTitle={title}
      maps={maps}
    />
  )
}
