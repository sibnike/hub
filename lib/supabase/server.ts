import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { mergeAuthCookieOptions } from '@/lib/supabase/auth-cookie'

export async function createClient() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const host = headersList.get('host') ?? undefined

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, mergeAuthCookieOptions(options, host))
            )
          } catch {
            // Server Component — cookies read-only
          }
        },
      },
    }
  )
}
