'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuildingIcon, SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/design/empty-state'
import { Input } from '@/components/ui/input'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { IndustryCategory } from '@/types/catalog'
import type {
  MarketplaceListingResult,
  MarketplaceSearchFilter,
  MarketplaceSearchResult,
  MarketplaceTenantResult,
} from '@/types/marketplace-search'

type MarketplaceSearchClientProps = {
  categories: IndustryCategory[]
}

const vitrinaBase =
  process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ??
  'https://vitrina.yanbada.com'

function buildTenantUrl(result: MarketplaceTenantResult): string | null {
  if (result.vitrina_page_slug) {
    const tenantQuery = result.tenant_slug ? `?tenant=${result.tenant_slug}` : ''
    return `${vitrinaBase}/p/${result.vitrina_page_slug}${tenantQuery}`
  }
  if (result.tenant_slug) {
    return `${vitrinaBase}/h/${result.tenant_slug}`
  }
  return null
}

function buildListingUrl(result: MarketplaceListingResult): string | null {
  if (!result.tenant_slug) return null
  return `${vitrinaBase}/p/${result.page_slug}?tenant=${result.tenant_slug}`
}

function mergeResults(
  tenants: MarketplaceTenantResult[],
  listings: MarketplaceListingResult[]
): MarketplaceSearchResult[] {
  return [...tenants, ...listings].sort((a, b) => b.rank - a.rank || 0)
}

