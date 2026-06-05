'use client'

import { createContext, useContext, type ReactNode } from 'react'

type EmbedContextValue = {
  embed: boolean
  track: boolean
  whiteLabel: boolean
  domainPrefix: string
}

const EmbedContext = createContext<EmbedContextValue>({
  embed: false,
  track: true,
  whiteLabel: false,
  domainPrefix: '',
})

export function EmbedProvider({
  embed,
  track,
  whiteLabel,
  domainPrefix,
  children,
}: EmbedContextValue & { children: ReactNode }) {
  return (
    <EmbedContext.Provider value={{ embed, track, whiteLabel, domainPrefix }}>
      {children}
    </EmbedContext.Provider>
  )
}

export function useEmbed(): EmbedContextValue {
  return useContext(EmbedContext)
}
