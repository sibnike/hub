import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  assertTenantAdminOrPlatform,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { getMembership } from '@/lib/marketplace/membership'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const tenantId = await resolveActiveTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No active tenant' }, { status: 400 })
  }

  if (!(await assertTenantAdminOrPlatform(tenantId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const membership = await getMembership(marketplace.id, tenantId)

  return NextResponse.json({
    marketplace_id: marketplace.id,
    tenant_id: tenantId,
    membership,
    status: membership?.status ?? null,
  })
}
