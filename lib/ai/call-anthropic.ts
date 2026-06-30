import { ANTHROPIC_API_URL, ANTHROPIC_TRANSLATE_MODEL } from '@/lib/ai/anthropic-config'

export async function callAnthropic(params: {
  system: string
  user: string
  maxTokens: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY не настроен на сервере')
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_TRANSLATE_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(
      errBody ? `Anthropic API: ${res.status}` : `Anthropic API error (${res.status})`
    )
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content?.find((c) => c.type === 'text')
  const raw = textBlock?.text?.trim()
  if (!raw) {
    throw new Error('Пустой ответ от модели')
  }
  return raw
}
