import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import type { HubEventRow } from '@/types/hub-event'

type RouteParams = { params: { slug: string; standId: string } }

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as HubEventRow | null
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: stand } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('id')
    .eq('id', params.standId)
    .eq('event_id', event.id)
    .maybeSingle()

  if (!stand) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const hubDomain = process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  const url = `https://${hubDomain}/e/${event.slug}/stand/${params.standId}`

  const buffer = await QRCode.toBuffer(url, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
