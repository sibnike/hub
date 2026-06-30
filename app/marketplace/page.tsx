import { MarketplaceSearchClient } from '@/components/marketplace/marketplace-search-client'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Поиск компаний — Yanbada Marketplace',
  description: 'AI-поиск исполнителей и компаний на платформе Yanbada',
}

export default async function MarketplacePage() {
  const categories = await getIndustryCategories()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketplaceSearchClient categories={categories} />
    </main>
  )
}
