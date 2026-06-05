import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EventMap } from '@/components/public/event-map'
import {
  countUnplacedStands,
  getEventMaps,
  getMapStands,
} from '@/lib/hub/get-map-data'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
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
  return {
    title: `Карта — ${title}`,
    description: `Интерактивная карта выставки ${title}`,
  }
}

export default async function MapPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const [maps, stands, categories] = await Promise.all([
    getEventMaps(event.id),
    getMapStands(event.id),
    getIndustryCategories(),
  ])

  return (
    <EventMap
      eventSlug={event.slug}
      maps={maps}
      stands={stands}
      categories={categories}
      unplacedCount={countUnplacedStands(stands)}
    />
  )
}
