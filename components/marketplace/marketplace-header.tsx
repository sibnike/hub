import { MarketplaceHeaderBar } from '@/components/marketplace/marketplace-header-bar'
import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

type MarketplaceHeaderProps = {
  marketplaceSlug: string
}

export async function MarketplaceHeader({ marketplaceSlug }: MarketplaceHeaderProps) {
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)

  if (!marketplace) {
    return (
      <header className="border-b border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
        {marketplaceSlug}
      </header>
    )
  }

  const tenants = await getAccessibleTenants()
  const activeTenantId =
    tenants.length > 0 ? ((await resolveActiveTenantId()) ?? tenants[0].id) : null

  return (
    <MarketplaceHeaderBar
      marketplace={marketplace}
      tenants={tenants}
      activeTenantId={activeTenantId}
    />
  )
}
