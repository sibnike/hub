'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  MARKETPLACE_LOCALES,
  type MarketplaceLocale,
} from '@/lib/marketplace/locales'

type MarketplaceLocaleContextValue = {
  locale: MarketplaceLocale
  locales: readonly MarketplaceLocale[]
  setLocale: (locale: MarketplaceLocale) => void
}

const MarketplaceLocaleContext = createContext<MarketplaceLocaleContextValue | null>(null)

export function MarketplaceLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<MarketplaceLocale>('ru')

  const setLocale = useCallback((next: MarketplaceLocale) => {
    if (MARKETPLACE_LOCALES.includes(next)) {
      setLocaleState(next)
    }
  }, [])

  const value = useMemo(
    () => ({ locale, locales: MARKETPLACE_LOCALES, setLocale }),
    [locale, setLocale]
  )

  return (
    <MarketplaceLocaleContext.Provider value={value}>
      {children}
    </MarketplaceLocaleContext.Provider>
  )
}

export function useMarketplaceLocale(): MarketplaceLocaleContextValue {
  const ctx = useContext(MarketplaceLocaleContext)
  if (!ctx) {
    return {
      locale: 'ru',
      locales: MARKETPLACE_LOCALES,
      setLocale: () => {},
    }
  }
  return ctx
}
