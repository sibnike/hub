import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogClient } from '@/components/public/catalog-client'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { getCatalogParticipants } from '@/lib/hub/get-catalog-participants'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { getI18nText } from '@/lib/i18n/get-text'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getPublishedEvent(params.slug)
  if (!event) return {}

  const title = getI18nText(event.name, 'ru', params.slug)
  const city = event.location?.city ?? ''
  const dates = formatDateRangeLabel(event.dates)
  const description = [city, dates !== '—' ? dates : null].filter(Boolean).join(' · ')

  return {
    title: `Каталог участников — ${title}`,
    description: description || `Каталог участников — ${title}`,
  }
}

export default async function CatalogPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const [participations, categories] = await Promise.all([
    getCatalogParticipants(event.id),
    getIndustryCategories(),
  ])

  return (
    <CatalogClient
      eventSlug={event.slug}
      participations={participations}
      categories={categories}
    />
  )
}
