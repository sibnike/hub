'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { modalEntry } from '@/lib/design/animations'
import {
  CloseIcon,
  ExternalLinkIcon,
  HandshakeIcon,
  HeartFilledIcon,
  HeartIcon,
  MapPinIcon,
} from '@/components/icons'
import { VitrinaEmbed } from '@/components/public/vitrina-embed'
import { cn } from '@/lib/utils'

type CompanyGuideModalProps = {
  open: boolean
  onClose: () => void
  eventSlug: string
  tenantSlug: string
  name: string
  logoUrl?: string | null
  categories?: string[]
  standLabel?: string
  vitrinaSlug?: string | null
  mapHref?: string
  profileHref?: string
  isFavorite: boolean
  onToggleFavorite: () => void
}

export function CompanyGuideModal({
  open,
  onClose,
  eventSlug,
  tenantSlug,
  name,
  logoUrl,
  categories = [],
  standLabel,
  vitrinaSlug,
  mapHref,
  profileHref,
  isFavorite,
  onToggleFavorite,
}: CompanyGuideModalProps) {
  const resolvedMapHref = mapHref ?? `/e/${eventSlug}/guide/map`
  const resolvedProfileHref =
    profileHref ?? `/e/${eventSlug}/guide/company/${tenantSlug}`

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            {...modalEntry}
            role="dialog"
            aria-modal
            aria-labelledby="company-modal-title"
            className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] md:inset-4 md:rounded-3xl"
          >
            <div className="flex items-start gap-4 border-b border-[var(--border)] p-4 md:p-6">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--surface2)]">
                {logoUrl ? (
                  <Image src={logoUrl} alt="" fill className="object-contain p-2" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-heading text-lg font-semibold text-[var(--muted)]">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="company-modal-title"
                  className="font-heading text-xl font-semibold text-[var(--brand)]"
                >
                  {name}
                </h2>
                {standLabel ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                    <MapPinIcon size={14} className="text-[var(--subtle)]" />
                    {standLabel}
                  </p>
                ) : null}
                {categories.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="rounded-md bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)]"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                aria-label="Закрыть"
              >
                <CloseIcon size={22} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 border-b border-[var(--border)] p-4 md:px-6">
              <ActionButton
                label={isFavorite ? 'В избранном' : 'В избранное'}
                active={isFavorite}
                onClick={onToggleFavorite}
                icon={
                  isFavorite ? (
                    <HeartFilledIcon size={20} className="text-[var(--accent)]" />
                  ) : (
                    <HeartIcon size={20} />
                  )
                }
              />
              <ActionButton
                label="На карте"
                href={resolvedMapHref}
                icon={<MapPinIcon size={20} />}
              />
              <ActionButton
                label="Профиль"
                href={resolvedProfileHref}
                icon={<ExternalLinkIcon size={20} />}
              />
              <ActionButton
                label="Встреча"
                disabled
                title="Скоро"
                icon={<HandshakeIcon size={20} />}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {vitrinaSlug ? (
                <VitrinaEmbed slug={vitrinaSlug} eventSlug={eventSlug} companyName={name} />
              ) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-12 text-center text-sm text-[var(--muted)]">
                  Компания пока не создала страницу-визитку.
                </p>
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

type ActionButtonProps = {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  href?: string
  active?: boolean
  disabled?: boolean
  title?: string
}

function ActionButton({
  label,
  icon,
  onClick,
  href,
  active,
  disabled,
  title,
}: ActionButtonProps) {
  const classes = cn(
    'flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] px-2 py-3 text-center text-xs font-medium text-[var(--text)] transition',
    active && 'border-[var(--accent)] bg-[var(--surface2)]',
    !disabled && !active && 'hover:bg-[var(--surface2)]',
    disabled && 'cursor-not-allowed opacity-50'
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={title}>
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
      title={title}
    >
      {icon}
      {label}
    </button>
  )
}
