'use client'

import Link from 'next/link'
import { MarketplaceRequestForm } from '@/components/marketplace/marketplace-request-form'
import { MarketplaceSearchPanel } from '@/components/marketplace/marketplace-search-client'
import { CityGuideIcon } from '@/components/icons/CityGuideIcon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { IndustryCategory } from '@/types/catalog'

type MarketplacePageClientProps = {
  categories: IndustryCategory[]
}

export function MarketplacePageClient({ categories }: MarketplacePageClientProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Yanbada Marketplace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Найдите исполнителя или отправьте запрос — мы подберём подходящих партнёров на платформе.
        </p>
        <Link
          href="/m/tourism"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-foreground"
        >
          <CityGuideIcon size={16} className="text-[var(--accent)]" />
          Туристический маркетплейс B2B
        </Link>
      </header>

      <Tabs defaultValue="search" className="gap-6">
        <TabsList>
          <TabsTrigger value="search">Поиск</TabsTrigger>
          <TabsTrigger value="request">Отправить запрос</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <MarketplaceSearchPanel categories={categories} />
        </TabsContent>

        <TabsContent value="request">
          <div className="max-w-xl">
            <MarketplaceRequestForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
