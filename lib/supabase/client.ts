import { createBrowserClient } from '@supabase/ssr'
import { getAuthCookieDomainForHost } from '@/lib/supabase/auth-cookie'

export function createClient() {
  const host = typeof window !== 'undefined' ? window.location.hostname : undefined

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getAuthCookieDomainForHost(host),
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }
  )
}
