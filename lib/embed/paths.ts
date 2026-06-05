export function publicEventPath(
  slug: string,
  subpath: string,
  opts: { whiteLabel?: boolean; prefix?: string } = {}
): string {
  const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`
  if (!opts.whiteLabel) return `/e/${slug}${normalized}`
  const prefix = opts.prefix ?? ''
  return `${prefix}${normalized}` || normalized
}
