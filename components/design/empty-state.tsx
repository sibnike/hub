'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/design/animations'
import type { IconProps } from '@/components/icons/types'

type EmptyStateProps = {
  icon: React.ComponentType<IconProps>
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <motion.div
      {...fadeUp}
      className="py-20 flex flex-col items-center text-center px-4"
    >
      <div className="w-20 h-20 rounded-2xl bg-[var(--surface2)] flex items-center justify-center mb-5">
        <Icon size={32} className="text-[var(--subtle)]" />
      </div>
      <h3 className="font-heading text-xl font-semibold text-[var(--brand)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)] max-w-md">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          {actionLabel}
        </Link>
      ) : null}
    </motion.div>
  )
}
