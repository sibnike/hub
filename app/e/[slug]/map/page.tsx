import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EventThemeShell } from '@/components/design/event-theme-shell'
import { InviteRequired } from '@/components/public/invite-required'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getI18nText } from '@/lib/i18n/get-text'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
  searchParams: { stand?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getPublishedEvent(params.slug)
  if (!event) return {}

  const title = getI18nText(event.name, 'ru', params.slug)
  return {
    title: `Карта — ${title}`,
    description: `Интерактивная карта выставки ${title}`,
  }
}

export default async function MapPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  return (
    <EventThemeShell settings={event.settings}>
      <InviteRequired slug={event.slug} event={event} />
    </EventThemeShell>
  )
}
