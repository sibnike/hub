#!/usr/bin/env node
/**
 * H-M4d test plan (TZ §8)
 * Usage: node scripts/test-marketplace-m4d.mjs [--base=https://hub.yanbada.com]
 */

import { readFileSync, existsSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertQaEmail } from './lib/qa-env-guard.mjs'

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
assertQaEmail('QA_BUYER_EMAIL')
assertQaEmail('QA_SANDBOX_EMAIL')

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
const QA_SANDBOX_TENANT = process.env.QA_SANDBOX_TENANT_ID ?? '959a1e3a-88d8-4949-86d3-62a10540ab4b'
const QA_TOUCHIN_TENANT = process.env.QA_TOUCHIN_TENANT_ID ?? 'c2c102de-72b5-4155-b262-787809495cd0'
const webhookSecret = process.env.VITRINA_WEBHOOK_SECRET

const results = []
let createdRequestId = null
let createdTargetIds = []
let createdSubmissionIds = []

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

function signWebhook(body) {
  return `sha256=${createHmac('sha256', webhookSecret).update(body).digest('hex')}`
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
  return [
    `${name}=${sessionCookieValue(session)}`,
    `${name}.domain-set=1`,
    tenantId ? `hub_active_tenant_id=${tenantId}` : null,
  ]
    .filter(Boolean)
    .join('; ')
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
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.ok ? res.json() : null
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

async function syncListing(payload) {
  const body = JSON.stringify(payload)
  const res = await fetch(`${hubBase}/api/sync/listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': signWebhook(body),
    },
    body,
  })
  return { ok: res.ok, status: res.status }
}

async function getTourismMarketplaceId() {
  const { json } = await rest('/rest/v1/marketplaces?select=id&slug=eq.tourism', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })
  return json?.[0]?.id ?? null
}

async function ensureBuyerApproved(marketplaceId) {
  const { json } = await rest(
    `/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${QA_BUYER_TENANT}&select=id,status`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const row = json?.[0]
  if (row?.status === 'approved') return
  if (row?.id) {
    await rest(`/rest/v1/marketplace_members?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Accept-Profile': 'hub', 'Content-Profile': 'hub' },
      body: JSON.stringify({ status: 'approved' }),
    })
    return
  }
  await rest('/rest/v1/marketplace_members', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub', 'Content-Profile': 'hub' },
    body: JSON.stringify({
      marketplace_id: marketplaceId,
      tenant_id: QA_BUYER_TENANT,
      status: 'approved',
    }),
  })
}

async function testMigrationAndRls() {
  const { json: reqSample } = await rest(
    '/rest/v1/marketplace_requests?select=budget_amount,requester_tenant_id,marketplace_id&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (Array.isArray(reqSample)) {
    pass('1.migration.requests_columns', 'select ok')
  } else {
    fail('1.migration.requests_columns', JSON.stringify(reqSample))
  }

  const { json: tgtSample } = await rest(
    '/rest/v1/marketplace_request_targets?select=response_status,vitrina_submission_id&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (Array.isArray(tgtSample)) {
    pass('1.migration.targets_columns', 'select ok')
  } else {
    fail('1.migration.targets_columns', JSON.stringify(tgtSample))
  }

  const anonRes = await fetch(
    `${supabaseUrl}/rest/v1/marketplace_requests?select=id&limit=1`,
    {
      headers: {
        apikey: anonKey ?? '',
        Authorization: `Bearer ${anonKey ?? ''}`,
        Accept: 'application/json',
        'Accept-Profile': 'hub',
      },
    }
  )

  if ([401, 403, 406].includes(anonRes.status)) {
    pass('1.rls.no_anon_requests', `status=${anonRes.status}`)
  } else {
    const body = await anonRes.json().catch(() => null)
    if (Array.isArray(body) && body.length === 0) {
      pass('1.rls.no_anon_requests', 'empty')
    } else {
      fail('1.rls.no_anon_requests', `status=${anonRes.status}`)
    }
  }
}

