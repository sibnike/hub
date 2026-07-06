export const RESERVED_MARKETPLACE_SUBDOMAINS = ['www', 'app', 'api', 'admin'] as const

export function normalizeMarketplaceHost(host: string): string {
  return host.toLowerCase().split(':')[0]
}

export type MarketplaceHostResolution =
  | { kind: 'flagship' }
  | { kind: 'subdomain'; subdomain: string }
  | { kind: 'custom_domain'; domain: string }

export function resolveMarketplaceHost(
  host: string,
  root: string
): MarketplaceHostResolution | null {
  const normalizedHost = normalizeMarketplaceHost(host)
  const normalizedRoot = normalizeMarketplaceHost(root)
  if (!normalizedRoot) return null

  if (normalizedHost === normalizedRoot) {
    return { kind: 'flagship' }
  }

  const suffix = `.${normalizedRoot}`
  if (normalizedHost.endsWith(suffix)) {
    const subdomain = normalizedHost.slice(0, -suffix.length)
    if (
      !subdomain ||
      (RESERVED_MARKETPLACE_SUBDOMAINS as readonly string[]).includes(subdomain)
    ) {
      return null
    }
    return { kind: 'subdomain', subdomain }
  }

  return { kind: 'custom_domain', domain: normalizedHost }
}

export function isYanbadaHubHost(host: string): boolean {
  const normalized = normalizeMarketplaceHost(host)
  const hubDomain = normalizeMarketplaceHost(
    process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  )

  return (
    normalized === hubDomain ||
    normalized === 'yanbada.com' ||
    normalized.endsWith('.yanbada.com') ||
    normalized === 'localhost' ||
    normalized.startsWith('127.0.0.1')
  )
}
