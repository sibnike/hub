'use client'

import { useEffect, useRef } from 'react'
import { vitrinaPublicBase } from '@/lib/hub/vitrina-url'

type VitrinaEmbedProps = {
  slug: string
  eventSlug: string
  companyName: string
}

// TODO: enable in vitrina repo — ?embed=1 mode with postMessage height reporting
export function VitrinaEmbed({ slug, eventSlug, companyName }: VitrinaEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const base = vitrinaPublicBase()
  const src = `${base}/p/${slug}?embed=1&ref=catalog&event=${eventSlug}`

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.data?.type === 'vitrina-page-height' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full"
        style={{ minHeight: 600, border: 0 }}
        title={`Профиль ${companyName}`}
        id="vitrina-embed"
      />
    </div>
  )
}
