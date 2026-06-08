import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { EventBrandingClient } from '@/components/organizer/event-branding-client'

type PageProps = { params: { slug: string } }

export default async function EventBrandingPage({ params }: PageProps) {
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
          <h1 className="text-2xl font-bold">Брендинг — {title}</h1>
          <p className="text-sm text-muted-foreground">Цвета, шрифты, hero и контакты гайда</p>
        </div>
        <Link href={`/organizer/events/${params.slug}`} className="text-sm text-primary hover:underline">
          ← Событие
        </Link>
      </div>
      <EventBrandingClient slug={params.slug} />
    </div>
  )
}
