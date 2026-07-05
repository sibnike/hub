'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CityGuideIcon } from '@/components/icons/CityGuideIcon'
import { ArrowLeftIcon } from '@/components/icons/ArrowLeftIcon'
import { getI18nText } from '@/lib/i18n/get-text'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type { MarketplaceMemberRow } from '@/types/marketplace-membership'
import type { OrganizerTenant } from '@/types/hub-event'

type MarketplaceMembershipGateProps = {
  marketplace: HubMarketplace
  tenant: OrganizerTenant
  membership: MarketplaceMemberRow | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function MarketplaceMembershipGate({
  marketplace,
  tenant,
  membership,
}: MarketplaceMembershipGateProps) {
  const title = getI18nText(marketplace.name, 'ru', marketplace.slug)
  const description = getI18nText(marketplace.description, 'ru')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localMembership, setLocalMembership] = useState(membership)

  async function submitRequest() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/membership/request`, {
        method: 'POST',
      })
      const json = (await res.json()) as {
        error?: string
        membership?: MarketplaceMemberRow
      }
      if (!res.ok) {
        if (res.status === 409 && json.membership) {
          setLocalMembership(json.membership)
        }
        setError(json.error ?? 'Не удалось отправить заявку')
        return
      }
      if (json.membership) setLocalMembership(json.membership)
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  const status = localMembership?.status ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <Link
        href="/marketplace"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon size={16} />
        Yanbada Marketplace
      </Link>

      <header className="mb-10">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <CityGuideIcon size={24} />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-[var(--muted)]">
          Тенант: <span className="text-foreground">{tenant.name}</span>
        </p>
      </header>

      <GateCard
        status={status}
        membership={localMembership}
        loading={loading}
        error={error}
        onSubmit={() => void submitRequest()}
      />
    </div>
  )
}

function GateCard({
  status,
  membership,
  loading,
  error,
  onSubmit,
}: {
  status: string | null
  membership: MarketplaceMemberRow | null
  loading: boolean
  error: string | null
  onSubmit: () => void
}) {
  if (!status) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-foreground">Подать заявку на доступ</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Маркетплейс доступен участникам по заявке. Отправьте запрос — платформа рассмотрит его
          в ближайшее время.
        </p>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-4" onClick={onSubmit} disabled={loading}>
          {loading ? 'Отправка…' : 'Подать заявку'}
        </Button>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-foreground">Заявка на рассмотрении</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Ваша заявка принята
          {membership?.created_at ? ` ${formatDate(membership.created_at)}` : ''}. Ожидайте
          решения платформы.
        </p>
      </div>
    )
  }

  if (status === 'rejected' || status === 'suspended') {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-foreground">Доступ отклонён</p>
        {membership?.reject_reason ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {membership.reject_reason}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Доступ к маркетплейсу недоступен для вашего тенанта.
          </p>
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-4" variant="outline" onClick={onSubmit} disabled={loading}>
          {loading ? 'Отправка…' : 'Подать повторно'}
        </Button>
      </div>
    )
  }

  return null
}
