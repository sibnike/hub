import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import type {
  MarketplaceMemberRow,
  MarketplaceMemberStatus,
} from '@/types/marketplace-membership'

export type MarketplaceAccessResult =
  | { allowed: true; membership: MarketplaceMemberRow; marketplaceId: string }
  | {
      allowed: false
      gate: 'no_membership' | 'pending' | 'rejected' | 'suspended'
      membership: MarketplaceMemberRow | null
      marketplaceId: string
    }
  | { allowed: false; gate: 'marketplace_not_found' }

export async function getMembership(
  marketplaceId: string,
  tenantId: string
): Promise<MarketplaceMemberRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('marketplace_members')
    .select('*')
    .eq('marketplace_id', marketplaceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('[getMembership]', marketplaceId, tenantId, error.message)
    return null
  }

  return data as MarketplaceMemberRow | null
}

export async function assertMarketplaceAccess(
  marketplaceSlug: string,
  tenantId: string
): Promise<MarketplaceAccessResult> {
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)
  if (!marketplace) {
    return { allowed: false, gate: 'marketplace_not_found' }
  }

  const membership = await getMembership(marketplace.id, tenantId)

  if (!membership) {
    return {
      allowed: false,
      gate: 'no_membership',
      membership: null,
      marketplaceId: marketplace.id,
    }
  }

  if (membership.status === 'approved') {
    return { allowed: true, membership, marketplaceId: marketplace.id }
  }

  const gate = membership.status as Exclude<
    MarketplaceMemberStatus,
    'approved'
  >

  return {
    allowed: false,
    gate,
    membership,
    marketplaceId: marketplace.id,
  }
}

export async function resolveMarketplaceIdBySlug(
  slug: string
): Promise<string | null> {
  const marketplace = await getActiveMarketplaceBySlug(slug)
  return marketplace?.id ?? null
}
