import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { mergeAuthCookieOptions } from '@/lib/supabase/auth-cookie'
import { getMarketplaceByHost } from '@/lib/marketplace/get-marketplace'
import {
  isYanbadaHubHost,
  normalizeMarketplaceHost,
} from '@/lib/marketplace/marketplace-host'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function withAuthRefresh(
  request: NextRequest,
  host: string,
  createResponse: () => NextResponse
): Promise<NextResponse> {
  let response = createResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = createResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, mergeAuthCookieOptions(options, host))
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

function normalizeTrailingSlash(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (pathname.length <= 1 || !pathname.endsWith('/')) return null

  const prefixes = ['/e/', '/organizer/', '/exhibitor/']
  if (!prefixes.some((p) => pathname.startsWith(p))) return null

  const url = request.nextUrl.clone()
  url.pathname = pathname.replace(/\/+$/, '')
  return NextResponse.redirect(url, 308)
}

export async function middleware(request: NextRequest) {
  const slashRedirect = normalizeTrailingSlash(request)
  if (slashRedirect) return slashRedirect

  const host = request.headers.get('host') ?? ''
  const normalizedHost = normalizeMarketplaceHost(host)
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/m/')) {
    return withAuthRefresh(request, host, () => NextResponse.next({ request }))
  }

  if (!isYanbadaHubHost(normalizedHost)) {
    const supabase = createServiceClient()
    const { data: event } = await supabase
      .schema('hub')
      .from('events')
      .select('slug, settings')
      .filter('settings->>custom_domain', 'eq', normalizedHost)
      .eq('status', 'published')
      .maybeSingle()

    if (event) {
      const settings =
        event.settings && typeof event.settings === 'object'
          ? (event.settings as Record<string, unknown>)
          : {}
      const prefix =
        typeof settings.custom_domain_prefix === 'string'
          ? settings.custom_domain_prefix
          : ''

      const url = request.nextUrl.clone()
      const originalPath = url.pathname

      if (prefix && !originalPath.startsWith(prefix)) {
        return withAuthRefresh(request, host, () => NextResponse.next({ request }))
      }

      const cleanPath = prefix
        ? originalPath.slice(prefix.length) || '/catalog'
        : originalPath === '/'
          ? '/catalog'
          : originalPath

      url.pathname = `/e/${event.slug}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`
      return NextResponse.rewrite(url)
    }

    const marketplace = await getMarketplaceByHost(normalizedHost)
    if (marketplace) {
      const url = request.nextUrl.clone()
      url.pathname = `/m/${marketplace.slug}${pathname === '/' ? '' : pathname}`
      return withAuthRefresh(request, host, () => NextResponse.rewrite(url))
    }
  }

  return withAuthRefresh(request, host, () => NextResponse.next({ request }))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|widgets/).*)'],
}
