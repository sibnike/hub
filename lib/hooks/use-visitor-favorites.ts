'use client'

import { useCallback, useEffect, useState } from 'react'
import type { VisitorFavoriteRow } from '@/types/visitor'

export function useVisitorFavorites(eventId: string) {
  const [favorites, setFavorites] = useState<VisitorFavoriteRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/visitor/favorites?event_id=${eventId}`)
      const json = (await res.json()) as { data?: VisitorFavoriteRow[] }
      if (res.ok) setFavorites(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  function isFavorite(tenantId: string) {
    return favorites.some((f) => f.tenant_id === tenantId)
  }

  async function toggle(tenantId: string) {
    const exists = isFavorite(tenantId)
    const res = await fetch('/api/visitor/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        tenant_id: tenantId,
        action: exists ? 'remove' : 'add',
      }),
    })
    if (res.ok) await load()
  }

  async function updateStatus(
    tenantId: string,
    status: VisitorFavoriteRow['status'],
    note?: string
  ) {
    const res = await fetch('/api/visitor/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        tenant_id: tenantId,
        action: 'update',
        status,
        note,
      }),
    })
    if (res.ok) await load()
  }

  return { favorites, loading, isFavorite, toggle, updateStatus, reload: load }
}
