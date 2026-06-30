'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SearchIcon } from '@/components/icons'
import { EmptyState } from '@/components/design/empty-state'
import { Input } from '@/components/ui/input'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { IndustryCategory } from '@/types/catalog'
import type {
  MarketplaceSearchFilter,
  MarketplaceSearchResult,
} from '@/types/marketplace-search'

type MarketplaceSearchClientProps = {
  categories: IndustryCategory[]
}

function buildProfileUrl(result: MarketplaceSearchResult): string | null {
  const base =
    process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ??
    'https://vitrina.yanbada.com'
  if (result.vitrina_page_slug) {
    return `${base}/p/${result.vitrina_page_slug}`
  }
  if (result.tenant_slug) {
    return `${base}/h/${result.tenant_slug}`
  }
  return null
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
      const res = await fetch('/api/marketplace/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      const json = (await res.json()) as {
        filter?: MarketplaceSearchFilter
        parsed_by_ai?: boolean
        results?: MarketplaceSearchResult[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка поиска')

      setFilter(json.filter ?? null)
      setParsedByAi(Boolean(json.parsed_by_ai))
      setResults(json.results ?? [])
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Поиск компаний</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Опишите задачу своими словами — мы подберём подходящих исполнителей на платформе
          Yanbada.
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
        <p className="mb-4 text-sm text-muted-foreground">Найдено: {results.length}</p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => {
          const name = result.name ?? result.tenant_slug ?? 'Компания'
          const description = getI18nText(result.short_description, 'ru')
          const profileUrl = buildProfileUrl(result)
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

          return (
            <li key={result.tenant_id}>
              {profileUrl ? (
                <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
