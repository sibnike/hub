import { sendEmail } from '@/lib/email/resend-client'
import { hubBaseUrl } from '@/lib/hub/organizer-event'
import type { I18nMap } from '@/types/hub-event'

export async function sendVisitorConfirmEmail(opts: {
  email: string
  name: string
  eventSlug: string
  eventName: I18nMap
  confirmToken: string
}): Promise<void> {
  const eventTitle = opts.eventName?.ru ?? opts.eventName?.en ?? opts.eventSlug
  const confirmUrl = `${hubBaseUrl()}/e/${opts.eventSlug}/confirm/${opts.confirmToken}`

  await sendEmail({
    to: opts.email,
    subject: `Подтверждение регистрации на ${eventTitle}`,
    html: `
      <p>Здравствуйте, ${opts.name}!</p>
      <p>Для входа в гайд посетителя выставки «${eventTitle}» перейдите по ссылке:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Ссылка действительна 24 часа.</p>
    `,
  })
}

export async function sendVisitorWelcomeEmail(opts: {
  email: string
  name: string
  eventSlug: string
  eventName: I18nMap
  tierName?: string
  tierDescription?: string
  bonusBalance: number
}): Promise<void> {
  const eventTitle = opts.eventName?.ru ?? opts.eventName?.en ?? opts.eventSlug
  const guideUrl = `${hubBaseUrl()}/e/${opts.eventSlug}/guide`

  await sendEmail({
    to: opts.email,
    subject: `Добро пожаловать в гайд — ${eventTitle}`,
    html: `
      <p>Здравствуйте, ${opts.name}!</p>
      <p>Регистрация на «${eventTitle}» подтверждена.</p>
      ${opts.tierName ? `<p>Ваш статус: <strong>${opts.tierName}</strong></p>` : ''}
      ${opts.tierDescription ? `<p>${opts.tierDescription}</p>` : ''}
      <p>Бонусный баланс: <strong>${opts.bonusBalance}</strong> баллов</p>
      <p><a href="${guideUrl}">Открыть гайд посетителя</a></p>
    `,
  })
}
