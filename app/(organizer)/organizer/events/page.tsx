import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { EventsListClient } from '@/components/organizer/events-list-client'
import { Card, CardContent } from '@/components/ui/card'

export default async function OrganizerEventsPage() {
  const tenants = await getAccessibleTenants()
  if (tenants.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-muted-foreground">
          <p>У вас пока нет доступа ни к одному тенанту.</p>
          <p>Обратитесь к администратору платформы.</p>
        </CardContent>
      </Card>
    )
  }

  const activeTenantId = await resolveActiveTenantId()
  return <EventsListClient activeTenantId={activeTenantId!} />
}
