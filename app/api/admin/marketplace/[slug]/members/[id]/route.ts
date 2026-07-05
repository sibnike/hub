import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { notifyTenantAdminsMembershipDecision } from '@/lib/email/templates/marketplace-membership'
import { getI18nText } from '@/lib/i18n/get-text'
import type {
  AdminMemberPatchAction,
  MarketplaceMemberRow,
} from '@/types/marketplace-membership'

type RouteContext = { params: Promise<{ slug: string; id: string }> }

type PatchBody = {
  action?: AdminMemberPatchAction
  reject_reason?: string
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug, id } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const body = (await request.json()) as PatchBody
  const action = body.action

  if (!action || !['approve', 'reject', 'suspend'].includes(action)) {
    return NextResponse.json({ error: 'action required: approve|reject|suspend' }, { status: 400 })
  }

  if (action === 'reject' && !body.reject_reason?.trim()) {
    return NextResponse.json({ error: 'reject_reason required for reject' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: existing, error: fetchError } = await admin
    .schema('hub')
    .from('marketplace_members')
    .select('*')
    .eq('id', id)
    .eq('marketplace_id', marketplace.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const statusMap: Record<AdminMemberPatchAction, MarketplaceMemberRow['status']> = {
    approve: 'approved',
    reject: 'rejected',
    suspend: 'suspended',
  }

  const patch: Record<string, unknown> = {
    status: statusMap[action],
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }

  if (action === 'reject' || action === 'suspend') {
    patch.reject_reason = body.reject_reason?.trim() ?? null
  } else {
    patch.reject_reason = null
  }

  const { data, error } = await admin
    .schema('hub')
    .from('marketplace_members')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const member = data as MarketplaceMemberRow
  const marketplaceName = getI18nText(marketplace.name, 'ru', marketplace.slug)

  if (action === 'approve') {
    await notifyTenantAdminsMembershipDecision({
      tenantId: member.tenant_id,
      marketplaceSlug: slug,
      marketplaceName,
      status: 'approved',
    })
  } else if (action === 'reject') {
    await notifyTenantAdminsMembershipDecision({
      tenantId: member.tenant_id,
      marketplaceSlug: slug,
      marketplaceName,
      status: 'rejected',
      rejectReason: member.reject_reason,
    })
  } else {
    await notifyTenantAdminsMembershipDecision({
      tenantId: member.tenant_id,
      marketplaceSlug: slug,
      marketplaceName,
      status: 'suspended',
      rejectReason: member.reject_reason,
    })
  }

  return NextResponse.json({ membership: member })
}
