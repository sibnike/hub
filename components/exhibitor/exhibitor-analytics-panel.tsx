'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnalyticsEmptyState } from '@/components/analytics/empty-state'
import { PeriodFilter } from '@/components/analytics/period-filter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  countByType,
  getTypeLabel,
  groupByDay,
  sourceDistribution,
} from '@/lib/analytics/aggregate'
import type { TrackRow, TrackType } from '@/types/analytics'

const LINE_COLORS: Record<string, string> = {
  profile_view: '#06b6d4',
  stand_view: '#10b981',
  qr_scan: '#f59e0b',
  form_submit: '#8b5cf6',
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981']

type ExhibitorAnalyticsPanelProps = {
  eventSlug: string
  tenantId: string
}

export function ExhibitorAnalyticsPanel({
  eventSlug,
  tenantId,
}: ExhibitorAnalyticsPanelProps) {
  const [days, setDays] = useState(30)
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/exhibitor/events/${eventSlug}/analytics?tenant_id=${tenantId}&days=${days}`
      )
      const json = (await res.json()) as { tracks?: TrackRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setTracks(json.tracks ?? [])
    } catch {
      setTracks([])
    } finally {
      setLoading(false)
    }
  }, [eventSlug, tenantId, days])

  useEffect(() => {
    void load()
  }, [load])

  const daily = useMemo(() => {
    const all = groupByDay(tracks)
    return all.map((row) => ({
      date: row.date,
      profile_view: row.profile_view ?? 0,
      stand_view: row.stand_view ?? 0,
      qr_scan: row.qr_scan ?? 0,
      form_submit: row.form_submit ?? 0,
    }))
  }, [tracks])

  const sources = useMemo(() => sourceDistribution(tracks, 'profile_view'), [tracks])

  const metrics = useMemo(
    () => [
      { label: 'Просмотры профиля', value: countByType(tracks, 'profile_view') },
      { label: 'Просмотры стенда', value: countByType(tracks, 'stand_view') },
      { label: 'Сканирования QR', value: countByType(tracks, 'qr_scan') },
      { label: 'Форм отправлено', value: countByType(tracks, 'form_submit') },
    ],
    [tracks]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Аналитика участия</h2>
        <PeriodFilter value={days} onChange={setDays} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : tracks.length === 0 ? (
        <AnalyticsEmptyState />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="mt-1 text-2xl font-bold">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Динамика по дням</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {Object.entries(LINE_COLORS).map(([key, color]) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={getTypeLabel(key as TrackType)}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {sources.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Источники трафика</CardTitle>
              </CardHeader>
              <CardContent className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label
                    >
                      {sources.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
