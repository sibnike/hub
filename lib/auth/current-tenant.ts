import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { OrganizerTenant } from '@/types/hub-event'

export const TENANT_COOKIE = 'hub_active_tenant_id'

type TenantRow = { id: string; slug: string; name: string }

export async function getCurrentUserTenants(): Promise<OrganizerTenant[] | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('tenant_admins')
    .select('tenant_id, tenants(id, slug, name)')
    .eq('user_id', user.id)

  return (
    data
      ?.map((row) => {
        const t = row.tenants as TenantRow | TenantRow[] | null
        const tenant = Array.isArray(t) ? t[0] : t
        if (!tenant?.id) return null
        return { id: tenant.id, slug: tenant.slug, name: tenant.name }
      })
      .filter((t): t is OrganizerTenant => t !== null) ?? []
  )
}

export async function assertTenantAdmin(tenantId: string): Promise<boolean> {
  const access = await requireTenantAdmin(tenantId)
  return access.ok
}

export type TenantAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 }

export async function requireTenantAdmin(
  tenantId: string
): Promise<TenantAccessResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const { data } = await supabase
    .from('tenant_admins')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return data ? { ok: true } : { ok: false, status: 403 }
}

export async function resolveActiveTenantId(
  preferredTenantId?: string | null
): Promise<string | null> {
  const tenants = await getCurrentUserTenants()
  if (!tenants || tenants.length === 0) return null

  if (preferredTenantId && tenants.some((t) => t.id === preferredTenantId)) {
    return preferredTenantId
  }

  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(TENANT_COOKIE)?.value
  if (fromCookie && tenants.some((t) => t.id === fromCookie)) {
    return fromCookie
  }

  return tenants[0].id
}
