import { Resend } from 'resend'

export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export const EMAIL_FROM = 'Yanbada <hub@yanbada.com>'

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!resend) {
    console.log(`[email skipped] ${opts.to} → ${opts.subject}`)
    return
  }
  await resend.emails.send({
    from: EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}
