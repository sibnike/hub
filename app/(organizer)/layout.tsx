import { redirect } from 'next/navigation'
import { HubHeader } from '@/components/hub/hub-header'
import { TenantSelector } from '@/components/organizer/tenant-selector'
import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { createClient } from '@/lib/supabase/server'

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `${process.env.NEXT_PUBLIC_VITRINA_ADMIN}/login?redirect=${process.env.NEXT_PUBLIC_HUB_DOMAIN}`
    )
  }

  const tenants = await getAccessibleTenants()
  const activeTenantId =
    tenants.length > 0
      ? ((await resolveActiveTenantId()) ?? tenants[0].id)
      : null

  return (
    <>
      <HubHeader />
      {tenants.length > 0 && activeTenantId && (
        <TenantSelector tenants={tenants} activeTenantId={activeTenantId} />
      )}
      <main className="p-4 md:p-6">{children}</main>
    </>
  )
}
