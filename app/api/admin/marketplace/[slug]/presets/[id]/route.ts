import { NextRequest, NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/current-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveMarketplaceBySlug } from '@/lib/marketplace/get-marketplace'
import type { SearchPresetParam } from '@/types/marketplace-guided-search'

type RouteContext = { params: Promise<{ slug: string; id: string }> }

type PatchBody = {
  theme_slug?: string
  name?: Record<string, string>
  hint_template?: Record<string, string>
  required_params?: SearchPresetParam[]
  clarify_hints?: Record<string, Record<string, string>>
  sort_order?: number
  is_active?: boolean
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug, id } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const body = (await request.json()) as PatchBody
  const patch: Record<string, unknown> = {}

  if (body.theme_slug !== undefined) patch.theme_slug = body.theme_slug
  if (body.name !== undefined) patch.name = body.name
  if (body.hint_template !== undefined) patch.hint_template = body.hint_template
  if (body.required_params !== undefined) patch.required_params = body.required_params
  if (body.clarify_hints !== undefined) patch.clarify_hints = body.clarify_hints
  if (body.sort_order !== undefined) patch.sort_order = body.sort_order
  if (body.is_active !== undefined) patch.is_active = body.is_active

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('hub')
    .from('search_presets')
    .update(patch)
    .eq('id', id)
    .eq('marketplace_id', marketplace.id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
  }

  return NextResponse.json({ preset: data })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug, id } = await context.params
  const marketplace = await getActiveMarketplaceBySlug(slug)
  if (!marketplace) {
    return NextResponse.json({ error: 'Marketplace not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .schema('hub')
    .from('search_presets')
    .delete()
    .eq('id', id)
    .eq('marketplace_id', marketplace.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