function FilterChips({ filter }: { filter: MarketplaceSearchFilter }) {
  const chips: string[] = []
  if (filter.keywords) chips.push(`Слова: ${filter.keywords}`)
  if (filter.categories.length) chips.push(`Категории: ${filter.categories.join(', ')}`)
  if (filter.tags.length) chips.push(`Теги: ${filter.tags.join(', ')}`)
  if (filter.country) chips.push(`Страна: ${filter.country}`)
  if (filter.city) chips.push(`Город: ${filter.city}`)
  if (!chips.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border bg-secondary px-3 py-1 text-xs text-muted-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

function ResultTypeBadge({ type }: { type: MarketplaceSearchResult['result_type'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        type === 'tenant'
          ? 'bg-primary/10 text-primary'
          : 'bg-accent/15 text-accent-foreground'
      )}
    >
      {type === 'tenant' ? 'Компания' : 'Услуга'}
    </span>
  )
}

function TenantCard({
  result,
  categoriesBySlug,
}: {
  result: MarketplaceTenantResult
  categoriesBySlug: Map<string, IndustryCategory>
}) {
  const name = result.name ?? result.tenant_slug ?? 'Компания'
  const description = getI18nText(result.short_description, 'ru')
  const profileUrl = buildTenantUrl(result)
  const categorySlugs = result.categories.slice(0, 3)

  const card = (
    <article className="overflow-hidden rounded-2xl border bg-card transition hover:shadow-md">
      <div className="flex h-28 items-center justify-center bg-muted/50">
        {result.logo_url ? (
          <Image
            src={result.logo_url}
            alt=""
            width={160}
            height={80}
            className="max-h-16 max-w-[60%] object-contain"
            unoptimized
          />
        ) : (
          <span className="text-2xl font-semibold text-muted-foreground">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="mb-2">
          <ResultTypeBadge type="tenant" />
        </div>
        <h2 className="text-lg font-semibold line-clamp-2">{name}</h2>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{description}</p>
        ) : null}
        {(result.city || result.country) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {[result.city, result.country].filter(Boolean).join(', ')}
          </p>
        )}
        {categorySlugs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categorySlugs.map((slug) => (
              <span
                key={slug}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              >
                {getI18nText(categoriesBySlug.get(slug)?.name, 'ru', slug)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )

  if (!profileUrl) return card

  return (
    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  )
}

function ListingCard({
  result,
  categoriesBySlug,
}: {
  result: MarketplaceListingResult
  categoriesBySlug: Map<string, IndustryCategory>
}) {
  const title = getI18nText(result.title, 'ru', result.page_slug)
  const description = getI18nText(result.short_text, 'ru')
  const listingUrl = buildListingUrl(result)
  const categorySlugs = result.categories.slice(0, 3)
  const companyName = result.tenant_name ?? result.tenant_slug ?? 'Компания'

  const card = (
    <article className="overflow-hidden rounded-2xl border bg-card transition hover:shadow-md">
      <div className="flex h-28 items-center justify-center bg-muted/50">
        {result.logo_url ? (
          <Image
            src={result.logo_url}
            alt=""
            width={160}
            height={80}
            className="max-h-16 max-w-[60%] object-contain"
            unoptimized
          />
        ) : (
          <BuildingIcon size={32} className="text-muted-foreground" />
        )}
      </div>
      <div className="p-5">
        <div className="mb-2">
          <ResultTypeBadge type="listing" />
        </div>
        <h2 className="text-lg font-semibold line-clamp-2">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{companyName}</p>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{description}</p>
        ) : null}
        {categorySlugs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categorySlugs.map((slug) => (
              <span
                key={slug}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              >
                {getI18nText(categoriesBySlug.get(slug)?.name, 'ru', slug)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )

  if (!listingUrl) return card

  return (
    <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  )
}

export function MarketplaceSearchClient({ categories }: MarketplaceSearchClientProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<MarketplaceSearchFilter | null>(null)
  const [parsedByAi, setParsedByAi] = useState(false)
  const [results, setResults] = useState<MarketplaceSearchResult[]>([])

  const categoriesBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories]
  )

  const runSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const body = JSON.stringify({ query: trimmed })
      const [tenantRes, listingRes] = await Promise.all([
        fetch('/api/marketplace/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        fetch('/api/marketplace/search-listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      ])

      const tenantJson = (await tenantRes.json()) as {
        filter?: MarketplaceSearchFilter
        parsed_by_ai?: boolean
        results?: MarketplaceTenantResult[]
        error?: string
      }
      const listingJson = (await listingRes.json()) as {
        results?: MarketplaceListingResult[]
        error?: string
      }

      if (!tenantRes.ok) throw new Error(tenantJson.error ?? 'Ошибка поиска компаний')
      if (!listingRes.ok) throw new Error(listingJson.error ?? 'Ошибка поиска услуг')

      setFilter(tenantJson.filter ?? null)
      setParsedByAi(Boolean(tenantJson.parsed_by_ai))
      setResults(
        mergeResults(tenantJson.results ?? [], listingJson.results ?? [])
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) {
      setQuery(q)
      void runSearch(q)
    }
  }, [runSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    const url = new URL(window.location.href)
    url.searchParams.set('q', trimmed)
    window.history.replaceState(null, '', url.toString())
    void runSearch(trimmed)
  }

  const tenantCount = results.filter((r) => r.result_type === 'tenant').length
  const listingCount = results.filter((r) => r.result_type === 'listing').length

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Поиск на Yanbada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Опишите задачу своими словами — мы найдём компании и конкретные услуги на платформе.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <SearchIcon
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-12 pl-10 text-base"
            placeholder="Например: нужен гид по горам в Алматы"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className={cn(
            'mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {loading ? 'Поиск…' : 'Найти'}
        </button>
      </form>

      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {filter ? (
        <div className="mb-6 space-y-2">
          {parsedByAi ? (
            <p className="text-xs text-muted-foreground">Распознанный фильтр</p>
          ) : null}
          <FilterChips filter={filter} />
        </div>
      ) : null}

      {!loading && filter && results.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Ничего не найдено"
          description="Попробуйте переформулировать запрос или уточнить город и услугу."
        />
      ) : null}

      {results.length > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Найдено: {results.length}
          {tenantCount > 0 || listingCount > 0
            ? ` (компаний: ${tenantCount}, услуг: ${listingCount})`
            : ''}
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <li
            key={
              result.result_type === 'tenant'
                ? `tenant-${result.tenant_id}`
                : `listing-${result.id}`
            }
          >
            {result.result_type === 'tenant' ? (
              <TenantCard result={result} categoriesBySlug={categoriesBySlug} />
            ) : (
              <ListingCard result={result} categoriesBySlug={categoriesBySlug} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
