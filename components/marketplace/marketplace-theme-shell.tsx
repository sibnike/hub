'use client'

import { cn } from '@/lib/utils'
import { ALL_FONT_CLASS_NAMES, getFontPairStyle } from '@/lib/event-fonts'
import {
  buildMarketplaceThemeStyle,
  isMarketplaceHeroImage,
} from '@/lib/marketplace/marketplace-theme'
import { parseMarketplaceSettings } from '@/lib/marketplace/marketplace-settings'
import { MarketplaceLocaleProvider } from '@/components/marketplace/marketplace-locale-context'

type MarketplaceThemeShellProps = {
  settings: Record<string, unknown>
  children: React.ReactNode
  className?: string
}

export function MarketplaceThemeShell({
  settings,
  children,
  className,
}: MarketplaceThemeShellProps) {
  const parsed = parseMarketplaceSettings(settings)
  const themeStyle = buildMarketplaceThemeStyle(settings)
  const fontStyle = getFontPairStyle(parsed.font_pair)

  return (
    <MarketplaceLocaleProvider>
      <div
        className={cn(
          'min-h-screen bg-[var(--bg)] text-[var(--text)] font-body antialiased flex flex-col',
          ALL_FONT_CLASS_NAMES,
          className
        )}
        style={{ ...themeStyle, ...fontStyle }}
        data-hero-image={isMarketplaceHeroImage(settings) ? 'true' : undefined}
      >
        {children}
      </div>
    </MarketplaceLocaleProvider>
  )
}
