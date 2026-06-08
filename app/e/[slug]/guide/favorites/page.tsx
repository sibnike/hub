import { notFound } from 'next/navigation'
import { FavoritesPage } from '@/components/visitor/favorites-page'
import { getCatalogParticipants } from '@/lib/hub/get-catalog-participants'
import { getPublishedEvent } from '@/lib/hub/get-published-event'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function GuideFavoritesPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const participations = await getCatalogParticipants(event.id)

  return (
    <FavoritesPage
      eventId={event.id}
      eventSlug={event.slug}
      participations={participations}
    />
  )
}
