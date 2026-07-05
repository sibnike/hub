import { redirect } from 'next/navigation'
import { HubHeader } from '@/components/hub/hub-header'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
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

  if (!(await isPlatformAdmin())) {
    redirect('/marketplace')
  }

  return (
    <>
      <HubHeader />
      <main className="p-4 md:p-6">{children}</main>
    </>
  )
}
