import { ExhibitorEventDetailClient } from '@/components/exhibitor/exhibitor-event-detail-client'

export default function ExhibitorEventDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  return <ExhibitorEventDetailClient slug={params.slug} />
}
