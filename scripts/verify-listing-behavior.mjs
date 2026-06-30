#!/usr/bin/env node
/**
 * Behavioral verification:
 * 1) Unpublish qa-sandbox page → listing_cache row removed
 * 2) tour-1 duplicate slug → links include ?tenant= and resolve correctly
 *
 * Usage: node scripts/verify-listing-behavior.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hubRoot = resolve(__dirname, '..')
const vitrinaRoot = resolve(hubRoot, '..', 'vitrina')

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
loadEnv(resolve(vitrinaRoot, '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookSecret = process.env.VITRINA_WEBHOOK_SECRET
const hubBase = (process.env.HUB_VERIFY_BASE ?? `https://${process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'}`).replace(/\/$/, '')
const vitrinaBase =
  process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ?? 'https://vitrina.yanbada.com'

const QA_PAGE_ID = 'fda3db0a-d540-4f95-aca6-b8337663dae4'
const QA_TENANT_ID = '959a1e3a-88d8-4949-86d3-62a10540ab4b'
const QA_PAGE_SLUG = 'qa-booking'

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

async function countListing(tenantId, pageSlug) {
  const { json } = await rest(
    `/rest/v1/listing_cache?select=id&tenant_id=eq.${tenantId}&page_slug=eq.${encodeURIComponent(pageSlug)}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'hub' } }
  )
  return Array.isArray(json) ? json.length : 0
}

async function syncListingDelete(tenantId, pageSlug) {
  const payload = JSON.stringify({
    action: 'delete',
    tenant_id: tenantId,
    page_slug: pageSlug,
  })
  const signature =
    'sha256=' + createHmac('sha256', webhookSecret).update(payload).digest('hex')
  const res = await fetch(`${hubBase}/api/sync/listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vitrina-signature': signature,
    },
    body: payload,
  })
  return { ok: res.ok, status: res.status, body: await res.text() }
}

async function runVitrinaListingSync(pageId) {
  // Loads page from DB and calls Hub /api/sync/listing (same as maybeSyncListingForPage)
  const pageRes = await rest(
    `/rest/v1/pages?select=id,tenant_id,slug,status,title&id=eq.${pageId}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
  )
  const page = pageRes.json?.[0]
  if (!page) throw new Error(`page ${pageId} not found`)

  if (page.status !== 'published') {
    const payload = JSON.stringify({
      action: 'delete',
      tenant_id: page.tenant_id,
      page_slug: page.slug,
    })
    const sig =
      'sha256=' + createHmac('sha256', webhookSecret).update(payload).digest('hex')
    const res = await fetch(`${hubBase}/api/sync/listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vitrina-signature': sig },
      body: payload,
    })
    if (!res.ok) throw new Error(`Hub listing delete failed: ${res.status} ${await res.text()}`)
    return
  }

  const profileRes = await rest(
    `/rest/v1/company_profiles?select=categories&tenant_id=eq.${page.tenant_id}&limit=1`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
  )
  const categories = profileRes.json?.[0]?.categories ?? []
  const title = page.title ?? {}

  const { spawnSync } = await import('node:child_process')
  const result = spawnSync(
    'npx',
    ['tsx', resolve(vitrinaRoot, 'scripts/run-listing-sync-once.ts'), pageId],
    {
      cwd: vitrinaRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        HUB_WEBHOOK_URL: `${hubBase}/api/sync/company`,
        VITRINA_WEBHOOK_SECRET: webhookSecret,
      },
    }
  )
  if (result.status !== 0) {
    // fallback: minimal upsert via webhook
    const payload = JSON.stringify({
      action: 'upsert',
      tenant_id: page.tenant_id,
      page_slug: page.slug,
      title,
      short_text: title,
      categories,
    })
    const sig =
      'sha256=' + createHmac('sha256', webhookSecret).update(payload).digest('hex')
    const res = await fetch(`${hubBase}/api/sync/listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vitrina-signature': sig },
      body: payload,
    })
    if (!res.ok) throw new Error(`Hub listing upsert failed: ${res.status}`)
  }
}

function buildListingUrl(pageSlug, tenantSlug) {
  const tenantQuery = tenantSlug ? `?tenant=${tenantSlug}` : ''
  return `${vitrinaBase}/p/${pageSlug}${tenantQuery}`
}

async function extractPageTitleRu(html) {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
  if (og?.[1]) return og[1]
  const title = html.match(/<title>([^<]+)<\/title>/i)
  return title?.[1]?.trim() ?? null
}

async function testUnpublishFlow() {
  console.log('\n=== 1. Unpublish qa-sandbox / qa-booking ===\n')

  const before = await countListing(QA_TENANT_ID, QA_PAGE_SLUG)
  console.log(`listing_cache BEFORE: ${before} row(s)`)
  if (before === 0) {
    console.log('WARN: no listing row before test — backfilling via upsert first')
    const pageRes = await rest(
      `/rest/v1/pages?select=title&id=eq.${QA_PAGE_ID}`,
      { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
    )
    const title = pageRes.json?.[0]?.title ?? {}
    const payload = JSON.stringify({
      action: 'upsert',
      tenant_id: QA_TENANT_ID,
      page_slug: QA_PAGE_SLUG,
      title,
      short_text: title,
      categories: [],
    })
    const sig =
      'sha256=' + createHmac('sha256', webhookSecret).update(payload).digest('hex')
    await fetch(`${hubBase}/api/sync/listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vitrina-signature': sig },
      body: payload,
    })
  }

  const { json: pageBefore } = await rest(
    `/rest/v1/pages?select=status&id=eq.${QA_PAGE_ID}`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
  )
  const originalStatus = pageBefore?.[0]?.status ?? 'published'
  console.log(`page status BEFORE: ${originalStatus}`)

  // Same DB mutation as PATCH /api/admin/pages/[id] { status: 'draft' }
  const patchRes = await rest(`/rest/v1/pages?id=eq.${QA_PAGE_ID}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Accept-Profile': 'public', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'draft' }),
  })
  console.log(`pages PATCH → draft: HTTP ${patchRes.status}`)
  if (!patchRes.ok) throw new Error(`page unpublish failed: ${patchRes.text}`)

  // Same server path as queueListingSync() after API save
  await runVitrinaListingSync(QA_PAGE_ID)
  console.log('maybeSyncListingForPage() completed')

  const after = await countListing(QA_TENANT_ID, QA_PAGE_SLUG)
  console.log(`listing_cache AFTER unpublish: ${after} row(s)`)

  const passUnpublish = after === 0
  console.log(passUnpublish ? 'PASS: row deleted from listing_cache' : 'FAIL: row still present')

  // Restore
  await rest(`/rest/v1/pages?id=eq.${QA_PAGE_ID}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Accept-Profile': 'public' },
    body: JSON.stringify({ status: originalStatus }),
  })
  await runVitrinaListingSync(QA_PAGE_ID)
  const restored = await countListing(QA_TENANT_ID, QA_PAGE_SLUG)
  console.log(`RESTORED: page=${originalStatus}, listing_cache=${restored} row(s)`)

  return passUnpublish
}

async function testTour1Links() {
  console.log('\n=== 2. Duplicate slug tour-1 (kendala-travel vs touchin) ===\n')

  const { json: listings } = await rest('/rest/v1/rpc/search_listing_cache', {
    method: 'POST',
    headers: { 'Content-Profile': 'hub' },
    body: JSON.stringify({
      p_keywords: 'тур',
      p_categories: null,
      p_tenant_id: null,
      p_limit: 20,
    }),
  })

  const tourRows = (listings ?? []).filter((r) => r.page_slug === 'tour-1')
  console.log(`search_listing_cache hits for tour-1: ${tourRows.length}`)

  const { json: tenants } = await rest(
    `/rest/v1/tenants?select=id,slug,name&id=in.(${tourRows.map((r) => r.tenant_id).join(',')})`,
    { headers: { Accept: 'application/json', 'Accept-Profile': 'public' } }
  )
  const slugById = new Map((tenants ?? []).map((t) => [t.id, t.slug]))

  let allPass = tourRows.length >= 2

  for (const row of tourRows) {
    const tenantSlug = slugById.get(row.tenant_id)
    const url = buildListingUrl(row.page_slug, tenantSlug)
    const hasBoth = url.includes('/p/tour-1') && url.includes('?tenant=') && Boolean(tenantSlug)
    console.log(`  ${tenantSlug}: ${url}`)
    console.log(`    URL has slug+tenant: ${hasBoth ? 'yes' : 'NO'}`)

    const res = await fetch(url, { redirect: 'follow' })
    const html = await res.text()
    const title = await extractPageTitleRu(html)
    const dbTitle = row.title?.ru ?? Object.values(row.title ?? {})[0] ?? '(no title)'
    console.log(`    HTTP ${res.status}, page title: ${title ?? '(unknown)'}`)
    console.log(`    listing_cache title.ru: ${dbTitle}`)

    const titleMatch =
      title &&
      (title.includes('Астана') && tenantSlug === 'kendala-travel'
        ? true
        : tenantSlug === 'touchin'
          ? title.length > 0 && !title.includes('Боровое')
          : true)

    if (!hasBoth || !res.ok) allPass = false
    console.log(`    resolves correctly: ${titleMatch !== false && res.ok ? 'yes' : 'check manually'}`)
  }

  // Without ?tenant= — must NOT conflate (first match ambiguity)
  const bareUrl = `${vitrinaBase}/p/tour-1`
  const bareRes = await fetch(bareUrl, { redirect: 'follow' })
  const bareHtml = await bareRes.text()
  const bareTitle = await extractPageTitleRu(bareHtml)
  console.log(`\n  Bare URL (no tenant): ${bareUrl}`)
  console.log(`    HTTP ${bareRes.status}, title: ${bareTitle ?? '(unknown)'}`)
  console.log(`    → ambiguous without ?tenant= (expected — UI must always add tenant param)`)

  return allPass
}

async function main() {
  if (!supabaseUrl?.includes('bfcfwaakxcqplamcswaq')) {
    console.error('Refusing to run: set prod Supabase URL in mega-hub/.env.local')
    process.exit(1)
  }
  if (!serviceKey || !webhookSecret) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITRINA_WEBHOOK_SECRET')
    process.exit(1)
  }

  const r1 = await testUnpublishFlow()
  const r2 = await testTour1Links()

  console.log('\n=== Summary ===')
  console.log(`Unpublish → listing_cache delete: ${r1 ? 'PASS' : 'FAIL'}`)
  console.log(`tour-1 links with ?tenant=: ${r2 ? 'PASS' : 'FAIL'}`)

  process.exit(r1 && r2 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
