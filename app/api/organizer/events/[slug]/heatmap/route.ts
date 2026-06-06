import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import type { HeatmapMetric, HeatmapResponse, HeatmapStandRow } from '@/types/heatmap'
import type { HubEventRow } from '@/types/hub-event'
import type { TrackType } from '@/types/analytics'

type RouteParams = { params: { slug: string } }

const METRIC_TYPES: Record<HeatmapMetric, TrackType[]> = {
  all: ['profile_view', 'stand_view', 'qr_scan'],
  profile_view: ['profile_view'],
  qr_scan: ['qr_scan'],
  stand_view: ['stand_view'],
}

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('id, organizer_tenant_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Pick<HubEventRow, 'id' | 'organizer_tenant_id'> | null
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const pavilion = searchParams.get('pavilion') ?? 'main'
  const floor = parseInt(searchParams.get('floor') ?? '1', 10)
  const metric = (searchParams.get('metric') ?? 'all') as HeatmapMetric
  const days = parseInt(searchParams.get('days') ?? '30', 10)
  const since =
    days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null

  const validTypes = METRIC_TYPES[metric] ?? METRIC_TYPES.all

  const supabase = await createClient()

  const [{ data: stands }, { data: tracks }, { data: cache }] = await Promise.all([
    supabase
      .schema('hub')
      .from('event_stands')
      .select(
        'id, tenant_id, stand_number, map_x, map_y, map_width, map_height'
      )
      .eq('event_id', event.id)
      .eq('pavilion', pavilion)
      .eq('floor', floor),
    (() => {
      let q = supabase
        .schema('hub')
        .from('track_events')
        .select('tenant_id, type')
        .eq('event_id', event.id)
        .in('type', validTypes)
      if (since) q = q.gte('ts', since)
      return q
    })(),
    supabase.schema('hub').from('company_cache').select('tenant_id, name'),
  ])

  const countsByTenant: Record<string, { profile_view: number; qr_scan: number; stand_view: number; total: number }> = {}

  for (const t of tracks ?? []) {
    if (!t.tenant_id || typeof t.tenant_id !== 'string') continue
    const tid = t.tenant_id
    if (!countsByTenant[tid]) {
      countsByTenant[tid] = { profile_view: 0, qr_scan: 0, stand_view: 0, total: 0 }
    }
    const type = t.type as TrackType
    if (type === 'profile_view') countsByTenant[tid].profile_view += 1
    if (type === 'qr_scan') countsByTenant[tid].qr_scan += 1
    if (type === 'stand_view') countsByTenant[tid].stand_view += 1
    if (['profile_view', 'qr_scan', 'stand_view'].includes(type)) {
      countsByTenant[tid].total += 1
    }
  }

  const nameByTenant = new Map(
    (cache ?? []).map((c) => [String(c.tenant_id), typeof c.name === 'string' ? c.name : ''])
  )

  const placedStands = (stands ?? []).filter(
    (s) => (s.map_x ?? 0) > 0 || (s.map_y ?? 0) > 0
  )

  const metricValue = (tid: string | null): number => {
    if (!tid) return 0
    const c = countsByTenant[tid]
    if (!c) return 0
    if (metric === 'profile_view') return c.profile_view
    if (metric === 'qr_scan') return c.qr_scan
    if (metric === 'stand_view') return c.stand_view
    return c.total
  }

  const points = placedStands.map((s) => {
    const mapX = typeof s.map_x === 'number' ? s.map_x : 0
    const mapY = typeof s.map_y === 'number' ? s.map_y : 0
    const mapW = typeof s.map_width === 'number' ? s.map_width : 5
    const mapH = typeof s.map_height === 'number' ? s.map_height : 5
    const tenantId = s.tenant_id ? String(s.tenant_id) : null
    return {
      x: mapX + mapW / 2,
      y: mapY + mapH / 2,
      value: metricValue(tenantId),
      stand_id: String(s.id),
      tenant_id: tenantId,
    }
  })

  const topStands: HeatmapStandRow[] = placedStands
    .map((s) => {
      const tenantId = s.tenant_id ? String(s.tenant_id) : null
      const counts = tenantId ? countsByTenant[tenantId] : null
      const mapX = typeof s.map_x === 'number' ? s.map_x : 0
      const mapY = typeof s.map_y === 'number' ? s.map_y : 0
      const mapW = typeof s.map_width === 'number' ? s.map_width : 5
      const mapH = typeof s.map_height === 'number' ? s.map_height : 5
      return {
        stand_id: String(s.id),
        tenant_id: tenantId,
        stand_number: typeof s.stand_number === 'string' ? s.stand_number : null,
        name: tenantId ? nameByTenant.get(tenantId) || tenantId.slice(0, 8) : '—',
        map_x: mapX,
        map_y: mapY,
        map_width: mapW,
        map_height: mapH,
        profile_view: counts?.profile_view ?? 0,
        qr_scan: counts?.qr_scan ?? 0,
        stand_view: counts?.stand_view ?? 0,
        total: counts?.total ?? 0,
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const max = Math.max(1, ...points.map((p) => p.value))

  const body: HeatmapResponse = { points, max, topStands }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
