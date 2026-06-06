'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CompanyContextHeader } from '@/components/public/company-context-header'
import { VitrinaEmbed } from '@/components/public/vitrina-embed'
import { useEmbed } from '@/lib/embed/context'
import { useTrack } from '@/lib/hooks/use-track'
import { cn } from '@/lib/utils'
import type { TrackSource } from '@/types/analytics'
import type { IndustryCategory } from '@/types/catalog'
import type { CompanyInEvent } from '@/lib/hub/get-company-in-event'

type CompanyPageContentProps = {
  data: CompanyInEvent
  categories: IndustryCategory[]
  source?: TrackSource
}

export function CompanyPageContent({
  data,
  categories,
  source = 'direct',
}: CompanyPageContentProps) {
  const { embed } = useEmbed()
  const { event, cache, stand, tenant_slug: tenantSlug, tenant_id: tenantId } = data
  const name = cache.name ?? tenantSlug

  useTrack({
    event_slug: event.slug,
    tenant_id: tenantId,
    type: 'profile_view',
    source,
  })

  return (
    <div
      className={cn(
        embed ? 'w-full space-y-6 px-4 py-6' : 'container max-w-4xl space-y-6 py-6'
      )}
    >
      <CompanyContextHeader
        company={cache}
        stand={stand}
        event={event}
        tenantSlug={tenantSlug}
        tenantId={tenantId}
        categories={categories}
      />

      <div className="border-t pt-6">
        {cache.vitrina_page_slug ? (
          <VitrinaEmbed
            slug={cache.vitrina_page_slug}
            eventSlug={event.slug}
            companyName={name}
          />
        ) : (
          <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
            Компания пока не создала страницу-визитку.
          </p>
        )}
      </div>

      <Button variant="outline" render={<Link href={`/e/${event.slug}/catalog`} />}>
        ← К каталогу
      </Button>
    </div>
  )
}
