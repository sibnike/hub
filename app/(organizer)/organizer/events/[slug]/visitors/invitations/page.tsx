import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { VisitorInvitationsPanel } from '@/components/organizer/visitor-invitations-panel'
import Link from 'next/link'

type PageProps = { params: { slug: string } }

export default async function VisitorInvitationsPage({ params }: PageProps) {
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Приглашения — {title}</h1>
        </div>
        <Link href={`/organizer/events/${params.slug}/visitors`} className="text-sm text-primary hover:underline">
          ← Посетители
        </Link>
      </div>
      <VisitorInvitationsPanel eventSlug={params.slug} />
    </div>
  )
}
