/**
 * Serverless DB access = HTTP (PostgREST), not TCP Postgres.
 * Do not add pg/DATABASE_URL. Direct SQL later → Supavisor transaction :6543 only.
 * See: docs/YANBADA_ARCHITECTURE.md §«Доступ к БД из Vercel Serverless»
 */
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}
