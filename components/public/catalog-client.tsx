'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { ParticipantCard } from '@/components/public/participant-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useTrack } from '@/lib/hooks/use-track'
import { getI18nText } from '@/lib/i18n/get-text'
import type { CatalogParticipant, IndustryCategory } from '@/types/catalog'
import { useEmbed } from '@/lib/embed/context'
import { useEventLocale } from '@/components/public/event-locale-context'
import { cn } from '@/lib/utils'

type CatalogClientProps = {
  eventSlug: string
  participations: CatalogParticipant[]
  categories: IndustryCategory[]
}

function collectSearchText(participant: CatalogParticipant): string {
  const { cache, stand } = participant
  const descParts = Object.values(cache.short_description ?? {}).join(' ')
  return [
    cache.name ?? '',
    descParts,
    ...(cache.tags ?? []),
    cache.country ?? '',
    stand?.stand_number ?? '',
    stand?.pavilion ?? '',
    participant.tenant_slug,
  ]
    .join(' ')
    .toLowerCase()
}

export function CatalogClient({
  eventSlug,
  participations,
  categories,
}: CatalogClientProps) {
  const { locale } = useEventLocale()
  const { embed } = useEmbed()
  useTrack({ event_slug: eventSlug, type: 'catalog_view' })
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [country, setCountry] = useState<string>('all')
  const [pavilion, setPavilion] = useState<string>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [query])

  const categoriesBySlug = useMemo(
    () => new Map(categories.map((c) => [c.slug, c])),
    [categories]
  )

  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const p of participations) {
      if (p.cache.country) set.add(p.cache.country)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [participations])

  const pavilions = useMemo(() => {
    const set = new Set<string>()
    for (const p of participations) {
      if (p.stand?.pavilion) set.add(p.stand.pavilion)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [participations])

  const hasActiveFilters =
    selectedCategories.length > 0 || country !== 'all' || pavilion !== 'all'

  const filtered = useMemo(() => {
    return participations.filter((p) => {
      if (debouncedQuery) {
        const haystack = collectSearchText(p)
        if (!haystack.includes(debouncedQuery)) return false
      }

      if (selectedCategories.length > 0) {
        const hasCategory = selectedCategories.some((slug) =>
          p.cache.categories.includes(slug)
        )
        if (!hasCategory) return false
      }

      if (country !== 'all' && p.cache.country !== country) return false

      if (pavilion !== 'all' && p.stand?.pavilion !== pavilion) return false

      return true
    })
  }, [participations, debouncedQuery, selectedCategories, country, pavilion])

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function resetFilters() {
    setSelectedCategories([])
    setCountry('all')
    setPavilion('all')
    setQuery('')
  }

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-medium">Категории</Label>
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <label
              key={cat.slug}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.slug)}
                onChange={() => toggleCategory(cat.slug)}
                className="rounded border-input"
              />
              <span>{getI18nText(cat.name, locale, cat.slug)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Страна</Label>
        <Select
          value={country}
          onValueChange={(value) => setCountry(value ?? 'all')}
        >
          <SelectTrigger className="mt-2 w-full">
            <SelectValue placeholder="Все страны" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все страны</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Павильон</Label>
        <Select
          value={pavilion}
          onValueChange={(value) => setPavilion(value ?? 'all')}
        >
          <SelectTrigger className="mt-2 w-full">
            <SelectValue placeholder="Все павильоны" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все павильоны</SelectItem>
            {pavilions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className={cn(embed ? 'w-full px-4 py-6 space-y-6' : 'container py-6 space-y-6')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, описанию, тегам, стенду…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" className="gap-1.5">
                  <Filter className="h-4 w-4" />
                  Фильтры
                  {hasActiveFilters ? (
                    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                      !
                    </span>
                  ) : null}
                </Button>
              }
            />
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Фильтры</SheetTitle>
              </SheetHeader>
              <div className="mt-6">{filterPanel}</div>
            </SheetContent>
          </Sheet>

          {hasActiveFilters || query ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Сбросить
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'компания' : 'компаний'} из{' '}
        {participations.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          Участники не найдены. Попробуйте изменить фильтры или поисковый запрос.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((participant) => (
            <ParticipantCard
              key={participant.id}
              eventSlug={eventSlug}
              participant={participant}
              categoriesBySlug={categoriesBySlug}
            />
          ))}
        </div>
      )}
    </div>
  )
}
