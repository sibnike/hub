'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ParticipantsPanel } from '@/components/organizer/participants-panel'
import { parseDateRange } from '@/lib/hub/event-dates'
import type { HubEventRow } from '@/types/hub-event'

export function EventManageClient({ slug }: { slug: string }) {
  const [event, setEvent] = useState<HubEventRow | null>(null)
  const [nameRu, setNameRu] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<HubEventRow['status']>('draft')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/organizer/events/${slug}`)
        const json = (await res.json()) as { data?: HubEventRow; error?: string }
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Не найдено')
        const e = json.data
        setEvent(e)
        setNameRu(e.name.ru ?? '')
        setNameEn(e.name.en ?? '')
        const dates = parseDateRange(e.dates)
        setDateFrom(dates?.start ?? '')
        setDateTo(dates?.end ?? '')
        setCity(e.location?.city ?? '')
        setAddress(e.location?.address ?? '')
        setStatus(e.status)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Ошибка')
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  async function save() {
    if (!event) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: { ru: nameRu.trim(), en: nameEn.trim() },
          dates: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
          location: { city: city.trim() || undefined, address: address.trim() || undefined },
          status,
        }),
      })
      const json = (await res.json()) as { data?: HubEventRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка сохранения')
      if (json.data) setEvent(json.data)
      setMessage('Сохранено')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish() {
    if (!event) return
    const next = event.status === 'published' ? 'draft' : 'published'
    setStatus(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/organizer/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = (await res.json()) as { data?: HubEventRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data) {
        setEvent(json.data)
        setStatus(json.data.status)
      }
      setMessage(next === 'published' ? 'Опубликовано' : 'Снято с публикации')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>
  if (!event) return <p className="text-sm text-destructive">{message ?? 'Не найдено'}</p>

  const title = event.name.ru ?? event.name.en ?? event.slug

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground font-mono">{event.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void togglePublish()} disabled={saving}>
            {event.status === 'published' ? 'Снять с публикации' : 'Опубликовать'}
          </Button>
          <Link href="/organizer/events" className="text-sm text-primary hover:underline self-center">
            К списку
          </Link>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Общее</TabsTrigger>
          <TabsTrigger value="participants">Участники</TabsTrigger>
          <TabsTrigger value="map">Карта</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
          <TabsTrigger value="visitors">Посетители</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Настройки события</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Название (RU)</Label>
                <Input className="mt-1" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
              </div>
              <div>
                <Label>Название (EN)</Label>
                <Input className="mt-1" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Дата начала</Label>
                  <Input type="date" className="mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Дата окончания</Label>
                  <Input type="date" className="mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Город</Label>
                <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>Адрес</Label>
                <Input className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="mt-4">
          <ParticipantsPanel event={event} eventSlug={slug} />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Загрузите SVG-схему павильона и расставьте стенды участников.
              </p>
              <Link
                href={`/organizer/events/${slug}/map`}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Открыть редактор карты
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Просмотры каталога, карты, профилей и сканирования QR.
              </p>
              <Link
                href={`/organizer/events/${slug}/analytics`}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Открыть аналитику
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embed" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Iframe, виджет-скрипт и настройки кастомного домена.
              </p>
              <Link
                href={`/organizer/events/${slug}/embed`}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Настроить встраивание
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitors" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Гайд посетителя: tier&apos;ы, приглашения, регистрация, опросы и бонусы.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/organizer/events/${slug}/visitors`}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                  Список посетителей
                </Link>
                <Link
                  href={`/organizer/events/${slug}/visitors/tiers`}
                  className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
                >
                  Tier&apos;ы
                </Link>
                <Link
                  href={`/organizer/events/${slug}/visitors/invitations`}
                  className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
                >
                  Приглашения
                </Link>
                <Link
                  href={`/organizer/events/${slug}/polls`}
                  className="inline-flex h-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium hover:bg-muted"
                >
                  Опросы
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
