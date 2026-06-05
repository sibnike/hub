import { Resend } from 'resend'
import type { HubEventRow } from '@/types/hub-event'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendInvitation(
  email: string,
  event: Pick<HubEventRow, 'slug' | 'name'>,
  code: string
): Promise<void> {
  if (!resend) {
    console.log(`[email skipped] ${email} → code: ${code}`)
    return
  }

  const eventName = event.name?.ru ?? event.name?.en ?? event.slug
  const hubDomain = process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  const hubUrl = `https://${hubDomain}/exhibitor/events/join?event=${event.slug}&code=${code}`

  await resend.emails.send({
    from: 'Yanbada <hub@yanbada.com>',
    to: email,
    subject: `Приглашение на ${eventName}`,
    html: `
      <h2>Вы приглашены на мероприятие «${eventName}»</h2>
      <p>Ваш код доступа: <strong>${code}</strong></p>
      <p><a href="${hubUrl}">Подключиться к мероприятию</a></p>
      <p>Если у вас ещё нет профиля компании в Yanbada — создайте его на admin.yanbada.com и затем подключитесь к выставке.</p>
    `,
  })
}
