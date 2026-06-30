import { NextRequest, NextResponse } from 'next/server'
import { parseMarketplaceQuery } from '@/lib/marketplace/parse-marketplace-query'
import {
  isFilterEmpty,
  normalizeSearchFilter,
} from '@/lib/marketplace/normalize-search-filter'
import { searchCompanyCache } from '@/lib/marketplace/search-company-cache'
import { checkRateLimit } from '@/lib/rate-limit'
import type { MarketplaceSearchFilter } from '@/types/marketplace-search'

type SearchBody = {
  query?: string
  filter?: Partial<MarketplaceSearchFilter>
  limit?: number
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-search:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  try {
    const body = (await request.json()) as SearchBody
    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? Math.min(body.limit, 50)
        : 20

    let filter: MarketplaceSearchFilter
    let parsedByAi = false

    if (body.filter && typeof body.filter === 'object') {
      filter = normalizeSearchFilter(body.filter)
    } else if (typeof body.query === 'string' && body.query.trim()) {
      filter = await parseMarketplaceQuery(body.query)
      parsedByAi = true
    } else {
      return NextResponse.json(
        { error: 'Укажите query или filter' },
        { status: 400 }
      )
    }

    if (isFilterEmpty(filter)) {
      return NextResponse.json({
        filter,
        parsed_by_ai: parsedByAi,
        results: [],
      })
    }

    const results = await searchCompanyCache(filter, limit)

    return NextResponse.json({
      filter,
      parsed_by_ai: parsedByAi,
      results,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Search failed'
    console.error('[marketplace/search]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
