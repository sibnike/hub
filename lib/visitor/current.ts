import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { VISITOR_SESSION_COOKIE } from '@/lib/visitor/cookie'
import { verifyVisitorToken } from '@/lib/visitor/session'
import type { EventVisitorRow } from '@/types/visitor'

export async function getCurrentVisitor(eventId: string): Promise<EventVisitorRow | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(VISITOR_SESSION_COOKIE)?.value
  if (!token) return null

  const payload = verifyVisitorToken(token)
  if (!payload || payload.event_id !== eventId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .schema('hub')
    .from('event_visitors')
    .select('*, tier:tier_id(*)')
    .eq('id', payload.visitor_id)
    .eq('email_confirmed', true)
    .maybeSingle()

  return data as EventVisitorRow | null
}

export async function getVisitorFromCookie(): Promise<{
  visitor_id: string
  event_id: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(VISITOR_SESSION_COOKIE)?.value
  if (!token) return null
  return verifyVisitorToken(token)
}
