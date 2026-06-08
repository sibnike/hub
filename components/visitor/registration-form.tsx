'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getI18nText } from '@/lib/i18n/get-text'
import { COUNTRY_OPTIONS, SUPPORTED_VISITOR_LANGUAGES } from '@/lib/visitor/locales'
import type { HubEventRow } from '@/types/hub-event'
import type { EventInvitationRow } from '@/types/visitor'
import { Badge } from '@/components/ui/badge'

type RegistrationFormProps = {
  event: HubEventRow
  invitation: EventInvitationRow
  inviteToken: string
}

export function RegistrationForm({ event, invitation, inviteToken }: RegistrationFormProps) {
  const router = useRouter()
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
      <div className="container max-w-md py-12">
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <h1 className="text-xl font-semibold">Проверьте почту</h1>
            <p className="text-sm text-muted-foreground">
              Мы отправили ссылку для подтверждения на <strong>{email}</strong>
            </p>
            <Button variant="outline" onClick={() => void resendEmail()} disabled={busy}>
              Отправить заново
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-lg py-8">
      <Card>
        <CardHeader>
          <CardTitle>Регистрация — {eventTitle}</CardTitle>
          {tierName ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge
                style={{
                  backgroundColor: invitation.tier?.color ?? 'var(--event-accent, #4f46e5)',
                  color: '#fff',
                }}
              >
                {tierName}
              </Badge>
              {tierDesc ? (
                <p className="text-sm text-muted-foreground">{tierDesc}</p>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email *</Label>
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Имя *</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Страна</Label>
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
            <Label>Город</Label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>Язык интерфейса</Label>
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
          <Button
            className="w-full"
            style={{ backgroundColor: 'var(--event-accent)' }}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Регистрация…' : 'Зарегистрироваться'}
          </Button>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
