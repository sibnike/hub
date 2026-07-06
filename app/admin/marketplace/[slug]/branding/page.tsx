import { notFound } from 'next/navigation'
import { MarketplaceBrandingAdmin } from '@/components/marketplace/marketplace-branding-admin'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function MarketplaceBrandingAdminPage({ params }: PageProps) {
  const { slug } = await params
  const marketplace = await getActiveMarketplaceBySlug(slug)

  if (!marketplace) {
    notFound()
  }

  return <MarketplaceBrandingAdmin marketplaceSlug={slug} />
}
