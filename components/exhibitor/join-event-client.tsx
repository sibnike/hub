'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function JoinEventClient({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [eventSlug, setEventSlug] = useState(searchParams.get('event') ?? '')
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exhibitor/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_slug: eventSlug.trim(),
          access_code: code.trim(),
          tenant_id: tenantId,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Не удалось подключиться')
      router.push(`/exhibitor/events/${eventSlug.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Подключиться к выставке</h1>
      <Card>
        <CardHeader>
          <CardTitle>Код доступа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Slug выставки</Label>
            <Input
              className="mt-1 font-mono"
              value={eventSlug}
              onChange={(e) => setEventSlug(e.target.value)}
              placeholder="digitalbridge-2025"
            />
          </div>
          <div>
            <Label>Код доступа</Label>
            <Input
              className="mt-1 font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="AB12CD34"
            />
          </div>
          <Button onClick={() => void join()} disabled={loading || !eventSlug || !code}>
            {loading ? 'Подключение…' : 'Подключиться'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
      <Link href="/exhibitor/events" className="text-sm text-primary hover:underline">
        ← Мои выставки
      </Link>
    </div>
  )
}
