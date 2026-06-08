'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { HeartFilledIcon, HeartIcon, MapPinIcon } from '@/components/icons'
import { staggerItem } from '@/lib/design/animations'
import { getI18nText } from '@/lib/i18n/get-text'
import type { CatalogParticipant, IndustryCategory } from '@/types/catalog'
import { useEventLocale } from '@/components/public/event-locale-context'

type GuideParticipantCardProps = {
  eventSlug: string
  participant: CatalogParticipant
  categoriesBySlug: Map<string, IndustryCategory>
  isFavorite: boolean
  onToggleFavorite: () => void
}

export function GuideParticipantCard({
  eventSlug,
  participant,
  categoriesBySlug,
  isFavorite,
  onToggleFavorite,
}: GuideParticipantCardProps) {
  const { locale } = useEventLocale()
  const { cache, stand, tenant_slug: tenantSlug } = participant
  const name = cache.name ?? tenantSlug
  const description = getI18nText(cache.short_description, locale)
  const categorySlugs = cache.categories.slice(0, 3)

  const standLabel = [
    stand?.stand_number ? `Стенд ${stand.stand_number}` : null,
    stand?.pavilion ? stand.pavilion : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const companyHref = `/e/${eventSlug}/guide/company/${tenantSlug}`

  return (
    <motion.article
      {...staggerItem}
      className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 hover:border-[var(--border2)] hover:shadow-[var(--shadow-lg)]"
    >
      <Link href={companyHref} className="block">
        <div className="flex h-32 items-center justify-center bg-[var(--surface2)]">
          {cache.logo_url ? (
            <Image
              src={cache.logo_url}
              alt=""
              width={160}
              height={80}
              className="max-h-20 max-w-[60%] object-contain"
              unoptimized
            />
          ) : (
            <span className="font-heading text-2xl font-semibold text-[var(--subtle)]">
              {name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={companyHref} className="min-w-0 flex-1">
            <h3 className="font-heading text-lg font-semibold text-[var(--brand)] line-clamp-2">
              {name}
            </h3>
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onToggleFavorite()
            }}
            className="shrink-0 text-[var(--muted)] transition hover:text-[var(--accent)]"
            aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
          >
            {isFavorite ? (
              <HeartFilledIcon size={22} className="text-[var(--accent)]" />
            ) : (
              <HeartIcon size={22} />
            )}
          </button>
        </div>

        {description ? (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{description}</p>
        ) : null}

        {standLabel ? (
          <div className="mt-4 flex items-center gap-2">
            <MapPinIcon size={14} className="shrink-0 text-[var(--subtle)]" />
            <span className="truncate text-xs text-[var(--muted)]">{standLabel}</span>
          </div>
        ) : null}

        {categorySlugs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categorySlugs.map((slug) => {
              const cat = categoriesBySlug.get(slug)
              const label = cat ? getI18nText(cat.name, locale, slug) : slug
              return (
                <span
                  key={slug}
                  className="rounded-md bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)]"
                >
                  {label}
                </span>
              )
            })}
          </div>
        ) : null}
      </div>
    </motion.article>
  )
}
