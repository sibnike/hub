import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  assertTenantAdmin,
  getCurrentUserTenants,
  resolveActiveTenantId,
  TENANT_COOKIE,
} from '@/lib/auth/current-tenant'

export async function GET() {
  const tenants = await getCurrentUserTenants()
  if (!tenants) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeTenantId = await resolveActiveTenantId()
  return NextResponse.json({ tenants, activeTenantId })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { tenant_id?: string }
  if (!body.tenant_id) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  if (!(await assertTenantAdmin(body.tenant_id))) {
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
