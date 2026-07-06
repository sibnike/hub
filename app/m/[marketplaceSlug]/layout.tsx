import { MarketplaceHeader } from '@/components/marketplace/marketplace-header'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ marketplaceSlug: string }>
}

export default async function MarketplaceSlugLayout({ children, params }: LayoutProps) {
  const { marketplaceSlug } = await params

  return (
    <>
      <MarketplaceHeader marketplaceSlug={marketplaceSlug} />
      {children}
    </>
  )
}
