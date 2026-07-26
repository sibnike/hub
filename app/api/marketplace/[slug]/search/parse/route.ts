import { NextRequest, NextResponse } from 'next/server'
import { HEAVY_API_MAX_DURATION_SEC } from '@/lib/vercel/heavy-api-duration'
import { getSearchPresetById } from '@/lib/marketplace/get-search-presets'

export const maxDuration = HEAVY_API_MAX_DURATION_SEC
import {
  getMissingRequiredParams,
  mergeGuidedParams,
  parseGuidedSearchQuery,
} from '@/lib/marketplace/parse-guided-search'
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'
import { checkRateLimit } from '@/lib/rate-limit'
import type { GuidedSearchParams } from '@/types/marketplace-guided-search'

type RouteContext = { params: Promise<{ slug: string }> }

type ParseBody = {
  preset_id: string
  query: string
  known_city?: string | null
  params?: Partial<GuidedSearchParams>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-guided-parse:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  try {
    const body = (await request.json()) as ParseBody
    if (!body.preset_id || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'preset_id and query required' }, { status: 400 })
    }

    const preset = await getSearchPresetById(access.marketplace.id, body.preset_id)
    if (!preset || !preset.is_active) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    const parsed = await parseGuidedSearchQuery({
      query: body.query,
      presetThemeSlug: preset.theme_slug,
      knownCity: body.known_city ?? null,
    })

    const params = body.params ? mergeGuidedParams(parsed, body.params) : parsed
    const missing = getMissingRequiredParams(preset.required_params, params)

    return NextResponse.json({
      params,
      parsed_by_ai: true,
      missing_params: missing,
      preset: {
        id: preset.id,
        theme_slug: preset.theme_slug,
        required_params: preset.required_params,
        clarify_hints: preset.clarify_hints,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Parse failed'
    console.error('[marketplace/search/parse]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
