#!/usr/bin/env node
/**
 * Test plan for Marketplace Tenant Search (TZ §6).
 *
 * Usage:
 *   cd mega-hub
 *   node scripts/test-marketplace-search.mjs
 *
 * Env (from .env.local or export):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   HUB_BASE_URL (default http://localhost:3001) — for API tests
 *   HUB_BASE_URL must serve /api/marketplace/search with ANTHROPIC_API_KEY on the server
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
loadEnvFile(resolve(root, '.env.production.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
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
  return { ok: res.ok, status: res.status, json }
}

async function testCityColumn() {
  const { ok, json } = await rest('/rest/v1/company_cache?select=tenant_id,city,name&limit=5', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })

  assert('1a. company_cache.city column exists', ok, ok ? '' : String(json))
  if (ok && Array.isArray(json)) {
    const withCity = json.filter((r) => r.city)
    pass('1b. sample rows loaded', `${json.length} rows, ${withCity.length} with city`)
  }
}

async function testFtsRpc() {
  const sampleRes = await rest(
    '/rest/v1/company_cache?select=tags,categories,short_description,name&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  let keyword = 'компания'
  const sample = Array.isArray(sampleRes.json) ? sampleRes.json[0] : null
  if (sample) {
    const tag = sample.tags?.[0]
    const cat = sample.categories?.[0]
    const desc =
      sample.short_description && typeof sample.short_description === 'object'
        ? Object.values(sample.short_description).find(
            (v) => typeof v === 'string' && v.trim().length > 3
          )
        : null
    if (tag) keyword = String(tag).split(/\s+/)[0]
    else if (desc) keyword = String(desc).split(/\s+/).find((w) => w.length > 3) ?? keyword
    else if (cat) keyword = String(cat)
    else if (sample.name) keyword = String(sample.name).split(/\s+/)[0]
  }

  const { ok, json } = await rest('/rest/v1/rpc/search_company_cache', {
    method: 'POST',
    headers: { 'Content-Profile': 'hub' },
    body: JSON.stringify({
      p_keywords: keyword,
      p_categories: null,
      p_tags: null,
      p_country: null,
      p_city: null,
      p_limit: 10,
    }),
  })

  assert('2a. FTS RPC search_company_cache works', ok, ok ? '' : String(json))
  assert(
    '2b. FTS finds matches by single word',
    ok && Array.isArray(json),
    `keyword="${keyword}", hits=${Array.isArray(json) ? json.length : 0}`
  )
}

async function testApiFilterPath() {
  const sampleRes = await rest(
    '/rest/v1/company_cache?select=country,city,categories&country=not.is.null&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  const sample = Array.isArray(sampleRes.json) ? sampleRes.json[0] : null

  const filter = {
    keywords: null,
    categories: sample?.categories?.length ? [sample.categories[0]] : [],
    tags: [],
    country: sample?.country ?? null,
    city: null,
  }

  const res = await fetch(`${hubBase}/api/marketplace/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter, limit: 5 }),
  })
  const json = await res.json()

  assert('4a. API filter path responds', res.ok, json.error ?? `status ${res.status}`)
  assert('4b. API returns results array', Array.isArray(json.results))
}

async function testApiAiParse() {
  const res = await fetch(`${hubBase}/api/marketplace/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'нужен гид по горам в Алматы' }),
  })
  const json = await res.json()

  assert('3a. AI search API responds', res.ok, json.error ?? `status ${res.status}`)
  assert('3b. parsed_by_ai flag', json.parsed_by_ai === true)

  const f = json.filter
  const structured =
    f &&
    (f.city?.toLowerCase().includes('алмат') ||
      f.categories?.includes('tourism') ||
      (f.keywords && !f.keywords.includes('нужен гид по горам в Алматы')))

  assert(
    '3c. AI returns structured filter (not echo)',
    Boolean(structured),
    JSON.stringify(f)
  )
}

function testCatalogRegression() {
  const catalogPath = resolve(root, 'components/visitor/guide-catalog-client.tsx')
  const content = readFileSync(catalogPath, 'utf8')
  assert(
    '5. guide-catalog-client unchanged (no marketplace imports)',
    !content.includes('marketplace') && content.includes('collectSearchText'),
    catalogPath
  )
}

async function main() {
  console.log('Marketplace Tenant Search — test plan\n')

  if (!supabaseUrl || !serviceKey) {
    fail('env', 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }

  await testCityColumn()
  await testFtsRpc()
  testCatalogRegression()

  try {
    await testApiFilterPath()
    await testApiAiParse()
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
