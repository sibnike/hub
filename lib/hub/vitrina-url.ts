export function vitrinaPublicBase(): string {
  const raw = process.env.NEXT_PUBLIC_VITRINA_PUBLIC ?? 'https://vitrina.yanbada.com'
  const trimmed = raw.replace(/\/$/, '')
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

export function buildVitrinaProfileUrl(
  vitrinaPageSlug: string,
  params: { ref: 'catalog' | 'qr'; event: string }
): string {
  const base = vitrinaPublicBase()
  const search = new URLSearchParams({ ref: params.ref, event: params.event })
  return `${base}/p/${vitrinaPageSlug}?${search.toString()}`
}
