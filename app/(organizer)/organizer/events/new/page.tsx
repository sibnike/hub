import { resolveActiveTenantId } from '@/lib/auth/current-tenant'
import { EventFormClient } from '@/components/organizer/event-form-client'

export default async function NewEventPage() {
  const tenantId = await resolveActiveTenantId()
  return <EventFormClient organizerTenantId={tenantId!} />
}
