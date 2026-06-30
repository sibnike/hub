import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ListingSyncBody = {
  action: 'upsert' | 'delete'
  tenant_id: string
  page_slug: string
  title?: Record<string, string>
  short_text?: Record<string, string>
  categories?: string[]
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-vitrina-signature')
  const body = await request.text()

  const expected = createHmac('sha256', process.env.VITRINA_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== `sha256=${expected}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = JSON.parse(body) as ListingSyncBody

  if (!data.tenant_id || !data.page_slug || !data.action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (data.action === 'delete') {
    const { error } = await supabase
      .schema('hub')
      .from('listing_cache')
      .delete()
      .eq('tenant_id', data.tenant_id)
      .eq('page_slug', data.page_slug)

    if (error) {
      console.error('listing_cache delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase.schema('hub').from('listing_cache').upsert(
    {
      tenant_id: data.tenant_id,
      page_slug: data.page_slug,
      title: data.title ?? {},
      short_text: data.short_text ?? {},
      categories: data.categories ?? [],
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,page_slug' }
  )

  if (error) {
    console.error('listing_cache upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
