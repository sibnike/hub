import { callAnthropic } from '@/lib/ai/call-anthropic'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getI18nText } from '@/lib/i18n/get-text'
import { extractJsonObject } from '@/lib/marketplace/marketplace-ai-json'
import {
  emptySearchFilter,
  normalizeSearchFilter,
} from '@/lib/marketplace/normalize-search-filter'
import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

export async function parseMarketplaceQuery(
  query: string
): Promise<MarketplaceSearchFilter> {
  const trimmed = query.trim()
  if (!trimmed) return emptySearchFilter()

  const categories = await getIndustryCategories()
  const validSlugs = new Set(categories.map((c) => c.slug))
  const categoryList = categories
    .map((c) => `- ${c.slug}: ${getI18nText(c.name, 'ru', c.slug)}`)
    .join('\n')

  const system = `Ты парсер поисковых запросов маркетплейса B2B-услуг.
Переведи свободный текст пользователя в JSON-фильтр для SQL-поиска по компаниям.
НЕ повторяй исходный текст целиком в keywords — выдели только значимые поисковые слова,
которые не покрыты категориями, тегами, страной или городом.

Доступные slug категорий (используй ТОЛЬКО из этого списка):
${categoryList}

Формат ответа — только JSON без пояснений:
{
  "keywords": string | null,
  "categories": string[],
  "tags": string[],
  "country": string | null,
  "city": string | null
}

Правила:
- categories — slug из списка выше, если запрос про отрасль (туризм → tourism, IT → it)
- city/country — если явно упомянуты (Алматы, Казахстан)
- tags — конкретные услуги/ниши, не дублируй categories
- keywords — оставшиеся смысловые слова (например «горы», «гид»), null если всё покрыто полями`

  const raw = await callAnthropic({
    system,
    user: trimmed,
    maxTokens: 512,
  })

  try {
    const parsed = extractJsonObject(raw) as Partial<MarketplaceSearchFilter>
    return normalizeSearchFilter(parsed, validSlugs)
  } catch {
    return normalizeSearchFilter({ keywords: trimmed }, validSlugs)
  }
}
