import {
  getVitrinaApiBase,
  getVitrinaIngestSecret,
  signVitrinaIngestPayload,
} from '@/lib/integrations/vitrina-ingest'
import {
  fetchVitrinaIngestWithRetry,
  throttleVitrinaIngest,
} from '@/lib/integrations/vitrina-ingest-throttle'
import type { MarketplaceRequestParsed } from '@/types/marketplace-request'

export type VitrinaSubmissionField = {
  key: string
  label: string
  value: string
}

export type CreateVitrinaSubmissionInput = {
  externalId: string
  tenantSlug: string
  title: string
  fields: VitrinaSubmissionField[]
  locale?: string
  metadata?: Record<string, unknown>
  sourceType?: 'marketplace'
  requesterTenantId?: string
  marketplaceRequestTargetId?: string
}

export type CreateVitrinaSubmissionResult = {
  submission_id: string
  status: string
  staff_cabinet_url: string
  duplicate: boolean
}

export function buildMarketplaceSubmissionFields(input: {
  requesterName: string
  requesterContact: string
  requestText: string
  parsed: MarketplaceRequestParsed | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  marketplaceRequestTargetId?: string
}): VitrinaSubmissionField[] {
  const fields: VitrinaSubmissionField[] = [
    { key: 'requester_name', label: 'Заявитель', value: input.requesterName },
    { key: 'requester_contact', label: 'Контакт', value: input.requesterContact },
    { key: 'request_text', label: 'Запрос', value: input.requestText },
  ]

  if (input.parsed?.requested_date) {
    fields.push({
      key: 'requested_date',
      label: 'Желаемая дата',
      value: input.parsed.requested_date,
    })
  }

  if (input.parsed?.quantity) {
    fields.push({
      key: 'quantity',
      label: 'Количество',
      value: input.parsed.quantity,
    })
  }

  const budget =
    input.budgetAmount ??
    input.parsed?.requester_proposed_price ??
    null

  if (budget != null) {
    fields.push({
      key: 'proposed_price',
      label: 'Бюджет заявителя',
      value: String(budget),
    })
    if (input.budgetCurrency) {
      fields.push({
        key: 'budget_currency',
        label: 'Валюта бюджета',
        value: input.budgetCurrency,
      })
    }
  }

  if (input.marketplaceRequestTargetId) {
    fields.push({
      key: 'marketplace_request_target_id',
      label: 'ID таргета',
      value: input.marketplaceRequestTargetId,
    })
  }

  return fields
}

export async function createVitrinaHubSubmission(
  input: CreateVitrinaSubmissionInput
): Promise<CreateVitrinaSubmissionResult> {
  const secret = getVitrinaIngestSecret()
  const base = getVitrinaApiBase()

  const fields = [...input.fields]
  if (
    input.marketplaceRequestTargetId &&
    !fields.some((f) => f.key === 'marketplace_request_target_id')
  ) {
    fields.push({
      key: 'marketplace_request_target_id',
      label: 'ID таргета',
      value: input.marketplaceRequestTargetId,
    })
  }

  const body: Record<string, unknown> = {
    source: 'hub',
    external_id: input.externalId,
    tenant_slug: input.tenantSlug,
    assigned_staff_id: null,
    locale: input.locale ?? 'ru',
    title: input.title,
    fields,
    metadata: input.metadata,
  }

  if (input.sourceType === 'marketplace') {
    body.source_type = 'marketplace'
  }

  if (input.requesterTenantId) {
    body.requester_tenant_id = input.requesterTenantId
  }

  const payload = JSON.stringify(body)
  const signature = signVitrinaIngestPayload(payload, secret)

  await throttleVitrinaIngest(input.tenantSlug)

  const res = await fetchVitrinaIngestWithRetry(`${base}/api/integrations/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vitrina-Ingest-Signature': signature,
    },
    body: payload,
  })

  const json = (await res.json()) as {
    ok?: boolean
    error?: string
    submission_id?: string
    status?: string
    staff_cabinet_url?: string
    duplicate?: boolean
  }

  if (!res.ok || !json.submission_id) {
    throw new Error(json.error ?? `Vitrina ingest failed (${res.status})`)
  }

  return {
    submission_id: json.submission_id,
    status: json.status ?? 'new',
    staff_cabinet_url: json.staff_cabinet_url ?? '',
    duplicate: Boolean(json.duplicate),
  }
}
