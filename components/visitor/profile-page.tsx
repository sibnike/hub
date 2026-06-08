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
import { COUNTRY_OPTIONS, SUPPORTED_VISITOR_LANGUAGES } from '@/lib/visitor/locales'
import type { BonusLogRow, EventVisitorRow } from '@/types/visitor'

type ProfilePageProps = {
  eventId: string
  eventSlug: string
  visitor: EventVisitorRow
  bonusLog: BonusLogRow[]
}

function reasonLabel(reason: string): string {
  if (reason === 'welcome') return 'Приветственный бонус'
  if (reason.startsWith('poll:')) return 'Опрос'
  if (reason === 'manual') return 'Начисление организатором'
  return reason
}

export function ProfilePage({ eventId, eventSlug, visitor: initial, bonusLog }: ProfilePageProps) {
  const router = useRouter()
  const [visitor, setVisitor] = useState(initial)
  const [name, setName] = useState(visitor.name)
  const [phone, setPhone] = useState(visitor.phone ?? '')
  const [country, setCountry] = useState(visitor.country ?? '')
  const [city, setCity] = useState(visitor.city ?? '')
  const [language, setLanguage] = useState(visitor.language)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/visitor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          name: name.trim(),
          phone: phone.trim(),
          country,
          city: city.trim(),
          language,
        }),
      })
      const json = (await res.json()) as { data?: EventVisitorRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data) setVisitor(json.data)
      setMessage('Сохранено')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    await fetch('/api/visitor/logout', { method: 'POST' })
    router.push(`/e/${eventSlug}`)
  }

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Мой профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input className="mt-1" value={visitor.email} disabled />
          </div>
          <div>
            <Label>Имя</Label>
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
            <Label>Язык</Label>
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
          <p className="text-lg">
            Баланс: <strong>{visitor.bonus_balance}</strong> баллов
          </p>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История баллов</CardTitle>
        </CardHeader>
        <CardContent>
          {bonusLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет начислений</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Дата</th>
                  <th className="py-2 pr-4">Сумма</th>
                  <th className="py-2">Причина</th>
                </tr>
              </thead>
              <tbody>
                {bonusLog.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {new Date(row.created_at).toLocaleDateString('ru')}
                    </td>
                    <td className="py-2 pr-4">
                      {row.amount > 0 ? '+' : ''}
                      {row.amount}
                    </td>
                    <td className="py-2">{reasonLabel(row.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => void logout()}>
        Выйти
      </Button>
    </div>
  )
}
