import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildVitrinaProfileUrl } from '@/lib/hub/vitrina-url'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; standId: string }
}

export default async function StandRedirectPage({ params }: PageProps) {
  const supabase = createAdminClient()

  const { data: stand } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('tenant_id, event_id')
    .eq('id', params.standId)
    .maybeSingle()

  if (!stand?.tenant_id) {
    redirect(`/e/${params.slug}/catalog`)
  }

  const headersList = await headers()
  await supabase.schema('hub').from('track_events').insert({
    event_id: stand.event_id,
    tenant_id: stand.tenant_id,
    type: 'qr_scan',
    source: 'qr',
    user_agent: headersList.get('user-agent') ?? null,
  })

  const { data: cache } = await supabase
    .schema('hub')
    .from('company_cache')
    .select('vitrina_page_slug')
    .eq('tenant_id', stand.tenant_id)
    .maybeSingle()

  if (!cache?.vitrina_page_slug) {
    redirect(`/e/${params.slug}/catalog`)
  }

  const vitrinaUrl = buildVitrinaProfileUrl(cache.vitrina_page_slug, {
    ref: 'qr',
    event: params.slug,
  })

  redirect(vitrinaUrl)
}
