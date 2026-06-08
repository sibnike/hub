import { NextRequest, NextResponse } from 'next/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { loadEventBySlug } from '@/lib/hub/organizer-event'
import { parseEventSettings } from '@/lib/hub/event-settings'
import { buildHeroBg } from '@/lib/design/theme'
import { createClient } from '@/lib/supabase/server'
import type { FontPairSlug } from '@/lib/event-fonts'
import type { HeroBgType } from '@/lib/design/theme'

type RouteParams = { params: { slug: string } }

type BrandingBody = {
  accent_color?: string
  brand_color?: string
  font_pair?: FontPairSlug
  hero_bg_type?: HeroBgType
  hero_bg_gradient_from?: string
  hero_bg_gradient_to?: string
  hero_bg_gradient_angle?: number
  hero_bg_solid?: string
  hero_image_url?: string
  brand_logo_url?: string
  brand_footer_text?: string
  welcome_message?: Record<string, string>
  organizer_contacts?: { email?: string; phone?: string; website?: string }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ data: parseEventSettings(event.settings) })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as BrandingBody
  const current = parseEventSettings(event.settings)

  const merged = {
    ...event.settings,
    ...current,
    ...(body.accent_color !== undefined ? { accent_color: body.accent_color } : {}),
    ...(body.brand_color !== undefined ? { brand_color: body.brand_color } : {}),
    ...(body.font_pair !== undefined ? { font_pair: body.font_pair } : {}),
    ...(body.hero_bg_type !== undefined ? { hero_bg_type: body.hero_bg_type } : {}),
    ...(body.hero_bg_gradient_from !== undefined
      ? { hero_bg_gradient_from: body.hero_bg_gradient_from }
      : {}),
    ...(body.hero_bg_gradient_to !== undefined
      ? { hero_bg_gradient_to: body.hero_bg_gradient_to }
      : {}),
    ...(body.hero_bg_gradient_angle !== undefined
      ? { hero_bg_gradient_angle: body.hero_bg_gradient_angle }
      : {}),
    ...(body.hero_bg_solid !== undefined ? { hero_bg_solid: body.hero_bg_solid } : {}),
    ...(body.hero_image_url !== undefined ? { hero_image_url: body.hero_image_url } : {}),
    ...(body.brand_logo_url !== undefined ? { brand_logo_url: body.brand_logo_url } : {}),
    ...(body.brand_footer_text !== undefined ? { brand_footer_text: body.brand_footer_text } : {}),
    ...(body.welcome_message !== undefined ? { welcome_message: body.welcome_message } : {}),
    ...(body.organizer_contacts !== undefined
      ? { organizer_contacts: body.organizer_contacts }
      : {}),
  }

  const parsed = parseEventSettings(merged)
  merged.hero_bg = buildHeroBg(parsed)

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .update({ settings: merged })
    .eq('id', event.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
