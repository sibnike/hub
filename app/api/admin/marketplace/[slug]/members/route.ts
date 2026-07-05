import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { joinTenants } from '@/lib/hub/join-tenants'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import type { MarketplaceMemberStatus } from '@/types/marketplace-membership'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const statusFilter = request.nextUrl.searchParams.get('status')
  const admin = createAdminClient()

  let query = admin
    .schema('hub')
    .from('marketplace_members')
    .select('*')
    .eq('marketplace_id', marketplace.id)
    .order('created_at', { ascending: false })

  if (
    statusFilter &&
    ['pending', 'approved', 'rejected', 'suspended'].includes(statusFilter)
  ) {
    query = query.eq('status', statusFilter as MarketplaceMemberStatus)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const withTenants = await joinTenants(data ?? [])

  return NextResponse.json({
    marketplace: { id: marketplace.id, slug: marketplace.slug },
    members: withTenants,
  })
}
