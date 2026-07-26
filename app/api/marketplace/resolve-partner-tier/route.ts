import { NextRequest, NextResponse } from 'next/server'
import { resolveMarketplacePartnerTier } from '@/lib/marketplace/resolve-partner-tier'
import {
  applyDiscountPct,
  discountPctForTier,
  parseMarketDiscountTiers,
} from '@/lib/marketplace/discount-tiers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve buyer discount tier for a TourHub listing.
 * Body: { marketplace?, seller_tenant_id, buyer_tenant_id?, listing_id? | page_slug? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      marketplace?: string
      seller_tenant_id?: string
      buyer_tenant_id?: string | null
      listing_id?: string
      page_slug?: string
    }

    const marketplace = body.marketplace || 'tourhub'
    if (!body.seller_tenant_id) {
      return NextResponse.json({ error: 'seller_tenant_id required' }, { status: 400 })
    }

    const tier = await resolveMarketplacePartnerTier({
      marketplaceSlug: marketplace,
      sellerTenantId: body.seller_tenant_id,
      buyerTenantId: body.buyer_tenant_id,
    })

    let listPrice: number | null = null
    let tiers = parseMarketDiscountTiers(null)

    if (body.listing_id || (body.page_slug && body.seller_tenant_id)) {
      const supabase = createAdminClient()
      let q = supabase
        .schema('hub')
        .from('listing_cache')
        .select('price_from, market_discount_tiers, tenant_id, page_slug')
        .eq('tenant_id', body.seller_tenant_id)
        .limit(1)

      if (body.listing_id) {
        q = supabase
          .schema('hub')
          .from('listing_cache')
          .select('price_from, market_discount_tiers, tenant_id, page_slug')
          .eq('id', body.listing_id)
          .limit(1)
      } else if (body.page_slug) {
        q = q.eq('page_slug', body.page_slug)
      }

      const { data: row } = await q.maybeSingle()
      if (row) {
        listPrice = typeof row.price_from === 'number' ? row.price_from : null
        tiers = parseMarketDiscountTiers(row.market_discount_tiers)
      }
    }

    const discountPct = discountPctForTier(tiers, tier)
    const unitPrice =
      listPrice != null ? applyDiscountPct(listPrice, discountPct) : null

    return NextResponse.json({
      tier,
      discount_pct: discountPct,
      discount_tiers: tiers,
      list_price: listPrice,
      unit_price: unitPrice,
      /** Always the lowest (public) — for market cards. */
      public_discount_pct: tiers.public,
    })
  } catch (e) {
    console.error('[resolve-partner-tier]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'resolve failed' },
      { status: 500 }
    )
  }
}
