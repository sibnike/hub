import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdminOrPlatform } from '@/lib/auth/current-tenant'
import { generateAccessCode, hashAccessCode } from '@/lib/access-code'
import { sendInvitation } from '@/lib/email/send-invitation'
import { joinTenants } from '@/lib/hub/join-tenants'
import { ensurePlaceholderMaps } from '@/lib/map/utils'
import type { HubEventRow } from '@/types/hub-event'
import type { ParticipationRow } from '@/types/participation'

type RouteParams = { params: { slug: string } }

type ParticipantInput = {
  email: string
  stand_number?: string
  pavilion?: string
  floor?: number
}

type StandRow = {
  id: string
  participation_id: string
  stand_number: string | null
  pavilion: string | null
  floor: number | null
}

async function loadEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as HubEventRow | null
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: participations, error: partError } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('*')
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 })
  }

  const rows = participations ?? []
  if (!rows.length) {
    return NextResponse.json({ data: [], event })
  }

  const participationIds = rows.map((p) => p.id)
  const { data: stands, error: standsError } = await supabase
    .schema('hub')
    .from('event_stands')
    .select('id, participation_id, stand_number, pavilion, floor')
    .in('participation_id', participationIds)

  if (standsError) {
    return NextResponse.json({ error: standsError.message }, { status: 500 })
  }

  const withTenants = await joinTenants(rows)
  const standsByParticipation = new Map<string, StandRow[]>()
  for (const stand of stands ?? []) {
    const pid = String(stand.participation_id)
    const list = standsByParticipation.get(pid) ?? []
    list.push(stand as StandRow)
    standsByParticipation.set(pid, list)
  }

  const data: ParticipationRow[] = withTenants.map((p) => {
    const participationStands = standsByParticipation.get(p.id) ?? []
    const mappedStands = participationStands.map((s) => ({
      id: s.id,
      stand_number: s.stand_number ?? '',
      pavilion: s.pavilion ?? '',
      floor: s.floor ?? 1,
    }))

    return {
      ...p,
      stand:
        mappedStands.length > 0
          ? mappedStands.length === 1
            ? mappedStands[0]
            : mappedStands
          : null,
    }
  })

  return NextResponse.json({ data, event })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const event = await loadEventBySlug(params.slug)
  if (!event || !(await assertTenantAdminOrPlatform(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { participants?: ParticipantInput[] }
  const participants = body.participants ?? []
  if (participants.length === 0) {
    return NextResponse.json({ error: 'participants required' }, { status: 400 })
  }

  const supabase = await createClient()
  const results: { email: string; code: string; status: string; error?: string }[] =
    []
  const mapPairs = new Map<string, { pavilion: string; floor: number }>()

  for (const p of participants) {
    const email = p.email.trim().toLowerCase()
    if (!email) continue

    try {
      const code = generateAccessCode(event.id, email, event.access_code_salt)
      const codeHash = hashAccessCode(code)

      const { data: participation, error: partError } = await supabase
        .schema('hub')
        .from('event_participations')
        .insert({
          event_id: event.id,
          tenant_id: null,
          invited_email: email,
          access_code: codeHash,
          status: 'pending',
        })
        .select()
        .single()

      if (partError) {
        results.push({ email, code, status: 'error', error: partError.message })
        continue
      }

      if (participation && p.stand_number) {
        const pavilion = p.pavilion?.trim() || 'main'
        const floor = p.floor ?? 1
        await supabase.schema('hub').from('event_stands').insert({
          participation_id: participation.id,
          event_id: event.id,
          tenant_id: null,
          stand_number: p.stand_number,
          pavilion,
          floor,
        })
        mapPairs.set(`${pavilion}:${floor}`, { pavilion, floor })
      }

      await sendInvitation(email, event, code)
      results.push({ email, code, status: 'created' })
    } catch (e) {
      results.push({
        email,
        code: '',
        status: 'error',
        error: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  if (mapPairs.size > 0) {
    await ensurePlaceholderMaps(supabase, event.id, Array.from(mapPairs.values()))
  }

  return NextResponse.json({ results })
}
