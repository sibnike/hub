import { notFound } from 'next/navigation'
import { PresetsAdminClient } from '@/components/marketplace/marketplace-presets-admin'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function MarketplacePresetsAdminPage({ params }: PageProps) {
  const { slug } = await params
  const marketplace = await getActiveMarketplaceBySlug(slug)

  if (!marketplace) {
    notFound()
  }

  const marketplaceName = getI18nText(marketplace.name, 'ru', marketplace.slug)

  return (
    <PresetsAdminClient
      marketplaceSlug={slug}
      marketplaceName={marketplaceName}
      themeSlugs={marketplace.theme_slugs}
    />
  )
}
