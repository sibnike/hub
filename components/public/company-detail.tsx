'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEmbed } from '@/lib/embed/context'
import { useTrack } from '@/lib/hooks/use-track'
import { cn } from '@/lib/utils'
import { buildVitrinaProfileUrl } from '@/lib/hub/vitrina-url'
import { getI18nText } from '@/lib/i18n/get-text'
import type { TrackSource } from '@/types/analytics'
import type { CompanyInEvent } from '@/lib/hub/get-company-in-event'
import type { IndustryCategory } from '@/types/catalog'
import { useEventLocale } from '@/components/public/event-locale-context'

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  youtube: 'YouTube',
  telegram: 'Telegram',
}

type CompanyDetailProps = {
  data: CompanyInEvent
  categories: IndustryCategory[]
  source?: TrackSource
}

export function CompanyDetail({ data, categories, source = 'direct' }: CompanyDetailProps) {
  const { locale } = useEventLocale()
  const { embed } = useEmbed()
  const { event, cache, stand, tenant_slug: tenantSlug } = data
  const name = cache.name ?? tenantSlug
  const description = getI18nText(cache.short_description, locale)

  const categoriesBySlug = new Map(categories.map((c) => [c.slug, c]))

  const vitrinaUrl =
    cache.vitrina_page_slug != null
      ? buildVitrinaProfileUrl(cache.vitrina_page_slug, {
          ref: 'catalog',
          event: event.slug,
        })
      : null

  const standLabel = [
    stand?.stand_number ? `Стенд ${stand.stand_number}` : null,
    stand?.pavilion,
    stand?.floor != null ? `этаж ${stand.floor}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  useTrack({
    event_slug: event.slug,
    tenant_id: data.tenant_id,
    type: 'profile_view',
    source,
  })

  return (
    <div className={cn(embed ? 'w-full px-4 py-6 space-y-6' : 'container py-6 max-w-3xl space-y-6')}>
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {cache.logo_url ? (
            <Image
              src={cache.logo_url}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{name}</h1>
          {description ? (
            <p className="mt-2 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      {standLabel ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Стенд
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">{standLabel}</span>
            <Button variant="outline" size="sm" disabled>
              Показать на карте
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(cache.categories.length > 0 || cache.tags.length > 0) && (
        <div className="space-y-2">
          {cache.categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {cache.categories.map((slug) => {
                const cat = categoriesBySlug.get(slug)
                return (
                  <Badge key={slug} variant="secondary">
                    {cat ? getI18nText(cat.name, locale, slug) : slug}
                  </Badge>
                )
              })}
            </div>
          ) : null}
          {cache.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {cache.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        {cache.country ? (
          <div>
            <span className="text-muted-foreground">Страна: </span>
            {cache.country}
          </div>
        ) : null}
        {cache.website ? (
          <div>
            <a
              href={cache.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Сайт
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
      </div>

      {Object.keys(cache.social_links).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(cache.social_links).map(([key, url]) =>
            url ? (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {SOCIAL_LABELS[key] ?? key}
              </a>
            ) : null
          )}
        </div>
      ) : null}

      {cache.contact_persons.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Контакты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cache.contact_persons.map((person, index) => (
              <div key={index} className="text-sm space-y-0.5">
                {person.name ? <p className="font-medium">{person.name}</p> : null}
                {person.role ? (
                  <p className="text-muted-foreground">{person.role}</p>
                ) : null}
                {person.phone ? <p>{person.phone}</p> : null}
                {person.email ? (
                  <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                    {person.email}
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        {vitrinaUrl ? (
          <Button
            size="lg"
            className="gap-2"
            style={{ backgroundColor: 'var(--event-accent)' }}
            render={
              <a href={vitrinaUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            Открыть полный профиль
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : null}
        <Button variant="outline" render={<Link href={`/e/${event.slug}/catalog`} />}>
          ← К каталогу
        </Button>
      </div>
    </div>
  )
}
