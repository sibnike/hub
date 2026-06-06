'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'yanbada_favorites'

type FavoriteRecord = {
  event_slug: string
  tenant_slug: string
  tenant_name: string
  saved_at: string
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setFavorites(JSON.parse(raw) as FavoriteRecord[])
      } catch {
        // ignore invalid JSON
      }
    }
  }, [])

  function isFavorite(eventSlug: string, tenantSlug: string) {
    return favorites.some(
      (f) => f.event_slug === eventSlug && f.tenant_slug === tenantSlug
    )
  }

  function add(rec: Omit<FavoriteRecord, 'saved_at'>) {
    const next = [
      ...favorites.filter(
        (f) => !(f.event_slug === rec.event_slug && f.tenant_slug === rec.tenant_slug)
      ),
      { ...rec, saved_at: new Date().toISOString() },
    ]
    setFavorites(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function remove(eventSlug: string, tenantSlug: string) {
    const next = favorites.filter(
      (f) => !(f.event_slug === eventSlug && f.tenant_slug === tenantSlug)
    )
    setFavorites(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return { favorites, isFavorite, add, remove }
}
