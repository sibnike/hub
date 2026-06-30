const vitrinaBase =
  process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ??
  'https://vitrina.yanbada.com'

type DateAvailabilityRow = {
  date: string
  available: boolean
}

function parseYearMonth(isoDate: string): { year: number; month: number } {
  const [yearRaw, monthRaw] = isoDate.split('-')
  return { year: Number(yearRaw), month: Number(monthRaw) }
}

async function fetchAvailabilityForConfig(
  configId: string,
  year: number,
  month: number
): Promise<DateAvailabilityRow[]> {
  const params = new URLSearchParams({
    config_id: configId,
    year: String(year),
    month: String(month),
  })
  const res = await fetch(`${vitrinaBase}/api/booking/availability?${params.toString()}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const json = (await res.json()) as { dates?: DateAvailabilityRow[] }
  return Array.isArray(json.dates) ? json.dates : []
}

/**
 * Returns true if tenant should stay in targets:
 * - no requested date → always true
 * - no booking configs → true (no calendar ≠ busy)
 * - at least one config has the date available → true
 */
export async function isTenantAvailableOnDate(
  configIds: string[],
  requestedDate: string | null
): Promise<boolean> {
  if (!requestedDate) return true
  if (!configIds.length) return true

  const { year, month } = parseYearMonth(requestedDate)

  for (const configId of configIds) {
    const dates = await fetchAvailabilityForConfig(configId, year, month)
    const row = dates.find((d) => d.date === requestedDate)
    if (row?.available) return true
  }

  return false
}

export function getVitrinaPublicBase(): string {
  return vitrinaBase
}
