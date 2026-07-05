import { NextRequest, NextResponse } from 'next/server'
import { getSearchPresetsForMarketplace } from '@/lib/marketplace/get-search-presets'
import { requireApprovedMarketplaceAccess } from '@/lib/marketplace/require-approved-access'

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const access = await requireApprovedMarketplaceAccess(slug)
  if (access instanceof NextResponse) return access

  try {
    const presets = await getSearchPresetsForMarketplace(access.marketplace.id, true)
    return NextResponse.json({ presets })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load presets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
