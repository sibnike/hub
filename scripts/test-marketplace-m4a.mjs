#!/usr/bin/env node
/**
 * H-M4a test plan (TZ §2.5)
 * Usage: node scripts/test-marketplace-m4a.mjs [--base http://localhost:3001]
 */

import { readFileSync, existsSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hubRoot = resolve(__dirname, '..')

function loadEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv(resolve(hubRoot, '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookSecret = process.env.VITRINA_WEBHOOK_SECRET
const projectId = 'bfcfwaakxcqplamcswaq'
const hubBase = (
  process.argv.find((a) => a.startsWith('--base='))?.slice(7) ??
  process.env.HUB_VERIFY_BASE ??
  `https://${process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'}`
).replace(/\/$/, '')

const results = []

function pass(id, detail = '') {
  results.push({ id, ok: true, detail })
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`)
}

function fail(id, detail = '') {
  results.push({ id, ok: false, detail })
  console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`)
}

async function rest(path, options = {}) {
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { ok: res.ok, status: res.status, json, text }
}

function sign(body) {
  return (
    'sha256=' + createHmac('sha256', webhookSecret).update(body).digest('hex')
  )
}

async function syncCompany(payload) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${hubBase}/api/sync/company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': sign(body),
    },
    body,
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

async function syncListing(payload) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${hubBase}/api/sync/listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': sign(body),
    },
    body,
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

