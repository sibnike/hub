'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmbedHeightReporter } from '@/components/public/embed-height-reporter'
import { EventHeader } from '@/components/public/event-header'
import { EventLocaleProvider } from '@/components/public/event-locale-context'
import { EmbedProvider } from '@/lib/embed/context'
import {
  getDefaultAccentColor,
  getEventLocales,
  parseEventSettings,
} from '@/lib/hub/event-settings'
import { cn } from '@/lib/utils'
import type { HubEventRow } from '@/types/hub-event'

type EventShellProps = {
  event: HubEventRow
  whiteLabel: boolean
  children: React.ReactNode
}

function EventShellInner({ event, whiteLabel, children }: EventShellProps) {
  const searchParams = useSearchParams()
  const embed = searchParams.get('embed') === '1'
  const track = searchParams.get('track') === '1'

  const settings = parseEventSettings(event.settings)
  const locales = getEventLocales(settings)
  const defaultLocale = locales[0] ?? 'ru'
  const accent = getDefaultAccentColor(settings)
  const domainPrefix = settings.custom_domain_prefix ?? ''

  return (
    <EmbedProvider
      embed={embed}
      track={track}
      whiteLabel={whiteLabel}
      domainPrefix={domainPrefix}
    >
      <EventLocaleProvider locales={locales} defaultLocale={defaultLocale}>
        <div
          className={cn(embed ? 'w-full' : 'min-h-screen flex flex-col')}
          style={
            {
              '--event-accent': accent,
              fontFamily: settings.font || undefined,
            } as React.CSSProperties
          }
        >
          {!embed ? (
            <EventHeader
              slug={event.slug}
              name={event.name}
              dates={event.dates}
              location={event.location ?? {}}
              settings={event.settings}
              whiteLabel={whiteLabel}
              domainPrefix={domainPrefix}
            />
          ) : null}
          <main className={cn(embed ? 'w-full' : 'flex-1')}>{children}</main>
          {!embed && (settings.brand_footer_text || whiteLabel) ? (
            <footer className="border-t py-4 text-center text-sm text-muted-foreground">
              {settings.brand_footer_text ? <p>{settings.brand_footer_text}</p> : null}
              {whiteLabel ? (
                <p className="mt-1 text-xs opacity-60">Powered by Yanbada</p>
              ) : null}
            </footer>
          ) : null}
          {embed ? <EmbedHeightReporter /> : null}
        </div>
      </EventLocaleProvider>
    </EmbedProvider>
  )
}

export function EventShell(props: EventShellProps) {
  return (
    <Suspense fallback={<div className="min-h-screen">{props.children}</div>}>
      <EventShellInner {...props} />
    </Suspense>
  )
}
