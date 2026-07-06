import type { Metadata } from 'next'
import { MarketplaceHeader } from '@/components/marketplace/marketplace-header'
import { MarketplaceThemeShell } from '@/components/marketplace/marketplace-theme-shell'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { parseMarketplaceSettings } from '@/lib/marketplace/marketplace-settings'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ marketplaceSlug: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { marketplaceSlug } = await params
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)

  if (!marketplace) {
    return { title: 'Маркетплейс не найден' }
  }

  const settings = parseMarketplaceSettings(marketplace.settings)
  const title =
    getI18nText(settings.display_name, 'ru') ||
    getI18nText(marketplace.name, 'ru', marketplace.slug)

  return {
    title: `${title} — Yanbada`,
    description: getI18nText(marketplace.description, 'ru'),
    ...(settings.favicon_url
      ? {
          icons: {
            icon: settings.favicon_url,
            shortcut: settings.favicon_url,
          },
        }
      : {}),
  }
}

export default async function MarketplaceSlugLayout({ children, params }: LayoutProps) {
  const { marketplaceSlug } = await params
  const marketplace = await getActiveMarketplaceBySlug(marketplaceSlug)
  const settings = marketplace?.settings ?? {}

  return (
    <MarketplaceThemeShell settings={settings}>
      <MarketplaceHeader marketplaceSlug={marketplaceSlug} />
      {children}
    </MarketplaceThemeShell>
  )
}
