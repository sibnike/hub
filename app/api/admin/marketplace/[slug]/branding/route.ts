import { NextRequest, NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { buildHeroBg } from '@/lib/design/theme'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import {
  parseMarketplaceSettings,
  type MarketplaceSettings,
} from '@/lib/marketplace/marketplace-settings'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FontPairSlug } from '@/lib/event-fonts'
import type { HeroBgType } from '@/lib/design/theme'
import type { I18nMap } from '@/types/hub-event'

type RouteContext = { params: Promise<{ slug: string }> }

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
  logo_url?: string
  favicon_url?: string
  display_name?: I18nMap
  hero_title?: I18nMap
  hero_subtitle?: I18nMap
  footer_text?: I18nMap
}

function mergeI18nField(
  current: Record<string, unknown>,
  key: string,
  value: I18nMap | undefined
): void {
  if (value === undefined) return
  current[key] = value
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  return NextResponse.json({ data: parseMarketplaceSettings(marketplace.settings) })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const body = (await request.json()) as BrandingBody
  const current = parseMarketplaceSettings(marketplace.settings)

  const merged: Record<string, unknown> = {
    ...marketplace.settings,
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
    ...(body.logo_url !== undefined ? { logo_url: body.logo_url } : {}),
    ...(body.favicon_url !== undefined ? { favicon_url: body.favicon_url } : {}),
  }

  mergeI18nField(merged, 'display_name', body.display_name)
  mergeI18nField(merged, 'hero_title', body.hero_title)
  mergeI18nField(merged, 'hero_subtitle', body.hero_subtitle)
  mergeI18nField(merged, 'footer_text', body.footer_text)

  const parsed = parseMarketplaceSettings(merged) as MarketplaceSettings
  merged.hero_bg = buildHeroBg(parsed)

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('hub')
    .from('marketplaces')
    .update({ settings: merged })
    .eq('id', marketplace.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
