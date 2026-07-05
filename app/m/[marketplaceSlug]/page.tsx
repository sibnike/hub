import { notFound, redirect } from 'next/navigation'
import { MarketplaceApprovedHub } from '@/components/marketplace/marketplace-approved-hub'
import { MarketplaceMembershipGate } from '@/components/marketplace/marketplace-membership-gate'
import { TenantSelector } from '@/components/organizer/tenant-selector'
import { HubHeader } from '@/components/hub/hub-header'
import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { assertMarketplaceAccess } from '@/lib/marketplace/membership'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ marketplaceSlug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { marketplaceSlug } = await params
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)

  if (!marketplace) {
    return { title: 'Маркетплейс не найден' }
  }

  const title = getI18nText(marketplace.name, 'ru', marketplace.slug)

  return {
    title: `${title} — Yanbada`,
    description: getI18nText(marketplace.description, 'ru'),
  }
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
      <>
        <HubHeader />
        {tenants.length > 1 ? (
          <TenantSelector tenants={tenants} activeTenantId={activeTenant.id} />
        ) : null}
        <main className="min-h-screen bg-background text-foreground">
          <MarketplaceApprovedHub marketplace={marketplace} tenant={activeTenant} />
        </main>
      </>
    )
  }

  if (access.gate === 'marketplace_not_found') {
    notFound()
  }

  return (
    <>
      <HubHeader />
      {tenants.length > 1 ? (
        <TenantSelector tenants={tenants} activeTenantId={activeTenant.id} />
      ) : null}
      <main className="min-h-screen bg-background text-foreground">
        <MarketplaceMembershipGate
          marketplace={marketplace}
          tenant={activeTenant}
          membership={access.membership}
        />
      </main>
    </>
  )
}
