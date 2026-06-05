'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { cn } from '@/lib/utils'
import type { HubEventWithCount } from '@/types/participation'

const STATUS_LABELS = {
  draft: 'Черновик',
  published: 'Опубликовано',
  archived: 'Архив',
} as const

function eventTitle(event: HubEventWithCount): string {
  return event.name.ru ?? event.name.en ?? Object.values(event.name)[0] ?? event.slug
}

export function EventsListClient({ activeTenantId }: { activeTenantId: string }) {
  const [events, setEvents] = useState<HubEventWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizer/events?organizer_tenant_id=${activeTenantId}`
        )
        const json = (await res.json()) as {
          data?: HubEventWithCount[]
          error?: string
        }
        if (!res.ok) throw new Error(json.error ?? 'Ошибка загрузки')
        setEvents(json.data ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        setLoading(false)
      }
    })()
  }, [activeTenantId])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">События</h1>
        <Link
          href="/organizer/events/new"
          className={cn(buttonVariants(), 'inline-flex items-center gap-1')}
        >
          <Plus className="h-4 w-4" />
          Создать событие
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Событий пока нет.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/organizer/events/${event.slug}`}
                      className="hover:underline"
                    >
                      {eventTitle(event)}
                    </Link>
                  </CardTitle>
                  <Badge
                    variant={event.status === 'published' ? 'default' : 'secondary'}
                  >
                    {STATUS_LABELS[event.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>Даты: {formatDateRangeLabel(event.dates)}</p>
                <p>Участников: {event.participants_count ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
