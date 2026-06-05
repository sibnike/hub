import { notFound } from 'next/navigation'
import { CompanyDetail } from '@/components/public/company-detail'
import { getCompanyInEvent } from '@/lib/hub/get-company-in-event'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; tenantSlug: string }
  searchParams: { ref?: string }
}

const VALID_SOURCES = ['catalog', 'map', 'qr', 'direct', 'search'] as const

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

  return <CompanyDetail data={data} categories={categories} source={source} />
}
