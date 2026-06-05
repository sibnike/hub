import { Suspense } from 'react'
import { resolveActiveTenantId } from '@/lib/auth/current-tenant'
import { JoinEventClient } from '@/components/exhibitor/join-event-client'

export default async function JoinEventPage() {
  const tenantId = await resolveActiveTenantId()
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
      <JoinEventClient tenantId={tenantId!} />
    </Suspense>
  )
}
