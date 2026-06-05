'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type EventLocaleContextValue = {
  locale: string
  locales: string[]
  setLocale: (locale: string) => void
}

const EventLocaleContext = createContext<EventLocaleContextValue | null>(null)

export function EventLocaleProvider({
  locales,
  defaultLocale,
  children,
}: {
  locales: string[]
  defaultLocale: string
  children: ReactNode
}) {
  const [locale, setLocaleState] = useState(defaultLocale)

  const setLocale = useCallback((next: string) => {
    if (locales.includes(next)) setLocaleState(next)
  }, [locales])

  const value = useMemo(
    () => ({ locale, locales, setLocale }),
    [locale, locales, setLocale]
  )

  return (
    <EventLocaleContext.Provider value={value}>{children}</EventLocaleContext.Provider>
  )
}

export function useEventLocale(): EventLocaleContextValue {
  const ctx = useContext(EventLocaleContext)
  if (!ctx) {
    return { locale: 'ru', locales: ['ru', 'en'], setLocale: () => {} }
  }
  return ctx
}
