'use client'

import { useEffect, useMemo, useState } from 'react'
import { FONT_PAIR_OPTIONS, type FontPairSlug } from '@/lib/event-fonts'
import { buildHeroBg, type HeroBgType } from '@/lib/design/theme'
import {
  parseMarketplaceSettings,
  type MarketplaceSettings,
} from '@/lib/marketplace/marketplace-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { I18nMap } from '@/types/hub-event'

type LocaleField = 'display_name' | 'hero_title' | 'hero_subtitle' | 'footer_text'

const LOCALES = ['ru', 'kz', 'en'] as const

type LocaleState = Record<(typeof LOCALES)[number], string>

function emptyLocaleState(): LocaleState {
  return { ru: '', kz: '', en: '' }
}

function localeFromMap(map?: I18nMap): LocaleState {
  return {
    ru: map?.ru ?? '',
    kz: map?.kz ?? '',
    en: map?.en ?? '',
  }
}

function mapFromLocale(state: LocaleState): I18nMap | undefined {
  const map: I18nMap = {}
  for (const loc of LOCALES) {
    const value = state[loc].trim()
    if (value) map[loc] = value
  }
  return Object.keys(map).length > 0 ? map : undefined
}

export function MarketplaceBrandingAdmin({ marketplaceSlug }: { marketplaceSlug: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [accentColor, setAccentColor] = useState('#3B82F6')
  const [brandColor, setBrandColor] = useState('#0F172A')
  const [fontPair, setFontPair] = useState<FontPairSlug>('modern')
  const [heroBgType, setHeroBgType] = useState<HeroBgType>('gradient')
  const [gradientFrom, setGradientFrom] = useState('#F8FAFC')
  const [gradientTo, setGradientTo] = useState('#EFF6FF')
  const [gradientAngle, setGradientAngle] = useState('135')
  const [heroSolid, setHeroSolid] = useState('#F8FAFC')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [displayName, setDisplayName] = useState<LocaleState>(emptyLocaleState())
  const [heroTitle, setHeroTitle] = useState<LocaleState>(emptyLocaleState())
  const [heroSubtitle, setHeroSubtitle] = useState<LocaleState>(emptyLocaleState())
  const [footerText, setFooterText] = useState<LocaleState>(emptyLocaleState())

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/marketplace/${marketplaceSlug}/branding`)
        const json = (await res.json()) as { data?: MarketplaceSettings }
        if (json.data) applySettings(json.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [marketplaceSlug])

  function applySettings(settings: MarketplaceSettings) {
    setAccentColor(settings.accent_color ?? '#3B82F6')
    setBrandColor(settings.brand_color ?? '#0F172A')
    setFontPair(settings.font_pair ?? 'modern')
    setHeroBgType(settings.hero_bg_type ?? 'gradient')
    setGradientFrom(settings.hero_bg_gradient_from ?? '#F8FAFC')
    setGradientTo(settings.hero_bg_gradient_to ?? '#EFF6FF')
    setGradientAngle(String(settings.hero_bg_gradient_angle ?? 135))
    setHeroSolid(settings.hero_bg_solid ?? '#F8FAFC')
    setHeroImageUrl(settings.hero_image_url ?? '')
    setLogoUrl(settings.logo_url ?? '')
    setFaviconUrl(settings.favicon_url ?? '')
    setDisplayName(localeFromMap(settings.display_name))
    setHeroTitle(localeFromMap(settings.hero_title))
    setHeroSubtitle(localeFromMap(settings.hero_subtitle))
    setFooterText(localeFromMap(settings.footer_text))
  }

  const previewHero = useMemo(
    () =>
      buildHeroBg({
        hero_bg_type: heroBgType,
        hero_bg_gradient_from: gradientFrom,
        hero_bg_gradient_to: gradientTo,
        hero_bg_gradient_angle: parseInt(gradientAngle, 10) || 135,
        hero_bg_solid: heroSolid,
        hero_image_url: heroImageUrl || undefined,
      }),
    [heroBgType, gradientFrom, gradientTo, gradientAngle, heroSolid, heroImageUrl]
  )

  function updateLocale(
    field: LocaleField,
    locale: (typeof LOCALES)[number],
    value: string
  ) {
    const setter = {
      display_name: setDisplayName,
      hero_title: setHeroTitle,
      hero_subtitle: setHeroSubtitle,
      footer_text: setFooterText,
    }[field]
    setter((prev) => ({ ...prev, [locale]: value }))
  }

  function localeValue(field: LocaleField, locale: (typeof LOCALES)[number]): string {
    const map = {
      display_name: displayName,
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      footer_text: footerText,
    }[field]
    return map[locale]
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/marketplace/${marketplaceSlug}/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accent_color: accentColor,
          brand_color: brandColor,
          font_pair: fontPair,
          hero_bg_type: heroBgType,
          hero_bg_gradient_from: gradientFrom,
          hero_bg_gradient_to: gradientTo,
          hero_bg_gradient_angle: parseInt(gradientAngle, 10) || 135,
          hero_bg_solid: heroSolid,
          hero_image_url: heroImageUrl || undefined,
          logo_url: logoUrl || undefined,
          favicon_url: faviconUrl || undefined,
          display_name: mapFromLocale(displayName),
          hero_title: mapFromLocale(heroTitle),
          hero_subtitle: mapFromLocale(heroSubtitle),
          footer_text: mapFromLocale(footerText),
        }),
      })
      const json = (await res.json()) as {
        error?: string
        data?: { settings: Record<string, unknown> }
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data?.settings) {
        applySettings(parseMarketplaceSettings(json.data.settings))
      }
      setMessage('Сохранено')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Загрузка…</p>

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Цвета</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Акцентный цвет</Label>
              <Input
                className="mt-1 h-10"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
              />
            </div>
            <div>
              <Label>Бренд-цвет (заголовки)</Label>
              <Input
                className="mt-1 h-10"
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Шрифт-пара</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={fontPair} onValueChange={(v) => v && setFontPair(v as FontPairSlug)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_PAIR_OPTIONS.map((pair) => (
                  <SelectItem key={pair.slug} value={pair.slug}>
                    {pair.label} — {pair.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hero-фон</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {(['gradient', 'image', 'solid'] as const).map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={heroBgType === type}
                    onChange={() => setHeroBgType(type)}
                  />
                  {type === 'gradient' ? 'Градиент' : type === 'image' ? 'Картинка' : 'Однотонный'}
                </label>
              ))}
            </div>
            {heroBgType === 'gradient' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>От</Label>
                  <Input
                    className="mt-1 h-10"
                    type="color"
                    value={gradientFrom}
                    onChange={(e) => setGradientFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label>До</Label>
                  <Input
                    className="mt-1 h-10"
                    type="color"
                    value={gradientTo}
                    onChange={(e) => setGradientTo(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Угол</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    value={gradientAngle}
                    onChange={(e) => setGradientAngle(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            {heroBgType === 'solid' ? (
              <div>
                <Label>Цвет</Label>
                <Input
                  className="mt-1 h-10 w-32"
                  type="color"
                  value={heroSolid}
                  onChange={(e) => setHeroSolid(e.target.value)}
                />
              </div>
            ) : null}
            {heroBgType === 'image' ? (
              <div>
                <Label>URL картинки</Label>
                <Input
                  className="mt-1"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Логотип и favicon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>URL логотипа</Label>
              <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>
            <div>
              <Label>URL favicon</Label>
              <Input
                className="mt-1"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {(
          [
            ['display_name', 'Название в хедере'],
            ['hero_title', 'Заголовок hero'],
            ['hero_subtitle', 'Подзаголовок hero'],
            ['footer_text', 'Текст в подвале'],
          ] as const
        ).map(([field, label]) => (
          <Card key={field}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {LOCALES.map((locale) => (
                <div key={locale}>
                  <Label className="uppercase">{locale}</Label>
                  {field === 'hero_subtitle' || field === 'footer_text' ? (
                    <Textarea
                      className="mt-1"
                      value={localeValue(field, locale)}
                      onChange={(e) => updateLocale(field, locale, e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <Input
                      className="mt-1"
                      value={localeValue(field, locale)}
                      onChange={(e) => updateLocale(field, locale, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Превью hero</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-6"
              style={{
                background: previewHero,
                backgroundSize: heroBgType === 'image' ? 'cover' : undefined,
              }}
            >
              <p className="font-heading text-lg font-semibold" style={{ color: brandColor }}>
                {heroTitle.ru || displayName.ru || 'Заголовок'}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {heroSubtitle.ru || 'Подзаголовок'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Превью акцента</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              Кнопка
            </button>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
