'use client'

import type { HeatmapPoint } from '@/types/heatmap'

type HeatmapOverlayProps = {
  points: HeatmapPoint[]
  max: number
}

export function HeatmapOverlay({ points, max }: HeatmapOverlayProps) {
  if (points.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="heat-low">
          <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heat-mid">
          <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heat-high">
          <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {points.map((p) => {
        const intensity = p.value / max
        const gradient =
          intensity < 0.33 ? 'heat-low' : intensity < 0.66 ? 'heat-mid' : 'heat-high'
        const radius = 4 + intensity * 8
        return (
          <circle
            key={p.stand_id}
            cx={p.x}
            cy={p.y}
            r={radius}
            fill={`url(#${gradient})`}
          />
        )
      })}
    </svg>
  )
}
