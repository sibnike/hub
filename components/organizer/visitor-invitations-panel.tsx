'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
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
import type { EventInvitationRow, VisitorTierRow } from '@/types/visitor'

type InvitationWithUrl = EventInvitationRow & { invite_url: string }

export function VisitorInvitationsPanel({ eventSlug }: { eventSlug: string }) {
  const [invitations, setInvitations] = useState<InvitationWithUrl[]>([])
  const [tiers, setTiers] = useState<VisitorTierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tierId, setTierId] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, tierRes] = await Promise.all([
        fetch(`/api/organizer/events/${eventSlug}/invitations`),
        fetch(`/api/organizer/events/${eventSlug}/tiers`),
      ])
      const invJson = (await invRes.json()) as { data?: InvitationWithUrl[] }
      const tierJson = (await tierRes.json()) as { data?: VisitorTierRow[] }
      setInvitations(invJson.data ?? [])
      setTiers(tierJson.data ?? [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function createInvitation() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: tierId || undefined, name: name.trim() || undefined }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setName('')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/invitations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !isActive }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url)
    setMessage('Ссылка скопирована')
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Приглашения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет приглашений</p>
          ) : (
            <ul className="space-y-3">
              {invitations.map((inv) => (
                <li key={inv.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{inv.name ?? 'Без названия'}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.tier?.name?.ru ?? 'Без tier'} · {inv.uses_count} регистраций
                        {!inv.is_active ? ' · деактивировано' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => copyUrl(inv.invite_url)}>
                        <Copy className="h-3 w-3 mr-1" />
                        Копировать
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleActive(inv.id, inv.is_active)}
                        disabled={busy}
                      >
                        {inv.is_active ? 'Деактивировать' : 'Активировать'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground break-all">{inv.invite_url}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Новое приглашение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tier</Label>
            <Select value={tierId} onValueChange={(v) => v && setTierId(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите tier" />
              </SelectTrigger>
              <SelectContent>
                {tiers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name.ru ?? t.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Название (для админа)</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Рассылка VIP" />
          </div>
          <Button onClick={() => void createInvitation()} disabled={busy}>
            Создать ссылку
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
