import Link from 'next/link'
import { CityGuideIcon } from '@/components/icons'
import { TenantSelector } from '@/components/organizer/tenant-selector'
import {
  getAccessibleTenants,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

type MarketplaceHeaderProps = {
  marketplaceSlug: string
}

export async function MarketplaceHeader({ marketplaceSlug }: MarketplaceHeaderProps) {
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)
  const title = marketplace
    ? getI18nText(marketplace.name, 'ru', marketplace.slug)
    : marketplaceSlug

  const tenants = await getAccessibleTenants()
  const activeTenantId =
    tenants.length > 0 ? ((await resolveActiveTenantId()) ?? tenants[0].id) : null

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <Link
        href={`/m/${marketplaceSlug}`}
        className="flex items-center gap-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-80"
      >
        <CityGuideIcon size={20} className="shrink-0 text-primary" />
        <span className="truncate">{title}</span>
      </Link>
      {activeTenantId ? (
        <TenantSelector
          tenants={tenants}
          activeTenantId={activeTenantId}
          variant="inline"
          label="Действую как:"
        />
      ) : null}
    </header>
  )
}