async function setupListings() {
  if (!webhookSecret) {
    skip('1.setup.listings', 'VITRINA_WEBHOOK_SECRET not set')
    return
  }

  const listings = [
    {
      action: 'upsert',
      tenant_id: QA_SANDBOX_TENANT,
      page_slug: 'qa-booking',
      title: { ru: 'Экскурсия QA booking M4d', en: 'Tour QA booking M4d' },
      short_text: { ru: 'Экскурсии Алматы', en: 'Almaty tours' },
      categories: ['tourism'],
      marketplace_themes: ['tourism'],
      price_from: 15000,
      price_currency: 'KZT',
    },
    {
      action: 'upsert',
      tenant_id: QA_TOUCHIN_TENANT,
      page_slug: 'qa-tourism-touchin-m4d',
      title: { ru: 'Туры Алматы Touchin M4d', en: 'Almaty tours Touchin M4d' },
      short_text: { ru: 'Экскурсии и туры в Алматы', en: 'Tours in Almaty' },
      categories: ['tourism'],
      marketplace_themes: ['tourism', 'accommodation'],
      price_from: 28000,
      price_currency: 'KZT',
    },
  ]

  let ok = 0
  for (const payload of listings) {
    const res = await syncListing(payload)
    if (res.ok) ok += 1
  }

  if (ok === listings.length) pass('1.setup.listings', `${ok} synced`)
  else fail('1.setup.listings', `${ok}/${listings.length}`)
}

