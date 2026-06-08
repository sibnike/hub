'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import type { EventVisitorRow, VisitorTierRow } from '@/types/visitor'

export function VisitorListPanel({ eventSlug }: { eventSlug: string }) {
  const [visitors, setVisitors] = useState<EventVisitorRow[]>([])
  const [tiers, setTiers] = useState<VisitorTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (tierFilter !== 'all') params.set('tier_id', tierFilter)
      if (search.trim()) params.set('q', search.trim())

      const [visRes, tierRes] = await Promise.all([
        fetch(`/api/organizer/events/${eventSlug}/visitors?${params}`),
        fetch(`/api/organizer/events/${eventSlug}/tiers`),
      ])
      const visJson = (await visRes.json()) as { data?: EventVisitorRow[] }
      const tierJson = (await tierRes.json()) as { data?: VisitorTierRow[] }
      setVisitors(visJson.data ?? [])
      setTiers(tierJson.data ?? [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [eventSlug, tierFilter, search])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 300)
    return () => window.clearTimeout(t)
  }, [load])

  async function changeTier(visitorId: string, tierId: string) {
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/visitors/${visitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: tierId || null }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function deleteVisitor(visitorId: string) {
    if (!confirm('Удалить посетителя?')) return
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/visitors/${visitorId}`, {
        method: 'DELETE',
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function addBonus(visitorId: string) {
    const amountStr = prompt('Сколько баллов начислить?')
    if (!amountStr) return
    const amount = parseInt(amountStr, 10)
    if (!amount) return
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/visitors/${visitorId}/bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: 'manual' }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading && visitors.length === 0) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Зарегистрированные посетители ({visitors.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>Поиск</Label>
            <Input
              className="mt-1"
              placeholder="Имя или email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Label>Фильтр по tier</Label>
            <Select value={tierFilter} onValueChange={(v) => v && setTierFilter(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {tiers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name.ru ?? t.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет посетителей</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Имя</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">Баланс</th>
                  <th className="py-2 pr-3">Дата</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{v.name}</td>
                    <td className="py-2 pr-3">{v.email}</td>
                    <td className="py-2 pr-3">
                      <Select
                        value={v.tier_id ?? ''}
                        onValueChange={(tid) => void changeTier(v.id, tid ?? '')}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          {tiers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name.ru ?? t.slug}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">{v.bonus_balance}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString('ru')}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => void addBonus(v.id)} disabled={busy}>
                          +баллы
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => void deleteVisitor(v.id)}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
