/** Anthropic model for marketplace query parsing (server-only). */
export const ANTHROPIC_MARKETPLACE_MODEL =
  process.env.ANTHROPIC_MARKETPLACE_MODEL ??
  process.env.ANTHROPIC_TRANSLATE_MODEL ??
  'claude-sonnet-4-20250514'

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
