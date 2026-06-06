import { getAccessibleTenants } from '@/lib/auth/current-tenant'
import { ExhibitorEventsClient } from '@/components/exhibitor/exhibitor-events-client'
import { Card, CardContent } from '@/components/ui/card'

export default async function ExhibitorEventsPage() {
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

  return <ExhibitorEventsClient />
}
