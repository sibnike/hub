import { redirect } from 'next/navigation'
import { HubHeader } from '@/components/hub/hub-header'
import { TenantSelector } from '@/components/organizer/tenant-selector'
import {
  getCurrentUserTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'

export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenants = await getCurrentUserTenants()
  if (!tenants || tenants.length === 0) {
    redirect(
      `${process.env.NEXT_PUBLIC_VITRINA_ADMIN}/login?redirect=${process.env.NEXT_PUBLIC_HUB_DOMAIN}`
    )
  }

  const activeTenantId = (await resolveActiveTenantId()) ?? tenants[0].id

  return (
    <>
      <HubHeader />
      <TenantSelector tenants={tenants} activeTenantId={activeTenantId} />
      <main className="p-4 md:p-6">{children}</main>
    </>
  )
}
