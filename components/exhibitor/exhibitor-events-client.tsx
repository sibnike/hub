'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { cn } from '@/lib/utils'

type ExhibitorEventItem = {
  id: string
  status: string
  event?: {
    slug: string
    name: Record<string, string>
    dates: string | null
  } | null
  stand?: { stand_number: string; pavilion: string }[] | { stand_number: string; pavilion: string } | null
}

function eventTitle(item: ExhibitorEventItem): string {
  const e = item.event
  if (!e) return 'Событие'
  return e.name?.ru ?? e.name?.en ?? e.slug
}

function getStand(item: ExhibitorEventItem) {
  const s = item.stand
  if (!s) return null
  return Array.isArray(s) ? s[0] : s
}

export function ExhibitorEventsClient() {
  const [items, setItems] = useState<ExhibitorEventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/exhibitor/events')
      const json = (await res.json()) as { data?: ExhibitorEventItem[] }
      setItems(json.data ?? [])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Мои выставки</h1>
        <Link
          href="/exhibitor/events/join"
          className={cn(buttonVariants(), 'inline-flex items-center gap-1')}
        >
          <Plus className="h-4 w-4" />
          Подключиться
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Вы ещё не участвуете ни в одной выставке.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const stand = getStand(item)
            const slug = item.event?.slug
            return (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{eventTitle(item)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Даты: {formatDateRangeLabel(item.event?.dates ?? null)}</p>
                  {stand ? (
                    <p>
                      Стенд: {stand.stand_number}
                      {stand.pavilion ? ` · ${stand.pavilion}` : ''}
                    </p>
                  ) : null}
                  {slug ? (
                    <Link
                      href={`/exhibitor/events/${slug}`}
                      className="text-primary hover:underline"
                    >
                      Открыть →
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
