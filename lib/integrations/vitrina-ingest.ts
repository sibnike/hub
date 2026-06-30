import { createHmac } from 'crypto'

export function signVitrinaIngestPayload(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function getVitrinaIngestSecret(): string {
  const secret = process.env.VITRINA_SUBMISSIONS_INGEST_SECRET?.trim()
  if (!secret) {
    throw new Error('VITRINA_SUBMISSIONS_INGEST_SECRET is not configured')
  }
  return secret
}

export function getVitrinaApiBase(): string {
  return (
    process.env.VITRINA_API_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ??
    'https://vitrina.yanbada.com'
  )
}

export function getHubMarketplaceSourceUrl(): string {
  const domain = process.env.NEXT_PUBLIC_HUB_DOMAIN?.trim()
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}/marketplace`
  return 'https://hub.yanbada.com/marketplace'
}
