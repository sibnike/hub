import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildMarketplaceSubmissionFields,
  createVitrinaHubSubmission,
} from '@/lib/integrations/vitrina-submissions'
import { getHubMarketplaceSourceUrl } from '@/lib/integrations/vitrina-ingest'
import type {
  DispatchTargetResult,
  MarketplaceRequestRow,
  MarketplaceRequestTargetCandidate,
  MarketplaceRequestTargetRow,
} from '@/types/marketplace-request'
import type { GuidedSearchParams } from '@/types/marketplace-guided-search'

export type DispatchMarketplaceRequestV2Input = {
  request: MarketplaceRequestRow
  targets: MarketplaceRequestTargetRow[]
  candidates: MarketplaceRequestTargetCandidate[]
  params: GuidedSearchParams
  marketplaceSlug: string
  requesterTenantId: string
  budgetAmount: number
  budgetCurrency: string
}

export async function dispatchMarketplaceRequestV2(
  input: DispatchMarketplaceRequestV2Input
): Promise<{ dispatched_count: number; results: DispatchTargetResult[] }> {
  const slugByTenant = new Map(
    input.candidates.map((c) => [c.tenant_id, c.tenant_slug])
  )
  const metaByTenant = new Map(
    input.candidates.map((c) => [c.tenant_id, c])
  )

  const sourceUrl = getHubMarketplaceSourceUrl()
  const hubBase = sourceUrl.replace(/\/marketplace$/, '')
  const supabase = createAdminClient()
  const results: DispatchTargetResult[] = []
  let dispatchedCount = 0

  for (const target of input.targets) {
    const tenantSlug = slugByTenant.get(target.tenant_id) ?? null
    const candidate = metaByTenant.get(target.tenant_id)

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
      const fields = buildMarketplaceSubmissionFields({
        requesterName: input.request.requester_name,
        requesterContact: input.request.requester_contact,
        requestText: input.request.request_text,
        parsed: input.request.ai_parsed,
        budgetAmount: input.budgetAmount,
        budgetCurrency: input.budgetCurrency,
        marketplaceRequestTargetId: target.id,
      })

      if (input.params.city) {
        fields.push({ key: 'city', label: 'Город', value: input.params.city })
      }

      if (candidate?.page_slug) {
        fields.push({ key: 'page_slug', label: 'Страница', value: candidate.page_slug })
      }

      if (candidate?.title) {
        fields.push({ key: 'listing_title', label: 'Предложение', value: candidate.title })
      }

      const vitrina = await createVitrinaHubSubmission({
        externalId: `mkt-req-${target.id}`,
        tenantSlug,
        title: 'Запрос с маркетплейса Yanbada',
        fields,
        sourceType: 'marketplace',
        requesterTenantId: input.requesterTenantId,
        marketplaceRequestTargetId: target.id,
        metadata: {
          source_type: 'marketplace',
          source_partner: input.marketplaceSlug,
          requester_tenant_id: input.requesterTenantId,
          marketplace_slug: input.marketplaceSlug,
          marketplace_request_target_id: target.id,
          hub_request_id: input.request.id,
          hub_target_id: target.id,
          listing_id: candidate?.listing_id ?? null,
          page_slug: candidate?.page_slug ?? null,
          source_url: `${hubBase}/m/${input.marketplaceSlug}`,
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
      console.error('[dispatchMarketplaceRequestV2]', target.id, message)
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
