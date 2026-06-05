'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { publicEventPath } from '@/lib/embed/paths'
import {
  getDefaultAccentColor,
  getEventLogoUrl,
  parseEventSettings,
} from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { EventLocation } from '@/types/hub-event'
import type { I18nMap } from '@/types/hub-event'
import { useEventLocale } from '@/components/public/event-locale-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EventHeaderProps = {
  slug: string
  name: I18nMap
  dates: string | null
  location: EventLocation
  settings: Record<string, unknown>
  whiteLabel?: boolean
  domainPrefix?: string
}

const LOCALE_LABELS: Record<string, string> = {
  ru: 'Русский',
  en: 'English',
  kk: 'Қазақша',
}

export function EventHeader({
  slug,
  name,
  dates,
  location,
  settings,
  whiteLabel = false,
  domainPrefix = '',
}: EventHeaderProps) {
  const pathname = usePathname()
  const { locale, locales, setLocale } = useEventLocale()
  const parsed = parseEventSettings(settings)
  const accent = getDefaultAccentColor(parsed)
  const title = getI18nText(name, locale, slug)
  const dateLabel = formatDateRangeLabel(dates)
  const city = location.city ?? ''

  const pathOpts = { whiteLabel, prefix: domainPrefix }
  const logoUrl = getEventLogoUrl(parsed)
  const tabs = [
    {
      href: publicEventPath(slug, '/catalog', pathOpts),
      label: 'Каталог',
      key: 'catalog',
    },
    { href: publicEventPath(slug, '/map', pathOpts), label: 'Карта', key: 'map' },
  ]

  const activeKey = pathname.includes('/map') ? 'map' : 'catalog'

  return (
    <header
      className="border-b bg-background"
      style={
        {
          '--event-accent': accent,
          fontFamily: parsed.font || undefined,
        } as React.CSSProperties
      }
    >
      <div className={cn('py-4 md:py-6 space-y-4', whiteLabel ? 'px-4 md:px-6' : 'container')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {logoUrl ? (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={logoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[city, dateLabel !== '—' ? dateLabel : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {locales.length > 1 ? (
            <Select
              value={locale}
              onValueChange={(value) => value && setLocale(value)}
            >
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_LABELS[code] ?? code.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeKey === tab.key
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              style={
                activeKey === tab.key
                  ? { backgroundColor: 'var(--event-accent)' }
                  : undefined
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
