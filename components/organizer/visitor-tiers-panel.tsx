'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VisitorTierRow } from '@/types/visitor'

export function VisitorTiersPanel({ eventSlug }: { eventSlug: string }) {
  const [tiers, setTiers] = useState<VisitorTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [slug, setSlug] = useState('')
  const [nameRu, setNameRu] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [descRu, setDescRu] = useState('')
  const [color, setColor] = useState('#4f46e5')
  const [welcomeBonus, setWelcomeBonus] = useState('0')
  const [isDefault, setIsDefault] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/tiers`)
      const json = (await res.json()) as { data?: VisitorTierRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setTiers(json.data ?? [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function createTier() {
    if (!slug.trim() || !nameRu.trim()) {
      setMessage('Укажите slug и название')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          name: { ru: nameRu.trim(), en: nameEn.trim() || nameRu.trim() },
          description: descRu.trim() ? { ru: descRu.trim() } : undefined,
          color,
          welcome_bonus: parseInt(welcomeBonus, 10) || 0,
          is_default: isDefault,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setSlug('')
      setNameRu('')
      setNameEn('')
      setDescRu('')
      setWelcomeBonus('0')
      setIsDefault(false)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function removeTier(id: string) {
    if (!confirm('Удалить tier?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/tiers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Ошибка')
      }
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Типы посетителей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет tier&apos;ов</p>
          ) : (
            <ul className="space-y-2">
              {tiers.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: t.color ?? '#4f46e5' }}
                    />
                    <span className="font-medium">{t.name.ru ?? t.slug}</span>
                    <span className="text-muted-foreground font-mono text-xs">{t.slug}</span>
                    <span className="text-muted-foreground">+{t.welcome_bonus}б</span>
                    {t.is_default ? (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">default</span>
                    ) : null}
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void removeTier(t.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Новый tier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Slug</Label>
              <Input className="mt-1 font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="vip" />
            </div>
            <div>
              <Label>Цвет</Label>
              <Input className="mt-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Название (RU)</Label>
            <Input className="mt-1" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          </div>
          <div>
            <Label>Название (EN)</Label>
            <Input className="mt-1" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div>
            <Label>Описание привилегий (RU)</Label>
            <Input className="mt-1" value={descRu} onChange={(e) => setDescRu(e.target.value)} />
          </div>
          <div>
            <Label>Приветственный бонус</Label>
            <Input className="mt-1 w-32" type="number" value={welcomeBonus} onChange={(e) => setWelcomeBonus(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Tier по умолчанию
          </label>
          <Button onClick={() => void createTier()} disabled={busy}>
            Создать
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
