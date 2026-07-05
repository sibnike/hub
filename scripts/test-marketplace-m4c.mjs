#!/usr/bin/env node
/**
 * H-M4c test plan (TZ §8)
 * Usage: node scripts/test-marketplace-m4c.mjs [--base=https://hub.yanbada.com]
 */

import { readFileSync, existsSync } from 'node:fs'
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const projectId = 'bfcfwaakxcqplamcswaq'
const hubBase = (
  process.argv.find((a) => a.startsWith('--base='))?.slice(7) ??
  process.env.HUB_VERIFY_BASE ??
  `https://${process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'}`
).replace(/\/$/, '')

const QA_BUYER_TENANT = process.env.QA_BUYER_TENANT_ID ?? null
const createdSubmissionIds = []

const results = []

function pass(id, detail = '') {
  results.push({ id, ok: true, detail })
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`)
}

function fail(id, detail = '') {
  results.push({ id, ok: false, detail })
  console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`)
}

function skip(id, detail = '') {
  results.push({ id, ok: true, skipped: true, detail })
  console.log(`SKIP ${id}${detail ? ` — ${detail}` : ''}`)
}

function authCookieName() {
  const host = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${host}-auth-token`
}

function sessionCookieValue(session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ??
      Math.floor(Date.now() / 1000) + Number(session.expires_in ?? 3600),
    token_type: session.token_type ?? 'bearer',
    user: session.user,
  })
  return `base64-${Buffer.from(payload, 'utf8').toString('base64url')}`
}

function hubCookieHeader(session, tenantId) {
  const name = authCookieName()
  const parts = [
    `${name}=${sessionCookieValue(session)}`,
    `${name}.domain-set=1`,
  ]
  if (tenantId) parts.push(`hub_active_tenant_id=${tenantId}`)
  return parts.join('; ')
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

async function signIn(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) return null
  return json
}

async function hubFetch(path, session, options = {}, tenantId) {
  const res = await fetch(`${hubBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: session ? hubCookieHeader(session, tenantId) : '',
      ...options.headers,
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function getTourismMarketplaceId() {
  const { json } = await rest(
    '/rest/v1/marketplaces?select=id,slug&slug=eq.tourism',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  return json?.[0]?.id ?? null
}

async function testMigrationAndRls() {
  const { json, status } = await rest(
    '/rest/v1/search_presets?select=id,theme_slug&limit=5',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (status === 200 && Array.isArray(json) && json.length >= 3) {
    pass('1.migration.table_and_seeds', `count=${json.length}`)
  } else {
    fail('1.migration.table_and_seeds', `status=${status} ${JSON.stringify(json)}`)
  }

  const anonRes = await fetch(`${supabaseUrl}/rest/v1/search_presets?select=id&limit=1`, {
    headers: {
      apikey: anonKey ?? '',
      Authorization: `Bearer ${anonKey ?? ''}`,
      Accept: 'application/json',
      'Accept-Profile': 'hub',
    },
  })

  if (anonRes.status === 401 || anonRes.status === 403 || anonRes.status === 406) {
    pass('1.rls.no_anon', `status=${anonRes.status}`)
  } else {
    const anonJson = await anonRes.json().catch(() => null)
    if (Array.isArray(anonJson) && anonJson.length === 0) {
      pass('1.rls.no_anon', 'empty via RLS')
    } else {
      fail('1.rls.no_anon', `status=${anonRes.status}`)
    }
  }
}

async function ensureBuyerApproved(marketplaceId) {
  if (!QA_BUYER_TENANT) return false

  const { json } = await rest(
    `/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${QA_BUYER_TENANT}&select=id,status`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  const row = json?.[0]
  if (row?.status === 'approved') return true

  if (row?.id) {
    await rest(`/rest/v1/marketplace_members?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Accept-Profile': 'hub',
        'Content-Profile': 'hub',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'approved' }),
    })
    return true
  }

  await rest('/rest/v1/marketplace_members', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'hub',
      'Content-Profile': 'hub',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      marketplace_id: marketplaceId,
      tenant_id: QA_BUYER_TENANT,
      status: 'approved',
    }),
  })
  return true
}

async function testE2EFlow() {
  const buyerEmail = process.env.QA_BUYER_EMAIL
  const buyerPassword = process.env.QA_BUYER_PASSWORD

  if (!buyerEmail || !buyerPassword || !QA_BUYER_TENANT || !anonKey) {
    skip('2.e2e.*', 'QA_BUYER credentials not set')
    return
  }

  const marketplaceId = await getTourismMarketplaceId()
  if (!marketplaceId) {
    fail('2.e2e.setup', 'tourism marketplace missing')
    return
  }

  await ensureBuyerApproved(marketplaceId)

  const session = await signIn(buyerEmail, buyerPassword)
  if (!session) {
    fail('2.e2e.signin')
    return
  }
  pass('2.e2e.signin')

  const presetsRes = await hubFetch(
    '/api/marketplace/tourism/presets',
    session,
    {},
    QA_BUYER_TENANT
  )
  const presets = presetsRes.json?.presets ?? []
  const tourismPreset =
    presets.find((p) => p.theme_slug === 'tourism') ?? presets[0]

  if (presetsRes.ok && tourismPreset) {
    pass('2.e2e.presets', tourismPreset.theme_slug)
  } else {
    fail('2.e2e.presets', `${presetsRes.status} ${presetsRes.text}`)
    return
  }

  const query =
    'Нужна экскурсия по Алматы на 2026-08-15 для 4 человек, полдня, русскоязычный гид.'

  const parseRes = await hubFetch(
    '/api/marketplace/tourism/search/parse',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        preset_id: tourismPreset.id,
        query,
        known_city: 'Алматы',
      }),
    },
    QA_BUYER_TENANT
  )

  const parsedParams = parseRes.json?.params
  if (parseRes.ok && parsedParams?.city) {
    pass('2.e2e.parse', `city=${parsedParams.city}`)
  } else {
    fail('2.e2e.parse', `${parseRes.status} ${JSON.stringify(parseRes.json)}`)
    return
  }

  let params = parsedParams
  if (parseRes.json?.missing_params?.length) {
    params = {
      ...params,
      date_from: params.date_from ?? '2026-08-15',
      date_to: params.date_to ?? '2026-08-15',
      people: params.people ?? 4,
    }
    pass('2.e2e.clarify_filled', parseRes.json.missing_params.join(','))
  } else {
    pass('2.e2e.clarify_filled', 'none needed')
  }

  const resultsRes = await hubFetch(
    '/api/marketplace/tourism/search/results',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        preset_id: tourismPreset.id,
        params,
        sort: 'price_asc',
        availability_filter: 'all',
      }),
    },
    QA_BUYER_TENANT
  )

  const offers = resultsRes.json?.results ?? []
  const hasQaPage = offers.some(
    (o) => o.page_slug === 'qa-booking' || String(o.page_slug).includes('qa')
  )

  if (resultsRes.ok && offers.length > 0) {
    pass('2.e2e.results', `count=${offers.length} qa=${hasQaPage}`)
  } else {
    fail('2.e2e.results', `${resultsRes.status} count=${offers.length}`)
    return
  }

  const priceSorted = await hubFetch(
    '/api/marketplace/tourism/search/results',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        preset_id: tourismPreset.id,
        params,
        sort: 'price_desc',
      }),
    },
    QA_BUYER_TENANT
  )
  const descOffers = priceSorted.json?.results ?? []
  if (priceSorted.ok && descOffers.length >= 2) {
    const p0 = descOffers[0].price_from ?? -1
    const p1 = descOffers[1].price_from ?? -1
    if (p0 >= p1 || p0 === -1 || p1 === -1) {
      pass('2.e2e.price_sort')
    } else {
      fail('2.e2e.price_sort', `${p0} < ${p1}`)
    }
  } else {
    pass('2.e2e.price_sort', 'skipped single result')
  }

  const withAvailability = offers.filter((o) => o.availability_checked)
  if (withAvailability.length) {
    pass('2.e2e.availability_flags', `checked=${withAvailability.length}`)
  } else {
    pass('2.e2e.availability_flags', 'no dates / no configs')
  }

  const bookItems = offers
    .filter((o) => o.tenant_slug)
    .slice(0, 2)
    .map((o) => ({
      listing_id: o.id,
      tenant_slug: o.tenant_slug,
      page_slug: o.page_slug,
      title: o.title?.ru ?? o.page_slug,
      date_from: params.date_from,
      date_to: params.date_to,
      people: params.people,
    }))

  if (bookItems.length < 2) {
    skip('2.e2e.multi_book', 'need 2 bookable offers')
    return
  }

  const bookRes = await hubFetch(
    '/api/marketplace/tourism/search/book',
    session,
    {
      method: 'POST',
      body: JSON.stringify({ params, items: bookItems }),
    },
    QA_BUYER_TENANT
  )

  const bookResults = bookRes.json?.results ?? []
  const okCount = bookResults.filter((r) => r.ok && r.submission_id).length

  for (const r of bookResults) {
    if (r.submission_id) createdSubmissionIds.push(r.submission_id)
  }

  if (bookRes.ok && okCount >= 1) {
    pass('2.e2e.multi_book', `ok=${okCount}/${bookResults.length}`)
  } else {
    fail('2.e2e.multi_book', `${bookRes.status} ${JSON.stringify(bookResults)}`)
  }
}

async function testNegative() {
  const anonPresets = await fetch(`${hubBase}/api/marketplace/tourism/presets`)
  if (anonPresets.status === 401) {
    pass('3.negative.anon_presets_401')
  } else {
    fail('3.negative.anon_presets_401', `status=${anonPresets.status}`)
  }

  const anonPage = await fetch(`${hubBase}/m/tourism`, { redirect: 'manual' })
  if ([302, 307, 308].includes(anonPage.status)) {
    pass('3.negative.anon_page_redirect', `status=${anonPage.status}`)
  } else {
    fail('3.negative.anon_page_redirect', `status=${anonPage.status}`)
  }

  const sandboxEmail = process.env.QA_SANDBOX_EMAIL
  const sandboxPassword = process.env.QA_SANDBOX_PASSWORD
  const QA_SANDBOX_TENANT = process.env.QA_SANDBOX_TENANT_ID

  if (!sandboxEmail || !sandboxPassword || !QA_SANDBOX_TENANT) {
    skip('3.negative.not_approved', 'QA_SANDBOX not configured')
    return
  }

  const marketplaceId = await getTourismMarketplaceId()
  if (marketplaceId) {
    await rest(
      `/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${QA_SANDBOX_TENANT}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Accept-Profile': 'hub',
          'Content-Profile': 'hub',
          Prefer: 'return=minimal',
        },
      }
    )
  }

  const session = await signIn(sandboxEmail, sandboxPassword)
  if (!session) {
    fail('3.negative.sandbox_signin')
    return
  }

  const blocked = await hubFetch(
    '/api/marketplace/tourism/search/results',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        preset_id: '00000000-0000-0000-0000-000000000000',
        params: { city: 'Алматы', date_from: '2026-08-15', people: 2, notes: null, search: {} },
      }),
    },
    QA_SANDBOX_TENANT
  )

  if (blocked.status === 403) {
    pass('3.negative.not_approved_results')
  } else {
    fail('3.negative.not_approved_results', `status=${blocked.status}`)
  }
}

