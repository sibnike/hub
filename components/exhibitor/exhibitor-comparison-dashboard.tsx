'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnalyticsEmptyState } from '@/components/analytics/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import type { EventComparisonRow } from '@/types/analytics'
import type { OrganizerTenant } from '@/types/hub-event'

type ExhibitorComparisonDashboardProps = {
  tenants: OrganizerTenant[]
  initialTenantId: string
}

export function ExhibitorComparisonDashboard({
  tenants,
  initialTenantId,
}: ExhibitorComparisonDashboardProps) {
  const [tenantId, setTenantId] = useState(initialTenantId)
  const [events, setEvents] = useState<EventComparisonRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exhibitor/analytics?tenant_id=${tenantId}`)
      const json = (await res.json()) as {
        events?: EventComparisonRow[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setEvents(json.events ?? [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(
    () =>
      events.map((e) => ({
        name: e.name.ru ?? e.name.en ?? e.slug,
        profile_view: e.profile_view,
      })),
    [events]
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Эффективность участия в выставках</h1>
          <p className="text-sm text-muted-foreground">
            Сравнение метрик по всем событиям
          </p>
        </div>
        {tenants.length > 1 ? (
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : events.length === 0 ? (
        <AnalyticsEmptyState message="Нет подтверждённых участий в выставках" />
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">Событие</th>
                      <th className="py-2 pr-3">Даты</th>
                      <th className="py-2 pr-3">Профиль</th>
                      <th className="py-2 pr-3">QR</th>
                      <th className="py-2 pr-3">Заявок</th>
                      <th className="py-2">Источник №1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.event_id} className="border-b">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/exhibitor/events/${e.slug}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {e.name.ru ?? e.name.en ?? e.slug}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {formatDateRangeLabel(e.dates)}
                        </td>
                        <td className="py-2 pr-3">{e.profile_view}</td>
                        <td className="py-2 pr-3">{e.qr_scan}</td>
                        <td className="py-2 pr-3 text-muted-foreground">—</td>
                        <td className="py-2">{e.top_source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сравнение просмотров профиля</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="profile_view"
                    name="Просмотры профиля"
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
