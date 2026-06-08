'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { CompanyGuideModal } from '@/components/design/company-guide-modal'
import { useVisitorFavorites } from '@/lib/hooks/use-visitor-favorites'
import { getI18nText } from '@/lib/i18n/get-text'
import type { IndustryCategory } from '@/types/catalog'
import type { CompanyInEvent } from '@/lib/hub/get-company-in-event'

type CompanyGuideInterceptProps = {
  data: CompanyInEvent
  categories: IndustryCategory[]
  eventId: string
}

export function CompanyGuideIntercept({
  data,
  categories,
  eventId,
}: CompanyGuideInterceptProps) {
  const router = useRouter()
  const { isFavorite, toggle } = useVisitorFavorites(eventId)

  const onClose = useCallback(() => {
    router.back()
  }, [router])

  const { cache, stand, tenant_slug: tenantSlug, event } = data
  const name = cache.name ?? tenantSlug

  const standLabel = [
    stand?.stand_number ? `Стенд ${stand.stand_number}` : null,
    stand?.pavilion ? stand.pavilion : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const categoryLabels = cache.categories.slice(0, 3).map((slug) => {
    const cat = categories.find((c) => c.slug === slug)
    return cat ? getI18nText(cat.name, 'ru', slug) : slug
  })

  return (
    <CompanyGuideModal
      open
      onClose={onClose}
      eventSlug={event.slug}
      tenantSlug={tenantSlug}
      name={name}
      logoUrl={cache.logo_url}
      categories={categoryLabels}
      standLabel={standLabel || undefined}
      vitrinaSlug={tenantSlug}
      isFavorite={isFavorite(data.tenant_id)}
      onToggleFavorite={() => void toggle(data.tenant_id)}
    />
  )
}
