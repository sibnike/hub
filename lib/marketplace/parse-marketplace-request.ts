import { callAnthropic } from '@/lib/ai/call-anthropic'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getI18nText } from '@/lib/i18n/get-text'
import { extractJsonObject } from '@/lib/marketplace/marketplace-ai-json'
import {
  emptyRequestParsed,
  normalizeRequestParsed,
} from '@/lib/marketplace/normalize-request-parsed'
import type { MarketplaceRequestParsed } from '@/types/marketplace-request'

export async function parseMarketplaceRequest(
  requestText: string
): Promise<MarketplaceRequestParsed> {
  const trimmed = requestText.trim()
  if (!trimmed) return emptyRequestParsed()

  const categories = await getIndustryCategories()
  const validSlugs = new Set(categories.map((c) => c.slug))
  const categoryList = categories
    .map((c) => `- ${c.slug}: ${getI18nText(c.name, 'ru', c.slug)}`)
    .join('\n')

  const system = `Ты парсер запросов маркетплейса B2B-услуг (заявитель описывает, что ему нужно).
Переведи свободный текст в JSON для поиска исполнителей и маршрутизации запроса.
Переиспользуй те же правила категорий/города/ключевых слов, что и в поиске компаний.

Доступные slug категорий (используй ТОЛЬКО из этого списка):
${categoryList}

Формат ответа — только JSON без пояснений:
{
  "keywords": string | null,
  "categories": string[],
  "tags": string[],
  "country": string | null,
  "city": string | null,
  "requested_date": string | null,
  "quantity": string | null,
  "requester_proposed_price": number | null
}

Правила:
- categories — slug из списка выше, если запрос про отрасль
- city/country — если явно упомянуты
- tags — конкретные услуги/ниши
- keywords — оставшиеся смысловые слова (например «горные лыжи», «гид»), null если всё покрыто полями
- requested_date — дата в формате YYYY-MM-DD, если в тексте явно указана дата/день («12 марта», «на завтра» → ближайшая календарная дата относительно сегодня), иначе null
- quantity — количество/объём в свободной форме («две пары», «3 человека»), иначе null
- requester_proposed_price — сумма, на которую согласен заявитель (число, без валюты), если указана, иначе null`

  const raw = await callAnthropic({
    system,
    user: trimmed,
    maxTokens: 640,
  })

  try {
    const parsed = extractJsonObject(raw) as Partial<MarketplaceRequestParsed> & Record<string, unknown>
    return normalizeRequestParsed(
      {
        search: {
          keywords: typeof parsed.keywords === 'string' ? parsed.keywords : null,
          categories: Array.isArray(parsed.categories) ? parsed.categories : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          country: typeof parsed.country === 'string' ? parsed.country : null,
          city: typeof parsed.city === 'string' ? parsed.city : null,
        },
        requested_date:
          typeof parsed.requested_date === 'string' ? parsed.requested_date : null,
        quantity: typeof parsed.quantity === 'string' ? parsed.quantity : null,
        requester_proposed_price:
          typeof parsed.requester_proposed_price === 'number'
            ? parsed.requester_proposed_price
            : null,
      },
      validSlugs,
      trimmed
    )
  } catch {
    return normalizeRequestParsed(
      { search: { ...emptyRequestParsed().search, keywords: trimmed } },
      validSlugs,
      trimmed
    )
  }
}
