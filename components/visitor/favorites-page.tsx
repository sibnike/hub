'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CheckCircleIcon,
  ClockIcon,
  CloseIcon,
  HeartIcon,
} from '@/components/icons'
import { EmptyState } from '@/components/design/empty-state'
import { GuideButton } from '@/components/design/guide-buttons'
import { HeroBanner } from '@/components/design/hero-banner'
import { ParticipantCardSkeletonGrid } from '@/components/design/participant-card-skeleton'
import { fadeUp, stagger } from '@/lib/design/animations'
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import { cn } from '@/lib/utils'
import type { CatalogParticipant } from '@/types/catalog'
import type { VisitorFavoriteRow } from '@/types/visitor'

const STATUS_ORDER = { planned: 0, met: 1, skipped: 2 } as const

type StatusFilter = 'all' | VisitorFavoriteRow['status']

const STATUS_LABELS: Record<VisitorFavoriteRow['status'], string> = {
  planned: 'Запланировано',
  met: 'Встретился',
  skipped: 'Пропустил',
}

const STATUS_COLORS: Record<VisitorFavoriteRow['status'], string> = {
  planned: 'var(--info)',
  met: 'var(--success)',
  skipped: 'var(--muted)',
}

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'planned', label: 'Запланировано' },
  { key: 'met', label: 'Встретился' },
  { key: 'skipped', label: 'Пропустил' },
]

type FavoritesPageProps = {
  eventId: string
  eventSlug: string
  participations: CatalogParticipant[]
}

export function FavoritesPage({ eventId, eventSlug, participations }: FavoritesPageProps) {
  const { favorites, loading, updateStatus } = useVisitorFavorites(eventId)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

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

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return sorted
    return sorted.filter((f) => f.status === statusFilter)
  }, [sorted, statusFilter])

  if (loading) {
    return (
      <div>
        <HeroBanner title="Избранное" subtitle="Загрузка…" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3 md:px-6">
          <ParticipantCardSkeletonGrid count={6} />
        </div>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div>
        <HeroBanner title="Избранное" subtitle="0 компаний" />
        <EmptyState
          icon={HeartIcon}
          title="Пока никого не добавили в избранное"
          description="Откройте каталог, найдите интересные компании и нажмите на сердечко."
          actionLabel="Перейти в каталог"
          actionHref={`/e/${eventSlug}/guide/catalog`}
        />
      </div>
    )
  }

  return (
    <div>
      <HeroBanner title="Избранное" subtitle={`${sorted.length} компаний`}>
        <span title="Скоро">
          <GuideButton disabled variant="secondary" className="text-sm">
            Экспортировать контакты
          </GuideButton>
        </span>
      </HeroBanner>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition',
                statusFilter === tab.key
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={HeartIcon}
            title="Нет компаний с таким статусом"
            description="Выберите другой фильтр или добавьте компании в избранное."
            actionLabel="Перейти в каталог"
            actionHref={`/e/${eventSlug}/guide/catalog`}
          />
        ) : (
          <motion.div {...stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((fav) => {
              const p = byTenant.get(fav.tenant_id)
              if (!p) return null
              const name = p.cache.name ?? p.tenant_slug
              const statusColor = STATUS_COLORS[fav.status]

              return (
                <motion.div
                  key={fav.id}
                  {...fadeUp}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
                >
                  <div className="relative flex h-32 items-center justify-center bg-[var(--surface2)]">
                    {p.cache.logo_url ? (
                      <Image
                        src={p.cache.logo_url}
                        alt=""
                        width={120}
                        height={64}
                        className="max-h-16 max-w-[60%] object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="font-heading text-xl font-semibold text-[var(--subtle)]">
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span
                      className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        color: statusColor,
                        border: `1px solid ${statusColor}30`,
                      }}
                    >
                      {STATUS_LABELS[fav.status]}
                    </span>
                  </div>

                  <div className="space-y-3 p-5">
                    <Link
                      href={`/e/${eventSlug}/guide/company/${p.tenant_slug}`}
                      className="font-heading text-lg font-semibold text-[var(--brand)] hover:text-[var(--accent)]"
                    >
                      {name}
                    </Link>

                    <div className="flex gap-1">
                      {(['planned', 'met', 'skipped'] as const).map((status) => {
                        const icons = {
                          planned: ClockIcon,
                          met: CheckCircleIcon,
                          skipped: CloseIcon,
                        }
                        const Icon = icons[status]
                        const active = fav.status === status
                        return (
                          <button
                            key={status}
                            type="button"
                            title={STATUS_LABELS[status]}
                            onClick={() =>
                              void updateStatus(fav.tenant_id, status, fav.note ?? undefined)
                            }
                            className={cn(
                              'flex flex-1 items-center justify-center rounded-lg border py-2 transition',
                              active
                                ? 'border-[var(--accent)] bg-[var(--surface2)] text-[var(--accent)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)]'
                            )}
                          >
                            <Icon size={18} />
                          </button>
                        )
                      })}
                    </div>

                    {expandedNote === fav.id ? (
                      <textarea
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                        placeholder="Заметка…"
                        defaultValue={fav.note ?? ''}
                        rows={2}
                        onBlur={(e) => {
                          const note = e.target.value.trim()
                          if (note !== (fav.note ?? '')) {
                            void updateStatus(fav.tenant_id, fav.status, note || undefined)
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedNote(fav.id)}
                        className="text-sm text-[var(--accent)] hover:opacity-80"
                      >
                        {fav.note ? 'Редактировать заметку' : 'Добавить заметку'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}