async function testE2ERequestFlow() {
  const buyerEmail = process.env.QA_BUYER_EMAIL
  const buyerPassword = process.env.QA_BUYER_PASSWORD

  if (!buyerEmail || !buyerPassword || !QA_BUYER_TENANT || !anonKey) {
    skip('2.e2e.*', 'QA_BUYER not configured')
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

  const presetsRes = await hubFetch('/api/marketplace/tourism/presets', session, {}, QA_BUYER_TENANT)
  const preset =
    presetsRes.json?.presets?.find((p) => p.theme_slug === 'tourism') ??
    presetsRes.json?.presets?.[0]

  if (!preset) {
    fail('2.e2e.presets')
    return
  }

  const params = {
    city: 'Алматы',
    date_from: '2026-09-10',
    date_to: '2026-09-10',
    people: 4,
    notes: 'M4d E2E: нужна экскурсия по Алматы с гидом',
    search: {
      keywords: 'экскурсия гид',
      categories: ['tourism'],
      tags: [],
      country: null,
      city: 'Алматы',
    },
  }

  const resultsRes = await hubFetch(
    '/api/marketplace/tourism/search/results',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        preset_id: preset.id,
        params,
        sort: 'price_asc',
        availability_filter: 'all',
      }),
    },
    QA_BUYER_TENANT
  )

  const offers = resultsRes.json?.results ?? []
  const tenantSet = new Set(offers.map((o) => o.tenant_id))
  if (resultsRes.ok && offers.length >= 2 && tenantSet.size >= 2) {
    pass('2.e2e.results', `count=${offers.length} tenants=${tenantSet.size}`)
  } else {
    fail('2.e2e.results', `count=${offers.length} tenants=${tenantSet.size}`)
    return
  }

  const requestRes = await hubFetch(
    '/api/marketplace/tourism/search/request',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        params,
        request_text: params.notes,
        budget_amount: 120000,
        budget_currency: 'KZT',
        offers,
        target_limit: 2,
      }),
    },
    QA_BUYER_TENANT
  )

  const dispatchResults = requestRes.json?.dispatch_results ?? []
  const okCount = dispatchResults.filter((r) => r.ok && r.vitrina_submission_id).length

  for (const r of dispatchResults) {
    if (r.vitrina_submission_id) createdSubmissionIds.push(r.vitrina_submission_id)
    if (r.target_id) createdTargetIds.push(r.target_id)
  }

  createdRequestId = requestRes.json?.request_id ?? null

  if (requestRes.ok && okCount >= 2) {
    pass('2.e2e.request_dispatch', `ok=${okCount}/2`)
  } else if (createdRequestId && createdTargetIds.length >= 2) {
    fail('2.e2e.request_dispatch', `ok=${okCount}/2 ${JSON.stringify(dispatchResults)}`)
  } else {
    fail('2.e2e.request_dispatch', `${requestRes.status} ok=${okCount} ${JSON.stringify(dispatchResults)}`)
    return
  }

  if (createdSubmissionIds.length >= 2) {
    const { json: submissions } = await rest(
      `/rest/v1/submissions?id=in.(${createdSubmissionIds.map((id) => `"${id}"`).join(',')})&select=id,source_type,requester_tenant_id,data`,
      { headers: { Accept: 'application/json' } }
    )

    const mktRows = (submissions ?? []).filter((s) => s.source_type === 'marketplace')
    const withRequester = mktRows.filter((s) => s.requester_tenant_id === QA_BUYER_TENANT)

    if (mktRows.length >= 2 && withRequester.length >= 2) {
      pass('2.e2e.submissions_attribution', `marketplace=${mktRows.length}`)
    } else {
      fail('2.e2e.submissions_attribution', JSON.stringify(submissions))
    }
  } else {
    skip('2.e2e.submissions_attribution', 'dispatch incomplete — retry after Vitrina cooldown')
  }

  if (createdTargetIds.length < 2 || !webhookSecret) {
    skip('2.e2e.response_channel', 'targets or webhook secret missing')
    return
  }

  const acceptBody = JSON.stringify({
    marketplace_request_target_id: createdTargetIds[0],
    response_status: 'accepted',
    response_message: 'M4d E2E accept',
    vitrina_submission_id: createdSubmissionIds[0] ?? null,
  })

  const acceptRes = await fetch(`${hubBase}/api/marketplace/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': signWebhook(acceptBody),
    },
    body: acceptBody,
  })

  if (acceptRes.ok) pass('2.e2e.response_accept')
  else fail('2.e2e.response_accept', `${acceptRes.status} ${await acceptRes.text()}`)

  const declineBody = JSON.stringify({
    marketplace_request_target_id: createdTargetIds[1],
    response_status: 'declined',
    response_message: 'M4d E2E decline',
  })

  const declineRes = await fetch(`${hubBase}/api/marketplace/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': signWebhook(declineBody),
    },
    body: declineBody,
  })

  if (declineRes.ok) pass('2.e2e.response_decline')
  else fail('2.e2e.response_decline', `${declineRes.status} ${await declineRes.text()}`)

  const { json: targets } = await rest(
    `/rest/v1/marketplace_request_targets?id=in.(${createdTargetIds.map((id) => `"${id}"`).join(',')})&select=id,response_status,response_message`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  const accepted = targets?.find((t) => t.id === createdTargetIds[0])
  const declined = targets?.find((t) => t.id === createdTargetIds[1])

  if (accepted?.response_status === 'accepted' && declined?.response_status === 'declined') {
    pass('2.e2e.targets_updated', `${accepted.response_status}/${declined.response_status}`)
  } else {
    fail('2.e2e.targets_updated', JSON.stringify(targets))
  }

  const myReqRes = await hubFetch('/api/marketplace/tourism/requests', session, {}, QA_BUYER_TENANT)
  const myRequest = myReqRes.json?.requests?.find((r) => r.id === createdRequestId)
  const statuses = myRequest?.targets?.map((t) => t.response_status) ?? []

  if (
    myReqRes.ok &&
    myRequest &&
    statuses.includes('accepted') &&
    statuses.includes('declined')
  ) {
    pass('2.e2e.my_requests', statuses.join(','))
  } else {
    fail('2.e2e.my_requests', JSON.stringify(myReqRes.json))
  }

  const repeatBody = JSON.stringify({
    marketplace_request_target_id: createdTargetIds[0],
    response_status: 'accepted',
    response_message: 'M4d E2E idempotent repeat',
  })

  const repeatRes = await fetch(`${hubBase}/api/marketplace/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': signWebhook(repeatBody),
    },
    body: repeatBody,
  })

  if (repeatRes.ok) pass('2.e2e.response_idempotent')
  else fail('2.e2e.response_idempotent', `${repeatRes.status}`)
}

async function testMultiBookThrottle() {
  const buyerEmail = process.env.QA_BUYER_EMAIL
  const buyerPassword = process.env.QA_BUYER_PASSWORD
  if (!buyerEmail || !buyerPassword || !QA_BUYER_TENANT) {
    skip('2.e2e.multi_book_2_2', 'QA_BUYER not configured')
    return
  }

  const session = await signIn(buyerEmail, buyerPassword)
  if (!session) {
    fail('2.e2e.multi_book_2_2.signin')
    return
  }

  const params = {
    city: 'Алматы',
    date_from: '2026-09-12',
    date_to: '2026-09-12',
    people: 2,
    notes: 'M4d throttle book test',
    search: { keywords: 'экскурсия', categories: ['tourism'], tags: [], country: null, city: 'Алматы' },
  }

  const presetsRes = await hubFetch('/api/marketplace/tourism/presets', session, {}, QA_BUYER_TENANT)
  const preset = presetsRes.json?.presets?.find((p) => p.theme_slug === 'tourism')
  const resultsRes = await hubFetch(
    '/api/marketplace/tourism/search/results',
    session,
    {
      method: 'POST',
      body: JSON.stringify({ preset_id: preset.id, params, sort: 'price_asc' }),
    },
    QA_BUYER_TENANT
  )

  const offers = resultsRes.json?.results ?? []
  const items = offers
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

  if (items.length < 2) {
    skip('2.e2e.multi_book_2_2', 'need 2 offers')
    return
  }

  const bookRes = await hubFetch(
    '/api/marketplace/tourism/search/book',
    session,
    { method: 'POST', body: JSON.stringify({ params, items }) },
    QA_BUYER_TENANT
  )

  const bookResults = bookRes.json?.results ?? []
  const okCount = bookResults.filter((r) => r.ok).length

  if (bookRes.ok && okCount === 2) {
    pass('2.e2e.multi_book_2_2', 'throttle+retry ok')
  } else {
    fail('2.e2e.multi_book_2_2', `ok=${okCount}/2 ${JSON.stringify(bookResults)}`)
  }
}

async function testNegative() {
  const anonPresets = await fetch(`${hubBase}/api/marketplace/tourism/presets`)
  if (anonPresets.status === 401) pass('3.negative.anon_presets_401')
  else fail('3.negative.anon_presets_401', `status=${anonPresets.status}`)

  const badBody = JSON.stringify({
    marketplace_request_target_id: createdTargetIds[0] ?? '00000000-0000-0000-0000-000000000000',
    response_status: 'accepted',
  })

  const badSigRes = await fetch(`${hubBase}/api/marketplace/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vitrina-signature': 'sha256=deadbeef' },
    body: badBody,
  })

  if (badSigRes.status === 401) pass('3.negative.response_bad_hmac')
  else fail('3.negative.response_bad_hmac', `status=${badSigRes.status}`)

  const sandboxEmail = process.env.QA_SANDBOX_EMAIL
  const sandboxPassword = process.env.QA_SANDBOX_PASSWORD
  const marketplaceId = await getTourismMarketplaceId()

  if (marketplaceId && QA_SANDBOX_TENANT) {
    await rest(
      `/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${QA_SANDBOX_TENANT}`,
      {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'Accept-Profile': 'hub', 'Content-Profile': 'hub' },
      }
    )
  }

  if (!sandboxEmail || !sandboxPassword) {
    skip('3.negative.not_approved_request', 'QA_SANDBOX not configured')
    return
  }

  const session = await signIn(sandboxEmail, sandboxPassword)
  const blocked = await hubFetch(
    '/api/marketplace/tourism/search/request',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        params: { city: 'Алматы', notes: 'x', search: {} },
        request_text: 'x',
        budget_amount: 1000,
        offers: [],
      }),
    },
    QA_SANDBOX_TENANT
  )

  if (blocked.status === 403) pass('3.negative.not_approved_request')
  else fail('3.negative.not_approved_request', `status=${blocked.status}`)
}

