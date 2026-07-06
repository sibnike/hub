'use client'

import { useMarketplaceLocale } from '@/components/marketplace/marketplace-locale-context'
import { getI18nText } from '@/lib/i18n/get-text'
import { isMarketplaceHeroImage } from '@/lib/marketplace/marketplace-theme'
import { parseMarketplaceSettings } from '@/lib/marketplace/marketplace-settings'
import { cn } from '@/lib/utils'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type { OrganizerTenant } from '@/types/hub-event'

type MarketplaceHeroProps = {
  marketplace: HubMarketplace
  tenant: OrganizerTenant
}

export function MarketplaceHero({ marketplace, tenant }: MarketplaceHeroProps) {
  const { locale } = useMarketplaceLocale()
  const settings = parseMarketplaceSettings(marketplace.settings)
  const heroImage = isMarketplaceHeroImage(marketplace.settings)

  const title =
    getI18nText(settings.hero_title, locale) ||
    getI18nText(marketplace.name, locale, marketplace.slug)

  const subtitle =
    getI18nText(settings.hero_subtitle, locale) ||
    getI18nText(marketplace.description, locale)

  return (
    <section
      className={cn(
        'relative -mx-4 mb-8 overflow-hidden px-4 py-10 md:-mx-6 md:px-6 md:py-14',
        heroImage && 'text-white'
      )}
      style={{
        background: 'var(--hero-bg)',
        backgroundSize: heroImage ? 'cover' : undefined,
        backgroundPosition: heroImage ? 'center' : undefined,
      }}
    >
      {heroImage ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[var(--brand)]/55"
          aria-hidden
        />
      ) : null}

      <div className="relative mx-auto max-w-4xl">
        <h1
          className={cn(
            'font-heading text-3xl font-semibold tracking-tight md:text-4xl',
            heroImage ? 'text-white' : 'text-[var(--brand)]'
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              'mt-3 max-w-2xl text-sm leading-relaxed md:text-base',
              heroImage ? 'text-white/85' : 'text-[var(--muted)]'
            )}
          >
            {subtitle}
          </p>
        ) : null}
        <p
          className={cn(
            'mt-4 text-sm',
            heroImage ? 'text-white/75' : 'text-[var(--muted)]'
          )}
        >
          Тенант:{' '}
          <span className={heroImage ? 'text-white' : 'text-[var(--text)]'}>
            {tenant.name}
          </span>
        </p>
      </div>
    </section>
  )
}
