import type { I18nMap } from '@/types/hub-event'

export type VisitorTierRow = {
  id: string
  event_id: string
  slug: string
  name: I18nMap
  description: I18nMap | null
  color: string | null
  welcome_bonus: number
  is_default: boolean
  sort_order: number
  created_at: string
}

export type EventInvitationRow = {
  id: string
  event_id: string
  tier_id: string | null
  invite_token: string
  name: string | null
  uses_count: number
  is_active: boolean
  created_at: string
  tier?: VisitorTierRow | null
}

export type EventVisitorRow = {
  id: string
  event_id: string
  tier_id: string | null
  invitation_id: string | null
  email: string
  name: string
  phone: string | null
  country: string | null
  city: string | null
  language: string
  session_token: string
  email_confirmed: boolean
  confirm_token: string | null
  bonus_balance: number
  created_at: string
  last_visit_at: string | null
  tier?: VisitorTierRow | null
}

export type VisitorFavoriteRow = {
  id: string
  visitor_id: string
  tenant_id: string
  status: 'planned' | 'met' | 'skipped'
  note: string | null
  saved_at: string
  met_at: string | null
}

export type PollOption = {
  id: string
  label: I18nMap
}

export type EventPollRow = {
  id: string
  event_id: string
  question: I18nMap
  options: PollOption[]
  type: 'single' | 'multi'
  bonus_reward: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export type EventPollAnswerRow = {
  id: string
  poll_id: string
  visitor_id: string
  selected_option_ids: string[]
  answered_at: string
}

export type BonusLogRow = {
  id: string
  visitor_id: string
  amount: number
  reason: string
  created_at: string
}
