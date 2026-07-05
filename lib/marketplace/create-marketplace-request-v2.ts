import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchMarketplaceRequestV2 } from '@/lib/marketplace/dispatch-marketplace-request-v2'
import type {
  CreateMarketplaceRequestV2Input,
  CreateMarketplaceRequestV2Result,
  MarketplaceRequestParsed,
  MarketplaceRequestRow,
  MarketplaceRequestTargetRow,
} from '@/types/marketplace-request'
import type { GuidedSearchParams } from '@/types/marketplace-guided-search'

function paramsToParsed(params: GuidedSearchParams): MarketplaceRequestParsed {
  const dateFrom = params.date_from
  return {
    search: params.search,
    requested_date: dateFrom,
    quantity: params.people != null ? String(params.people) : null,
    requester_proposed_price: null,
  }
}

function toRequestRow(row: Record<string, unknown>): MarketplaceRequestRow {
  return {
    id: String(row.id),
    requester_name: String(row.requester_name),
    requester_contact: String(row.requester_contact),
    request_text: String(row.request_text),
    ai_parsed:
      row.ai_parsed && typeof row.ai_parsed === 'object'
        ? (row.ai_parsed as MarketplaceRequestParsed)
        : null,
    access_token: String(row.access_token),
    status: row.status === 'closed' ? 'closed' : 'open',
    budget_amount:
      typeof row.budget_amount === 'number' ? row.budget_amount : null,
    budget_currency:
      typeof row.budget_currency === 'string' ? row.budget_currency : null,
    requester_tenant_id:
      row.requester_tenant_id != null ? String(row.requester_tenant_id) : null,
    marketplace_id:
      row.marketplace_id != null ? String(row.marketplace_id) : null,
    created_at: String(row.created_at),
  }
}

function toTargetRow(row: Record<string, unknown>): MarketplaceRequestTargetRow {
  const responseStatus = row.response_status
  return {
    id: String(row.id),
    request_id: String(row.request_id),
    tenant_id: String(row.tenant_id),
    vitrina_submission_id:
      row.vitrina_submission_id != null ? String(row.vitrina_submission_id) : null,
    status:
      row.status === 'viewed' ||
      row.status === 'responded' ||
      row.status === 'declined' ||
      row.status === 'selected'
        ? row.status
        : 'sent',
    response_status:
      responseStatus === 'accepted' ||
      responseStatus === 'declined' ||
      responseStatus === 'expired'
        ? responseStatus
        : 'pending',
    proposed_price:
      typeof row.proposed_price === 'number' ? row.proposed_price : null,
    response_message:
      typeof row.response_message === 'string' ? row.response_message : null,
    responded_at: typeof row.responded_at === 'string' ? row.responded_at : null,
    created_at: String(row.created_at),
  }
}

export async function createMarketplaceRequestV2(
  input: CreateMarketplaceRequestV2Input
): Promise<CreateMarketplaceRequestV2Result> {
  const text = input.request_text.trim()
  if (!text) {
    throw new Error('request_text обязателен')
  }

  if (!Number.isFinite(input.budget_amount) || input.budget_amount <= 0) {
    throw new Error('budget_amount must be positive')
  }

  const uniqueTargets = new Map<string, (typeof input.targets)[number]>()
  for (const target of input.targets) {
    if (!target.tenant_id || !target.tenant_slug) continue
    if (!uniqueTargets.has(target.tenant_id)) {
      uniqueTargets.set(target.tenant_id, target)
    }
  }

  const targets = [...uniqueTargets.values()]
  if (!targets.length) {
    throw new Error('No valid targets')
  }

  const parsed = paramsToParsed(input.params)
  parsed.requester_proposed_price = input.budget_amount

  const supabase = createAdminClient()

  const { data: requestData, error: requestError } = await supabase
    .schema('hub')
    .from('marketplace_requests')
    .insert({
      requester_name: input.requester_name.trim(),
      requester_contact: input.requester_contact.trim(),
      request_text: text,
      ai_parsed: parsed,
      status: 'open',
      budget_amount: input.budget_amount,
      budget_currency: input.budget_currency,
      requester_tenant_id: input.requester_tenant_id,
      marketplace_id: input.marketplace_id,
    })
    .select()
    .single()

  if (requestError || !requestData) {
    throw new Error(requestError?.message ?? 'Failed to create marketplace request')
  }

  const request = toRequestRow(requestData as Record<string, unknown>)

  const targetRows = targets.map((t) => ({
    request_id: request.id,
    tenant_id: t.tenant_id,
    status: 'sent' as const,
    response_status: 'pending' as const,
  }))

  const { data: targetsData, error: targetsError } = await supabase
    .schema('hub')
    .from('marketplace_request_targets')
    .insert(targetRows)
    .select()

  if (targetsError) {
    throw new Error(targetsError.message)
  }

  const targetRecords = (targetsData ?? []).map((r) =>
    toTargetRow(r as Record<string, unknown>)
  )

  const dispatch = await dispatchMarketplaceRequestV2({
    request,
    targets: targetRecords,
    candidates: targets,
    params: input.params,
    marketplaceSlug: input.marketplace_slug,
    requesterTenantId: input.requester_tenant_id,
    budgetAmount: input.budget_amount,
    budgetCurrency: input.budget_currency,
  })

  return {
    request,
    targets: targetRecords.map((target) => {
      const sent = dispatch.results.find((r) => r.target_id === target.id)
      return sent?.vitrina_submission_id
        ? { ...target, vitrina_submission_id: sent.vitrina_submission_id }
        : target
    }),
    dispatched_count: dispatch.dispatched_count,
    dispatch_results: dispatch.results,
  }
}
