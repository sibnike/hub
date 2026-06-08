'use client'

import { motion } from 'framer-motion'
import { heroEntry } from '@/lib/design/animations'
import { isHeroImage } from '@/lib/design/theme'
import { parseEventSettings } from '@/lib/hub/event-settings'
import { cn } from '@/lib/utils'

type HeroBannerProps = {
  variant?: 'full' | 'compact'
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
  contentClassName?: string
  settings?: Record<string, unknown>
}

export function HeroBanner({
  variant = 'compact',
  title,
  subtitle,
  children,
  className,
  contentClassName,
  settings,
}: HeroBannerProps) {
  const parsed = parseEventSettings(settings)
  const hasImageOverlay = isHeroImage(parsed)

  return (
    <section
      className={cn(
        'relative flex w-full items-end overflow-hidden',
        variant === 'full' ? 'min-h-[50vh] md:min-h-[60vh]' : 'h-[200px]',
        className
      )}
      style={{
        background: 'var(--hero-bg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {hasImageOverlay ? <div className="absolute inset-0 bg-black/45" aria-hidden /> : null}
      <div
        className={cn(
          'absolute inset-0',
          !hasImageOverlay && 'bg-gradient-to-t from-black/10 to-transparent'
        )}
        aria-hidden
      />
      <motion.div
        {...heroEntry}
        className={cn(
          'relative z-10 w-full px-4 pb-8 pt-12 md:px-8',
          hasImageOverlay ? 'text-white' : 'text-[var(--brand)]',
          contentClassName
        )}
      >
        <div className="mx-auto max-w-6xl">
          <h1
            className={cn(
              'font-heading font-semibold',
              variant === 'full' ? 'text-3xl md:text-5xl' : 'text-2xl md:text-3xl'
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                'mt-2 font-body text-sm md:text-base',
                hasImageOverlay ? 'text-white/80' : 'text-[var(--muted)]'
              )}
            >
              {subtitle}
            </p>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </motion.div>
    </section>
  )
}
