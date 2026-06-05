import Link from 'next/link'
import { redirect } from 'next/navigation'
import { QrPrintGrid } from '@/components/organizer/qr-print-grid'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { getMapStands } from '@/lib/hub/get-map-data'
import { createClient } from '@/lib/supabase/server'
import type { HubEventRow } from '@/types/hub-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export default async function QrPrintPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    redirect('/organizer/events')
  }

  const stands = await getMapStands(event.id)
  const eventTitle = (event as HubEventRow).name.ru ?? (event as HubEventRow).name.en ?? event.slug

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">QR-коды стендов</h1>
          <p className="text-sm text-muted-foreground">{eventTitle}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/organizer/events/${params.slug}`}
            className="text-sm text-primary hover:underline self-center"
          >
            ← К событию
          </Link>
        </div>
      </div>

      {stands.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет стендов для печати</p>
      ) : (
        <QrPrintGrid eventSlug={params.slug} stands={stands} />
      )}
    </div>
  )
}
