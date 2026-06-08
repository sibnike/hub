'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BonusIcon, EditIcon, LogoutIcon } from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'
import { HeroBanner } from '@/components/design/hero-banner'
import { fadeUp } from '@/lib/design/animations'
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
  const [editing, setEditing] = useState(false)
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
      setEditing(false)
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
    <div>
      <HeroBanner title="Профиль" subtitle={visitor.email} />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-6">
        {/* User card */}
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-semibold text-[var(--brand)]">
                {visitor.name}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{visitor.email}</p>
            </div>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface2)]"
              >
                <EditIcon size={16} />
                Редактировать
              </button>
            ) : null}
          </div>

          {editing ? (
            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-[var(--text)]">Имя</Label>
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
                <Label className="text-[var(--text)]">Язык</Label>
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
              <div className="flex gap-2">
                <GuideButton onClick={() => void save()} disabled={saving}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </GuideButton>
                <GuideButton variant="secondary" onClick={() => setEditing(false)}>
                  Отмена
                </GuideButton>
              </div>
            </div>
          ) : (
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {visitor.phone ? (
                <div>
                  <dt className="text-[var(--muted)]">Телефон</dt>
                  <dd className="font-medium text-[var(--text)]">{visitor.phone}</dd>
                </div>
              ) : null}
              {visitor.country ? (
                <div>
                  <dt className="text-[var(--muted)]">Страна</dt>
                  <dd className="font-medium text-[var(--text)]">{visitor.country}</dd>
                </div>
              ) : null}
              {visitor.city ? (
                <div>
                  <dt className="text-[var(--muted)]">Город</dt>
                  <dd className="font-medium text-[var(--text)]">{visitor.city}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[var(--muted)]">Язык</dt>
                <dd className="font-medium text-[var(--text)]">
                  {SUPPORTED_VISITOR_LANGUAGES.find((l) => l.code === visitor.language)?.label ??
                    visitor.language}
                </dd>
              </div>
            </dl>
          )}
          {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
        </motion.section>

        {/* Balance card */}
        <motion.section
          {...fadeUp}
          className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-6"
        >
          <BonusIcon size={36} className="text-[var(--accent)]" />
          <div>
            <p className="font-heading text-4xl font-semibold text-[var(--brand)]">
              {visitor.bonus_balance}
            </p>
            <p className="text-sm text-[var(--muted)]">баллов на счёте</p>
          </div>
        </motion.section>

        {/* Bonus log */}
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
        >
          <h3 className="font-heading text-lg font-semibold text-[var(--brand)]">
            История начислений
          </h3>
          {bonusLog.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Пока нет начислений</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="py-2 pr-4 font-medium">Дата</th>
                    <th className="py-2 pr-4 font-medium">Сумма</th>
                    <th className="py-2 font-medium">Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusLog.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 pr-4 text-[var(--text)]">
                        {new Date(row.created_at).toLocaleDateString('ru')}
                      </td>
                      <td
                        className={`py-3 pr-4 font-medium ${row.amount > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}
                      >
                        {row.amount > 0 ? '+' : ''}
                        {row.amount}
                      </td>
                      <td className="py-3 text-[var(--muted)]">{reasonLabel(row.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        <GuideButton variant="secondary" onClick={() => void logout()} className="w-full">
          <LogoutIcon size={18} className="mr-2 inline" />
          Выйти
        </GuideButton>
      </div>
    </div>
  )
}
