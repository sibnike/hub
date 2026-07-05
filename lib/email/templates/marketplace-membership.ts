import { sendEmail } from '@/lib/email/resend-client'
import { getPlatformAdminEmails, getTenantAdminEmails } from '@/lib/email/get-admin-emails'
import { hubBaseUrl } from '@/lib/hub/organizer-event'

export async function notifyPlatformAdminsMembershipRequest(opts: {
  marketplaceSlug: string
  marketplaceName: string
  tenantName: string
}): Promise<void> {
  const emails = await getPlatformAdminEmails()
  const adminUrl = `${hubBaseUrl()}/admin/marketplace/${opts.marketplaceSlug}/members`

  if (!emails.length) {
    console.log(
      '[membership-email] TODO: no platform admin emails — new request',
      opts.marketplaceSlug,
      opts.tenantName
    )
    return
  }

  await Promise.all(
    emails.map((to) =>
      sendEmail({
        to,
        subject: `Новая заявка на маркетплейс «${opts.marketplaceName}»`,
        html: `
          <p>Поступила заявка на доступ к маркетплейсу «${opts.marketplaceName}».</p>
          <p>Тенант: <strong>${opts.tenantName}</strong></p>
          <p><a href="${adminUrl}">Открыть список заявок</a></p>
        `,
      })
    )
  )
}

export async function notifyTenantAdminsMembershipDecision(opts: {
  tenantId: string
  marketplaceSlug: string
  marketplaceName: string
  status: 'approved' | 'rejected' | 'suspended'
  rejectReason?: string | null
}): Promise<void> {
  const emails = await getTenantAdminEmails(opts.tenantId)
  if (!emails.length) {
    console.log(
      '[membership-email] no tenant admin emails — decision',
      opts.status,
      opts.tenantId
    )
    return
  }

  const hubUrl = `${hubBaseUrl()}/m/${opts.marketplaceSlug}`
  let subject: string
  let body: string

  if (opts.status === 'approved') {
    subject = `Доступ к маркетплейсу «${opts.marketplaceName}» одобрен`
    body = `
      <p>Заявка вашего тенанта на маркетплейс «${opts.marketplaceName}» одобрена.</p>
      <p><a href="${hubUrl}">Открыть маркетплейс</a></p>
    `
  } else if (opts.status === 'rejected') {
    subject = `Заявка на маркетплейс «${opts.marketplaceName}» отклонена`
    body = `
      <p>Заявка на доступ к маркетплейсу «${opts.marketplaceName}» отклонена.</p>
      ${opts.rejectReason ? `<p>Причина: ${opts.rejectReason}</p>` : ''}
      <p>Вы можете подать заявку повторно: <a href="${hubUrl}">${hubUrl}</a></p>
    `
  } else {
    subject = `Доступ к маркетплейсу «${opts.marketplaceName}» приостановлен`
    body = `
      <p>Доступ вашего тенанта к маркетплейсу «${opts.marketplaceName}» приостановлен.</p>
      ${opts.rejectReason ? `<p>Комментарий: ${opts.rejectReason}</p>` : ''}
      <p>Страница маркетплейса: <a href="${hubUrl}">${hubUrl}</a></p>
    `
  }

  await Promise.all(
    emails.map((to) =>
      sendEmail({
        to,
        subject,
        html: body,
      })
    )
  )
}
