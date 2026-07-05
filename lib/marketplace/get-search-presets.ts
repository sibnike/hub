import { createAdminClient } from '@/lib/supabase/admin'
import type { SearchPresetParam, SearchPresetRow } from '@/types/marketplace-guided-search'

function normalizeRequiredParams(raw: unknown): SearchPresetParam[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set<SearchPresetParam>(['city', 'dates', 'people'])
  return raw.filter((v): v is SearchPresetParam => typeof v === 'string' && allowed.has(v as SearchPresetParam))
}

function normalizeClarifyHints(raw: unknown): Record<string, Record<string, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, Record<string, string>> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = value as Record<string, string>
    }
  }
  return out
}

function toPresetRow(row: Record<string, unknown>): SearchPresetRow {
  return {
    id: String(row.id),
    marketplace_id: String(row.marketplace_id),
    theme_slug: String(row.theme_slug),
    name: (row.name as SearchPresetRow['name']) ?? {},
    hint_template: (row.hint_template as SearchPresetRow['hint_template']) ?? {},
    required_params: normalizeRequiredParams(row.required_params),
    clarify_hints: normalizeClarifyHints(row.clarify_hints),
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  }
}

export async function getSearchPresetsForMarketplace(
  marketplaceId: string,
  activeOnly = true
): Promise<SearchPresetRow[]> {
  const supabase = createAdminClient()
  let query = supabase
    .schema('hub')
    .from('search_presets')
    .select('*')
    .eq('marketplace_id', marketplaceId)
    .order('sort_order', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getSearchPresetsForMarketplace]', error.message)
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => toPresetRow(row as Record<string, unknown>))
}

export async function getSearchPresetById(
  marketplaceId: string,
  presetId: string
): Promise<SearchPresetRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('hub')
    .from('search_presets')
    .select('*')
    .eq('marketplace_id', marketplaceId)
    .eq('id', presetId)
    .maybeSingle()

  if (error) {
    console.error('[getSearchPresetById]', error.message)
    return null
  }

  if (!data) return null
  return toPresetRow(data as Record<string, unknown>)
}
