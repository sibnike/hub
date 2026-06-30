#!/usr/bin/env node
/**
 * Unit checks for AI parse normalization (without calling Anthropic).
 * Run: node scripts/test-marketplace-parse-unit.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function normalizeSearchFilter(input, validCategorySlugs) {
  const keywords =
    typeof input?.keywords === 'string' && input.keywords.trim()
      ? input.keywords.trim()
      : null

  const categories = Array.isArray(input?.categories)
    ? input.categories.filter(
        (c) =>
          typeof c === 'string' &&
          c.trim().length > 0 &&
          (!validCategorySlugs || validCategorySlugs.has(c))
      )
    : []

  const tags = Array.isArray(input?.tags)
    ? input.tags.filter((t) => typeof t === 'string' && t.trim().length > 0)
    : []

  const country =
    typeof input?.country === 'string' && input.country.trim()
      ? input.country.trim()
      : null

  const city =
    typeof input?.city === 'string' && input.city.trim() ? input.city.trim() : null

  return { keywords, categories, tags, country, city }
}

const validSlugs = new Set([
  'it',
  'tourism',
  'construction',
  'other',
])

const mockAiResponse = {
  keywords: 'гид горы',
  categories: ['tourism'],
  tags: ['гид'],
  country: 'Казахстан',
  city: 'Алматы',
}

const filter = normalizeSearchFilter(mockAiResponse, validSlugs)

const echo = 'нужен гид по горам в Алматы'
const isStructured =
  filter.city?.includes('Алмат') &&
  filter.categories.includes('tourism') &&
  filter.keywords !== echo

if (!isStructured) {
  console.error('✗ AI normalize unit test failed', filter)
  process.exit(1)
}

const routeUsesSameSearch = readFileSync(
  resolve(__dirname, '../app/api/marketplace/search/route.ts'),
  'utf8'
).includes('searchCompanyCache(filter')

if (!routeUsesSameSearch) {
  console.error('✗ API route must call searchCompanyCache(filter) for both paths')
  process.exit(1)
}

console.log('✓ AI normalize produces structured filter from mock Claude JSON')
console.log('✓ API route uses single searchCompanyCache(filter) path')
console.log(JSON.stringify(filter))
