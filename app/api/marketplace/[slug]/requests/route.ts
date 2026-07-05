import { NextRequest, NextResponse } from 'next/server'
import { getTenantMarketplaceRequests } from '@/lib/marketplace/get-tenant-marketplace-requests'
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  const requests = await getTenantMarketplaceRequests(
    access.marketplace.id,
    access.tenantId
  )

  return NextResponse.json({ requests })
}
