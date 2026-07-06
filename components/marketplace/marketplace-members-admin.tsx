'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  MarketplaceMemberStatus,
  MarketplaceMemberWithTenant,
} from '@/types/marketplace-membership'

const STATUS_LABELS: Record<MarketplaceMemberStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  suspended: 'Приостановлено',
}

type MembersAdminClientProps = {
  marketplaceSlug: string
  marketplaceName: string
}

export function MembersAdminClient({
  marketplaceSlug,
}: MembersAdminClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [members, setMembers] = useState<MarketplaceMemberWithTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
      const res = await fetch(`/api/admin/marketplace/${marketplaceSlug}/members${qs}`)
      const json = (await res.json()) as {
        error?: string
        members?: MarketplaceMemberWithTenant[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка загрузки')
        return
      }
      setMembers(json.members ?? [])
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [marketplaceSlug, statusFilter])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  async function patchMember(
    id: string,
    action: 'approve' | 'reject' | 'suspend',
    reason?: string
  ) {
    setActionLoading(id)
    try {
      const res = await fetch(
        `/api/admin/marketplace/${marketplaceSlug}/members/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            reject_reason: reason,
          }),
        }
      )
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setError(json.error ?? 'Ошибка действия')
        return
      }
      setRejectId(null)
      setRejectReason('')
      await loadMembers()
    } catch {
      setError('Ошибка сети')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-[var(--muted)]" htmlFor="status-filter">
          Статус
        </label>
        <select
          id="status-filter"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все</option>
          <option value="pending">На рассмотрении</option>
          <option value="approved">Одобрено</option>
          <option value="rejected">Отклонено</option>
          <option value="suspended">Приостановлено</option>
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}

      {!loading && members.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Заявок нет</p>
      ) : null}

      <ul className="space-y-3">
        {members.map((m) => (
          <li
            key={m.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {m.tenant?.name ?? m.tenant_id}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {STATUS_LABELS[m.status]} ·{' '}
                  {new Date(m.created_at).toLocaleDateString('ru-RU')}
                </p>
                {m.reject_reason ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{m.reject_reason}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {m.status === 'pending' ? (
                  <>
                    <Button
                      size="sm"
                      disabled={actionLoading === m.id}
                      onClick={() => void patchMember(m.id, 'approve')}
                    >
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === m.id}
                      onClick={() => {
                        setRejectId(m.id)
                        setRejectReason('')
                      }}
                    >
                      Отклонить
                    </Button>
                  </>
                ) : null}
                {m.status === 'approved' ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionLoading === m.id}
                    onClick={() => void patchMember(m.id, 'suspend', 'Доступ приостановлен')}
                  >
                    Приостановить
                  </Button>
                ) : null}
              </div>
            </div>

            {rejectId === m.id ? (
              <div className="mt-3 border-t border-border pt-3">
                <textarea
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  rows={2}
                  placeholder="Причина отклонения"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!rejectReason.trim() || actionLoading === m.id}
                    onClick={() => void patchMember(m.id, 'reject', rejectReason.trim())}
                  >
                    Подтвердить отклонение
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectId(null)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
