import Link from 'next/link'
import { CityGuideIcon } from '@/components/icons/CityGuideIcon'
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'
import { getI18nText } from '@/lib/i18n/get-text'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type { OrganizerTenant } from '@/types/hub-event'

type MarketplaceApprovedHubProps = {
  marketplace: HubMarketplace
  tenant: OrganizerTenant
}

export function MarketplaceApprovedHub({ marketplace, tenant }: MarketplaceApprovedHubProps) {
  const title = getI18nText(marketplace.name, 'ru', marketplace.slug)
  const description = getI18nText(marketplace.description, 'ru')

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <Link
        href="/marketplace"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon size={16} />
        Yanbada Marketplace
      </Link>

      <header className="mb-10">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <CityGuideIcon size={24} />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-[var(--muted)]">
          Тенант: <span className="text-foreground">{tenant.name}</span>
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-foreground">Поиск скоро</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Доступ к маркетплейсу открыт. Раздел guided-поиска и выдачи появится в следующем
          обновлении. Пока можно пользоваться общим поиском на{' '}
          <Link
            href="/marketplace"
            className="text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Yanbada Marketplace
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
