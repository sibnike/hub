import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CompanyPageContent } from '@/components/public/company-page-content'
import { getCompanyInEvent } from '@/lib/hub/get-company-in-event'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getI18nText } from '@/lib/i18n/get-text'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; tenantSlug: string }
  searchParams: { ref?: string }
}

const VALID_SOURCES = ['catalog', 'map', 'qr', 'direct', 'search'] as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getCompanyInEvent(params.slug, params.tenantSlug)
  if (!data) return {}

  const lang = 'ru'
  const companyName = data.cache.name ?? params.tenantSlug
  const eventName = getI18nText(data.event.name, lang, params.slug)
  const description = getI18nText(data.cache.short_description, lang)

  return {
    title: `${companyName} — ${eventName}`,
    description,
  }
}

export default async function CompanyPage({ params, searchParams }: PageProps) {
  const [data, categories] = await Promise.all([
    getCompanyInEvent(params.slug, params.tenantSlug),
    getIndustryCategories(),
  ])

  if (!data) notFound()

  const ref = searchParams.ref
  const source = VALID_SOURCES.includes(ref as (typeof VALID_SOURCES)[number])
    ? (ref as (typeof VALID_SOURCES)[number])
    : 'direct'

  return <CompanyPageContent data={data} categories={categories} source={source} />
}
