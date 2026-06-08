'use client'

import { useMemo, useState } from 'react'
import { EventMap } from '@/components/public/event-map'
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import { Label } from '@/components/ui/label'
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
      <div className="container flex items-center gap-2 pt-4">
        <input
          id="fav-only"
          type="checkbox"
          checked={showOnlyFavorites}
          onChange={(e) => setShowOnlyFavorites(e.target.checked)}
          className="rounded border"
        />
        <Label htmlFor="fav-only" className="text-sm cursor-pointer">
          Показать только избранные
        </Label>
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
