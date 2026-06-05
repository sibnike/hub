import { resolveActiveTenantId } from '@/lib/auth/current-tenant'
import { EventsListClient } from '@/components/organizer/events-list-client'

export default async function OrganizerEventsPage() {
  const activeTenantId = await resolveActiveTenantId()
  return <EventsListClient activeTenantId={activeTenantId!} />
}
