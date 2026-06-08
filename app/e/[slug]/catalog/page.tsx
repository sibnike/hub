import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { InviteRequired } from '@/components/public/invite-required'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getI18nText } from '@/lib/i18n/get-text'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getPublishedEvent(params.slug)
  if (!event) return {}

  const title = getI18nText(event.name, 'ru', params.slug)
  const city = event.location?.city ?? ''
  const dates = formatDateRangeLabel(event.dates)
  const description = [city, dates !== '—' ? dates : null].filter(Boolean).join(' · ')

  return {
    title: `Каталог участников — ${title}`,
    description: description || `Каталог участников — ${title}`,
  }
}

export default async function CatalogPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  return <InviteRequired slug={event.slug} />
}
