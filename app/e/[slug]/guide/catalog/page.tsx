import { notFound } from 'next/navigation'
import { GuideCatalogClient } from '@/components/visitor/guide-catalog-client'
import { getCatalogParticipants } from '@/lib/hub/get-catalog-participants'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getPublishedEvent } from '@/lib/hub/get-published-event'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function GuideCatalogPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const [participations, categories] = await Promise.all([
    getCatalogParticipants(event.id),
    getIndustryCategories(),
  ])

  return (
    <GuideCatalogClient
      eventId={event.id}
      eventSlug={event.slug}
      participations={participations}
      categories={categories}
    />
  )
}
