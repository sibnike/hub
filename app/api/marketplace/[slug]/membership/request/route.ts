import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertTenantAdminOrPlatform,
  resolveActiveTenantId,
} from '@/lib/auth/current-tenant'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { getMembership } from '@/lib/marketplace/membership'
import { notifyPlatformAdminsMembershipRequest } from '@/lib/email/templates/marketplace-membership'
import { getI18nText } from '@/lib/i18n/get-text'
import type { MarketplaceMemberRow } from '@/types/marketplace-membership'

type RouteContext = { params: Promise<{ slug: string }> }

export async function POST(_request: NextRequest, context: RouteContext) {
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

  const existing = await getMembership(marketplace.id, tenantId)
  const admin = createAdminClient()

  if (!existing) {
    const { data, error } = await admin
      .schema('hub')
      .from('marketplace_members')
      .insert({
        marketplace_id: marketplace.id,
        tenant_id: tenantId,
        status: 'pending',
        requested_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[membership/request] insert', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await sendNewRequestEmail(marketplace, tenantId, slug)

    return NextResponse.json({ membership: data as MarketplaceMemberRow }, { status: 201 })
  }

  if (existing.status === 'pending') {
    return NextResponse.json(
      { error: 'Заявка уже на рассмотрении', membership: existing },
      { status: 409 }
    )
  }

  if (existing.status === 'approved') {
    return NextResponse.json(
      { error: 'Доступ уже одобрен', membership: existing },
      { status: 409 }
    )
  }

  const { data, error } = await admin
    .schema('hub')
    .from('marketplace_members')
    .update({
      status: 'pending',
      requested_by: user.id,
      reviewed_by: null,
      reviewed_at: null,
      reject_reason: null,
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error) {
    console.error('[membership/request] resubmit', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await sendNewRequestEmail(marketplace, tenantId, slug)

  return NextResponse.json({ membership: data as MarketplaceMemberRow })
}

async function sendNewRequestEmail(
  marketplace: Awaited<ReturnType<typeof getActiveMarketplaceBySlug>>,
  tenantId: string,
  slug: string
): Promise<void> {
  if (!marketplace) return

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  await notifyPlatformAdminsMembershipRequest({
    marketplaceSlug: slug,
    marketplaceName: getI18nText(marketplace.name, 'ru', marketplace.slug),
    tenantName: tenant?.name ?? tenantId,
  })
}
