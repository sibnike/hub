'use client'

import { useMemo, useState } from 'react'
import { HeartFilledIcon, HeartIcon } from '@/components/icons'
import { HeroBanner } from '@/components/design/hero-banner'
import { EventMap } from '@/components/public/event-map'
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import { cn } from '@/lib/utils'
import type { IndustryCategory } from '@/types/catalog'
import type { EventMapRow, MapStandRow } from '@/types/map'

type GuideMapClientProps = {
  eventId: string
  eventSlug: string
  maps: EventMapRow[]
  stands: MapStandRow[]
  categories: IndustryCategory[]
  unplacedCount: number
  highlightStandId?: string | null
}

export function GuideMapClient({
  eventId,
  eventSlug,
  maps,
  stands,
  categories,
  unplacedCount,
  highlightStandId,
}: GuideMapClientProps) {
  const { favorites } = useVisitorFavorites(eventId)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  const favoriteTenantIds = useMemo(
    () => new Set(favorites.map((f) => f.tenant_id)),
    [favorites]
  )

  const filteredStands = useMemo(() => {
    if (!showOnlyFavorites) return stands
    return stands.filter((s) => s.tenant_id != null && favoriteTenantIds.has(s.tenant_id))
  }, [stands, showOnlyFavorites, favoriteTenantIds])

  return (
    <div className="space-y-3">
      <HeroBanner title="Карта выставки" subtitle={`${stands.length} стендов`} />

      <div className="container flex items-center gap-3 px-4 pt-2 md:px-6">
        <button
          type="button"
          onClick={() => setShowOnlyFavorites((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition',
            showOnlyFavorites
              ? 'border-[var(--accent)] bg-[var(--surface2)] text-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface2)]'
          )}
        >
          {showOnlyFavorites ? (
            <HeartFilledIcon size={18} className="text-[var(--accent)]" />
          ) : (
            <HeartIcon size={18} />
          )}
          Только избранные
        </button>
      </div>

      <EventMap
        eventSlug={eventSlug}
        maps={maps}
        stands={filteredStands}
        categories={categories}
        unplacedCount={unplacedCount}
        highlightStandId={highlightStandId}
        favoriteTenantIds={favoriteTenantIds}
        guideMode
        guideBasePath={`/e/${eventSlug}/guide`}
      />
    </div>
  )
}
