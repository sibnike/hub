import { redirect } from 'next/navigation'
import { HubHeader } from '@/components/hub/hub-header'
import { getCurrentUserTenants } from '@/lib/auth/current-tenant'

export default async function ExhibitorLayout({
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

  return (
    <>
      <HubHeader />
      <main className="p-4 md:p-6">{children}</main>
    </>
  )
}
