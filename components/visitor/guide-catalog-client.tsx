'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { GuideParticipantCard } from '@/components/visitor/guide-participant-card'
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
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import { getI18nText } from '@/lib/i18n/get-text'
import type { CatalogParticipant, IndustryCategory } from '@/types/catalog'
import { useEventLocale } from '@/components/public/event-locale-context'
import { cn } from '@/lib/utils'

type GuideCatalogClientProps = {
  eventId: string
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

export function GuideCatalogClient({
  eventId,
  eventSlug,
  participations,
  categories,
}: GuideCatalogClientProps) {
  const { locale } = useEventLocale()
  const { isFavorite, toggle } = useVisitorFavorites(eventId)
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

  const filtered = useMemo(() => {
    return participations.filter((p) => {
      if (debouncedQuery) {
        if (!collectSearchText(p).includes(debouncedQuery)) return false
      }
      if (selectedCategories.length > 0) {
        if (!selectedCategories.some((c) => p.cache.categories.includes(c))) return false
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

  const filterPanel = (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Категории</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = selectedCategories.includes(cat.slug)
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => toggleCategory(cat.slug)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted'
                )}
              >
                {getI18nText(cat.name, locale, cat.slug)}
              </button>
            )
          })}
        </div>
      </div>
      {countries.length > 0 ? (
        <div>
          <Label>Страна</Label>
          <Select value={country} onValueChange={(v) => v && setCountry(v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {pavilions.length > 0 ? (
        <div>
          <Label>Павильон</Label>
          <Select value={pavilion} onValueChange={(v) => v && setPavilion(v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {pavilions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="container py-6 space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Поиск участников…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Фильтры">
                <Filter className="h-4 w-4" />
              </Button>
            }
          />
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Фильтры</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{filterPanel}</div>
          </SheetContent>
        </Sheet>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} из {participations.length} участников
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <GuideParticipantCard
            key={p.id}
            eventSlug={eventSlug}
            participant={p}
            categoriesBySlug={categoriesBySlug}
            isFavorite={isFavorite(p.tenant_id)}
            onToggleFavorite={() => void toggle(p.tenant_id)}
          />
        ))}
      </div>
    </div>
  )
}
