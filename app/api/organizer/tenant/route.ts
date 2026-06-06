import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  assertTenantAdminOrPlatform,
  getAccessibleTenants,
  resolveActiveTenantId,
  TENANT_COOKIE,
} from '@/lib/auth/current-tenant'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenants = await getAccessibleTenants()

  const activeTenantId = await resolveActiveTenantId()
  return NextResponse.json({ tenants, activeTenantId })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tenant_id?: string }
  if (!body.tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  if (!(await assertTenantAdminOrPlatform(body.tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set(TENANT_COOKIE, body.tenant_id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  return NextResponse.json({ ok: true, activeTenantId: body.tenant_id })
}
