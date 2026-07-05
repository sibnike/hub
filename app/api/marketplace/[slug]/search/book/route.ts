import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchMarketplaceBookings } from '@/lib/marketplace/dispatch-marketplace-bookings'
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'
import { checkRateLimit } from '@/lib/rate-limit'
import type { CartItemInput, GuidedSearchParams } from '@/types/marketplace-guided-search'

type RouteContext = { params: Promise<{ slug: string }> }

type BookBody = {
  params: GuidedSearchParams
  items: CartItemInput[]
  requester_name?: string
  requester_contact?: string
}

export async function POST(request: NextRequest, context: RouteContext) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-guided-book:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  try {
    const body = (await request.json()) as BookBody
    if (!body.params || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'params and items required' }, { status: 400 })
    }

    if (body.items.length > 10) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 })
    }

    for (const item of body.items) {
      if (!item.listing_id || !item.tenant_slug || !item.page_slug || !item.title) {
        return NextResponse.json({ error: 'Invalid cart item' }, { status: 400 })
      }
    }

    const supabase = createAdminClient()
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', access.tenantId)
      .maybeSingle()

    const requesterName = body.requester_name?.trim() || tenant?.name || 'Marketplace tenant'
    const requesterContact = body.requester_contact?.trim() || 'marketplace@yanbada.com'

    const { results, booked_count } = await dispatchMarketplaceBookings({
      marketplaceSlug: slug,
      requesterTenantId: access.tenantId,
      requesterName,
      requesterContact,
      params: body.params,
      items: body.items,
    })

    return NextResponse.json({ results, booked_count })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Booking failed'
    console.error('[marketplace/search/book]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
