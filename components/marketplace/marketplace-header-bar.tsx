'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CityGuideIcon } from '@/components/icons'
import { TenantSelector } from '@/components/organizer/tenant-selector'
import { useMarketplaceLocale } from '@/components/marketplace/marketplace-locale-context'
import {
  MARKETPLACE_LOCALE_LABELS,
  type MarketplaceLocale,
} from '@/lib/marketplace/locales'
import {
  getMarketplaceDisplayName,
  parseMarketplaceSettings,
} from '@/lib/marketplace/marketplace-settings'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type { OrganizerTenant } from '@/types/hub-event'

type MarketplaceHeaderBarProps = {
  marketplace: HubMarketplace
  tenants: OrganizerTenant[]
  activeTenantId: string | null
}

export function MarketplaceHeaderBar({
  marketplace,
  tenants,
  activeTenantId,
}: MarketplaceHeaderBarProps) {
  const { locale, locales, setLocale } = useMarketplaceLocale()
  const settings = parseMarketplaceSettings(marketplace.settings)
  const title = getMarketplaceDisplayName(
    settings,
    marketplace.name,
    locale,
    marketplace.slug
  )

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
      <Link
        href={`/m/${marketplace.slug}`}
        className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--brand)] transition-opacity hover:opacity-80"
      >
        {settings.logo_url ? (
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
            <Image
              src={settings.logo_url}
              alt=""
              fill
              className="object-contain p-0.5"
              unoptimized
            />
          </span>
        ) : (
          <CityGuideIcon size={20} className="shrink-0 text-[var(--accent)]" />
        )}
        <span className="truncate font-heading">{title}</span>
      </Link>

      <div className="flex shrink-0 items-center gap-3">
        <Select
          value={locale}
          onValueChange={(value) => value && setLocale(value as MarketplaceLocale)}
        >
          <SelectTrigger className="h-8 w-[7.5rem] border-[var(--border)] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((code) => (
              <SelectItem key={code} value={code}>
                {MARKETPLACE_LOCALE_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeTenantId ? (
          <TenantSelector
            tenants={tenants}
            activeTenantId={activeTenantId}
            variant="inline"
            label="Действую как:"
          />
        ) : null}
      </div>
    </header>
  )
}
