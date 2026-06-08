'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import {
  getDefaultAccentColor,
  getEventLogoUrl,
  parseEventSettings,
} from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { EventLocation, I18nMap } from '@/types/hub-event'
import type { EventVisitorRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'
import { Badge } from '@/components/ui/badge'

type GuideHeaderProps = {
  slug: string
  name: I18nMap
  dates: string | null
  location: EventLocation
  settings: Record<string, unknown>
  visitor: EventVisitorRow
}

const NAV_ITEMS = [
  { href: 'guide', label: 'Главная', key: 'home' },
  { href: 'guide/catalog', label: 'Каталог', key: 'catalog' },
  { href: 'guide/map', label: 'Карта', key: 'map' },
  { href: 'guide/favorites', label: 'Избранное', key: 'favorites' },
  { href: 'guide/polls', label: 'Опросы', key: 'polls' },
  { href: 'guide/profile', label: 'Профиль', key: 'profile' },
]

export function GuideHeader({
  slug,
  name,
  dates,
  location,
  settings,
  visitor,
}: GuideHeaderProps) {
  const pathname = usePathname()
  const { locale } = useEventLocale()
  const parsed = parseEventSettings(settings)
  const accent = getDefaultAccentColor(parsed)
  const title = getI18nText(name, locale, slug)
  const dateLabel = formatDateRangeLabel(dates)
  const city = location.city ?? ''
  const logoUrl = getEventLogoUrl(parsed)
  const tierName = visitor.tier
    ? getI18nText(visitor.tier.name, locale, visitor.tier.slug)
    : null
  const tierColor = visitor.tier?.color ?? accent

  const activeKey = NAV_ITEMS.find((item) => pathname.includes(`/${item.href}`))?.key ?? 'home'

  return (
    <header
      className="border-b bg-background"
      style={
        {
          '--event-accent': accent,
          fontFamily: parsed.font || undefined,
          ...(parsed.hero_image_url
            ? {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${parsed.hero_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        } as React.CSSProperties
      }
    >
      <div className="container py-4 md:py-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {logoUrl ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[city, dateLabel !== '—' ? dateLabel : null].filter(Boolean).join(' · ')}
              </p>
              {tierName ? (
                <Badge
                  className="mt-2 text-white border-0"
                  style={{ backgroundColor: tierColor }}
                >
                  {tierName}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{visitor.name}</p>
            <p className="text-muted-foreground">{visitor.bonus_balance} баллов</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((tab) => (
            <Link
              key={tab.key}
              href={`/e/${slug}/${tab.href}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeKey === tab.key
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              style={
                activeKey === tab.key ? { backgroundColor: 'var(--event-accent)' } : undefined
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
