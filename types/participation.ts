import type { HubEventRow } from '@/types/hub-event'

export type ParticipationRow = {
  id: string
  event_id: string
  tenant_id: string | null
  invited_email: string | null
  access_code: string
  status: 'pending' | 'confirmed' | 'rejected'
  joined_at: string | null
  created_at: string
  tenant?: { id: string; name: string; slug: string } | null
  stand?:
    | { id: string; stand_number: string; pavilion: string; floor: number }[]
    | { id: string; stand_number: string; pavilion: string; floor: number }
    | null
}

export type HubEventWithCount = HubEventRow & {
  participants_count?: number
}
