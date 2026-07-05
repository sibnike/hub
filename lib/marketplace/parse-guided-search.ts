import { callAnthropic } from '@/lib/ai/call-anthropic'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getI18nText } from '@/lib/i18n/get-text'
import { extractJsonObject } from '@/lib/marketplace/marketplace-ai-json'
import { normalizeSearchFilter } from '@/lib/marketplace/normalize-search-filter'
import type { GuidedSearchParams } from '@/types/marketplace-guided-search'
import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

function emptyGuidedParams(): GuidedSearchParams {
  return {
    city: null,
    date_from: null,
    date_to: null,
    people: null,
    notes: null,
    search: {
      keywords: null,
      categories: [],
      tags: [],
      country: null,
      city: null,
    },
  }
}

function parsePeople(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    if (match) return Number(match[0])
  }
  return null
}

function mergeParams(
  parsed: Partial<GuidedSearchParams> & { search?: Partial<MarketplaceSearchFilter> },
  validSlugs: Set<string>,
  fallbackCity: string | null
): GuidedSearchParams {
  const search = normalizeSearchFilter(parsed.search ?? {}, validSlugs)
  const city = parsed.city?.trim() || search.city || fallbackCity || null

  if (city) {
    search.city = city
  }

  return {
    city,
    date_from: typeof parsed.date_from === 'string' ? parsed.date_from : null,
    date_to: typeof parsed.date_to === 'string' ? parsed.date_to : null,
    people: parsePeople(parsed.people),
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() || null : null,
    search,
  }
}

export async function parseGuidedSearchQuery(input: {
  query: string
  presetThemeSlug: string
  knownCity?: string | null
}): Promise<GuidedSearchParams> {
  const trimmed = input.query.trim()
  if (!trimmed) {
    const base = emptyGuidedParams()
    if (input.knownCity) {
      base.city = input.knownCity
      base.search.city = input.knownCity
    }
    return base
  }

  const categories = await getIndustryCategories()
  const validSlugs = new Set(categories.map((c) => c.slug))
  const categoryList = categories
    .map((c) => `- ${c.slug}: ${getI18nText(c.name, 'ru', c.slug)}`)
    .join('\n')

  const system = `Ты парсер guided-поиска B2B-маркетплейса.
Тема пресета: ${input.presetThemeSlug}.
Переведи свободный текст в JSON для поиска предложений и бронирования.

Доступные slug категорий (используй ТОЛЬКО из этого списка):
${categoryList}

Формат ответа — только JSON без пояснений:
{
  "city": string | null,
  "date_from": string | null,
  "date_to": string | null,
  "people": number | null,
  "notes": string | null,
  "keywords": string | null,
  "categories": string[],
  "tags": string[],
  "country": string | null
}

Правила:
- city — город, если упомянут (Алматы, Astana и т.д.)
- date_from/date_to — даты в формате YYYY-MM-DD; если одна дата — обе одинаковые
- people — число человек/участников, если указано
- notes — прочие пожелания одной строкой
- categories/tags/keywords/country — как в поиске компаний; keywords — только значимые слова, не дублируй city/dates`

  const raw = await callAnthropic({
    system,
    user: trimmed,
    maxTokens: 640,
  })

  try {
    const parsed = extractJsonObject(raw) as Record<string, unknown>
    return mergeParams(
      {
        city: typeof parsed.city === 'string' ? parsed.city : null,
        date_from: typeof parsed.date_from === 'string' ? parsed.date_from : null,
        date_to: typeof parsed.date_to === 'string' ? parsed.date_to : null,
        people: parsePeople(parsed.people),
        notes: typeof parsed.notes === 'string' ? parsed.notes : null,
        search: {
          keywords: typeof parsed.keywords === 'string' ? parsed.keywords : null,
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          country: typeof parsed.country === 'string' ? parsed.country : null,
          city: typeof parsed.city === 'string' ? parsed.city : null,
        },
      },
      validSlugs,
      input.knownCity ?? null
    )
  } catch {
    return mergeParams(
      {
        search: { keywords: trimmed, categories: [], tags: [], country: null, city: null },
      },
      validSlugs,
      input.knownCity ?? null
    )
  }
}

export function mergeGuidedParams(
  base: GuidedSearchParams,
  patch: Partial<GuidedSearchParams>
): GuidedSearchParams {
  return {
    city: patch.city !== undefined ? patch.city : base.city,
    date_from: patch.date_from !== undefined ? patch.date_from : base.date_from,
    date_to: patch.date_to !== undefined ? patch.date_to : base.date_to,
    people: patch.people !== undefined ? patch.people : base.people,
    notes: patch.notes !== undefined ? patch.notes : base.notes,
    search: patch.search ? { ...base.search, ...patch.search } : base.search,
  }
}

export function getMissingRequiredParams(
  required: string[],
  params: GuidedSearchParams
): string[] {
  const missing: string[] = []
  for (const key of required) {
    if (key === 'city' && !params.city) missing.push(key)
    if (key === 'dates' && !params.date_from) missing.push(key)
    if (key === 'people' && !params.people) missing.push(key)
  }
  return missing
}
