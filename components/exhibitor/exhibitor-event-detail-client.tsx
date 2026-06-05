'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExhibitorAnalyticsPanel } from '@/components/exhibitor/exhibitor-analytics-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'

type Detail = {
  tenant_id?: string | null
  event?: { slug: string; name: Record<string, string>; dates: string | null }
  stand?:
    | { stand_number: string; pavilion: string; floor: number }[]
    | { stand_number: string; pavilion: string; floor: number }
    | null
}

export function ExhibitorEventDetailClient({ slug }: { slug: string }) {
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/exhibitor/events')
      const json = (await res.json()) as { data?: (Detail & { event?: { slug: string } })[] }
      const found = (json.data ?? []).find((d) => d.event?.slug === slug) ?? null
      setItem(found)
      setLoading(false)
    })()
  }, [slug])

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>
  if (!item?.event) return <p className="text-sm text-destructive">Участие не найдено</p>

  const stand = Array.isArray(item.stand) ? item.stand[0] : item.stand
  const title = item.event.name?.ru ?? item.event.name?.en ?? slug
  const tenantId = item.tenant_id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/exhibitor/events" className="text-sm text-primary hover:underline">
        ← Мои выставки
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Мой стенд</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Даты: {formatDateRangeLabel(item.event.dates)}</p>
          {stand ? (
            <>
              <p>Номер: {stand.stand_number ?? '—'}</p>
              <p>Павильон: {stand.pavilion ?? '—'}</p>
              <p>Этаж: {stand.floor ?? 1}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Стенд не назначен</p>
          )}
        </CardContent>
      </Card>

      {tenantId ? (
        <Card>
          <CardContent className="pt-6">
            <ExhibitorAnalyticsPanel eventSlug={slug} tenantId={tenantId} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Аналитика доступна после подтверждения участия
          </CardContent>
        </Card>
      )}
    </div>
  )
}
