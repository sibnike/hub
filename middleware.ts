import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function isKnownHubHost(host: string): boolean {
  const hubDomain = process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  return (
    host === hubDomain ||
    host.endsWith('.yanbada.com') ||
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1')
  )
}

async function refreshAuth(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
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

  if (!isKnownHubHost(host)) {
    const supabase = createServiceClient()
    const { data: event } = await supabase
      .schema('hub')
      .from('events')
      .select('slug, settings')
      .filter('settings->>custom_domain', 'eq', host)
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
        return refreshAuth(request)
      }

      const cleanPath = prefix
        ? originalPath.slice(prefix.length) || '/catalog'
        : originalPath === '/'
          ? '/catalog'
          : originalPath

      url.pathname = `/e/${event.slug}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`
      return NextResponse.rewrite(url)
    }
  }

  return refreshAuth(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|widgets/).*)'],
}