async function testProdVerification() {
  if (!createdRequestId) {
    skip('4.prod.requests', 'no request from E2E')
    return
  }

  const { json: request } = await rest(
    `/rest/v1/marketplace_requests?id=eq.${createdRequestId}&select=id,budget_amount,budget_currency,requester_tenant_id,marketplace_id`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (request?.[0]?.budget_amount != null && request[0].requester_tenant_id === QA_BUYER_TENANT) {
    pass('4.prod.request_row', `budget=${request[0].budget_amount}`)
  } else {
    fail('4.prod.request_row', JSON.stringify(request))
  }

  const { json: targets } = await rest(
    `/rest/v1/marketplace_request_targets?request_id=eq.${createdRequestId}&select=id,response_status,vitrina_submission_id`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  if (Array.isArray(targets) && targets.length >= 2) {
    pass('4.prod.targets', `count=${targets.length}`)
  } else {
    fail('4.prod.targets', JSON.stringify(targets))
  }
}

async function main() {
  console.log(`H-M4d tests — hub base: ${hubBase}`)

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  await testMigrationAndRls()
  await setupListings()
  await testE2ERequestFlow()
  await testMultiBookThrottle()
  await testNegative()
  await testProdVerification()

  const failed = results.filter((r) => !r.ok)
  const skipped = results.filter((r) => r.skipped)
  console.log(
    `\nDone: ${results.length - failed.length}/${results.length} passed` +
      (skipped.length ? ` (${skipped.length} skipped)` : '')
  )
  if (createdRequestId) console.log('Request ID:', createdRequestId)
  if (createdTargetIds.length) console.log('Target IDs:', createdTargetIds.join(', '))
  if (createdSubmissionIds.length) console.log('Submission IDs:', createdSubmissionIds.join(', '))
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
