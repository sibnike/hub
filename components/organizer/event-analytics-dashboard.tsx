'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  hourlyActivity,
  sourceDistribution,
  topCompanies,
} from '@/lib/analytics/aggregate'
import { EventHeatmapSection } from '@/components/organizer/event-heatmap-section'
import type { CompanyCacheBrief, TrackRow, TrackType } from '@/types/analytics'
import type { EventMapRow } from '@/types/map'

const LINE_COLORS: Record<string, string> = {
  catalog_view: '#6366f1',
  map_view: '#8b5cf6',
  profile_view: '#06b6d4',
  qr_scan: '#f59e0b',
  stand_view: '#10b981',
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981']

type EventAnalyticsDashboardProps = {
  eventSlug: string
  eventTitle: string
  maps: EventMapRow[]
}

export function EventAnalyticsDashboard({
  eventSlug,
  eventTitle,
  maps,
}: EventAnalyticsDashboardProps) {
  const [days, setDays] = useState(30)
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [cache, setCache] = useState<CompanyCacheBrief[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/analytics?days=${days}`
      )
      const json = (await res.json()) as {
        tracks?: TrackRow[]
        cache?: CompanyCacheBrief[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка загрузки')
      setTracks(json.tracks ?? [])
      setCache(json.cache ?? [])
    } catch {
      setTracks([])
      setCache([])
    } finally {
      setLoading(false)
    }
  }, [eventSlug, days])

  useEffect(() => {
    void load()
  }, [load])

  const daily = useMemo(() => groupByDay(tracks), [tracks])
  const companies = useMemo(() => topCompanies(tracks, cache), [tracks, cache])
  const sources = useMemo(() => sourceDistribution(tracks, 'profile_view'), [tracks])
  const hourly = useMemo(() => hourlyActivity(tracks), [tracks])

  const metrics = useMemo(
    () => [
      { label: 'Просмотры каталога', value: countByType(tracks, 'catalog_view') },
      { label: 'Просмотры карты', value: countByType(tracks, 'map_view') },
      { label: 'Открытия профилей', value: countByType(tracks, 'profile_view') },
      { label: 'Сканирования QR', value: countByType(tracks, 'qr_scan') },
    ],
    [tracks]
  )

  const hasData = tracks.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Аналитика выставки</h1>
          <p className="text-sm text-muted-foreground">{eventTitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter value={days} onChange={setDays} />
          <Link
            href={`/organizer/events/${eventSlug}`}
            className="text-sm text-primary hover:underline"
          >
            ← К событию
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : !hasData ? (
        <AnalyticsEmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <Card key={m.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="mt-1 text-3xl font-bold">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Динамика по дням</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Топ компаний</CardTitle>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3">Компания</th>
                          <th className="py-2 pr-3">Профиль</th>
                          <th className="py-2 pr-3">QR</th>
                          <th className="py-2">Стенд</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((c) => (
                          <tr key={c.tenant_id} className="border-b">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border">
                                  {c.logo_url ? (
                                    <Image
                                      src={c.logo_url}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                      {c.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <span className="truncate max-w-[140px]">{c.name}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-3">{c.profile_view}</td>
                            <td className="py-2 pr-3">{c.qr_scan}</td>
                            <td className="py-2">{c.stand_view}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Источники просмотров профиля</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sources}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
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
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Активность по часам</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="События" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <EventHeatmapSection eventSlug={eventSlug} maps={maps} />
    </div>
  )
}
