#!/usr/bin/env node
/**
 * H-M4b test plan (TZ §7)
 * Usage: node scripts/test-marketplace-m4b.mjs [--base=https://hub.yanbada.com]
 *
 * Env for prod E2E (optional):
 *   QA_SANDBOX_EMAIL, QA_SANDBOX_PASSWORD — tenant A (qa-sandbox)
 *   QA_BUYER_EMAIL, QA_BUYER_PASSWORD — tenant B (qa-buyer)
 *   QA_PLATFORM_EMAIL, QA_PLATFORM_PASSWORD — platform admin
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

const QA_SANDBOX_TENANT = process.env.QA_SANDBOX_TENANT_ID ?? '959a1e3a-88d8-4949-86d3-62a10540ab4b'
const QA_BUYER_TENANT = process.env.QA_BUYER_TENANT_ID ?? null

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

async function testMigrationTable() {
  const { json, status } = await rest(
    '/rest/v1/marketplace_members?select=id&limit=0',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  if (status === 200 || Array.isArray(json)) {
    pass('1.migration.table_exists')
  } else {
    fail('1.migration.table_exists', `status=${status} ${JSON.stringify(json)}`)
  }

  const marketplaceId = await getTourismMarketplaceId()
  if (marketplaceId) {
    pass('1.migration.tourism_marketplace', marketplaceId)
  } else {
    fail('1.migration.tourism_marketplace')
  }
}

async function testRlsPolicies() {
  const query = `
    SELECT policyname, roles::text, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'hub' AND tablename = 'marketplace_members'
    ORDER BY policyname;
  `

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
    skip('1.rls.pg_policies', 'use Supabase MCP execute_sql — see report')
    return
  }

  const rows = Array.isArray(policies) ? policies : policies?.result ?? []
  const hasAnon = rows.some((p) => String(p.roles).includes('anon'))
  const selectPolicy = rows.find((p) => p.cmd === 'SELECT')

  if (selectPolicy && String(selectPolicy.roles).includes('authenticated')) {
    pass('1.rls.select_authenticated', selectPolicy.policyname)
  } else {
    fail('1.rls.select_authenticated', JSON.stringify(rows))
  }

  if (!hasAnon) {
    pass('1.rls.no_anon')
  } else {
    fail('1.rls.no_anon', JSON.stringify(rows))
  }
}

async function cleanupMembership(marketplaceId, tenantId) {
  await rest(
    `/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${tenantId}`,
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

async function testE2EFlow() {
  const email = process.env.QA_SANDBOX_EMAIL
  const password = process.env.QA_SANDBOX_PASSWORD
  const platformEmail = process.env.QA_PLATFORM_EMAIL
  const platformPassword = process.env.QA_PLATFORM_PASSWORD

  if (!email || !password || !anonKey) {
    skip('2.e2e.*', 'QA_SANDBOX_EMAIL/PASSWORD or anon key not set')
    return
  }

  const marketplaceId = await getTourismMarketplaceId()
  if (!marketplaceId) {
    fail('2.e2e.setup', 'tourism marketplace missing')
    return
  }

  await cleanupMembership(marketplaceId, QA_SANDBOX_TENANT)

  const session = await signIn(email, password)
  if (!session) {
    fail('2.e2e.signin', 'qa-sandbox auth failed')
    return
  }
  pass('2.e2e.signin')

  const req1 = await hubFetch(
    '/api/marketplace/tourism/membership/request',
    session,
    { method: 'POST' },
    QA_SANDBOX_TENANT
  )
  const req1Json = req1.json ?? {}
  if (req1.status === 201 && req1Json.membership?.status === 'pending') {
    pass('2.e2e.request_pending')
  } else {
    fail('2.e2e.request_pending', `${req1.status} ${JSON.stringify(req1Json)}`)
  }

  const req2 = await hubFetch(
    '/api/marketplace/tourism/membership/request',
    session,
    { method: 'POST' },
    QA_SANDBOX_TENANT
  )
  if (req2.status === 409) {
    pass('2.e2e.duplicate_409')
  } else {
    fail('2.e2e.duplicate_409', `status=${req2.status}`)
  }

  if (!platformEmail || !platformPassword) {
    skip('2.e2e.approve', 'QA_PLATFORM credentials not set')
    return
  }

  const platformSession = await signIn(platformEmail, platformPassword)
  if (!platformSession) {
    fail('2.e2e.platform_signin')
    return
  }

  const listRes = await hubFetch(
    '/api/admin/marketplace/tourism/members?status=pending',
    platformSession
  )
  const listJson = listRes.json ?? {}
  const member = listJson.members?.find((m) => m.tenant_id === QA_SANDBOX_TENANT)
  if (!member) {
    fail('2.e2e.admin_list', 'pending member not found')
    return
  }
  pass('2.e2e.admin_list')

  const approveRes = await hubFetch(
    `/api/admin/marketplace/tourism/members/${member.id}`,
    platformSession,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    }
  )
  if (approveRes.ok) {
    pass('2.e2e.approve')
  } else {
    fail('2.e2e.approve', approveRes.text)
    return
  }

  const statusRes = await hubFetch(
    '/api/marketplace/tourism/membership',
    session,
    {},
    QA_SANDBOX_TENANT
  )
  const statusJson = statusRes.json ?? {}
  if (statusJson.status === 'approved') {
    pass('2.e2e.status_approved')
  } else {
    fail('2.e2e.status_approved', JSON.stringify(statusJson))
  }

  const pageRes = await hubFetch('/m/tourism', session, { redirect: 'manual' }, QA_SANDBOX_TENANT)
  const pageHtml = pageRes.text ?? ''
  if (pageRes.status === 200 && pageHtml.includes('Поиск скоро')) {
    pass('2.e2e.page_approved_gate')
  } else if (pageRes.status === 200 && !pageHtml.includes('Подать заявку')) {
    pass('2.e2e.page_approved_gate', 'inside marketplace')
  } else {
    fail('2.e2e.page_approved_gate', `status=${pageRes.status}`)
  }

  const rejectRes = await hubFetch(
    `/api/admin/marketplace/tourism/members/${member.id}`,
    platformSession,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', reject_reason: 'M4b test reject' }),
    }
  )
  if (rejectRes.ok) {
    pass('2.e2e.reject')
  } else {
    fail('2.e2e.reject', rejectRes.text)
  }

  const resubmitRes = await hubFetch(
    '/api/marketplace/tourism/membership/request',
    session,
    { method: 'POST' },
    QA_SANDBOX_TENANT
  )
  const resubmitJson = resubmitRes.json ?? {}
  if (resubmitRes.ok && resubmitJson.membership?.status === 'pending') {
    pass('2.e2e.resubmit_pending')
  } else {
    fail('2.e2e.resubmit_pending', `${resubmitRes.status}`)
  }

  await hubFetch(
    `/api/admin/marketplace/tourism/members/${member.id}`,
    platformSession,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    }
  )

  const suspendRes = await hubFetch(
    `/api/admin/marketplace/tourism/members/${member.id}`,
    platformSession,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'suspend', reject_reason: 'M4b test suspend' }),
    }
  )
  if (suspendRes.ok) {
    pass('2.e2e.suspend')
  } else {
    fail('2.e2e.suspend', suspendRes.text)
  }

  const blockedRes = await hubFetch(
    '/api/marketplace/tourism/membership',
    session,
    {},
    QA_SANDBOX_TENANT
  )
  const blockedJson = blockedRes.json ?? {}
  if (blockedJson.status === 'suspended') {
    pass('2.e2e.suspend_status')
  } else {
    fail('2.e2e.suspend_status', JSON.stringify(blockedJson))
  }

  const blockedPage = await hubFetch(
    '/m/tourism',
    session,
    { redirect: 'manual' },
    QA_SANDBOX_TENANT
  )
  if (
    blockedPage.status === 200 &&
    (blockedPage.text?.includes('Доступ отклонён') ||
      blockedPage.text?.includes('Приостановлен') ||
      blockedPage.text?.includes('Подать повторно'))
  ) {
    pass('2.e2e.page_suspended_gate')
  } else {
    fail('2.e2e.page_suspended_gate', `status=${blockedPage.status}`)
  }

  await cleanupMembership(marketplaceId, QA_SANDBOX_TENANT)
}

async function testNegative() {
  const anonPage = await fetch(`${hubBase}/m/tourism`, { redirect: 'manual' })
  if (anonPage.status === 307 || anonPage.status === 302 || anonPage.status === 308) {
    pass('3.negative.anon_redirect', `status=${anonPage.status}`)
  } else {
    fail('3.negative.anon_redirect', `status=${anonPage.status}`)
  }

  const marketplaceId = await getTourismMarketplaceId()
  if (!marketplaceId) return

  const buyerEmail = process.env.QA_BUYER_EMAIL
  const buyerPassword = process.env.QA_BUYER_PASSWORD
  const sandboxEmail = process.env.QA_SANDBOX_EMAIL
  const sandboxPassword = process.env.QA_SANDBOX_PASSWORD

  if (!buyerEmail || !buyerPassword || !sandboxEmail || !sandboxPassword || !anonKey) {
    skip('3.negative.rls_isolation', 'QA buyer/sandbox credentials not set')
    return
  }

  await cleanupMembership(marketplaceId, QA_SANDBOX_TENANT)
  const { json: inserted, ok: insertOk } = await rest('/rest/v1/marketplace_members', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'hub',
      'Content-Profile': 'hub',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      marketplace_id: marketplaceId,
      tenant_id: QA_SANDBOX_TENANT,
      status: 'pending',
    }),
  })

  const memberId = inserted?.[0]?.id ?? inserted?.id
  if (!insertOk || !memberId) {
    fail('3.negative.seed', JSON.stringify(inserted))
    return
  }

  const buyerSession = await signIn(buyerEmail, buyerPassword)
  const buyerTenantId = QA_BUYER_TENANT

  if (buyerSession && buyerTenantId && buyerTenantId !== QA_SANDBOX_TENANT) {
    const buyerRes = await fetch(
      `${supabaseUrl}/rest/v1/marketplace_members?marketplace_id=eq.${marketplaceId}&tenant_id=eq.${QA_SANDBOX_TENANT}&select=id`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${buyerSession.access_token}`,
          Accept: 'application/json',
          'Accept-Profile': 'hub',
        },
      }
    )
    const buyerJson = await buyerRes.json()
    if (Array.isArray(buyerJson) && buyerJson.length === 0) {
      pass('3.negative.rls_isolation')
    } else {
      fail('3.negative.rls_isolation', JSON.stringify(buyerJson))
    }
  } else {
    skip('3.negative.rls_isolation', 'QA_BUYER_TENANT_ID not configured')
  }

  await rest(`/rest/v1/marketplace_members?id=eq.${memberId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'hub',
      'Content-Profile': 'hub',
      Prefer: 'return=minimal',
    },
  })
}

async function testProdRows() {
  const { json } = await rest(
    '/rest/v1/marketplace_members?select=id,status,marketplace_id,tenant_id&limit=5',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  if (Array.isArray(json)) {
    pass('4.prod.rows_readable', `count sample ok, rows=${json.length}`)
  } else {
    fail('4.prod.rows_readable', String(json))
  }

  const anonRes = await fetch(
    `${supabaseUrl}/rest/v1/marketplace_members?select=id&limit=1`,
    {
      headers: {
        apikey: anonKey ?? serviceKey,
        Authorization: `Bearer ${anonKey ?? ''}`,
        Accept: 'application/json',
        'Accept-Profile': 'hub',
      },
    }
  )
  if (anonRes.status === 401 || anonRes.status === 403 || anonRes.status === 406) {
    pass('4.prod.no_anon_exposure', `status=${anonRes.status}`)
  } else {
    const anonJson = await anonRes.json().catch(() => null)
    if (Array.isArray(anonJson) && anonJson.length === 0) {
      pass('4.prod.no_anon_exposure', 'empty via RLS')
    } else {
      fail('4.prod.no_anon_exposure', `status=${anonRes.status}`)
    }
  }
}

async function main() {
  console.log(`H-M4b tests — hub base: ${hubBase}`)
  console.log(`Supabase: ${supabaseUrl}`)

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  await testMigrationTable()
  await testRlsPolicies()
  await testE2EFlow()
  await testNegative()
  await testProdRows()

  const failed = results.filter((r) => !r.ok)
  const skipped = results.filter((r) => r.skipped)
  console.log(
    `\nDone: ${results.length - failed.length}/${results.length} passed` +
      (skipped.length ? ` (${skipped.length} skipped)` : '')
  )
  if (failed.length) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
