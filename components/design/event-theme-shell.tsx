'use client'

import { cn } from '@/lib/utils'
import { ALL_FONT_CLASS_NAMES, getFontPairStyle } from '@/lib/event-fonts'
import { buildEventThemeStyle, isHeroImage } from '@/lib/design/theme'
import { parseEventSettings } from '@/lib/hub/event-settings'

type EventThemeShellProps = {
  settings: Record<string, unknown>
  children: React.ReactNode
  className?: string
}

export function EventThemeShell({ settings, children, className }: EventThemeShellProps) {
  const parsed = parseEventSettings(settings)
  const themeStyle = buildEventThemeStyle(settings)
  const fontStyle = getFontPairStyle(parsed.font_pair)

  return (
    <div
      className={cn(
        'min-h-screen bg-[var(--bg)] text-[var(--text)] font-body antialiased',
        ALL_FONT_CLASS_NAMES,
        className
      )}
      style={{ ...themeStyle, ...fontStyle }}
      data-hero-image={isHeroImage(parsed) ? 'true' : undefined}
    >
      {children}
    </div>
  )
}
