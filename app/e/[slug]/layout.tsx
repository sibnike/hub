import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { EventShell } from '@/components/public/event-shell'
import {
  isWhiteLabelHost,
  parseEventSettings,
} from '@/lib/hub/event-settings'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getI18nText } from '@/lib/i18n/get-text'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type LayoutProps = {
  children: React.ReactNode
  params: { slug: string }
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const event = await getPublishedEvent(params.slug)
  if (!event) return {}

  const title = getI18nText(event.name, 'ru', params.slug)
  const city = event.location?.city ?? ''

  return {
    title,
    description: city ? `${title} — ${city}` : title,
  }
}

export default async function EventLayout({ children, params }: LayoutProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const headersList = await headers()
  const host = headersList.get('host')
  const settings = parseEventSettings(event.settings)
  const whiteLabel = isWhiteLabelHost(host, settings)

  return (
    <EventShell event={event} whiteLabel={whiteLabel}>
      {children}
    </EventShell>
  )
}
