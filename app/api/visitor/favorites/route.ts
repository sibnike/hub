import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVisitorFromCookie } from '@/lib/visitor/current'

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('event_id')
  const payload = await getVisitorFromCookie()

  if (!eventId || !payload || payload.event_id !== eventId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitor_favorites')
    .select('*')
    .eq('visitor_id', payload.visitor_id)
    .order('saved_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    event_id: string
    tenant_id: string
    action: 'add' | 'remove' | 'update'
    status?: 'planned' | 'met' | 'skipped'
    note?: string
  }

  const payload = await getVisitorFromCookie()
  if (!payload || payload.event_id !== body.event_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  if (body.action === 'remove') {
    await supabase
      .schema('hub')
      .from('event_visitor_favorites')
      .delete()
      .eq('visitor_id', payload.visitor_id)
      .eq('tenant_id', body.tenant_id)

    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update') {
    const updates: Record<string, unknown> = {}
    if (body.status) {
      updates.status = body.status
      updates.met_at = body.status === 'met' ? new Date().toISOString() : null
    }
    if (body.note !== undefined) updates.note = body.note

    const { data, error } = await supabase
      .schema('hub')
      .from('event_visitor_favorites')
      .update(updates)
      .eq('visitor_id', payload.visitor_id)
      .eq('tenant_id', body.tenant_id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data })
  }

  const { data, error } = await supabase
    .schema('hub')
    .from('event_visitor_favorites')
    .upsert(
      {
        visitor_id: payload.visitor_id,
        tenant_id: body.tenant_id,
        status: 'planned',
      },
      { onConflict: 'visitor_id,tenant_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
