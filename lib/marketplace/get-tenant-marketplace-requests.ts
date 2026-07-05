import { createAdminClient } from '@/lib/supabase/admin'
import type { MarketplaceRequestListItem } from '@/types/marketplace-request'

export async function getTenantMarketplaceRequests(
  marketplaceId: string,
  requesterTenantId: string
): Promise<MarketplaceRequestListItem[]> {
  const supabase = createAdminClient()

  const { data: requests, error } = await supabase
    .schema('hub')
    .from('marketplace_requests')
    .select(
      'id, request_text, budget_amount, budget_currency, status, created_at'
    )
    .eq('marketplace_id', marketplaceId)
    .eq('requester_tenant_id', requesterTenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !requests?.length) {
    return []
  }

  const requestIds = requests.map((r) => r.id)

  const { data: targets } = await supabase
    .schema('hub')
    .from('marketplace_request_targets')
    .select(
      'id, request_id, tenant_id, response_status, response_message, responded_at, vitrina_submission_id'
    )
    .in('request_id', requestIds)

  const tenantIds = Array.from(new Set((targets ?? []).map((t) => String(t.tenant_id))))
  const { data: tenants } = tenantIds.length
    ? await supabase.from('tenants').select('id, name, slug').in('id', tenantIds)
    : { data: [] as Array<{ id: string; name: string; slug: string }> }

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]))

  return requests.map((request) => ({
    id: String(request.id),
    request_text: String(request.request_text),
    budget_amount:
      typeof request.budget_amount === 'number' ? request.budget_amount : null,
    budget_currency:
      typeof request.budget_currency === 'string' ? request.budget_currency : null,
    status: request.status === 'closed' ? 'closed' : 'open',
    created_at: String(request.created_at),
    targets: (targets ?? [])
      .filter((t) => t.request_id === request.id)
      .map((t) => {
        const tenant = tenantById.get(String(t.tenant_id))
        return {
          id: String(t.id),
          tenant_id: String(t.tenant_id),
          tenant_slug: tenant?.slug ?? null,
          tenant_name: tenant?.name ?? null,
          response_status:
            t.response_status === 'accepted' ||
            t.response_status === 'declined' ||
            t.response_status === 'expired'
              ? t.response_status
              : 'pending',
          response_message:
            typeof t.response_message === 'string' ? t.response_message : null,
          responded_at:
            typeof t.responded_at === 'string' ? t.responded_at : null,
          vitrina_submission_id:
            t.vitrina_submission_id != null
              ? String(t.vitrina_submission_id)
              : null,
        }
      }),
  }))
}
