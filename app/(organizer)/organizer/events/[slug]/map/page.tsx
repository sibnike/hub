import { redirect } from 'next/navigation'
import { MapEditor } from '@/components/organizer/map-editor'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { getEventMaps, getMapStands } from '@/lib/hub/get-map-data'
import { createClient } from '@/lib/supabase/server'
import type { HubEventRow } from '@/types/hub-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export default async function OrganizerMapPage({ params }: PageProps) {
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

  const [maps, stands] = await Promise.all([
    getEventMaps(event.id),
    getMapStands(event.id),
  ])

  return (
    <MapEditor
      event={event as HubEventRow}
      eventSlug={params.slug}
      initialMaps={maps}
      initialStands={stands}
    />
  )
}
