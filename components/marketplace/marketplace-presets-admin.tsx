'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { SearchPresetParam, SearchPresetRow } from '@/types/marketplace-guided-search'

type PresetsAdminClientProps = {
  marketplaceSlug: string
  marketplaceName: string
  themeSlugs: string[]
}

type PresetDraft = {
  id?: string
  theme_slug: string
  name_ru: string
  hint_ru: string
  required_params: SearchPresetParam[]
  sort_order: number
  is_active: boolean
}

function toDraft(preset: SearchPresetRow): PresetDraft {
  return {
    id: preset.id,
    theme_slug: preset.theme_slug,
    name_ru: preset.name.ru ?? '',
    hint_ru: preset.hint_template.ru ?? '',
    required_params: preset.required_params,
    sort_order: preset.sort_order,
    is_active: preset.is_active,
  }
}

function emptyDraft(themeSlugs: string[]): PresetDraft {
  return {
    theme_slug: themeSlugs[0] ?? 'tourism',
    name_ru: '',
    hint_ru: '',
    required_params: ['city', 'dates', 'people'],
    sort_order: 0,
    is_active: true,
  }
}

export function PresetsAdminClient({
  marketplaceSlug,
  themeSlugs,
}: PresetsAdminClientProps) {
  const [presets, setPresets] = useState<SearchPresetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PresetDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const loadPresets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/marketplace/${marketplaceSlug}/presets`)
      const json = (await res.json()) as { error?: string; presets?: SearchPresetRow[] }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка загрузки')
        return
      }
      setPresets(json.presets ?? [])
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [marketplaceSlug])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setError(null)

    const payload = {
      theme_slug: draft.theme_slug,
      name: { ru: draft.name_ru },
      hint_template: { ru: draft.hint_ru },
      required_params: draft.required_params,
      sort_order: draft.sort_order,
      is_active: draft.is_active,
    }

    try {
      const res = draft.id
        ? await fetch(
            `/api/admin/marketplace/${marketplaceSlug}/presets/${draft.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          )
        : await fetch(`/api/admin/marketplace/${marketplaceSlug}/presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setError(json.error ?? 'Ошибка сохранения')
        return
      }

      setDraft(null)
      await loadPresets()
    } catch {
      setError('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  async function deletePreset(id: string) {
    if (!confirm('Удалить пресет?')) return
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/marketplace/${marketplaceSlug}/presets/${id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setError(json.error ?? 'Ошибка удаления')
        return
      }
      await loadPresets()
    } catch {
      setError('Ошибка сети')
    }
  }

  function toggleParam(param: SearchPresetParam) {
    if (!draft) return
    const has = draft.required_params.includes(param)
    setDraft({
      ...draft,
      required_params: has
        ? draft.required_params.filter((p) => p !== param)
        : [...draft.required_params, param],
    })
  }

  return (
    <>
      <div className="mb-4">
        <Button size="sm" onClick={() => setDraft(emptyDraft(themeSlugs))}>
          Новый пресет
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}

      {draft ? (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">
            {draft.id ? 'Редактирование' : 'Новый пресет'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-[var(--muted)]">Тема</span>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={draft.theme_slug}
                onChange={(e) => setDraft({ ...draft, theme_slug: e.target.value })}
              >
                {themeSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-[var(--muted)]">Порядок</span>
              <input
                type="number"
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={draft.sort_order}
                onChange={(e) =>
                  setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="text-[var(--muted)]">Название (ru)</span>
              <input
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={draft.name_ru}
                onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="text-[var(--muted)]">Заготовка текста (ru)</span>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                rows={3}
                value={draft.hint_ru}
                onChange={(e) => setDraft({ ...draft, hint_ru: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['city', 'dates', 'people'] as SearchPresetParam[]).map((param) => (
              <button
                key={param}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  draft.required_params.includes(param)
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-foreground'
                    : 'text-[var(--muted)]'
                }`}
                onClick={() => toggleParam(param)}
              >
                {param}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
            Активен
          </label>

          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={saving || !draft.name_ru.trim()} onClick={() => void saveDraft()}>
              Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {presets.map((preset) => (
          <li
            key={preset.id}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {preset.name.ru ?? preset.theme_slug}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {preset.theme_slug} · порядок {preset.sort_order} ·{' '}
                  {preset.is_active ? 'активен' : 'выключен'}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Параметры: {preset.required_params.join(', ') || '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(preset))}>
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void deletePreset(preset.id)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
