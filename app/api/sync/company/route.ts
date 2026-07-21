import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-vitrina-signature')
  const body = await request.text()

  const expected = createHmac('sha256', process.env.VITRINA_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== `sha256=${expected}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = JSON.parse(body) as Record<string, unknown> & { tenant_id: string }

  const row: Record<string, unknown> = {
    tenant_id: data.tenant_id,
    name: data.name,
    logo_url: data.logo_url,
    logo_dark_url: data.logo_dark_url,
    cover_photo_url: data.cover_photo_url,
    gallery: data.gallery ?? [],
    video: data.video ?? {},
    about: data.about ?? {},
    languages: data.languages ?? [],
    coverage_cities: data.coverage_cities ?? [],
    license: data.license ?? null,
    tourism_business_role: data.tourism_business_role ?? null,
    founding_year: data.founding_year ?? null,
    employee_count: data.employee_count ?? null,
    legal_entity_type: data.legal_entity_type ?? null,
    legal_name: data.legal_name ?? null,
    registration_number: data.registration_number ?? null,
    short_description: data.short_description,
    categories: data.categories,
    tags: data.tags,
    country: data.country,
    city: data.city,
    website: data.website,
    social_links: data.social_links,
    contact_persons: data.contact_persons,
    vitrina_page_slug: data.vitrina_page_slug,
    synced_at: new Date().toISOString(),
  }

  if (data.marketplace_themes !== undefined) {
    row.marketplace_themes = data.marketplace_themes
  }

  const { error } = await supabase.schema('hub').from('company_cache').upsert(row, {
    onConflict: 'tenant_id',
  })

  if (error) {
    console.error('company_cache upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
