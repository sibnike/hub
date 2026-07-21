import type { I18nMap } from '@/types/hub-event'

export type ContactPerson = {
  name?: string
  role?: string
  phone?: string
  email?: string
}

export type CompanyLicense = {
  kind?: string
  type?: I18nMap | string
  number?: string
  document_url?: string
} | null

/** Core hub.company_cache row; extended tourism/media fields optional until synced. */
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
  marketplace_themes?: string[]
  logo_dark_url?: string | null
  cover_photo_url?: string | null
  gallery?: unknown[]
  video?: Record<string, unknown>
  about?: I18nMap
  languages?: string[]
  coverage_cities?: unknown[]
  license?: CompanyLicense
  tourism_business_role?: string | null
  founding_year?: number | null
  employee_count?: number | null
  legal_entity_type?: string | null
  legal_name?: string | null
  registration_number?: string | null
}
