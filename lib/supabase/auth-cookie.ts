export function getAuthCookieDomain(): string | undefined {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
  return domain || undefined
}

export function mergeAuthCookieOptions<T extends { domain?: string }>(
  options?: T
): T | undefined {
  const domain = getAuthCookieDomain()
  if (!domain) return options
  return { ...options, domain } as T
}
