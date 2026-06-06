'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Handshake, MapPin, Star, StarOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFavorites } from '@/lib/hooks/use-favorites'
import { trackEvent } from '@/lib/hooks/use-track'
import { buildVitrinaProfileUrl } from '@/lib/hub/vitrina-url'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { CatalogStand, IndustryCategory } from '@/types/catalog'
import type { CompanyCacheRow } from '@/types/company-cache'
import type { HubEventRow } from '@/types/hub-event'
import { useEventLocale } from '@/components/public/event-locale-context'

const MAX_VISIBLE_CATEGORIES = 4

type CompanyContextHeaderProps = {
  company: CompanyCacheRow
  stand?: CatalogStand | null
  event: HubEventRow
  tenantSlug: string
  tenantId: string
  categories: IndustryCategory[]
}

function ActionButton({
  icon,
  label,
  onClick,
  href,
  active,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  active?: boolean
}) {
  const content = (
    <>
      {icon}
      <span className="text-xs">{label}</span>
    </>
  )

  const className = cn(
    'flex h-auto min-w-[88px] flex-col items-center gap-1.5 px-3 py-2.5',
    active && 'border-[var(--event-accent)] bg-[var(--event-accent)]/10'
  )

  if (href) {
    return (
      <Button variant="outline" size="sm" className={className} render={<Link href={href} />}>
        {content}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={onClick}>
      {content}
    </Button>
  )
}

export function CompanyContextHeader({
  company,
  stand,
  event,
  tenantSlug,
  tenantId,
  categories,
}: CompanyContextHeaderProps) {
  const { locale } = useEventLocale()
  const { isFavorite, add, remove } = useFavorites()
  const [toast, setToast] = useState<string | null>(null)

  const name = company.name ?? tenantSlug
  const description = getI18nText(company.short_description, locale)
  const saved = isFavorite(event.slug, tenantSlug)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  const standLabel = stand
    ? [
        stand.stand_number ? `Стенд ${stand.stand_number}` : null,
        stand.pavilion,
        stand.floor != null ? `этаж ${stand.floor}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  const vitrinaUrl =
    company.vitrina_page_slug != null
      ? buildVitrinaProfileUrl(company.vitrina_page_slug, {
          ref: 'catalog',
          event: event.slug,
        })
      : null

  function handleFavoriteToggle() {
    if (saved) {
      remove(event.slug, tenantSlug)
      showToast('Удалено из избранного')
    } else {
      add({
        event_slug: event.slug,
        tenant_slug: tenantSlug,
        tenant_name: name,
      })
      showToast('Добавлено в избранное')
      trackEvent({
        event_slug: event.slug,
        tenant_id: tenantId,
        type: 'save',
        source: 'profile',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {company.logo_url ? (
            <Image
              src={company.logo_url}
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
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-bold leading-tight">{name}</h1>
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
          <CompanyBadges company={company} categories={categories} />
          {company.country ? (
            <p className="text-sm text-muted-foreground">{company.country}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stand?.id ? (
          <ActionButton
            icon={<MapPin className="h-4 w-4" />}
            label="На карте"
            href={`/e/${event.slug}/map?stand=${stand.id}`}
          />
        ) : null}
        {vitrinaUrl ? (
          <Button
            variant="outline"
            size="sm"
            className="flex h-auto min-w-[88px] flex-col items-center gap-1.5 px-3 py-2.5"
            render={
              <a href={vitrinaUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink className="h-4 w-4" />
            <span className="text-xs">Открыть профиль</span>
          </Button>
        ) : null}
        <ActionButton
          icon={<Handshake className="h-4 w-4" />}
          label="Встреча"
          onClick={() => showToast('Функция скоро будет доступна')}
        />
        <ActionButton
          icon={
            saved ? (
              <Star className="h-4 w-4 fill-current text-amber-500" />
            ) : (
              <StarOff className="h-4 w-4" />
            )
          }
          label="Сохранить"
          onClick={handleFavoriteToggle}
          active={saved}
        />
      </div>

      {standLabel ? (
        <p className="text-sm text-muted-foreground">{standLabel}</p>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function CompanyBadges({
  company,
  categories,
}: {
  company: CompanyCacheRow
  categories: IndustryCategory[]
}) {
  const { locale } = useEventLocale()
  const categoriesBySlug = new Map(categories.map((c) => [c.slug, c]))

  const visibleCategories = company.categories.slice(0, MAX_VISIBLE_CATEGORIES)
  const hiddenCategoryCount = company.categories.length - visibleCategories.length
  const hiddenCategoryLabels = company.categories
    .slice(MAX_VISIBLE_CATEGORIES)
    .map((slug) => {
      const cat = categoriesBySlug.get(slug)
      return cat ? getI18nText(cat.name, locale, slug) : slug
    })
    .join(', ')

  if (visibleCategories.length === 0 && company.tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleCategories.map((slug) => {
        const cat = categoriesBySlug.get(slug)
        return (
          <Badge key={slug} variant="secondary">
            {cat ? getI18nText(cat.name, locale, slug) : slug}
          </Badge>
        )
      })}
      {hiddenCategoryCount > 0 ? (
        <Badge variant="secondary" title={hiddenCategoryLabels}>
          +{hiddenCategoryCount}
        </Badge>
      ) : null}
      {company.tags.map((tag) => (
        <Badge key={tag} variant="outline">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
