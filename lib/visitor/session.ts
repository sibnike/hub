import { sign, verify } from 'jsonwebtoken'

const SECRET = process.env.SESSION_SIGNING_SECRET!

export type VisitorTokenPayload = {
  visitor_id: string
  event_id: string
}

export function signVisitorToken(payload: VisitorTokenPayload): string {
  return sign(payload, SECRET, { expiresIn: '90d' })
}

export function verifyVisitorToken(token: string): VisitorTokenPayload | null {
  try {
    const payload = verify(token, SECRET) as VisitorTokenPayload
    if (!payload?.visitor_id || !payload?.event_id) return null
    return payload
  } catch {
    return null
  }
}
