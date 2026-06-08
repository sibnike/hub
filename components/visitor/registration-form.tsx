'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MailIcon, StarIcon } from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'
import { fadeUp } from '@/lib/design/animations'
import { getEventLogoUrl, parseEventSettings } from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COUNTRY_OPTIONS, SUPPORTED_VISITOR_LANGUAGES } from '@/lib/visitor/locales'
import type { HubEventRow } from '@/types/hub-event'
import type { EventInvitationRow } from '@/types/visitor'

type RegistrationFormProps = {
  event: HubEventRow
  invitation: EventInvitationRow
  inviteToken: string
}

function parsePrivileges(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n|•|·/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function RegistrationForm({ event, invitation, inviteToken }: RegistrationFormProps) {
  const router = useRouter()
  const settings = parseEventSettings(event.settings)
  const logoUrl = getEventLogoUrl(settings)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [language, setLanguage] = useState('ru')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  const eventTitle = getI18nText(event.name, 'ru', event.slug)
  const tierName = invitation.tier
    ? getI18nText(invitation.tier.name, 'ru', invitation.tier.slug)
    : null
  const tierDesc = invitation.tier?.description
    ? getI18nText(invitation.tier.description, 'ru')
    : null
  const tierColor = invitation.tier?.color ?? 'var(--tier-default)'
  const privileges = parsePrivileges(tierDesc)

  async function submit() {
    if (!email.trim() || !name.trim()) {
      setMessage('Укажите email и имя')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/visitor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_token: inviteToken,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim() || undefined,
          country: country || undefined,
          city: city.trim() || undefined,
          language,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        status?: string
        redirect?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка регистрации')

      if (json.status === 'already_registered' && json.redirect) {
        router.push(json.redirect)
        return
      }
      setCheckEmail(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function resendEmail() {
    setBusy(true)
    try {
      await fetch('/api/visitor/resend-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), event_slug: event.slug }),
      })
      setMessage('Письмо отправлено повторно')
    } catch {
      setMessage('Не удалось отправить письмо')
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <motion.div
          {...fadeUp}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-md)]"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--surface2)]">
            <MailIcon size={36} className="text-[var(--accent)]" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-semibold text-[var(--brand)]">
            Проверьте почту
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Мы отправили ссылку для подтверждения на{' '}
            <strong className="text-[var(--text)]">{email}</strong>
          </p>
          <GuideButton
            variant="secondary"
            className="mt-6"
            onClick={() => void resendEmail()}
            disabled={busy}
          >
            Отправить заново
          </GuideButton>
          {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <section
        className="relative flex min-h-[40vh] items-end px-4 pb-10 pt-16 md:px-8"
        style={{
          background: 'var(--hero-bg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/25" aria-hidden />
        <motion.div {...fadeUp} className="relative z-10 mx-auto w-full max-w-4xl">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white/10">
                <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : null}
            <div className="text-white">
              <p className="text-sm text-white/80">Регистрация</p>
              <h1 className="font-heading text-2xl font-semibold md:text-3xl">{eventTitle}</h1>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 md:grid-cols-2 md:px-6">
        {/* Tier card */}
        {tierName ? (
          <motion.section
            {...fadeUp}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
          >
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: `${tierColor}15`,
                color: tierColor,
                border: `1px solid ${tierColor}30`,
              }}
            >
              <StarIcon size={14} />
              {tierName}
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-[var(--brand)]">
              Что включено
            </h2>
            {privileges.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {privileges.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : tierDesc ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{tierDesc}</p>
            ) : null}
          </motion.section>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Form */}
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
        >
          <h2 className="font-heading text-lg font-semibold text-[var(--brand)]">
            Ваши данные
          </h2>
          <div className="mt-6 space-y-4">
            <div>
              <Label className="text-[var(--text)]">Email *</Label>
              <Input
                className="mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[var(--text)]">Имя *</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-[var(--text)]">Телефон</Label>
              <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-[var(--text)]">Страна</Label>
              <Select value={country} onValueChange={(v) => v && setCountry(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите страну" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--text)]">Город</Label>
              <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label className="text-[var(--text)]">Язык интерфейса</Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_VISITOR_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <GuideButton className="w-full" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Регистрация…' : 'Зарегистрироваться'}
            </GuideButton>
            {message ? (
              <p className="text-sm text-[var(--error)]">{message}</p>
            ) : null}
          </div>
        </motion.section>
      </div>
    </div>
  )
}
