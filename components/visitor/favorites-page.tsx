'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import type { CatalogParticipant } from '@/types/catalog'
import { cn } from '@/lib/utils'

const STATUS_ORDER = { planned: 0, met: 1, skipped: 2 } as const

type FavoritesPageProps = {
  eventId: string
  eventSlug: string
  participations: CatalogParticipant[]
}

export function FavoritesPage({ eventId, eventSlug, participations }: FavoritesPageProps) {
  const { favorites, loading, updateStatus } = useVisitorFavorites(eventId)

  const byTenant = useMemo(
    () => new Map(participations.map((p) => [p.tenant_id, p])),
    [participations]
  )

  const sorted = useMemo(() => {
    return [...favorites].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 0
      const sb = STATUS_ORDER[b.status] ?? 0
      if (sa !== sb) return sa - sb
      return new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
    })
  }, [favorites])

  function exportContacts() {
    const met = sorted.filter((f) => f.status === 'met')
    const lines = ['company,tenant_slug']
    for (const fav of met) {
      const p = byTenant.get(fav.tenant_id)
      if (p) lines.push(`"${p.cache.name ?? p.tenant_slug}",${p.tenant_slug}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${eventSlug}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="container py-8 text-sm text-muted-foreground">Загрузка…</p>

  if (sorted.length === 0) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <p>Избранное пусто.</p>
        <Button
          className="mt-4"
          variant="outline"
          render={<Link href={`/e/${eventSlug}/guide/catalog`} />}
        >
          Перейти в каталог
        </Button>
      </div>
    )
  }

  return (
    <div className="container py-6 space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Моё избранное ({sorted.length})</h2>
        <Button variant="outline" size="sm" onClick={exportContacts}>
          Экспортировать контакты
        </Button>
      </div>

      <div className="space-y-4">
        {sorted.map((fav) => {
          const p = byTenant.get(fav.tenant_id)
          if (!p) return null
          const name = p.cache.name ?? p.tenant_slug

          return (
            <Card key={fav.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {p.cache.logo_url ? (
                      <Image src={p.cache.logo_url} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/e/${eventSlug}/guide/company/${p.tenant_slug}`}
                      className="font-medium hover:underline"
                    >
                      {name}
                    </Link>
                  </div>
                </div>

                <div className="flex gap-1">
                  {(['planned', 'met', 'skipped'] as const).map((status) => {
                    const labels = { planned: 'Планирую', met: 'Встретился', skipped: 'Пропустил' }
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateStatus(fav.tenant_id, status, fav.note ?? undefined)}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs border transition-colors',
                          fav.status === status
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        {labels[status]}
                      </button>
                    )
                  })}
                </div>

                <Input
                  placeholder="Заметка…"
                  defaultValue={fav.note ?? ''}
                  onBlur={(e) => {
                    const note = e.target.value.trim()
                    if (note !== (fav.note ?? '')) {
                      void updateStatus(fav.tenant_id, fav.status, note || undefined)
                    }
                  }}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
