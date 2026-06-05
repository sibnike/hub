import { createHmac, randomBytes } from 'crypto'

export function generateAccessCode(
  eventId: string,
  email: string,
  salt: string
): string {
  return createHmac('sha256', salt)
    .update(`${eventId}:${email.toLowerCase()}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase()
}

export function generateSalt(): string {
  return randomBytes(32).toString('hex')
}

export function hashAccessCode(code: string): string {
  return createHmac('sha256', process.env.SESSION_SIGNING_SECRET!)
    .update(code.toUpperCase().trim())
    .digest('hex')
}
