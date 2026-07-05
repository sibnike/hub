import { NextRequest, NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import { getSearchPresetsForMarketplace } from '@/lib/marketplace/get-search-presets'
import type { SearchPresetParam } from '@/types/marketplace-guided-search'

type RouteContext = { params: Promise<{ slug: string }> }

type PresetBody = {
  theme_slug: string
  name: Record<string, string>
  hint_template: Record<string, string>
  required_params?: SearchPresetParam[]
  clarify_hints?: Record<string, Record<string, string>>
  sort_order?: number
  is_active?: boolean
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

  const presets = await getSearchPresetsForMarketplace(marketplace.id, false)
  return NextResponse.json({ presets })
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const body = (await request.json()) as PresetBody
  if (!body.theme_slug || !body.name || !body.hint_template) {
    return NextResponse.json({ error: 'theme_slug, name, hint_template required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('hub')
    .from('search_presets')
    .insert({
      marketplace_id: marketplace.id,
      theme_slug: body.theme_slug,
      name: body.name,
      hint_template: body.hint_template,
      required_params: body.required_params ?? [],
      clarify_hints: body.clarify_hints ?? {},
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preset: data }, { status: 201 })
}
