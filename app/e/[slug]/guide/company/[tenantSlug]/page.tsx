import { notFound } from 'next/navigation'
import { CompanyPageContent } from '@/components/public/company-page-content'
import { getCompanyInEvent } from '@/lib/hub/get-company-in-event'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; tenantSlug: string }
}

export default async function GuideCompanyPage({ params }: PageProps) {
  const [data, categories] = await Promise.all([
    getCompanyInEvent(params.slug, params.tenantSlug),
    getIndustryCategories(),
  ])

  if (!data) notFound()

  return <CompanyPageContent data={data} categories={categories} source="catalog" />
}
