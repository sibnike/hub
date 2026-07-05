#!/usr/bin/env node
/**
 * One-off: create qa-buyer tenant + QA creds in .env.local (prod).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const hubRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const QA = {
  sandbox: {
    tenantId: '959a1e3a-88d8-4949-86d3-62a10540ab4b',
    email: 'qa-sandbox-e2e@vitrina.test',
    password: 'vitrina-qa-sandbox-e2e',
  },
  buyer: {
    slug: 'qa-buyer',
    name: 'QA Buyer',
    email: 'qa-buyer-e2e@vitrina.test',
    password: 'vitrina-qa-buyer-e2e',
  },
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

async function authAdmin(path, options = {}) {
  return rest(`/auth/v1/admin${path}`, options)
}

async function listUsers() {
  const { json } = await authAdmin('/users?page=1&per_page=1000')
  return json?.users ?? []
}

async function ensureAuthUser(email, password) {
  const users = await listUsers()
  const existing = users.find((u) => u.email === email)
  if (existing) {
    await authAdmin(`/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    })
    return existing
  }
  const { json, ok, text } = await authAdmin('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!ok) throw new Error(`createUser ${email}: ${text}`)
  return json
}

function upsertEnvLine(env, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  if (re.test(env)) return env.replace(re, `${key}=${value}`)
  return `${env.trim()}\n${key}=${value}`
}

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const { json: sandboxTenant } = await rest(
    `/rest/v1/tenants?select=*&slug=eq.qa-sandbox`
  )
  const sandbox = sandboxTenant?.[0]
  if (!sandbox) throw new Error('qa-sandbox not found')
  console.log('qa-sandbox:', sandbox.id)

  const sandboxUser = await ensureAuthUser(QA.sandbox.email, QA.sandbox.password)
  await rest('/rest/v1/tenant_admins', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: sandboxUser.id,
      tenant_id: QA.sandbox.tenantId,
    }),
  })
  console.log('qa-sandbox admin:', sandboxUser.id)

  const { json: existingBuyer } = await rest(
    `/rest/v1/tenants?select=id&slug=eq.${QA.buyer.slug}`
  )
  let buyerTenantId = existingBuyer?.[0]?.id

  if (!buyerTenantId) {
    const settings = { ...(sandbox.settings ?? {}) }
    delete settings.telegram_chat_id
    const { json: created, ok, text } = await rest('/rest/v1/tenants', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        slug: QA.buyer.slug,
        name: QA.buyer.name,
        settings,
        is_active: true,
        status: sandbox.status ?? 'active',
      }),
    })
    if (!ok) throw new Error(`create tenant: ${text}`)
    buyerTenantId = created?.[0]?.id ?? created?.id
    console.log('qa-buyer created:', buyerTenantId)
  } else {
    console.log('qa-buyer exists:', buyerTenantId)
  }

  const buyerUser = await ensureAuthUser(QA.buyer.email, QA.buyer.password)
  await rest('/rest/v1/tenant_admins', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: buyerUser.id,
      tenant_id: buyerTenantId,
    }),
  })
  console.log('qa-buyer admin:', buyerUser.id)

  const { json: staff } = await rest(
    `/rest/v1/tenant_staff?select=id&tenant_id=eq.${buyerTenantId}&limit=1`
  )
  console.log('qa-buyer staff rows:', Array.isArray(staff) ? staff.length : 0)

  let env = readFileSync(resolve(hubRoot, '.env.local'), 'utf8')
  env = upsertEnvLine(env, 'QA_SANDBOX_EMAIL', QA.sandbox.email)
  env = upsertEnvLine(env, 'QA_SANDBOX_PASSWORD', QA.sandbox.password)
  env = upsertEnvLine(env, 'QA_SANDBOX_TENANT_ID', QA.sandbox.tenantId)
  env = upsertEnvLine(env, 'QA_BUYER_EMAIL', QA.buyer.email)
  env = upsertEnvLine(env, 'QA_BUYER_PASSWORD', QA.buyer.password)
  env = upsertEnvLine(env, 'QA_BUYER_TENANT_ID', buyerTenantId)

  writeFileSync(resolve(hubRoot, '.env.local'), env.trim() + '\n')

  console.log('ENV_UPDATED')
  console.log(JSON.stringify({ buyerTenantId }, null, 2))
  console.log('Run scripts/setup-qa-platform.mjs for QA_PLATFORM_* creds')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
