import { notFound } from 'next/navigation'
import { CompanyGuideIntercept } from '@/components/visitor/company-guide-intercept'
import { getCompanyInEvent } from '@/lib/hub/get-company-in-event'
import { getIndustryCategories } from '@/lib/hub/get-industry-categories'
import { getPublishedEvent } from '@/lib/hub/get-published-event'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { slug: string; tenantSlug: string }
}

export default async function GuideCompanyModalPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const [data, categories] = await Promise.all([
    getCompanyInEvent(params.slug, params.tenantSlug),
    getIndustryCategories(),
  ])

  if (!data) notFound()

  return (
    <CompanyGuideIntercept data={data} categories={categories} eventId={event.id} />
  )
}
