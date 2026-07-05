import { notFound } from 'next/navigation'
import { MembersAdminClient } from '@/components/marketplace/marketplace-members-admin'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function MarketplaceMembersAdminPage({ params }: PageProps) {
  const { slug } = await params
  const marketplace = await getActiveMarketplaceBySlug(slug)

  if (!marketplace) {
    notFound()
  }

  const marketplaceName = getI18nText(marketplace.name, 'ru', marketplace.slug)

  return (
    <MembersAdminClient marketplaceSlug={slug} marketplaceName={marketplaceName} />
  )
}
