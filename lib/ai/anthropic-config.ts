/** Anthropic model for content translation (server-only). */
export const ANTHROPIC_TRANSLATE_MODEL =
  process.env.ANTHROPIC_TRANSLATE_MODEL ?? 'claude-sonnet-4-6'

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/** Max chars of source text per translate request (all fields combined). */
export const TRANSLATE_MAX_CHARS = 12_000
