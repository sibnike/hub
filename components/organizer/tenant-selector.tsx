'use client'

import type { OrganizerTenant } from '@/types/hub-event'

export function TenantSelector({
  tenants,
  activeTenantId,
  variant = 'bar',
  label,
}: {
  tenants: OrganizerTenant[]
  activeTenantId: string
  variant?: 'bar' | 'inline'
  label?: string
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

  const select = (
    <select
      className="h-8 max-w-[12rem] truncate rounded-md border border-border bg-background px-2 text-sm text-foreground sm:max-w-xs"
      value={activeTenantId}
      onChange={(e) => void switchTenant(e.target.value)}
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  )

  if (variant === 'inline') {
    return (
      <div className="flex shrink-0 items-center gap-2 text-sm">
        {label ? <span className="hidden text-muted-foreground sm:inline">{label}</span> : null}
        {select}
      </div>
    )
  }

  return <div className="border-b bg-muted/30 px-4 py-2">{select}</div>
}
