import { createAdminClient } from '@/lib/supabase/admin'
import {
  resolvePartnerTier,
  type MarketPartnerTier,
} from '@/lib/marketplace/discount-tiers'

/**
 * Resolve TourHub buyer tier for a seller listing:
 * gold (seller link) > silver (platform member) > public.
 */
export async function resolveMarketplacePartnerTier(opts: {
  marketplaceSlug: string
  sellerTenantId: string
  buyerTenantId: string | null | undefined
}): Promise<MarketPartnerTier> {
  if (!opts.buyerTenantId) return 'public'

  const supabase = createAdminClient()
  const { data: market } = await supabase
    .schema('hub')
    .from('marketplaces')
    .select('id')
    .eq('slug', opts.marketplaceSlug)
    .maybeSingle()

  if (!market) return 'public'

  const [{ data: gold }, { data: member }] = await Promise.all([
    supabase
      .schema('hub')
      .from('marketplace_partner_links')
      .select('id')
      .eq('marketplace_id', market.id)
      .eq('seller_tenant_id', opts.sellerTenantId)
      .eq('buyer_tenant_id', opts.buyerTenantId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .schema('hub')
      .from('marketplace_members')
      .select('partner_tier, status')
      .eq('marketplace_id', market.id)
      .eq('tenant_id', opts.buyerTenantId)
      .maybeSingle(),
  ])

  const memberTier =
    member?.status === 'approved' && member.partner_tier === 'silver'
      ? ('silver' as const)
      : null

  return resolvePartnerTier({
    hasGoldLink: Boolean(gold),
    memberTier,
  })
}
