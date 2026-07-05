import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMarketplaceRequestV2 } from '@/lib/marketplace/create-marketplace-request-v2'
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'
import { checkRateLimit } from '@/lib/rate-limit'
import type {
  GuidedSearchParams,
  MarketplaceListingOffer,
} from '@/types/marketplace-guided-search'
import type { MarketplaceRequestTargetCandidate } from '@/types/marketplace-request'

type RouteContext = { params: Promise<{ slug: string }> }

type RequestBody = {
  params: GuidedSearchParams
  request_text?: string
  budget_amount?: number
  budget_currency?: string
  offers?: Array<Pick<
    MarketplaceListingOffer,
    'id' | 'tenant_id' | 'tenant_slug' | 'page_slug' | 'title'
  >>
  target_limit?: number
  requester_name?: string
  requester_contact?: string
}

function buildTargetsFromOffers(
  offers: RequestBody['offers'],
  limit: number
): MarketplaceRequestTargetCandidate[] {
  if (!offers?.length) return []

  const seen = new Set<string>()
  const targets: MarketplaceRequestTargetCandidate[] = []

  for (const offer of offers) {
    if (!offer.tenant_id || !offer.tenant_slug || seen.has(offer.tenant_id)) continue
    seen.add(offer.tenant_id)
    targets.push({
      tenant_id: offer.tenant_id,
      tenant_slug: offer.tenant_slug,
      listing_id: offer.id,
      page_slug: offer.page_slug,
      title:
        typeof offer.title === 'object'
          ? offer.title.ru ?? offer.page_slug
          : offer.page_slug,
    })
    if (targets.length >= limit) break
  }

  return targets
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-guided-request:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  try {
    const body = (await request.json()) as RequestBody

    if (!body.params) {
      return NextResponse.json({ error: 'params required' }, { status: 400 })
    }

    const budgetAmount = Number(body.budget_amount)
    if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
      return NextResponse.json({ error: 'budget_amount must be positive' }, { status: 400 })
    }

    const requestText = body.request_text?.trim() || body.params.notes?.trim()
    if (!requestText) {
      return NextResponse.json({ error: 'request_text required' }, { status: 400 })
    }

    const limit =
      typeof body.target_limit === 'number' && body.target_limit > 0
        ? Math.min(body.target_limit, 20)
        : 10

    const targets = buildTargetsFromOffers(body.offers, limit)
    if (!targets.length) {
      return NextResponse.json({ error: 'No targets from offers' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', access.tenantId)
      .maybeSingle()

    const result = await createMarketplaceRequestV2({
      marketplace_id: access.marketplace.id,
      marketplace_slug: slug,
      requester_tenant_id: access.tenantId,
      requester_name: body.requester_name?.trim() || tenant?.name || 'Marketplace tenant',
      requester_contact: body.requester_contact?.trim() || 'marketplace@yanbada.com',
      request_text: requestText,
      budget_amount: budgetAmount,
      budget_currency: body.budget_currency?.trim() || 'KZT',
      params: body.params,
      targets,
    })

    return NextResponse.json({
      request_id: result.request.id,
      dispatched_count: result.dispatched_count,
      target_count: result.targets.length,
      dispatch_results: result.dispatch_results,
      message:
        result.dispatched_count > 0
          ? `Запрос отправлен ${result.dispatched_count} исполнител${result.dispatched_count === 1 ? 'ю' : 'ям'}`
          : 'Исполнители найдены, но доставка не удалась',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Request failed'
    console.error('[marketplace/search/request]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
