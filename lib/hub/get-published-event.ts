import { createAdminClient } from '@/lib/supabase/admin'
import type { HubEventRow } from '@/types/hub-event'

export async function getPublishedEvent(slug: string): Promise<HubEventRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[getPublishedEvent]', slug, error.message)
    return null
  }

  return data as HubEventRow | null
}
