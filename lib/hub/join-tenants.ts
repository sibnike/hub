import { createAdminClient } from '@/lib/supabase/admin'

export type TenantSummary = {
  id: string
  name: string
  slug: string
}

export async function joinTenants<T extends { tenant_id: string | null }>(
  rows: T[]
): Promise<(T & { tenant: TenantSummary | null })[]> {
  if (!rows.length) return []

  const supabase = createAdminClient()
  const tenantIds = Array.from(
    new Set(rows.map((r) => r.tenant_id).filter(Boolean) as string[])
  )

  if (!tenantIds.length) {
    return rows.map((r) => ({ ...r, tenant: null }))
  }

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .in('id', tenantIds)

  const map = new Map(tenants?.map((t) => [t.id, t]) ?? [])
  return rows.map((r) => ({
    ...r,
    tenant: r.tenant_id ? map.get(r.tenant_id) ?? null : null,
  }))
}
