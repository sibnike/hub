'use client'

import type { OrganizerTenant } from '@/types/hub-event'

export function TenantSelector({
  tenants,
  activeTenantId,
}: {
  tenants: OrganizerTenant[]
  activeTenantId: string
}) {
  if (tenants.length <= 1) return null

  async function switchTenant(tenantId: string) {
    await fetch('/api/organizer/tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId }),
    })
    window.location.reload()
  }

  return (
    <div className="border-b px-4 py-2 bg-muted/30">
      <select
        className="h-8 rounded-md border bg-background px-2 text-sm"
        value={activeTenantId}
        onChange={(e) => void switchTenant(e.target.value)}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
