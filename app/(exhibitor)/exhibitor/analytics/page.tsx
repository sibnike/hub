import { ExhibitorComparisonDashboard } from '@/components/exhibitor/exhibitor-comparison-dashboard'
import {
  getCurrentUserTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'

export const dynamic = 'force-dynamic'

export default async function ExhibitorAnalyticsPage() {
  const tenants = (await getCurrentUserTenants()) ?? []
  const activeTenantId = (await resolveActiveTenantId()) ?? tenants[0]?.id ?? ''

  return (
    <ExhibitorComparisonDashboard
      tenants={tenants}
      initialTenantId={activeTenantId}
    />
  )
}
