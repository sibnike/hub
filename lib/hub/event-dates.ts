/** Parse PostgreSQL daterange string e.g. [2025-06-01,2025-06-10) */
export function parseDateRange(raw: string | null): { start: string; end: string } | null {
  if (!raw) return null
  const match = raw.match(/^[\[(](\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})[\])]$/)
  if (!match) return null
  return { start: match[1], end: match[2] }
}

export function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `[${start},${end}]`
  if (start) return `[${start},)`
  return null
}

export function formatDateRangeLabel(raw: string | null): string {
  const parsed = parseDateRange(raw)
  if (!parsed) return '—'
  if (parsed.start === parsed.end) return parsed.start
  return `${parsed.start} — ${parsed.end}`
}
