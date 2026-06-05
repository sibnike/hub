'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Mail, Printer, Trash2, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { generateAccessCode } from '@/lib/access-code'
import { parseParticipantsCsv } from '@/lib/hub/parse-csv-participants'
import type { HubEventRow } from '@/types/hub-event'
import type { ParticipationRow } from '@/types/participation'

function getStand(part: ParticipationRow) {
  const s = part.stand
  if (!s) return null
  return Array.isArray(s) ? s[0] : s
}

function statusLabel(status: ParticipationRow['status']) {
  if (status === 'confirmed') return 'Подтверждён'
  if (status === 'rejected') return 'Отклонён'
  return 'Ожидает'
}

export function ParticipantsPanel({
  event,
  eventSlug,
}: {
  event: HubEventRow
  eventSlug: string
}) {
  const [participants, setParticipants] = useState<ParticipationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [standNumber, setStandNumber] = useState('')
  const [pavilion, setPavilion] = useState('')
  const [floor, setFloor] = useState('1')
  const [csvText, setCsvText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/participants`)
      const json = (await res.json()) as { data?: ParticipationRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setParticipants(json.data ?? [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function addParticipants(rows: {
    email: string
    stand_number?: string
    pavilion?: string
    floor?: number
  }[]) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants: rows }),
      })
      const json = (await res.json()) as {
        results?: { email: string; code: string; status: string; error?: string }[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      const created = json.results?.filter((r) => r.status === 'created').length ?? 0
      setMessage(`Добавлено: ${created}`)
      setAddOpen(false)
      setCsvOpen(false)
      setEmail('')
      setStandNumber('')
      setPavilion('')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  function plainCode(part: ParticipationRow): string | null {
    if (!part.invited_email) return null
    return generateAccessCode(event.id, part.invited_email, event.access_code_salt)
  }

  async function copyCode(part: ParticipationRow) {
    const code = plainCode(part)
    if (!code) return
    await navigator.clipboard.writeText(code)
    setMessage(`Код скопирован: ${code}`)
  }

  async function resend(part: ParticipationRow) {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/participants/${part.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resend' }),
        }
      )
      if (!res.ok) throw new Error('Не удалось отправить')
      setMessage('Приглашение отправлено повторно')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function remove(part: ParticipationRow) {
    if (!window.confirm(`Удалить ${part.invited_email ?? 'участника'}?`)) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/participants/${part.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Не удалось удалить')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={busy}>
          <UserPlus className="h-4 w-4 mr-1" />
          Добавить участника
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)} disabled={busy}>
          <Upload className="h-4 w-4 mr-1" />
          Загрузить CSV
        </Button>
        <Link
          href={`/organizer/events/${eventSlug}/qr`}
          className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
        >
          <Printer className="h-3.5 w-3.5" />
          Печать QR-кодов
        </Link>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Участников пока нет</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Стенд</th>
                <th className="py-2 pr-3">Павильон</th>
                <th className="py-2 pr-3">Код</th>
                <th className="py-2 pr-3">QR</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((part) => {
                const stand = getStand(part)
                const code = plainCode(part)
                return (
                  <tr key={part.id} className="border-b">
                    <td className="py-2 pr-3">{part.invited_email ?? part.tenant?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{stand?.stand_number ?? '—'}</td>
                    <td className="py-2 pr-3">{stand?.pavilion ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{code ?? '—'}</td>
                    <td className="py-2 pr-3">
                      {stand?.id ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/organizer/events/${eventSlug}/qr/${stand.id}`}
                          alt="QR"
                          width={40}
                          height={40}
                          className="rounded border"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-3">{statusLabel(part.status)}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        {code ? (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => void copyCode(part)}
                            title="Скопировать код"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {part.invited_email ? (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => void resend(part)}
                            title="Отправить повторно"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => void remove(part)}
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Добавить участника</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Email</Label>
              <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Стенд</Label>
              <Input className="mt-1" value={standNumber} onChange={(e) => setStandNumber(e.target.value)} />
            </div>
            <div>
              <Label>Павильон</Label>
              <Input className="mt-1" value={pavilion} onChange={(e) => setPavilion(e.target.value)} />
            </div>
            <div>
              <Label>Этаж</Label>
              <Input className="mt-1" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <Button
              disabled={busy || !email}
              onClick={() =>
                void addParticipants([
                  {
                    email,
                    stand_number: standNumber || undefined,
                    pavilion: pavilion || undefined,
                    floor: parseInt(floor, 10) || 1,
                  },
                ])
              }
            >
              Добавить
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={csvOpen} onOpenChange={setCsvOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Загрузить CSV</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Формат: email,stand_number,pavilion,floor
            </p>
            <Textarea
              rows={10}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="email,stand_number,pavilion,floor&#10;ivan@epson.com,A-101,Hall 1,1"
            />
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => setCsvText(String(reader.result ?? ''))
                reader.readAsText(file, 'UTF-8')
              }}
            />
            <Button
              disabled={busy || !csvText.trim()}
              onClick={() => void addParticipants(parseParticipantsCsv(csvText))}
            >
              Импортировать
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
