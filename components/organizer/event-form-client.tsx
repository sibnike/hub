'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidEventSlug, slugFromTitle } from '@/lib/hub/slug-from-title'

export function EventFormClient({ organizerTenantId }: { organizerTenantId: string }) {
  const router = useRouter()
  const [nameRu, setNameRu] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onNameRuChange(value: string) {
    setNameRu(value)
    if (!slugTouched) setSlug(slugFromTitle(value))
  }

  async function create() {
    setSaving(true)
    setError(null)
    try {
      if (!isValidEventSlug(slug)) throw new Error('Slug: только a-z, 0-9 и дефис')
      if (!nameRu.trim()) throw new Error('Укажите название на русском')

      const res = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizer_tenant_id: organizerTenantId,
          slug,
          name: { ru: nameRu.trim(), en: nameEn.trim() },
          dates: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
          location: { city: city.trim() || undefined, address: address.trim() || undefined },
        }),
      })
      const json = (await res.json()) as { data?: { slug: string }; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Не удалось создать')
      router.push(`/organizer/events/${json.data?.slug ?? slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Новое событие</h1>
        <Link href="/organizer/events" className="text-sm text-primary hover:underline">
          Назад
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Основное</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Slug *</Label>
            <Input
              className="mt-1 font-mono"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value.toLowerCase())
              }}
            />
          </div>
          <div>
            <Label>Название (RU) *</Label>
            <Input className="mt-1" value={nameRu} onChange={(e) => onNameRuChange(e.target.value)} />
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
        </CardContent>
      </Card>
      <div className="flex items-center gap-3">
        <Button onClick={() => void create()} disabled={saving}>
          {saving ? 'Создание…' : 'Создать'}
        </Button>
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </div>
  )
}
