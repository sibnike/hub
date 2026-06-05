export type I18nMap = Record<string, string>

export type EventLocation = {
  city?: string
  address?: string
  coordinates?: { lat: number; lng: number }
}

export type HubEventRow = {
  id: string
  organizer_tenant_id: string
  slug: string
  name: I18nMap
  dates: string | null
  location: EventLocation
  status: 'draft' | 'published' | 'archived'
  settings: Record<string, unknown>
  access_code_salt: string
  created_at: string
  updated_at: string
}

export type OrganizerTenant = {
  id: string
  slug: string
  name: string
}
