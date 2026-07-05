#!/usr/bin/env node
/**
 * Local DB reset: bootstrap public deps (local-only) + hub migrations.
 * Bootstrap lives in supabase/local/ — never in migrations/ (not pushed to prod).
 */

import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const hubRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const bootstrapSrc = join(hubRoot, 'supabase/local/hub_public_bootstrap.sql')
const bootstrapTmp = join(
  hubRoot,
  'supabase/migrations/20260603119999_hub_public_bootstrap.sql'
)

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: hubRoot, stdio: 'inherit', env: process.env })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function removeTempBootstrap() {
  if (existsSync(bootstrapTmp)) {
    unlinkSync(bootstrapTmp)
  }
}

function main() {
  if (!existsSync(bootstrapSrc)) {
    console.error('Missing local bootstrap:', bootstrapSrc)
    process.exit(1)
  }

  removeTempBootstrap()

  try {
    copyFileSync(bootstrapSrc, bootstrapTmp)
    run('npx', ['supabase@latest', 'start'])
    run('npx', ['supabase@latest', 'db', 'reset', '--local', '--no-seed'])
  } finally {
    removeTempBootstrap()
  }
}

main()
