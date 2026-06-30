import {
  getVitrinaApiBase,
  getVitrinaIngestSecret,
  signVitrinaIngestPayload,
} from '@/lib/integrations/vitrina-ingest'
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

  if (input.parsed?.requester_proposed_price != null) {
    fields.push({
      key: 'proposed_price',
      label: 'Бюджет заявителя',
      value: String(input.parsed.requester_proposed_price),
    })
  }

  return fields
}

export async function createVitrinaHubSubmission(
  input: CreateVitrinaSubmissionInput
): Promise<CreateVitrinaSubmissionResult> {
  const secret = getVitrinaIngestSecret()
  const base = getVitrinaApiBase()

  const body = {
    source: 'hub' as const,
    external_id: input.externalId,
    tenant_slug: input.tenantSlug,
    assigned_staff_id: null,
    locale: input.locale ?? 'ru',
    title: input.title,
    fields: input.fields,
    metadata: input.metadata,
  }

  const payload = JSON.stringify(body)
  const signature = signVitrinaIngestPayload(payload, secret)

  const res = await fetch(`${base}/api/integrations/submissions`, {
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
