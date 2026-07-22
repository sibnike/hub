import { normalizeMarketplaceHost } from '@/lib/marketplace/marketplace-host'

export function getAuthCookieDomainForHost(host?: string): string | undefined {
  const h = normalizeMarketplaceHost(host ?? '')
  if (!h || h.startsWith('localhost') || h.startsWith('127.0.0.1')) return undefined
  if (h === 'microp.app' || h.endsWith('.microp.app')) {
    return process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim() || '.microp.app'
  }
  if (h === 'yanbada.com' || h.endsWith('.yanbada.com')) {
    return process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim() || '.yanbada.com'
  }
  return undefined
}

export function mergeAuthCookieOptions<T extends { domain?: string }>(
  options?: T,
  host?: string
): T | undefined {
  const domain = getAuthCookieDomainForHost(host)
  if (!domain) return options
  return { ...options, domain } as T
}
