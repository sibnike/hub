'use client'

import { useEffect } from 'react'

export function EmbedHeightReporter() {
  useEffect(() => {
    function sendHeight() {
      const height = document.documentElement.scrollHeight
      window.parent.postMessage({ type: 'yanbada-hub-height', height }, '*')
    }

    sendHeight()
    const ro = new ResizeObserver(sendHeight)
    ro.observe(document.documentElement)
    window.addEventListener('load', sendHeight)

    return () => {
      ro.disconnect()
      window.removeEventListener('load', sendHeight)
    }
  }, [])

  return null
}
