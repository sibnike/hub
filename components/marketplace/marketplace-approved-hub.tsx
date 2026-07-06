import { MarketplaceGuidedSearch } from '@/components/marketplace/marketplace-guided-search'
import { MarketplaceHero } from '@/components/marketplace/marketplace-hero'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type { OrganizerTenant } from '@/types/hub-event'

type MarketplaceApprovedHubProps = {
  marketplace: HubMarketplace
  tenant: OrganizerTenant
}

export function MarketplaceApprovedHub({ marketplace, tenant }: MarketplaceApprovedHubProps) {
  return (
    <>
      <MarketplaceHero marketplace={marketplace} tenant={tenant} />
      <MarketplaceGuidedSearch marketplace={marketplace} />
    </>
  )
}
