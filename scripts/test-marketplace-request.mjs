#!/usr/bin/env node
/**
 * Test plan for Marketplace Request (TZ §5, Mechanic 3a — schema + routing, no Vitrina dispatch).
 *
 * Usage: node scripts/test-marketplace-request.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(resolve(root, '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hubBase = (process.env.HUB_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '')

const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

function assert(name, condition, detail = '') {
  if (condition) pass(name, detail)
  else fail(name, detail)
}

async function rest(path, options = {}) {
  const key = options.key ?? serviceKey
  const res = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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
  return { ok: res.ok, status: res.status, json }
}

async function testAnonCannotReadPii() {
  if (!anonKey) {
    fail('3a. anon key present', 'NEXT_PUBLIC_SUPABASE_ANON_KEY missing — skip RLS smoke')
    return
  }

  const requests = await rest(
    '/rest/v1/marketplace_requests?select=id,requester_name,requester_contact&limit=5',
    {
      key: anonKey,
      headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
    }
  )
  const requestRows = Array.isArray(requests.json) ? requests.json : []
  assert(
    '3a. anon cannot list marketplace_requests',
    requests.ok && requestRows.length === 0,
    `status=${requests.status}, rows=${requestRows.length}`
  )

  const targets = await rest(
    '/rest/v1/marketplace_request_targets?select=id,tenant_id,proposed_price&limit=5',
    {
      key: anonKey,
      headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
    }
  )
  assert(
    '3b. anon has no SELECT grant on targets',
    targets.status === 401 || targets.status === 403,
    `status=${targets.status}`
  )
}

async function testTablesExist() {
  const req = await rest('/rest/v1/marketplace_requests?select=id&limit=1', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })
  assert('1a. marketplace_requests table', req.ok, req.ok ? '' : String(req.json))

  const tgt = await rest('/rest/v1/marketplace_request_targets?select=id&limit=1', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })
  assert('1b. marketplace_request_targets table', tgt.ok, tgt.ok ? '' : String(tgt.json))
}

async function testApiCreateWithFilter() {
  const res = await fetch(`${hubBase}/api/marketplace/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester_name: 'Test User',
      requester_contact: 'test@example.com',
      request_text: 'нужны горные лыжи',
      target_limit: 5,
      parsed: {
        search: { keywords: 'лыжи', categories: [], tags: [], country: null, city: null },
        requested_date: null,
        quantity: 'две пары',
        requester_proposed_price: null,
      },
    }),
  })
  const json = await res.json()
  assert('2a. API creates request', res.ok, json.error ?? `status ${res.status}`)
  assert('2b. returns parsed object', json.parsed?.search != null)
  assert(
    '2c. dispatch_pending only when matches undelivered',
    json.matched_count > 0 ? json.dispatch_pending === (json.dispatched_count === 0) : json.dispatch_pending === false
  )
  assert('2c2. returns access_token', typeof json.access_token === 'string' && json.access_token.length >= 16)
  assert(
    '2g. dispatch fields present',
    typeof json.dispatched_count === 'number' && Array.isArray(json.dispatch_results)
  )
  assert(
    '2d. no-match branch does not error',
    res.ok && typeof json.matched_count === 'number'
  )

  if (json.request_id) {
    const { json: targets } = await rest(
      `/rest/v1/marketplace_request_targets?select=tenant_id&request_id=eq.${json.request_id}`,
      { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
    )
    const count = Array.isArray(targets) ? targets.length : 0
    assert(
      '2e. targets count matches matched_count',
      count === json.matched_count,
      `db=${count}, api=${json.matched_count}`
    )
    assert('2f. target limit respected', count <= 5, `count=${count}`)
  }
}

async function main() {
  console.log('Marketplace Request (3a) — test plan\n')

  if (!supabaseUrl || !serviceKey) {
    fail('env', 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }

  await testTablesExist()
  await testAnonCannotReadPii()

  try {
    await testApiCreateWithFilter()
  } catch (e) {
    fail('API tests', e instanceof Error ? e.message : String(e))
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
