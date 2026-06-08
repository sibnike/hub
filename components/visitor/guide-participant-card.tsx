'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { CatalogParticipant, IndustryCategory } from '@/types/catalog'
import { useEventLocale } from '@/components/public/event-locale-context'

type GuideParticipantCardProps = {
  eventSlug: string
  participant: CatalogParticipant
  categoriesBySlug: Map<string, IndustryCategory>
  isFavorite: boolean
  onToggleFavorite: () => void
}

export function GuideParticipantCard({
  eventSlug,
  participant,
  categoriesBySlug,
  isFavorite,
  onToggleFavorite,
}: GuideParticipantCardProps) {
  const { locale } = useEventLocale()
  const { cache, stand, tenant_slug: tenantSlug } = participant
  const name = cache.name ?? tenantSlug
  const description = getI18nText(cache.short_description, locale)
  const categorySlugs = cache.categories.slice(0, 2)

  const standLabel = [
    stand?.stand_number ? `Стенд ${stand.stand_number}` : null,
    stand?.pavilion ? stand.pavilion : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const mapHref = stand?.id
    ? `/e/${eventSlug}/guide/map?stand=${stand.id}`
    : `/e/${eventSlug}/guide/map`

  return (
    <Card className="h-full overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {cache.logo_url ? (
              <Image src={cache.logo_url} alt="" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight line-clamp-2">{name}</h3>
            {standLabel ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{standLabel}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
            aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
          >
            <Heart
              className={cn('h-5 w-5', isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground')}
            />
          </button>
        </div>

        {description ? (
          <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{description}</p>
        ) : (
          <div className="flex-1" />
        )}

        {categorySlugs.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {categorySlugs.map((slug) => {
              const cat = categoriesBySlug.get(slug)
              const label = cat ? getI18nText(cat.name, locale, slug) : slug
              return (
                <Badge key={slug} variant="secondary" className="text-[11px]">
                  {label}
                </Badge>
              )
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 min-w-[120px]"
            style={{ backgroundColor: 'var(--event-accent)' }}
            render={<Link href={`/e/${eventSlug}/guide/company/${tenantSlug}`} />}
          >
            Профиль
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[120px]"
            render={<Link href={mapHref} />}
          >
            На карте
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