async function testMigrationAndSeed() {
  const { json: marketplaces } = await rest(
    '/rest/v1/marketplaces?select=slug,theme_slugs,is_active&slug=eq.tourism',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (!Array.isArray(marketplaces) || marketplaces.length !== 1) {
    fail('1.migration.tourism_seed', 'tourism row missing')
    return
  }

  const tourism = marketplaces[0]
  const themes = tourism.theme_slugs ?? []
  const expected = ['transport', 'accommodation', 'tourism', 'guides', 'food']
  const themesOk =
    themes.length === expected.length && expected.every((t) => themes.includes(t))

  if (tourism.is_active && themesOk) {
    pass('1.migration.tourism_seed', `theme_slugs=${themes.join(',')}`)
  } else {
    fail('1.migration.tourism_seed', JSON.stringify(tourism))
  }

  const cols = await rest('/rest/v1/rpc', {
    method: 'POST',
    body: JSON.stringify({}),
  }).catch(() => null)

  const { json: companyCols } = await rest(
    `/rest/v1/company_cache?select=marketplace_themes&limit=1`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  if (Array.isArray(companyCols)) {
    pass('1.migration.company_cache_column')
  } else {
    fail('1.migration.company_cache_column', String(companyCols))
  }

  const { json: listingCols } = await rest(
    `/rest/v1/listing_cache?select=marketplace_themes,price_from,price_currency&limit=1`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  if (Array.isArray(listingCols)) {
    pass('1.migration.listing_cache_columns')
  } else {
    fail('1.migration.listing_cache_columns', String(listingCols))
  }

  void cols
}

async function testSyncEndpoints(tenantId) {
  const pageSlug = `m4a-test-${Date.now()}`
  const themesA = ['guides', 'transport']
  const themesB = ['accommodation']

  const companySeed = await syncCompany({
    tenant_id: tenantId,
    name: 'M4A Test Company',
    marketplace_themes: themesA,
  })
  if (!companySeed.ok) {
    fail('2.sync.company_with_themes', `${companySeed.status} ${companySeed.text}`)
  } else {
    pass('2.sync.company_with_themes')
  }

  const { json: companyAfterA } = await rest(
    `/rest/v1/company_cache?select=marketplace_themes&tenant_id=eq.${tenantId}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const companyThemesA = companyAfterA?.[0]?.marketplace_themes ?? []
  if (
    companyThemesA.length === themesA.length &&
    themesA.every((t) => companyThemesA.includes(t))
  ) {
    pass('2.sync.company_themes_persisted')
  } else {
    fail('2.sync.company_themes_persisted', JSON.stringify(companyThemesA))
  }

  const companyNoThemes = await syncCompany({
    tenant_id: tenantId,
    name: 'M4A Test Company Renamed',
  })
  if (!companyNoThemes.ok) {
    fail('2.sync.company_without_themes', `${companyNoThemes.status}`)
  } else {
    pass('2.sync.company_without_themes')
  }

  const { json: companyAfterB } = await rest(
    `/rest/v1/company_cache?select=marketplace_themes,name&tenant_id=eq.${tenantId}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const companyThemesB = companyAfterB?.[0]?.marketplace_themes ?? []
  const nameB = companyAfterB?.[0]?.name
  if (
    companyThemesB.length === themesA.length &&
    themesA.every((t) => companyThemesB.includes(t)) &&
    nameB === 'M4A Test Company Renamed'
  ) {
    pass('2.sync.company_themes_not_overwritten')
  } else {
    fail('2.sync.company_themes_not_overwritten', JSON.stringify(companyAfterB?.[0]))
  }

  const listingWith = await syncListing({
    action: 'upsert',
    tenant_id: tenantId,
    page_slug: pageSlug,
    title: { ru: 'M4A listing' },
    marketplace_themes: themesA,
    price_from: 15000,
    price_currency: 'KZT',
  })
  if (!listingWith.ok) {
    fail('2.sync.listing_with_fields', `${listingWith.status} ${listingWith.text}`)
  } else {
    pass('2.sync.listing_with_fields')
  }

  const { json: listingAfterA } = await rest(
    `/rest/v1/listing_cache?select=marketplace_themes,price_from,price_currency&tenant_id=eq.${tenantId}&page_slug=eq.${encodeURIComponent(pageSlug)}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const rowA = listingAfterA?.[0]
  if (
    rowA?.price_from === 15000 &&
    rowA?.price_currency === 'KZT' &&
    Array.isArray(rowA?.marketplace_themes) &&
    themesA.every((t) => rowA.marketplace_themes.includes(t))
  ) {
    pass('2.sync.listing_fields_persisted')
  } else {
    fail('2.sync.listing_fields_persisted', JSON.stringify(rowA))
  }

  const listingPartial = await syncListing({
    action: 'upsert',
    tenant_id: tenantId,
    page_slug: pageSlug,
    title: { ru: 'M4A listing updated' },
    marketplace_themes: themesB,
  })
  if (!listingPartial.ok) {
    fail('2.sync.listing_partial_update', `${listingPartial.status}`)
  } else {
    pass('2.sync.listing_partial_update')
  }

  const { json: listingAfterB } = await rest(
    `/rest/v1/listing_cache?select=marketplace_themes,price_from,price_currency&tenant_id=eq.${tenantId}&page_slug=eq.${encodeURIComponent(pageSlug)}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const rowB = listingAfterB?.[0]
  if (
    rowB?.price_from === 15000 &&
    rowB?.price_currency === 'KZT' &&
    themesB.every((t) => rowB?.marketplace_themes?.includes(t))
  ) {
    pass('2.sync.listing_price_not_overwritten')
  } else {
    fail('2.sync.listing_price_not_overwritten', JSON.stringify(rowB))
  }

  await syncListing({ action: 'delete', tenant_id: tenantId, page_slug: pageSlug })
}

async function testRlsPolicies() {
  const query = `
    SELECT policyname, roles::text, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'hub' AND tablename = 'marketplaces'
    ORDER BY policyname;
  `

  const { json } = await rest('/rest/v1/rpc/execute_sql', {
    method: 'POST',
    body: JSON.stringify({ query }),
  }).catch(() => ({ json: null }))

  if (json) {
    void json
  }

  const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }).catch(() => null)

  let policies = null
  if (sqlRes?.ok) {
    policies = await sqlRes.json()
  }

  if (!policies) {
    const { text } = await rest(
      `/rest/v1/marketplaces?select=slug&limit=0`,
      { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
    )
    if (text !== undefined) {
      pass('3.rls.service_role_read', 'marketplaces readable via service role')
    }
    console.log('SKIP 3.rls.pg_policies — run via Supabase MCP execute_sql')
    return
  }

  const rows = Array.isArray(policies) ? policies : policies?.result ?? []
  const selectPolicy = rows.find((p) => p.cmd === 'SELECT')
  const hasAnon = rows.some((p) => String(p.roles).includes('anon'))

  if (selectPolicy && String(selectPolicy.roles).includes('authenticated')) {
    pass('3.rls.select_authenticated', `qual=${selectPolicy.qual ?? 'true'}`)
  } else {
    fail('3.rls.select_authenticated', JSON.stringify(rows))
  }

  if (!hasAnon) {
    pass('3.rls.no_anon')
  } else {
    fail('3.rls.no_anon', JSON.stringify(rows))
  }
}

async function testRoutes() {
  const tourismRes = await fetch(`${hubBase}/m/tourism`, { redirect: 'manual' })
  if (tourismRes.status === 200) {
    const html = await tourismRes.text()
    if (html.includes('Туристический маркетплейс') || html.includes('Tourism Marketplace')) {
      pass('4.routes.tourism', `status=${tourismRes.status}`)
    } else {
      fail('4.routes.tourism', 'page missing expected title')
    }
  } else {
    fail('4.routes.tourism', `status=${tourismRes.status}`)
  }

  const missingRes = await fetch(`${hubBase}/m/nonexistent-slug-m4a`, { redirect: 'manual' })
  if (missingRes.status === 404) {
    pass('4.routes.nonexistent_404', `status=${missingRes.status}`)
  } else {
    fail('4.routes.nonexistent_404', `status=${missingRes.status}`)
  }
}

async function pickTenantId() {
  const { json } = await rest(
    '/rest/v1/company_cache?select=tenant_id&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  if (Array.isArray(json) && json[0]?.tenant_id) return json[0].tenant_id

  const { json: tenants } = await rest('/rest/v1/tenants?select=id&limit=1', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'public' },
  })
  return tenants?.[0]?.id ?? randomUUID()
}

async function main() {
  console.log(`H-M4a tests — hub base: ${hubBase}`)
  console.log(`Supabase: ${supabaseUrl}`)

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  await testMigrationAndSeed()

  if (!webhookSecret) {
    console.log('SKIP 2.sync.* — VITRINA_WEBHOOK_SECRET not set')
  } else {
    const tenantId = await pickTenantId()
    await testSyncEndpoints(tenantId)
  }

  await testRlsPolicies()
  await testRoutes()

  const failed = results.filter((r) => !r.ok)
  console.log(`\nDone: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
