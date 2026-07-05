'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MarketplaceRequestListItem } from '@/types/marketplace-request'

type MarketplaceMyRequestsProps = {
  marketplaceSlug: string
}

function statusLabel(status: string): string {
  switch (status) {
    case 'accepted':
      return 'Принято'
    case 'declined':
      return 'Отклонено'
    case 'expired':
      return 'Истекло'
    default:
      return 'Ожидание'
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'accepted':
      return 'text-[var(--accent)]'
    case 'declined':
      return 'text-destructive'
    default:
      return 'text-[var(--muted)]'
  }
}

export function MarketplaceMyRequests({ marketplaceSlug }: MarketplaceMyRequestsProps) {
  const [requests, setRequests] = useState<MarketplaceRequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplaceSlug}/requests`)
      const json = (await res.json()) as {
        error?: string
        requests?: MarketplaceRequestListItem[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Не удалось загрузить запросы')
        return
      }
      setRequests(json.requests ?? [])
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [marketplaceSlug])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Загрузка запросов…</p>
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    )
  }

  if (!requests.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Вы ещё не отправляли запросы через маркетплейс.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Мои запросы</h2>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Обновить
        </Button>
      </div>

      <ul className="space-y-4">
        {requests.map((request) => (
          <li
            key={request.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{request.request_text}</p>
                {request.budget_amount != null ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Бюджет: {request.budget_amount.toLocaleString('ru-RU')}{' '}
                    {request.budget_currency ?? 'KZT'}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {new Date(request.created_at).toLocaleString('ru-RU')}
                </p>
              </div>
            </div>

            {request.targets.length ? (
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {request.targets.map((target) => (
                  <li
                    key={target.id}
                    className="flex flex-wrap items-start justify-between gap-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {target.tenant_name ?? target.tenant_slug ?? target.tenant_id}
                      </span>
                      <span className={cn('ml-2', statusClass(target.response_status))}>
                        {statusLabel(target.response_status)}
                      </span>
                      {target.response_message ? (
                        <p className="mt-1 text-[var(--muted)]">{target.response_message}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
