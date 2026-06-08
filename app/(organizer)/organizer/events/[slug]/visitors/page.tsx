import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { VisitorListPanel } from '@/components/organizer/visitor-list-panel'
import Link from 'next/link'

type PageProps = { params: { slug: string } }

export default async function VisitorsPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('id, slug, name, organizer_tenant_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    redirect('/organizer/events')
  }

  const title = event.name?.ru ?? event.name?.en ?? event.slug

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Посетители — {title}</h1>
          <p className="text-sm text-muted-foreground font-mono">{event.slug}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/organizer/events/${params.slug}/visitors/tiers`} className="text-primary hover:underline">
            Tier&apos;ы
          </Link>
          <Link href={`/organizer/events/${params.slug}/visitors/invitations`} className="text-primary hover:underline">
            Приглашения
          </Link>
          <Link href={`/organizer/events/${params.slug}/polls`} className="text-primary hover:underline">
            Опросы
          </Link>
          <Link href={`/organizer/events/${params.slug}`} className="text-muted-foreground hover:underline">
            ← Событие
          </Link>
        </div>
      </div>
      <VisitorListPanel eventSlug={params.slug} />
    </div>
  )
}
