import { NextRequest, NextResponse } from 'next/server'
import { createMarketplaceRequest } from '@/lib/marketplace/create-marketplace-request'
import { normalizeRequestParsed } from '@/lib/marketplace/normalize-request-parsed'
import { checkRateLimit } from '@/lib/rate-limit'
import type { MarketplaceRequestParsed } from '@/types/marketplace-request'

type RequestBody = {
  requester_name?: string
  requester_contact?: string
  request_text?: string
  target_limit?: number
  /** Skip AI when testing with a pre-built parsed object */
  parsed?: Partial<MarketplaceRequestParsed> & {
    search?: Partial<MarketplaceRequestParsed['search']>
  }
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(`marketplace-request:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  try {
    const body = (await request.json()) as RequestBody

    const name = typeof body.requester_name === 'string' ? body.requester_name.trim() : ''
    const contact =
      typeof body.requester_contact === 'string' ? body.requester_contact.trim() : ''
    const text = typeof body.request_text === 'string' ? body.request_text.trim() : ''

    if (!name || !contact || !text) {
      return NextResponse.json(
        { error: 'Укажите requester_name, requester_contact и request_text' },
        { status: 400 }
      )
    }

    const parsedOverride = body.parsed
      ? normalizeRequestParsed(body.parsed, undefined, text)
      : undefined

    const result = await createMarketplaceRequest(
      {
        requester_name: name,
        requester_contact: contact,
        request_text: text,
        target_limit:
          typeof body.target_limit === 'number' && body.target_limit > 0
            ? Math.min(body.target_limit, 20)
            : undefined,
      },
      parsedOverride
        ? { parsed: parsedOverride, parsedByAi: false }
        : undefined
    )

    return NextResponse.json({
      request_id: result.request.id,
      access_token: result.request.access_token,
      matched_count: result.matched_count,
      dispatched_count: result.dispatched_count,
      target_tenant_ids: result.targets.map((t) => t.tenant_id),
      parsed: result.parsed,
      parsed_by_ai: result.parsed_by_ai,
      dispatch_pending: result.matched_count > 0 && result.dispatched_count === 0,
      dispatch_results: result.dispatch_results,
      message:
        result.matched_count === 0
          ? 'Подходящих исполнителей не найдено'
          : result.dispatched_count > 0
            ? `Запрос отправлен ${result.dispatched_count} исполнител${result.dispatched_count === 1 ? 'ю' : 'ям'}. Ожидайте связи.`
            : 'Исполнители найдены, но доставка в Vitrina не удалась — попробуйте позже',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Request failed'
    console.error('[marketplace/request]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
