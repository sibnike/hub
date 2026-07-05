import { NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform, resolveActiveTenantId } from '@/lib/auth/current-tenant'
import { createClient } from '@/lib/supabase/server'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { assertMarketplaceAccess } from '@/lib/marketplace/membership'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'

export type ApprovedMarketplaceContext = {
  marketplace: HubMarketplace
  tenantId: string
}

export async function requireApprovedMarketplaceAccess(
  slug: string
): Promise<ApprovedMarketplaceContext | NextResponse> {
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

  const access = await assertMarketplaceAccess(slug, tenantId)
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'Membership required', gate: access.gate },
      { status: 403 }
    )
  }

  return { marketplace, tenantId }
}
