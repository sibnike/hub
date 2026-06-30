import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildMarketplaceSubmissionFields,
  createVitrinaHubSubmission,
} from '@/lib/integrations/vitrina-submissions'
import { getHubMarketplaceSourceUrl } from '@/lib/integrations/vitrina-ingest'
import type {
  DispatchTargetResult,
  MarketplaceRequestParsed,
  MarketplaceRequestRow,
  MarketplaceRequestTargetRow,
  MatchedRequestTenant,
} from '@/types/marketplace-request'

export type DispatchMarketplaceRequestResult = {
  dispatched_count: number
  results: DispatchTargetResult[]
}

export async function dispatchMarketplaceRequest(input: {
  request: MarketplaceRequestRow
  targets: MarketplaceRequestTargetRow[]
  matched: MatchedRequestTenant[]
  parsed: MarketplaceRequestParsed | null
}): Promise<DispatchMarketplaceRequestResult> {
  if (!input.targets.length) {
    return { dispatched_count: 0, results: [] }
  }

  const slugByTenant = new Map(
    input.matched.map((m) => [m.tenant_id, m.tenant_slug])
  )

  const fields = buildMarketplaceSubmissionFields({
    requesterName: input.request.requester_name,
    requesterContact: input.request.requester_contact,
    requestText: input.request.request_text,
    parsed: input.parsed,
  })

  const sourceUrl = getHubMarketplaceSourceUrl()
  const supabase = createAdminClient()
  const results: DispatchTargetResult[] = []
  let dispatchedCount = 0

  for (const target of input.targets) {
    const tenantSlug = slugByTenant.get(target.tenant_id) ?? null

    if (!tenantSlug) {
      results.push({
        target_id: target.id,
        tenant_id: target.tenant_id,
        tenant_slug: null,
        ok: false,
        error: 'tenant_slug not found',
      })
      continue
    }

    try {
      const vitrina = await createVitrinaHubSubmission({
        externalId: `mkt-${target.id}`,
        tenantSlug,
        title: 'Запрос с маркетплейса Yanbada',
        fields,
        metadata: {
          hub_request_id: input.request.id,
          hub_target_id: target.id,
          source_url: sourceUrl,
        },
      })

      const { error } = await supabase
        .schema('hub')
        .from('marketplace_request_targets')
        .update({ vitrina_submission_id: vitrina.submission_id })
        .eq('id', target.id)

      if (error) {
        throw new Error(error.message)
      }

      dispatchedCount += 1
      results.push({
        target_id: target.id,
        tenant_id: target.tenant_id,
        tenant_slug: tenantSlug,
        ok: true,
        vitrina_submission_id: vitrina.submission_id,
        duplicate: vitrina.duplicate,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Dispatch failed'
      console.error('[dispatchMarketplaceRequest]', target.id, message)
      results.push({
        target_id: target.id,
        tenant_id: target.tenant_id,
        tenant_slug: tenantSlug,
        ok: false,
        error: message,
      })
    }
  }

  return { dispatched_count: dispatchedCount, results }
}
