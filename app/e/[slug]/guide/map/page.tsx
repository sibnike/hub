import { notFound } from 'next/navigation'
import { GuideMapClient } from '@/components/visitor/guide-map-client'
import { countUnplacedStands, getEventMaps, getMapStands } from '@/lib/hub/get-map-data'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getPublishedEvent } from '@/lib/hub/get-published-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
  searchParams: { stand?: string }
}

export default async function GuideMapPage({ params, searchParams }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const [maps, stands, categories] = await Promise.all([
    getEventMaps(event.id),
    getMapStands(event.id),
    getIndustryCategories(),
  ])

  return (
    <GuideMapClient
      eventId={event.id}
      eventSlug={event.slug}
      maps={maps}
      stands={stands}
      categories={categories}
      unplacedCount={countUnplacedStands(stands)}
      highlightStandId={searchParams.stand ?? null}
    />
  )
}
