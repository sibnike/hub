import { EventManageClient } from '@/components/organizer/event-manage-client'

export default function EventManagePage({
  params,
}: {
  params: { slug: string }
}) {
  return <EventManageClient slug={params.slug} />
}