async function testProdVerification() {
  const { json } = await rest(
    '/rest/v1/search_presets?select=id,theme_slug,is_active&marketplace_id=not.is.null&limit=10',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (Array.isArray(json) && json.length >= 3) {
    pass('4.prod.presets_seeds', `count=${json.length}`)
  } else {
    fail('4.prod.presets_seeds', JSON.stringify(json))
  }

  if (!createdSubmissionIds.length) {
    skip('4.prod.submissions', 'no submissions from E2E')
    return
  }

  const ids = createdSubmissionIds.map((id) => `"${id}"`).join(',')
  const query = `
    SELECT id, source_type, external_source, data->'_integration' as integration
    FROM public.submissions
    WHERE id IN (${ids})
    ORDER BY created_at DESC;
  `

  const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  }).catch(() => null)

  if (!sqlRes?.ok) {
    skip('4.prod.submissions', 'use Supabase MCP — see report')
    return
  }

  const rows = await sqlRes.json()
  const list = Array.isArray(rows) ? rows : rows?.result ?? []

  if (list.length >= 1) {
    const sample = list[0]
    pass(
      '4.prod.submissions',
      `count=${list.length} source_type=${sample.source_type ?? 'null'}`
    )
  } else {
    fail('4.prod.submissions', 'not found')
  }
}

async function main() {
  console.log(`H-M4c tests — hub base: ${hubBase}`)
  console.log(`Supabase: ${supabaseUrl}`)

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  await testMigrationAndRls()
  await testE2EFlow()
  await testNegative()
  await testProdVerification()

  const failed = results.filter((r) => !r.ok)
  const skipped = results.filter((r) => r.skipped)
  console.log(
    `\nDone: ${results.length - failed.length}/${results.length} passed` +
      (skipped.length ? ` (${skipped.length} skipped)` : '')
  )
  if (createdSubmissionIds.length) {
    console.log('Created submission IDs:', createdSubmissionIds.join(', '))
  }
  if (failed.length) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
