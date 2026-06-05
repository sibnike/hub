'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { HeatmapOverlay } from '@/components/analytics/heatmap-overlay'
import { PeriodFilter } from '@/components/analytics/period-filter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildHeatmapSvg, downloadHeatmapSvg } from '@/lib/analytics/export-heatmap'
import { extractSvgViewBox } from '@/lib/svg/sanitize'
import { formatMapTabLabel } from '@/lib/map/utils'
import type { HeatmapMetric, HeatmapResponse } from '@/types/heatmap'
import type { EventMapRow } from '@/types/map'

const METRIC_OPTIONS: { value: HeatmapMetric; label: string }[] = [
  { value: 'all', label: 'Все события' },
  { value: 'profile_view', label: 'Просмотры профилей' },
  { value: 'qr_scan', label: 'Сканирования QR' },
  { value: 'stand_view', label: 'Клики на карте' },
]

type EventHeatmapSectionProps = {
  eventSlug: string
  maps: EventMapRow[]
}

export function EventHeatmapSection({ eventSlug, maps }: EventHeatmapSectionProps) {
  const [pavilion, setPavilion] = useState(maps[0]?.pavilion ?? 'main')
  const [floor, setFloor] = useState(maps[0]?.floor ?? 1)
  const [metric, setMetric] = useState<HeatmapMetric>('all')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<HeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const activeMap = useMemo(
    () => maps.find((m) => m.pavilion === pavilion && m.floor === floor) ?? maps[0] ?? null,
    [maps, pavilion, floor]
  )

  const viewBox = useMemo(
    () => (activeMap?.svg_content ? extractSvgViewBox(activeMap.svg_content) : null),
    [activeMap]
  )
  const aspectRatio = viewBox ? `${viewBox.width} / ${viewBox.height}` : '16 / 9'

  const load = useCallback(async () => {
    if (!activeMap) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/heatmap?pavilion=${encodeURIComponent(pavilion)}&floor=${floor}&metric=${metric}&days=${days}`
      )
      const json = (await res.json()) as HeatmapResponse & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setData(json)
    } catch {
      setData({ points: [], max: 1, topStands: [] })
    } finally {
      setLoading(false)
    }
  }, [eventSlug, pavilion, floor, metric, days, activeMap])

  useEffect(() => {
    void load()
  }, [load])

  function selectMap(map: EventMapRow) {
    setPavilion(map.pavilion)
    setFloor(map.floor)
  }

  function exportHeatmap() {
    if (!activeMap?.svg_content || !data) return
    const svg = buildHeatmapSvg(
      activeMap.svg_content,
      data.points,
      data.max,
      data.topStands,
      viewBox
    )
    downloadHeatmapSvg(
      svg,
      `heatmap-${eventSlug}-${pavilion}-${floor}.svg`
    )
  }

  const hasPlacedStands = (data?.points.length ?? 0) > 0
  const hasActivity = (data?.points.some((p) => p.value > 0) ?? false)

  if (maps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Тепловая карта</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Загрузите карту павильона в редакторе, чтобы увидеть тепловую карту.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Тепловая карта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {maps.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {maps.map((map) => (
                <Button
                  key={map.id}
                  size="sm"
                  variant={
                    activeMap?.id === map.id ? 'default' : 'outline'
                  }
                  onClick={() => selectMap(map)}
                >
                  {formatMapTabLabel(map)}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Метрика</Label>
              <Select
                value={metric}
                onValueChange={(v) => v && setMetric(v as HeatmapMetric)}
              >
                <SelectTrigger className="mt-1 w-[200px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PeriodFilter value={days} onChange={setDays} />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка тепловой карты…</p>
        ) : !hasPlacedStands ? (
          <p className="text-sm text-muted-foreground">
            Недостаточно данных для тепловой карты — разместите стенды на карте.
          </p>
        ) : !hasActivity ? (
          <p className="text-sm text-muted-foreground">
            Недостаточно данных для тепловой карты за выбранный период.
          </p>
        ) : null}

        <div
          id="heatmap-container"
          className="relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-lg border bg-muted/20 [&_svg]:h-full [&_svg]:w-full"
          style={{ aspectRatio }}
        >
          {activeMap?.svg_content ? (
            <div
              className="pointer-events-none absolute inset-0"
              dangerouslySetInnerHTML={{ __html: activeMap.svg_content }}
            />
          ) : null}
          {data && hasActivity ? (
            <HeatmapOverlay points={data.points} max={data.max} />
          ) : null}
          {data?.topStands.map((s) => (
            <div
              key={s.stand_id}
              className="pointer-events-none absolute rounded border border-foreground/15 bg-background/10"
              style={{
                left: `${s.map_x}%`,
                top: `${s.map_y}%`,
                width: `${s.map_width}%`,
                height: `${s.map_height}%`,
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Синий — низкая активность, жёлтый — средняя, красный — высокая
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasActivity || !activeMap?.svg_content}
            onClick={exportHeatmap}
          >
            <Download className="mr-1 h-4 w-4" />
            Скачать тепловую карту
          </Button>
        </div>

        {data && data.topStands.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Компания</th>
                  <th className="py-2 pr-3">Стенд</th>
                  <th className="py-2 pr-3">Профиль</th>
                  <th className="py-2 pr-3">QR</th>
                  <th className="py-2 pr-3">Карта</th>
                  <th className="py-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.topStands.map((row, i) => (
                  <tr key={row.stand_id} className="border-b">
                    <td className="py-2 pr-3">{i + 1}</td>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3">{row.stand_number ?? '—'}</td>
                    <td className="py-2 pr-3">{row.profile_view}</td>
                    <td className="py-2 pr-3">{row.qr_scan}</td>
                    <td className="py-2 pr-3">{row.stand_view}</td>
                    <td className="py-2 font-medium">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
