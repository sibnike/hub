import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchMarketplaceRequest } from '@/lib/marketplace/dispatch-marketplace-request'
import { matchRequestTenants } from '@/lib/marketplace/match-request-tenants'
import { parseMarketplaceRequest } from '@/lib/marketplace/parse-marketplace-request'
import type {
  CreateMarketplaceRequestInput,
  CreateMarketplaceRequestResult,
  MarketplaceRequestParsed,
  MarketplaceRequestRow,
  MarketplaceRequestTargetRow,
} from '@/types/marketplace-request'

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
    created_at: String(row.created_at),
  }
}

function toTargetRow(row: Record<string, unknown>): MarketplaceRequestTargetRow {
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
    proposed_price:
      typeof row.proposed_price === 'number' ? row.proposed_price : null,
    response_message:
      typeof row.response_message === 'string' ? row.response_message : null,
    responded_at: typeof row.responded_at === 'string' ? row.responded_at : null,
    created_at: String(row.created_at),
  }
}

export async function createMarketplaceRequest(
  input: CreateMarketplaceRequestInput,
  options?: { parsed?: MarketplaceRequestParsed; parsedByAi?: boolean }
): Promise<CreateMarketplaceRequestResult> {
  const name = input.requester_name.trim()
  const contact = input.requester_contact.trim()
  const text = input.request_text.trim()

  if (!name || !contact || !text) {
    throw new Error('requester_name, requester_contact и request_text обязательны')
  }

  let parsed = options?.parsed
  let parsedByAi = options?.parsedByAi ?? false

  if (!parsed) {
    parsed = await parseMarketplaceRequest(text)
    parsedByAi = true
  }

  const matched = await matchRequestTenants(parsed, input.target_limit)

  const supabase = createAdminClient()

  const { data: requestData, error: requestError } = await supabase
    .schema('hub')
    .from('marketplace_requests')
    .insert({
      requester_name: name,
      requester_contact: contact,
      request_text: text,
      ai_parsed: parsed,
      status: 'open',
    })
    .select()
    .single()

  if (requestError || !requestData) {
    throw new Error(requestError?.message ?? 'Failed to create marketplace request')
  }

  const request = toRequestRow(requestData as Record<string, unknown>)

  if (!matched.length) {
    return {
      request,
      targets: [],
      matched_count: 0,
      parsed,
      parsed_by_ai: parsedByAi,
      dispatched_count: 0,
      dispatch_results: [],
    }
  }

  const targetRows = matched.map((m) => ({
    request_id: request.id,
    tenant_id: m.tenant_id,
    status: 'sent' as const,
  }))

  const { data: targetsData, error: targetsError } = await supabase
    .schema('hub')
    .from('marketplace_request_targets')
    .insert(targetRows)
    .select()

  if (targetsError) {
    throw new Error(targetsError.message)
  }

  const targets = (targetsData ?? []).map((r) =>
    toTargetRow(r as Record<string, unknown>)
  )

  const dispatch = await dispatchMarketplaceRequest({
    request,
    targets,
    matched,
    parsed,
  })

  return {
    request,
    targets: targets.map((target) => {
      const sent = dispatch.results.find((r) => r.target_id === target.id)
      return sent?.vitrina_submission_id
        ? { ...target, vitrina_submission_id: sent.vitrina_submission_id }
        : target
    }),
    matched_count: matched.length,
    parsed,
    parsed_by_ai: parsedByAi,
    dispatched_count: dispatch.dispatched_count,
    dispatch_results: dispatch.results,
  }
}
