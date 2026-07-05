const tenantLastCallMs = new Map<string, number>()

export const VITRINA_INGEST_THROTTLE_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function throttleVitrinaIngest(tenantSlug: string): Promise<void> {
  const now = Date.now()
  const last = tenantLastCallMs.get(tenantSlug) ?? 0
  const wait = VITRINA_INGEST_THROTTLE_MS - (now - last)
  if (wait > 0) await sleep(wait)
  tenantLastCallMs.set(tenantSlug, Date.now())
}

export async function fetchVitrinaIngestWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 4
): Promise<Response> {
  const body =
    typeof init.body === 'string'
      ? init.body
      : init.body != null
        ? String(init.body)
        : undefined

  let lastRes: Response | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(url, { ...init, body })
    lastRes = res

    if (res.status !== 429 || attempt === maxAttempts - 1) {
      return res
    }

    const backoffMs = 800 * 2 ** attempt
    await sleep(backoffMs)
    await throttleVitrinaIngest('retry')
  }

  return lastRes!
}
