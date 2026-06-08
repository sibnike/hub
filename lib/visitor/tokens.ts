import { randomBytes } from 'crypto'

export function generateSecureToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex')
}
