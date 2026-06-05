import { createAdminClient } from '@/lib/supabase/admin'
import type { IndustryCategory } from '@/types/catalog'
import type { I18nMap } from '@/types/hub-event'

export async function getIndustryCategories(): Promise<IndustryCategory[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('industry_categories')
    .select('slug, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('[getIndustryCategories]', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    slug: String(row.slug),
    name: (row.name ?? {}) as I18nMap,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
  }))
}
