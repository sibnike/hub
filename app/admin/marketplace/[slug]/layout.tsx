import { notFound } from 'next/navigation'
import { MarketplaceAdminNav } from '@/components/marketplace/marketplace-admin-nav'
import { getI18nText } from '@/lib/i18n/get-text'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function AdminMarketplaceSlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params
  const marketplace = await getActiveMarketplaceBySlug(slug)

  if (!marketplace) {
    notFound()
  }

  const marketplaceName = getI18nText(marketplace.name, 'ru', marketplace.slug)

  return (
    <div className="mx-auto max-w-5xl">
      <MarketplaceAdminNav slug={slug} marketplaceName={marketplaceName} />
      {children}
    </div>
  )
}
