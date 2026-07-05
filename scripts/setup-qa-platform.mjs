#!/usr/bin/env node
/**
 * One-off: create qa-platform platform_admin + QA creds in .env.local (prod).
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
  platform: {
    email: 'qa-platform@vitrina.test',
    password: process.env.QA_PLATFORM_PASSWORD || 'vitrina-qa-platform-e2e',
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
    const { ok, text } = await authAdmin(`/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    })
    if (!ok) throw new Error(`setPassword ${email}: ${text}`)
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

  const platformUser = await ensureAuthUser(QA.platform.email, QA.platform.password)
  console.log('qa-platform password set:', platformUser.id)

  const { ok, text } = await rest('/rest/v1/platform_admins', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: platformUser.id }),
  })
  if (!ok) throw new Error(`platform_admins insert: ${text}`)
  console.log('qa-platform platform_admin row ensured')

  let env = readFileSync(resolve(hubRoot, '.env.local'), 'utf8')
  env = upsertEnvLine(env, 'QA_PLATFORM_EMAIL', QA.platform.email)
  env = upsertEnvLine(env, 'QA_PLATFORM_PASSWORD', QA.platform.password)
  writeFileSync(resolve(hubRoot, '.env.local'), env.trim() + '\n')

  console.log('ENV_UPDATED')
  console.log(
    JSON.stringify(
      {
        platformUserId: platformUser.id,
        platformEmail: QA.platform.email,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
