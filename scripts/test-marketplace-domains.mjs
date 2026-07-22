/**
 * Pure checks for H-M5.3 acceptance (run: node scripts/test-marketplace-domains.mjs)
 */

const RESERVED = ['www', 'app', 'api', 'admin']

function normalizeHost(host) {
  return host.toLowerCase().split(':')[0]
}

function resolveMarketplaceHost(host, root) {
  const h = normalizeHost(host)
  const r = normalizeHost(root)
  if (!r) return null
  if (h === r) return { kind: 'flagship' }
  const suffix = `.${r}`
  if (h.endsWith(suffix)) {
    const sub = h.slice(0, -suffix.length)
    if (!sub || RESERVED.includes(sub)) return null
    return { kind: 'subdomain', subdomain: sub }
  }
  return { kind: 'custom_domain', domain: h }
}

function getAuthCookieDomainForHost(host) {
  const h = normalizeHost(host ?? '')
  if (!h || h === 'localhost' || h.startsWith('127.0.0.1')) return undefined
  if (h === 'yanbada.com' || h.endsWith('.yanbada.com')) {
    return process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim() || '.yanbada.com'
  }
  return undefined
}

function isYanbadaHubHost(host, hubDomain = 'hub.microp.app') {
  const normalized = normalizeHost(host)
  const hub = normalizeHost(hubDomain)
  return (
    normalized === hub ||
    normalized === 'yanbada.com' ||
    normalized.endsWith('.yanbada.com') ||
    normalized === 'localhost' ||
    normalized.startsWith('127.0.0.1')
  )
}

const root = 'microp.app'
let failed = 0

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label)
    failed++
  } else {
    console.log('OK:', label)
  }
}

const r1 = resolveMarketplaceHost('tourism.microp.app', root)
assert('tourism.microp.app → subdomain tourism', r1?.kind === 'subdomain' && r1.subdomain === 'tourism')

const r2 = resolveMarketplaceHost('microp.app', root)
assert('microp.app → flagship', r2?.kind === 'flagship')

const r3 = resolveMarketplaceHost('www.microp.app', root)
assert('www.microp.app → null', r3 === null)

const r4 = resolveMarketplaceHost('tourhub.kz', root)
assert('tourhub.kz → custom_domain', r4?.kind === 'custom_domain' && r4.domain === 'tourhub.kz')

assert('x.yanbada.com cookie → .yanbada.com', getAuthCookieDomainForHost('x.yanbada.com') === '.yanbada.com')
assert('tourhub.kz cookie → undefined', getAuthCookieDomainForHost('tourhub.kz') === undefined)
assert('tourism.microp.app cookie → undefined', getAuthCookieDomainForHost('tourism.microp.app') === undefined)
assert('localhost cookie → undefined', getAuthCookieDomainForHost('localhost') === undefined)

assert('hub.yanbada.com is yanbada hub', isYanbadaHubHost('hub.yanbada.com'))
assert('tourism.microp.app is NOT yanbada hub', !isYanbadaHubHost('tourism.microp.app'))
assert('tourhub.kz is NOT yanbada hub', !isYanbadaHubHost('tourhub.kz'))

if (failed > 0) {
  process.exit(1)
}
console.log('\nAll marketplace domain checks passed.')
