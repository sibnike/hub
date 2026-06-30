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

  const data = JSON.parse(body) as {
    tenant_id: string
    name?: string
    logo_url?: string
    short_description?: Record<string, string>
    categories?: string[]
    tags?: string[]
    country?: string
    city?: string
    website?: string
    social_links?: Record<string, string>
    contact_persons?: unknown[]
    vitrina_page_slug?: string
  }

  const { error } = await supabase.schema('hub').from('company_cache').upsert(
    {
      tenant_id: data.tenant_id,
      name: data.name,
      logo_url: data.logo_url,
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
    },
    { onConflict: 'tenant_id' }
  )

  if (error) {
    console.error('company_cache upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
