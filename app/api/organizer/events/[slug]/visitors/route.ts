import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: { slug: string } }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tierId = request.nextUrl.searchParams.get('tier_id')
  const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()

  const supabase = await createClient()
  let query = supabase
    .schema('hub')
    .from('event_visitors')
    .select('*, tier:tier_id(*)')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  if (tierId) query = query.eq('tier_id', tierId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let rows = data ?? []
  if (search) {
    rows = rows.filter(
      (v) =>
        v.name.toLowerCase().includes(search) ||
        v.email.toLowerCase().includes(search)
    )
  }

  return NextResponse.json({ data: rows })
}
