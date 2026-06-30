import type { I18nMap } from '@/types/hub-event'

export type ContactPerson = {
  name?: string
  role?: string
  phone?: string
  email?: string
}

export type CompanyCacheRow = {
  tenant_id: string
  name: string | null
  logo_url: string | null
  short_description: I18nMap
  categories: string[]
  tags: string[]
  country: string | null
  city: string | null
  website: string | null
  social_links: Record<string, string>
  contact_persons: ContactPerson[]
  vitrina_page_slug: string | null
  synced_at: string | null
}
