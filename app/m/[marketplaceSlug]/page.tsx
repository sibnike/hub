import { notFound, redirect } from 'next/navigation'
import { MarketplaceApprovedHub } from '@/components/marketplace/marketplace-approved-hub'
import { MarketplaceMembershipGate } from '@/components/marketplace/marketplace-membership-gate'
import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { assertMarketplaceAccess } from '@/lib/marketplace/membership'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ marketplaceSlug: string }>
}

export default async function MarketplaceHubPage({ params }: PageProps) {
  const { marketplaceSlug } = await params
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)

  if (!marketplace) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `${process.env.NEXT_PUBLIC_VITRINA_ADMIN}/login?redirect=${encodeURIComponent(
        `${process.env.NEXT_PUBLIC_HUB_DOMAIN ? `https://${process.env.NEXT_PUBLIC_HUB_DOMAIN}` : ''}/m/${marketplaceSlug}`
      )}`
    )
  }

  const tenants = await getAccessibleTenants()
  if (tenants.length === 0) {
    redirect('/marketplace')
  }

  const activeTenantId = (await resolveActiveTenantId()) ?? tenants[0].id
  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0]

  const access = await assertMarketplaceAccess(marketplaceSlug, activeTenant.id)

  if (access.allowed) {
    return (
      <main>
        <MarketplaceApprovedHub marketplace={marketplace} tenant={activeTenant} />
      </main>
    )
  }

  if (access.gate === 'marketplace_not_found') {
    notFound()
  }

  return (
    <main>
      <MarketplaceMembershipGate
        marketplace={marketplace}
        tenant={activeTenant}
        membership={access.membership}
      />
    </main>
  )
}
