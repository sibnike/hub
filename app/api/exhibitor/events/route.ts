import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin, resolveActiveTenantId } from '@/lib/auth/current-tenant'

export async function GET(request: NextRequest) {
  const tenantId = await resolveActiveTenantId(
    request.nextUrl.searchParams.get('tenant_id')
  )
  if (!tenantId || !(await assertTenantAdmin(tenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_participations')
    .select(
      `
      *,
      event:event_id(id, slug, name, dates, status),
      stand:event_stands(stand_number, pavilion, floor)
    `
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .order('joined_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
