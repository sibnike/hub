'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Filter, Minus, Plus, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useEventLocale } from '@/components/public/event-locale-context'
import { trackEvent, useTrack } from '@/lib/hooks/use-track'
import { extractSvgViewBox } from '@/lib/svg/sanitize'
import { getI18nText } from '@/lib/i18n/get-text'
import {
  categoryColor,
  dominantCategory,
  formatMapTabLabel,
  standMatchesMap,
} from '@/lib/map/utils'
import { useEmbed } from '@/lib/embed/context'
import { cn } from '@/lib/utils'
import type { IndustryCategory } from '@/types/catalog'
import type { EventMapRow, MapStandRow } from '@/types/map'

type EventMapProps = {
  eventSlug: string
  maps: EventMapRow[]
  stands: MapStandRow[]
  categories: IndustryCategory[]
  unplacedCount: number
  highlightStandId?: string | null
  favoriteTenantIds?: Set<string>
  guideMode?: boolean
  guideBasePath?: string
}

function isPlaced(stand: MapStandRow): boolean {
  return stand.map_x > 0 || stand.map_y > 0
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

export function EventMap({
  eventSlug,
  maps,
  stands,
  categories,
  unplacedCount,
  highlightStandId = null,
  favoriteTenantIds,
  guideMode = false,
  guideBasePath,
}: EventMapProps) {
  const { locale } = useEventLocale()
  const { embed } = useEmbed()
  const isMobile = useIsMobile()
  useTrack({ event_slug: eventSlug, type: 'map_view' })

  const [activeMap, setActiveMap] = useState(maps[0] ?? null)
  const [selectedStand, setSelectedStand] = useState<MapStandRow | null>(null)
  const [highlightApplied, setHighlightApplied] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [zoom, setZoom] = useState(1)
  const mapAreaRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)

  const viewBox = useMemo(
    () => (activeMap?.svg_content ? extractSvgViewBox(activeMap.svg_content) : null),
    [activeMap]
  )
  const aspectRatio = viewBox ? `${viewBox.width} / ${viewBox.height}` : '16 / 9'

  const hasActiveFilters = search.trim().length > 0 || selectedCategories.length > 0

  const matchedStandIds = useMemo(() => {
    const ids = new Set<string>()
    const q = search.trim().toLowerCase()

    for (const stand of stands.filter(isPlaced)) {
      const matchesSearch =
        !q ||
        stand.cache?.name?.toLowerCase().includes(q) ||
        stand.stand_number?.toLowerCase().includes(q)

      const matchesCategory =
        selectedCategories.length === 0 ||
        stand.cache?.categories?.some((c) => selectedCategories.includes(c))

      if (matchesSearch && matchesCategory) ids.add(stand.id)
    }
    return ids
  }, [stands, search, selectedCategories])

  const standsForMap = useMemo(() => {
    if (!activeMap) return []
    return stands.filter((s) => standMatchesMap(s, activeMap) && isPlaced(s))
  }, [stands, activeMap])

  const categoriesOnMap = useMemo(() => {
    const slugs = new Set<string>()
    for (const stand of standsForMap) {
      for (const c of stand.cache?.categories ?? []) slugs.add(c)
    }
    return categories.filter((c) => slugs.has(c.slug))
  }, [standsForMap, categories])

  const crossPavilionMatch = useMemo(() => {
    if (!search.trim() && selectedCategories.length === 0) return null
    if (!activeMap) return null

    const match = stands.find(
      (s) =>
        isPlaced(s) &&
        matchedStandIds.has(s.id) &&
        !standMatchesMap(s, activeMap)
    )
    if (!match) return null
    const targetMap = maps.find((m) => standMatchesMap(match, m))
    if (!targetMap) return null
    return { stand: match, map: targetMap }
  }, [search, selectedCategories, activeMap, stands, matchedStandIds, maps])

  const showMapTabs = maps.length > 1

  useEffect(() => {
    if (!highlightStandId || highlightApplied || !maps.length) return

    const stand = stands.find((s) => s.id === highlightStandId)
    if (!stand) return

    const targetMap = maps.find((m) => standMatchesMap(stand, m))
    if (targetMap) setActiveMap(targetMap)
    setSelectedStand(stand)
    setHighlightApplied(true)
  }, [highlightStandId, highlightApplied, maps, stands])

  const filterPanel = (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Категории</Label>
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {categories.map((cat) => (
            <label key={cat.slug} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.slug)}
                onChange={() =>
                  setSelectedCategories((prev) =>
                    prev.includes(cat.slug)
                      ? prev.filter((s) => s !== cat.slug)
                      : [...prev, cat.slug]
                  )
                }
                className="rounded border-input"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor(cat.slug) }}
              />
              <span>{getI18nText(cat.name, locale, cat.slug)}</span>
            </label>
          ))}
        </div>
      </div>
      {hasActiveFilters ? (
        <Button size="sm" variant="outline" onClick={() => {
          setSearch('')
          setSelectedCategories([])
        }}>
          <X className="mr-1 h-3.5 w-3.5" />
          Сбросить фильтры
        </Button>
      ) : null}
    </div>
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchRef.current = { dist: Math.hypot(dx, dy), zoom }
      }
    },
    [zoom]
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.hypot(dx, dy)
    const scale = dist / pinchRef.current.dist
    setZoom(Math.min(3, Math.max(0.5, pinchRef.current.zoom * scale)))
  }, [])

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null
  }, [])

  if (!maps.length) {
    return (
      <div className="container py-12 text-center">
        <h2 className="mb-4 text-2xl font-semibold">Карта выставки</h2>
        <p className="text-muted-foreground">Карта будет добавлена скоро.</p>
      </div>
    )
  }

  const matchedOnMap = standsForMap.filter((s) => matchedStandIds.has(s.id)).length

  return (
    <div className={cn(embed ? 'w-full px-4 py-6 space-y-4' : 'container py-6 space-y-4')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Карта выставки</h2>
        {showMapTabs ? (
          <div className="flex flex-wrap gap-1">
            {maps.map((map) => (
              <Button
                key={map.id}
                size="sm"
                variant={activeMap?.id === map.id ? 'default' : 'outline'}
                onClick={() => setActiveMap(map)}
              >
                {formatMapTabLabel(map)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {!isMobile ? (
          <aside className="hidden shrink-0 rounded-lg border p-4 lg:block lg:w-64">
            <p className="mb-3 text-sm font-medium">Фильтры</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filterPanel}
          </aside>
        ) : (
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="w-full">
                  <Filter className="mr-1 h-4 w-4" />
                  Фильтры
                  {hasActiveFilters ? (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCategories.length + (search ? 1 : 0)}
                    </Badge>
                  ) : null}
                </Button>
              }
            />
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Фильтры карты</SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Поиск..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {filterPanel}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          {hasActiveFilters ? (
            <p className="text-sm text-muted-foreground">
              Найдено {matchedOnMap} из {standsForMap.length} стендов
            </p>
          ) : null}

          {crossPavilionMatch ? (
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--event-accent)] bg-[var(--event-accent)]/10 px-3 py-2 text-left text-sm hover:bg-[var(--event-accent)]/20"
              onClick={() => setActiveMap(crossPavilionMatch.map)}
            >
              Найдено в {formatMapTabLabel(crossPavilionMatch.map)} → переключиться
            </button>
          ) : null}

          {unplacedCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {unplacedCount} стендов ещё не размещены на карте
            </p>
          ) : null}

          <div
            ref={mapAreaRef}
            className="relative overflow-auto rounded-lg border bg-muted/20"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="relative mx-auto w-full max-w-[1200px] origin-top-left transition-transform [&_svg]:h-full [&_svg]:w-full"
              style={{ aspectRatio, transform: `scale(${zoom})` }}
            >
              {activeMap?.svg_content ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  dangerouslySetInnerHTML={{ __html: activeMap.svg_content }}
                />
              ) : null}
              {standsForMap.map((stand) => {
                const matched = !hasActiveFilters || matchedStandIds.has(stand.id)
                const cat = dominantCategory(stand.cache?.categories)
                const borderColor = cat ? categoryColor(cat) : undefined
                const isFavorite =
                  stand.tenant_id != null && (favoriteTenantIds?.has(stand.tenant_id) ?? false)

                return (
                  <button
                    key={stand.id}
                    type="button"
                    title={stand.cache?.name ?? stand.stand_number ?? ''}
                    className={cn(
                      'absolute flex items-center justify-center rounded border-2 bg-background/70 text-xs transition-all',
                      matched
                        ? hasActiveFilters
                          ? 'animate-pulse border-[var(--event-accent)] ring-2 ring-[var(--event-accent)] opacity-100'
                          : isFavorite
                            ? 'border-amber-400 ring-2 ring-amber-300 opacity-100 hover:bg-background/90'
                            : 'border-foreground/30 opacity-100 hover:border-[var(--event-accent)] hover:bg-background/90'
                        : 'opacity-25 border-foreground/20'
                    )}
                    style={{
                      left: `${stand.map_x}%`,
                      top: `${stand.map_y}%`,
                      width: `${stand.map_width}%`,
                      height: `${stand.map_height}%`,
                      borderColor:
                        matched && isFavorite
                          ? '#f59e0b'
                          : matched && borderColor
                            ? borderColor
                            : undefined,
                    }}
                    onClick={() => {
                      setSelectedStand(stand)
                      if (stand.tenant_id) {
                        trackEvent({
                          event_slug: eventSlug,
                          tenant_id: stand.tenant_id,
                          type: 'stand_view',
                          source: 'map',
                        })
                      }
                    }}
                  >
                    <span className="truncate px-1 font-medium">{stand.stand_number}</span>
                  </button>
                )
              })}
            </div>

            <div className="absolute bottom-3 right-3 hidden gap-1 md:flex">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {categoriesOnMap.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">Категории на карте:</span>
              {categoriesOnMap.map((cat) => (
                <Badge
                  key={cat.slug}
                  variant="outline"
                  className="gap-1.5 text-xs"
                  style={{ borderColor: categoryColor(cat.slug) }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: categoryColor(cat.slug) }}
                  />
                  {getI18nText(cat.name, locale, cat.slug)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={!!selectedStand} onOpenChange={(open) => !open && setSelectedStand(null)}>
        <SheetContent>
          {selectedStand ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedStand.cache?.name ?? selectedStand.stand_number}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-4">
                {selectedStand.cache?.logo_url ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border">
                    <Image
                      src={selectedStand.cache.logo_url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
                {selectedStand.cache?.short_description ? (
                  <p className="text-sm text-muted-foreground">
                    {getI18nText(selectedStand.cache.short_description, locale)}
                  </p>
                ) : null}
                {selectedStand.stand_number ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Стенд: </span>
                    {selectedStand.stand_number}
                    {selectedStand.pavilion ? ` · ${selectedStand.pavilion}` : ''}
                  </p>
                ) : null}
                {selectedStand.tenant_slug ? (
                  <Link
                    href={
                      guideMode && guideBasePath
                        ? `${guideBasePath}/company/${selectedStand.tenant_slug}`
                        : `/e/${eventSlug}/company/${selectedStand.tenant_slug}`
                    }
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    Открыть профиль
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
