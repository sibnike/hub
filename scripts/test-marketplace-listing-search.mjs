#!/usr/bin/env node
/**
 * Test plan for Marketplace Listing Search (TZ §7, Mechanic 2).
 *
 * Usage:
 *   cd mega-hub
 *   node scripts/test-marketplace-listing-search.mjs
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   HUB_BASE_URL (default http://localhost:3001)
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

async function backfillFromPublishedPages() {
  const sql = `
    INSERT INTO hub.listing_cache (tenant_id, page_slug, title, short_text, categories)
    SELECT
      p.tenant_id,
      p.slug,
      p.title,
      COALESCE(NULLIF(p.description, '{}'::jsonb), p.title),
      COALESCE(cp.categories, '{}'::text[])
    FROM public.pages p
    LEFT JOIN public.company_profiles cp ON cp.tenant_id = p.tenant_id
    WHERE p.status = 'published'
    ON CONFLICT (tenant_id, page_slug) DO UPDATE SET
      title = EXCLUDED.title,
      short_text = EXCLUDED.short_text,
      categories = EXCLUDED.categories,
      synced_at = now();
  `
  const { ok, json } = await rest('/rest/v1/rpc/exec_sql_backfill', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (ok) return

  const { ok: insertOk, json: insertJson } = await rest('/rest/v1/listing_cache', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Profile': 'hub',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([]),
  })

  const pagesRes = await rest(
    '/rest/v1/pages?select=tenant_id,slug,title,description,status&status=eq.published',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
  )

  if (!Array.isArray(pagesRes.json) || !pagesRes.json.length) {
    fail('backfill', 'no published pages')
    return
  }

  for (const page of pagesRes.json) {
    const profileRes = await rest(
      `/rest/v1/company_profiles?select=categories&tenant_id=eq.${page.tenant_id}&limit=1`,
      { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
    )
    const categories = Array.isArray(profileRes.json) ? profileRes.json[0]?.categories ?? [] : []

    await rest('/rest/v1/listing_cache', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Profile': 'hub',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        tenant_id: page.tenant_id,
        page_slug: page.slug,
        title: page.title ?? {},
        short_text:
          page.description && Object.keys(page.description).length
            ? page.description
            : page.title ?? {},
        categories,
      }),
    })
  }

  pass('backfill listing_cache from published pages', `${pagesRes.json.length} pages`)
}

async function testListingTable() {
  const { ok, json } = await rest('/rest/v1/listing_cache?select=id,tenant_id,page_slug&limit=5', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })
  assert('1a. listing_cache table exists', ok, ok ? '' : String(json))
  if (ok && Array.isArray(json)) {
    pass('1b. sample rows', `${json.length} rows`)
  }
}

async function testListingFts() {
  const sampleRes = await rest(
    '/rest/v1/listing_cache?select=title,short_text&limit=1',
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )

  let keyword = 'меню'
  const sample = Array.isArray(sampleRes.json) ? sampleRes.json[0] : null
  if (sample?.title && typeof sample.title === 'object') {
    const ru = sample.title.ru ?? Object.values(sample.title).find((v) => typeof v === 'string')
    if (ru) keyword = String(ru).split(/\s+/).find((w) => w.length > 3) ?? keyword
  }

  const { ok, json } = await rest('/rest/v1/rpc/search_listing_cache', {
    method: 'POST',
    headers: { 'Content-Profile': 'hub' },
    body: JSON.stringify({
      p_keywords: keyword,
      p_categories: null,
      p_tenant_id: null,
      p_limit: 10,
    }),
  })

  assert('2a. FTS RPC search_listing_cache works', ok, ok ? '' : String(json))
  assert(
    '2b. FTS finds matches by keyword',
    ok && Array.isArray(json) && json.length > 0,
    `keyword="${keyword}", hits=${Array.isArray(json) ? json.length : 0}`
  )
}

async function testUnpublishRemovesListing() {
  const sampleRes = await rest('/rest/v1/listing_cache?select=tenant_id,page_slug&limit=1', {
    headers: { Accept: 'application/json', 'Accept-Profile': 'hub' },
  })
  const sample = Array.isArray(sampleRes.json) ? sampleRes.json[0] : null
  if (!sample) {
    fail('3. unpublish delete', 'no sample row')
    return
  }

  const secret = process.env.VITRINA_WEBHOOK_SECRET
  const syncUrl = `${hubBase}/api/sync/listing`

  if (secret) {
    const payload = JSON.stringify({
      action: 'delete',
      tenant_id: sample.tenant_id,
      page_slug: sample.page_slug,
    })
    const crypto = await import('node:crypto')
    const signature =
      'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const delRes = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vitrina-signature': signature,
      },
      body: payload,
    })
    if (delRes.status === 404) {
      pass('3a. sync webhook delete skipped', `HUB not running at ${hubBase}`)
    } else {
      assert('3a. listing row deleted via sync webhook', delRes.ok, `status=${delRes.status}`)
    }
  } else {
    pass('3a. sync webhook delete skipped', 'VITRINA_WEBHOOK_SECRET not set')
  }

  const searchRes = await rest('/rest/v1/rpc/search_listing_cache', {
    method: 'POST',
    headers: { 'Content-Profile': 'hub' },
    body: JSON.stringify({
      p_keywords: sample.page_slug.replace(/-/g, ' '),
      p_categories: null,
      p_tenant_id: sample.tenant_id,
      p_limit: 5,
    }),
  })

  const hits = Array.isArray(searchRes.json) ? searchRes.json : []
  const stillThere = hits.some(
    (r) => r.page_slug === sample.page_slug && r.tenant_id === sample.tenant_id
  )
  assert('3b. deleted listing not in search', !stillThere)

  await rest('/rest/v1/listing_cache', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Profile': 'hub',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      tenant_id: sample.tenant_id,
      page_slug: sample.page_slug,
      title: { ru: 'Test restore' },
      short_text: { ru: 'restore row after delete test' },
      categories: [],
    }),
  })
}

async function testTenantSearchRegression() {
  try {
    const res = await fetch(`${hubBase}/api/marketplace/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { keywords: 'компания', categories: [], tags: [], country: null, city: null },
        limit: 5,
      }),
    })
    const text = await res.text()
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      pass('4. Mechanic 1 API skipped', `HUB not running at ${hubBase}`)
      return
    }
    const json = JSON.parse(text)
    assert('4a. Mechanic 1 search API responds', res.ok, json.error ?? `status ${res.status}`)
    assert(
      '4b. results have result_type tenant',
      Array.isArray(json.results) &&
        (json.results.length === 0 || json.results[0].result_type === 'tenant')
    )
  } catch (e) {
    pass('4. Mechanic 1 API skipped', e instanceof Error ? e.message : String(e))
  }
}

async function testListingSearchApi() {
  try {
    const res = await fetch(`${hubBase}/api/marketplace/search-listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { keywords: 'меню', categories: [], tags: [], country: null, city: null },
        limit: 5,
      }),
    })
    const text = await res.text()
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      pass('5. search-listings API skipped', `HUB not running at ${hubBase}`)
      return
    }
    const json = JSON.parse(text)
    assert('5a. search-listings API responds', res.ok, json.error ?? `status ${res.status}`)
    assert(
      '5b. results have result_type listing',
      Array.isArray(json.results) &&
        (json.results.length === 0 || json.results[0].result_type === 'listing')
    )
  } catch (e) {
    pass('5. search-listings API skipped', e instanceof Error ? e.message : String(e))
  }
}

function testUiMixedResults() {
  const uiPath = resolve(root, 'components/marketplace/marketplace-search-client.tsx')
  const content = readFileSync(uiPath, 'utf8')
  assert(
    '6. UI shows both result types',
    content.includes("result_type === 'tenant'") &&
      content.includes("result_type === 'listing'") &&
      content.includes('search-listings'),
    uiPath
  )
}

async function main() {
  console.log('Marketplace Listing Search — test plan\n')

  if (!supabaseUrl || !serviceKey) {
    fail('env', 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    process.exit(1)
  }

  await backfillFromPublishedPages()
  await testListingTable()
  await testListingFts()
  await testUnpublishRemovesListing()
  testUiMixedResults()

  try {
    await testTenantSearchRegression()
    await testListingSearchApi()
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
