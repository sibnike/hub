'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { btnHover } from '@/lib/design/animations'
import { cn } from '@/lib/utils'

type GuideButtonProps = {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}

const variants = {
  primary:
    'px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition',
  secondary:
    'px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-medium hover:bg-[var(--surface2)] transition',
  ghost:
    'px-4 py-2 rounded-lg text-[var(--accent)] hover:bg-[var(--surface2)] transition',
}

export function GuideButton({
  children,
  href,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button',
}: GuideButtonProps) {
  const classes = cn(variants[variant], className, disabled && 'opacity-50 pointer-events-none')

  if (href) {
    return (
      <motion.div {...btnHover}>
        <Link href={href} className={cn('inline-flex items-center justify-center', classes)}>
          {children}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.button
      {...btnHover}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </motion.button>
  )
}
