'use client'

import { useEffect } from 'react'
import { useEmbed } from '@/lib/embed/context'
import type { TrackSource, TrackType } from '@/types/analytics'

function getSessionId(): string {
  let id = sessionStorage.getItem('hub_session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('hub_session_id', id)
  }
  return id
}

export interface TrackPayload {
  event_slug: string
  tenant_id?: string
  type: TrackType
  source?: TrackSource
}

const VIEW_TYPES = ['profile_view', 'catalog_view', 'map_view']

export function useTrack(payload: TrackPayload | null) {
  const { embed, track: trackEnabled } = useEmbed()

  useEffect(() => {
    if (!payload) return
    if (embed && !trackEnabled && VIEW_TYPES.includes(payload.type)) return

    const key = `tracked_${payload.type}_${payload.event_slug}_${payload.tenant_id ?? 'event'}`
    if (VIEW_TYPES.includes(payload.type)) {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, session_id: getSessionId() }),
    }).catch(() => {})
  }, [payload, embed, trackEnabled])
}

export function trackEvent(payload: TrackPayload) {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const embed = params.get('embed') === '1'
    const trackEnabled = params.get('track') === '1'
    if (embed && !trackEnabled && VIEW_TYPES.includes(payload.type)) return
  }

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, session_id: getSessionId() }),
  }).catch(() => {})
}
