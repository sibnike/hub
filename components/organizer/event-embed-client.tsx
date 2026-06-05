'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseEventSettings } from '@/lib/hub/event-settings'
import type { HubEventRow } from '@/types/hub-event'

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button size="sm" variant="outline" className="absolute right-2 top-2" onClick={() => void copy()}>
        {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
        {copied ? 'Скопировано' : 'Скопировать'}
      </Button>
    </div>
  )
}

export function EventEmbedClient({ slug }: { slug: string }) {
  const hubDomain = process.env.NEXT_PUBLIC_HUB_DOMAIN ?? 'hub.yanbada.com'
  const hubUrl = `https://${hubDomain}`

  const [event, setEvent] = useState<HubEventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [customDomain, setCustomDomain] = useState('')
  const [domainPrefix, setDomainPrefix] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState('')
  const [brandFooterText, setBrandFooterText] = useState('')

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/organizer/events/${slug}`)
      const json = (await res.json()) as { data?: HubEventRow; error?: string }
      if (json.data) {
        setEvent(json.data)
        const s = parseEventSettings(json.data.settings)
        setCustomDomain(s.custom_domain ?? '')
        setDomainPrefix(s.custom_domain_prefix ?? '')
        setBrandLogoUrl(s.brand_logo_url ?? '')
        setBrandColor(s.brand_color ?? '')
        setBrandFooterText(s.brand_footer_text ?? '')
      }
      setLoading(false)
    })()
  }, [slug])

  async function saveBranding() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            custom_domain: customDomain.trim() || null,
            custom_domain_prefix: domainPrefix.trim() || null,
            brand_logo_url: brandLogoUrl.trim() || null,
            brand_color: brandColor.trim() || null,
            brand_footer_text: brandFooterText.trim() || null,
          },
        }),
      })
      const json = (await res.json()) as { data?: HubEventRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data) setEvent(json.data)
      setMessage('Сохранено')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const iframeFixed = `<iframe
  src="${hubUrl}/e/${slug}/catalog?embed=1"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none;"
></iframe>`

  const iframeAuto = `<iframe
  id="yanbada-hub"
  src="${hubUrl}/e/${slug}/catalog?embed=1"
  width="100%"
  frameborder="0"
  style="border: none; min-height: 600px;"
></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'yanbada-hub-height') {
      document.getElementById('yanbada-hub').style.height = e.data.height + 'px';
    }
  });
</script>`

  const widgetCode = `<script src="${hubUrl}/widgets/hub-widget.js" data-event="${slug}" async></script>
<button data-yanbada-hub="${slug}">Открыть каталог участников</button>
<button data-yanbada-hub="${slug}" data-yanbada-view="map">Открыть карту</button>`

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>

  const title = event?.name.ru ?? event?.name.en ?? slug

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Встраивание и white-label</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <Link href={`/organizer/events/${slug}`} className="text-sm text-primary hover:underline">
          ← К событию
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Iframe (фиксированная высота)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyBlock code={iframeFixed} />
          <div>
            <p className="mb-2 text-sm font-medium">Превью каталога</p>
            <iframe
              src={`/e/${slug}/catalog?embed=1`}
              title="Превью каталога"
              className="w-full rounded-lg border"
              style={{ height: 480 }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Iframe с авто-высотой</CardTitle>
        </CardHeader>
        <CardContent>
          <CopyBlock code={iframeAuto} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Виджет-скрипт (overlay)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyBlock code={widgetCode} />
          <p className="text-xs text-muted-foreground">
            Вставьте код на свой сайт. Кнопки откроют каталог или карту в overlay.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Превью карты</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src={`/e/${slug}/map?embed=1`}
            title="Превью карты"
            className="w-full rounded-lg border"
            style={{ height: 480 }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Кастомный домен (white-label)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Настройте CNAME вашего домена на Vercel (cname.vercel-dns.com), затем добавьте домен в
            Vercel UI. Для локального теста можно указать <code>localhost:3001</code>.
          </p>
          <div>
            <Label>Домен</Label>
            <Input
              className="mt-1"
              placeholder="digitalbridge.kz"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
            />
          </div>
          <div>
            <Label>Префикс пути</Label>
            <Input
              className="mt-1"
              placeholder="/exhibitor"
              value={domainPrefix}
              onChange={(e) => setDomainPrefix(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Например: digitalbridge.kz/exhibitor/catalog
            </p>
          </div>
          <div>
            <Label>Лого организатора (URL)</Label>
            <Input
              className="mt-1"
              value={brandLogoUrl}
              onChange={(e) => setBrandLogoUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>Бренд-цвет</Label>
            <Input
              className="mt-1"
              placeholder="#4f46e5"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </div>
          <div>
            <Label>Текст в подвале</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={brandFooterText}
              onChange={(e) => setBrandFooterText(e.target.value)}
              placeholder="© 2025 DigitalBridge"
            />
          </div>
          <Button disabled={saving} onClick={() => void saveBranding()}>
            {saving ? 'Сохранение…' : 'Сохранить настройки'}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
