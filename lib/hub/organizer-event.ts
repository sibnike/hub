import { createClient } from '@/lib/supabase/server'
import type { HubEventRow } from '@/types/hub-event'

export async function loadEventBySlug(slug: string): Promise<HubEventRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as HubEventRow | null
}

export function hubBaseUrl(): string {
  const domain = process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  return `https://${domain}`
}
