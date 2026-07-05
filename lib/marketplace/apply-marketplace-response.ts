import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantAdminEmails } from '@/lib/email/get-admin-emails'
import { sendEmail } from '@/lib/email/resend-client'
import { hubBaseUrl } from '@/lib/hub/organizer-event'
import { getI18nText } from '@/lib/i18n/get-text'
import type { MarketplaceTargetResponseStatus } from '@/types/marketplace-request'

export type ApplyMarketplaceResponseInput = {
  marketplace_request_target_id: string
  response_status: 'accepted' | 'declined'
  response_message?: string | null
  vitrina_submission_id?: string | null
}

export type ApplyMarketplaceResponseResult = {
  target_id: string
  request_id: string
  response_status: MarketplaceTargetResponseStatus
  updated: boolean
}

export async function applyMarketplaceResponse(
  input: ApplyMarketplaceResponseInput
): Promise<ApplyMarketplaceResponseResult> {
  const supabase = createAdminClient()

  const { data: target, error: fetchError } = await supabase
    .schema('hub')
    .from('marketplace_request_targets')
    .select('id, request_id, tenant_id, response_status, vitrina_submission_id')
    .eq('id', input.marketplace_request_target_id)
    .maybeSingle()

  if (fetchError || !target) {
    throw new Error('Target not found')
  }

  const { data: requestRow } = await supabase
    .schema('hub')
    .from('marketplace_requests')
    .select('id, requester_tenant_id, request_text, budget_amount, budget_currency, marketplace_id')
    .eq('id', target.request_id)
    .maybeSingle()

  let marketplaceSlug = 'tourism'
  let marketplaceName = 'Маркетплейс'

  if (requestRow?.marketplace_id) {
    const { data: marketplace } = await supabase
      .schema('hub')
      .from('marketplaces')
      .select('slug, name')
      .eq('id', requestRow.marketplace_id)
      .maybeSingle()

    if (marketplace?.slug) {
      marketplaceSlug = marketplace.slug
      marketplaceName = getI18nText(
        marketplace.name as Record<string, string>,
        'ru',
        marketplace.slug
      )
    }
  }

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    response_status: input.response_status,
    response_message: input.response_message?.trim() || null,
    responded_at: now,
    status: input.response_status === 'accepted' ? 'responded' : 'declined',
  }

  if (input.vitrina_submission_id && !target.vitrina_submission_id) {
    updatePayload.vitrina_submission_id = input.vitrina_submission_id
  }

  const { error: updateError } = await supabase
    .schema('hub')
    .from('marketplace_request_targets')
    .update(updatePayload)
    .eq('id', input.marketplace_request_target_id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  if (requestRow?.requester_tenant_id) {
    await notifyRequesterTenantAdmins({
      requesterTenantId: requestRow.requester_tenant_id,
      marketplaceSlug,
      marketplaceName,
      responseStatus: input.response_status,
      responseMessage: input.response_message,
      requestText: requestRow.request_text,
    })
  }

  return {
    target_id: String(target.id),
    request_id: String(target.request_id),
    response_status: input.response_status,
    updated: true,
  }
}

async function notifyRequesterTenantAdmins(opts: {
  requesterTenantId: string
  marketplaceSlug: string
  marketplaceName: string
  responseStatus: 'accepted' | 'declined'
  responseMessage?: string | null
  requestText: string
}): Promise<void> {
  const emails = await getTenantAdminEmails(opts.requesterTenantId)
  if (!emails.length) {
    console.log(
      '[marketplace-response-email] no requester admin emails',
      opts.requesterTenantId
    )
    return
  }

  const hubUrl = `${hubBaseUrl()}/m/${opts.marketplaceSlug}`
  const statusLabel =
    opts.responseStatus === 'accepted' ? 'принят' : 'отклонён'

  await Promise.all(
    emails.map((to) =>
      sendEmail({
        to,
        subject: `Ответ на запрос в маркетплейсе «${opts.marketplaceName}»`,
        html: `
          <p>Исполнитель ${statusLabel} ваш запрос на маркетплейсе «${opts.marketplaceName}».</p>
          <p><strong>Запрос:</strong> ${opts.requestText}</p>
          ${opts.responseMessage ? `<p><strong>Сообщение:</strong> ${opts.responseMessage}</p>` : ''}
          <p><a href="${hubUrl}">Открыть «Мои запросы»</a></p>
        `,
      })
    )
  )
}
