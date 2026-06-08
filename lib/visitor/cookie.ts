import { cookies } from 'next/headers'
import { signVisitorToken } from '@/lib/visitor/session'

export const VISITOR_SESSION_COOKIE = 'visitor_session'

export async function setVisitorSessionCookie(
  visitorId: string,
  eventId: string
): Promise<void> {
  const token = signVisitorToken({ visitor_id: visitorId, event_id: eventId })
  const cookieStore = await cookies()
  cookieStore.set(VISITOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  })
}

export async function clearVisitorSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(VISITOR_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}
