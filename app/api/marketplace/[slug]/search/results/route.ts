import { NextRequest, NextResponse } from 'next/server'
import { HEAVY_API_MAX_DURATION_SEC } from '@/lib/vercel/heavy-api-duration'
import { getSearchPresetById } from '@/lib/marketplace/get-search-presets'

export const maxDuration = HEAVY_API_MAX_DURATION_SEC
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'
import {
  filterListingOffersByAvailability,
  searchMarketplaceListings,
  sortListingOffers,
} from '@/lib/marketplace/search-marketplace-listings'
import { checkRateLimit } from '@/lib/rate-limit'
import type { GuidedSearchParams } from '@/types/marketplace-guided-search'

type RouteContext = { params: Promise<{ slug: string }> }

type ResultsBody = {
  preset_id: string
  params: GuidedSearchParams
  sort?: 'price_asc' | 'price_desc' | 'availability'
  availability_filter?: 'all' | 'available' | 'unavailable'
  limit?: number
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-guided-results:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  try {
    const body = (await request.json()) as ResultsBody
    if (!body.preset_id || !body.params) {
      return NextResponse.json({ error: 'preset_id and params required' }, { status: 400 })
    }

    const preset = await getSearchPresetById(access.marketplace.id, body.preset_id)
    if (!preset || !preset.is_active) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? Math.min(body.limit, 50)
        : 30

    let results = await searchMarketplaceListings({
      marketplaceThemeSlugs: access.marketplace.theme_slugs,
      presetThemeSlug: preset.theme_slug,
      params: body.params,
      limit,
      checkAvailability: Boolean(body.params.date_from),
    })

    const availabilityFilter = body.availability_filter ?? 'all'
    results = filterListingOffersByAvailability(results, availabilityFilter)

    const sort = body.sort ?? 'availability'
    results = sortListingOffers(results, sort)

    return NextResponse.json({ results, params: body.params })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Search failed'
    console.error('[marketplace/search/results]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
