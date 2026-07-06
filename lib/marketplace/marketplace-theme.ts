import {
  buildThemeSurfaceStyle,
  isHeroImageFromSurface,
  type ThemeSurfaceInput,
} from '@/lib/design/theme'
import { parseMarketplaceSettings } from '@/lib/marketplace/marketplace-settings'

export function buildMarketplaceThemeStyle(
  raw: Record<string, unknown> | null | undefined
): React.CSSProperties {
  return buildThemeSurfaceStyle(parseMarketplaceSettings(raw))
}

export function isMarketplaceHeroImage(
  raw: Record<string, unknown> | null | undefined
): boolean {
  return isHeroImageFromSurface(parseMarketplaceSettings(raw) as ThemeSurfaceInput)
}
