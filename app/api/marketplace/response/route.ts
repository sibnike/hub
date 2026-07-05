import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { applyMarketplaceResponse } from '@/lib/marketplace/apply-marketplace-response'

type ResponseBody = {
  marketplace_request_target_id?: string
  response_status?: 'accepted' | 'declined'
  response_message?: string | null
  vitrina_submission_id?: string | null
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-vitrina-signature')
  const bodyText = await request.text()

  const expected = createHmac('sha256', process.env.VITRINA_WEBHOOK_SECRET!)
    .update(bodyText)
    .digest('hex')

  if (signature !== `sha256=${expected}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: ResponseBody
  try {
    body = JSON.parse(bodyText) as ResponseBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetId = body.marketplace_request_target_id?.trim()
  const responseStatus = body.response_status

  if (!targetId) {
    return NextResponse.json(
      { error: 'marketplace_request_target_id required' },
      { status: 400 }
    )
  }

  if (responseStatus !== 'accepted' && responseStatus !== 'declined') {
    return NextResponse.json(
      { error: 'response_status must be accepted or declined' },
      { status: 400 }
    )
  }

  try {
    const result = await applyMarketplaceResponse({
      marketplace_request_target_id: targetId,
      response_status: responseStatus,
      response_message: body.response_message,
      vitrina_submission_id: body.vitrina_submission_id,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed'
    console.error('[marketplace/response]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
