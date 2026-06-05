import { createBrowserClient } from '@supabase/ssr'
import { getAuthCookieDomain } from '@/lib/supabase/auth-cookie'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getAuthCookieDomain(),
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }
  )
}
