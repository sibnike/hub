import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `${process.env.NEXT_PUBLIC_VITRINA_ADMIN}/login?redirect=${process.env.NEXT_PUBLIC_HUB_DOMAIN}`
    )
  }

  redirect('/organizer/events')
}
