/**
 * Vercel serverless wall-clock for heavy marketplace / events handlers.
 * Requires Pro (Hobby caps at 10s). Raise only with evidence from function logs.
 *
 * P2 backlog (not now):
 * - Job queue (QStash / Inngest) for marketplace dispatch after request insert
 * - Availability check concurrency (pool 3–5)
 * - Participants CSV: send invites after HTTP response / chunked
 * Trigger: FUNCTION_INVOCATION_TIMEOUT in Vercel logs or growing multi-target volume.
 * See: docs/HUB_ARCHITECTURE.md §Serverless limits, HUB_ROADMAP-next.md tech debt
 */
export const HEAVY_API_MAX_DURATION_SEC = 60
