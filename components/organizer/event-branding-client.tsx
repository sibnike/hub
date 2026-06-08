'use client'

import { useEffect, useMemo, useState } from 'react'
import { FONT_PAIR_OPTIONS } from '@/lib/event-fonts'
import { buildHeroBg } from '@/lib/design/theme'
import { parseEventSettings, type EventSettings } from '@/lib/hub/event-settings'
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
import type { FontPairSlug } from '@/lib/event-fonts'
import type { HeroBgType } from '@/lib/design/theme'

export function EventBrandingClient({ slug }: { slug: string }) {
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
  const [footerText, setFooterText] = useState('')
  const [welcomeRu, setWelcomeRu] = useState('')
  const [welcomeEn, setWelcomeEn] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/organizer/events/${slug}/branding`)
        const json = (await res.json()) as { data?: EventSettings }
        if (json.data) applySettings(json.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  function applySettings(s: EventSettings) {
    setAccentColor(s.accent_color ?? '#3B82F6')
    setBrandColor(s.brand_color ?? '#0F172A')
    setFontPair(s.font_pair ?? 'modern')
    setHeroBgType(s.hero_bg_type ?? 'gradient')
    setGradientFrom(s.hero_bg_gradient_from ?? '#F8FAFC')
    setGradientTo(s.hero_bg_gradient_to ?? '#EFF6FF')
    setGradientAngle(String(s.hero_bg_gradient_angle ?? 135))
    setHeroSolid(s.hero_bg_solid ?? '#F8FAFC')
    setHeroImageUrl(s.hero_image_url ?? '')
    setLogoUrl(s.brand_logo_url ?? '')
    setFooterText(s.brand_footer_text ?? '')
    setWelcomeRu(s.welcome_message?.ru ?? '')
    setWelcomeEn(s.welcome_message?.en ?? '')
    setContactEmail(s.organizer_contacts?.email ?? '')
    setContactPhone(s.organizer_contacts?.phone ?? '')
    setContactWebsite(s.organizer_contacts?.website ?? '')
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

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${slug}/branding`, {
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
          brand_logo_url: logoUrl || undefined,
          brand_footer_text: footerText || undefined,
          welcome_message: {
            ru: welcomeRu.trim() || undefined,
            en: welcomeEn.trim() || undefined,
          },
          organizer_contacts: {
            email: contactEmail.trim() || undefined,
            phone: contactPhone.trim() || undefined,
            website: contactWebsite.trim() || undefined,
          },
        }),
      })
      const json = (await res.json()) as { error?: string; data?: { settings: Record<string, unknown> } }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data?.settings) applySettings(parseEventSettings(json.data.settings))
      setMessage('Сохранено')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>

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
              <Input className="mt-1 h-10" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
            <div>
              <Label>Бренд-цвет (заголовки)</Label>
              <Input className="mt-1 h-10" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
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
                {FONT_PAIR_OPTIONS.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.label} — {p.description}
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
              {(['gradient', 'image', 'solid'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={heroBgType === t}
                    onChange={() => setHeroBgType(t)}
                  />
                  {t === 'gradient' ? 'Градиент' : t === 'image' ? 'Картинка' : 'Однотонный'}
                </label>
              ))}
            </div>
            {heroBgType === 'gradient' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>От</Label>
                  <Input className="mt-1 h-10" type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} />
                </div>
                <div>
                  <Label>До</Label>
                  <Input className="mt-1 h-10" type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} />
                </div>
                <div>
                  <Label>Угол</Label>
                  <Input className="mt-1" type="number" value={gradientAngle} onChange={(e) => setGradientAngle(e.target.value)} />
                </div>
              </div>
            ) : null}
            {heroBgType === 'solid' ? (
              <div>
                <Label>Цвет</Label>
                <Input className="mt-1 h-10 w-32" type="color" value={heroSolid} onChange={(e) => setHeroSolid(e.target.value)} />
              </div>
            ) : null}
            {heroBgType === 'image' ? (
              <div>
                <Label>URL картинки</Label>
                <Input className="mt-1" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://..." />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Контент</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>URL логотипа</Label>
              <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>
            <div>
              <Label>Приветствие (RU)</Label>
              <Textarea className="mt-1" value={welcomeRu} onChange={(e) => setWelcomeRu(e.target.value)} />
            </div>
            <div>
              <Label>Приветствие (EN)</Label>
              <Textarea className="mt-1" value={welcomeEn} onChange={(e) => setWelcomeEn(e.target.value)} />
            </div>
            <div>
              <Label>Текст в подвале</Label>
              <Input className="mt-1" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Контакты организатора</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input className="mt-1" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label>Телефон</Label>
              <Input className="mt-1" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div>
              <Label>Сайт</Label>
              <Input className="mt-1" value={contactWebsite} onChange={(e) => setContactWebsite(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Превью hero</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-2xl h-48 flex flex-col justify-end p-4 relative overflow-hidden"
              style={{
                background: previewHero.startsWith('url(') ? undefined : previewHero,
                backgroundImage: previewHero.startsWith('url(') ? previewHero : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '--accent': accentColor,
                '--brand': brandColor,
              } as React.CSSProperties}
            >
              {previewHero.startsWith('url(') ? (
                <div className="absolute inset-0 bg-black/40" />
              ) : null}
              <div className="relative">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-8 mb-2 object-contain" />
                ) : null}
                <p className="font-heading text-lg font-semibold" style={{ color: brandColor }}>
                  Название выставки
                </p>
                <p className="text-xs mt-1" style={{ color: brandColor, opacity: 0.7 }}>
                  Astana · 1–4 октября
                </p>
                <span
                  className="inline-block mt-3 px-4 py-1.5 rounded-xl text-white text-xs font-medium"
                  style={{ backgroundColor: accentColor }}
                >
                  Открыть каталог
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Шрифт: {fontPair}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
