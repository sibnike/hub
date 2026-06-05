import type {
  CompanyCacheBrief,
  CompanyStats,
  EventComparisonRow,
  TrackRow,
  TrackType,
} from '@/types/analytics'

const CHART_TYPES: TrackType[] = [
  'catalog_view',
  'map_view',
  'profile_view',
  'qr_scan',
  'stand_view',
]

const TYPE_LABELS: Record<TrackType, string> = {
  catalog_view: 'Каталог',
  map_view: 'Карта',
  profile_view: 'Профиль',
  qr_scan: 'QR',
  stand_view: 'Стенд',
  save: 'Сохранения',
  form_submit: 'Заявки',
}

const SOURCE_LABELS: Record<string, string> = {
  catalog: 'Каталог',
  map: 'Карта',
  qr: 'QR',
  direct: 'Прямой',
  search: 'Поиск',
}

export function getTypeLabel(type: TrackType): string {
  return TYPE_LABELS[type]
}

export function getSourceLabel(source: string | null): string {
  if (!source) return 'Неизвестно'
  return SOURCE_LABELS[source] ?? source
}

export function countByType(tracks: TrackRow[], type: TrackType): number {
  return tracks.filter((t) => t.type === type).length
}

export function toLocalDateKey(ts: string): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type DailyTrackRow = { date: string; [key: string]: string | number }

export function groupByDay(tracks: TrackRow[]): DailyTrackRow[] {
  const map = new Map<string, Record<string, number>>()

  for (const track of tracks) {
    const date = toLocalDateKey(track.ts)
    if (!map.has(date)) {
      const row: Record<string, number> = {}
      for (const t of CHART_TYPES) row[t] = 0
      map.set(date, row)
    }
    const row = map.get(date)!
    row[track.type] = (row[track.type] ?? 0) + 1
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))
}

export function topCompanies(
  tracks: TrackRow[],
  cache: CompanyCacheBrief[],
  limit = 20
): CompanyStats[] {
  const cacheByTenant = new Map(cache.map((c) => [c.tenant_id, c]))
  const stats = new Map<string, CompanyStats>()

  for (const track of tracks) {
    if (!track.tenant_id) continue
    const cached = cacheByTenant.get(track.tenant_id)
    if (!stats.has(track.tenant_id)) {
      stats.set(track.tenant_id, {
        tenant_id: track.tenant_id,
        name: cached?.name ?? track.tenant_id.slice(0, 8),
        logo_url: cached?.logo_url ?? null,
        profile_view: 0,
        qr_scan: 0,
        stand_view: 0,
        total: 0,
      })
    }
    const row = stats.get(track.tenant_id)!
    if (track.type === 'profile_view') row.profile_view += 1
    if (track.type === 'qr_scan') row.qr_scan += 1
    if (track.type === 'stand_view') row.stand_view += 1
    if (['profile_view', 'qr_scan', 'stand_view'].includes(track.type)) {
      row.total += 1
    }
  }

  return Array.from(stats.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function sourceDistribution(
  tracks: TrackRow[],
  type: TrackType = 'profile_view'
): Array<{ name: string; value: number }> {
  const counts = new Map<string, number>()
  for (const track of tracks) {
    if (track.type !== type) continue
    const key = track.source ?? 'direct'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([name, value]) => ({
    name: getSourceLabel(name),
    value,
  }))
}

export function hourlyActivity(tracks: TrackRow[]): Array<{ hour: string; count: number }> {
  const counts = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }))
  for (const track of tracks) {
    const hour = new Date(track.ts).getHours()
    counts[hour].count += 1
  }
  return counts
}

export function topSource(tracks: TrackRow[]): string | null {
  const dist = sourceDistribution(tracks, 'profile_view')
  if (!dist.length) return null
  return dist.sort((a, b) => b.value - a.value)[0]?.name ?? null
}

export function aggregateEventComparison(
  participations: Array<{
    event_id: string
    events: { slug: string; name: Record<string, string>; dates: string | null } | null
  }>,
  tracks: Array<{ event_id: string; type: TrackType; source: string | null }>
): EventComparisonRow[] {
  const tracksByEvent = new Map<string, typeof tracks>()
  for (const track of tracks) {
    const list = tracksByEvent.get(track.event_id) ?? []
    list.push(track)
    tracksByEvent.set(track.event_id, list)
  }

  return participations
    .map((part) => {
      const event = part.events
      if (!event) return null
      const eventTracks = tracksByEvent.get(part.event_id) ?? []
      const asTrackRows: TrackRow[] = eventTracks.map((t) => ({
        type: t.type,
        source: t.source,
        tenant_id: null,
        ts: '',
      }))
      return {
        event_id: part.event_id,
        slug: event.slug,
        name: event.name,
        dates: event.dates,
        profile_view: countByType(asTrackRows, 'profile_view'),
        qr_scan: countByType(asTrackRows, 'qr_scan'),
        stand_view: countByType(asTrackRows, 'stand_view'),
        form_submit: countByType(asTrackRows, 'form_submit'),
        top_source: topSource(
          eventTracks.map((t) => ({
            type: t.type,
            source: t.source,
            tenant_id: null,
            ts: '',
          }))
        ),
      }
    })
    .filter((row): row is EventComparisonRow => row !== null)
}
