import { EventEmbedClient } from '@/components/organizer/event-embed-client'

export default function EventEmbedPage({ params }: { params: { slug: string } }) {
  return <EventEmbedClient slug={params.slug} />
}
