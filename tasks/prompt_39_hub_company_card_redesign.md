> Открой `tasks/prompt_39_hub_company_card_redesign.md` и выполни задачу. Положи в `mega-hub/tasks/`. Переработка страницы карточки компании в контексте события — добавить embed страницы Vitrina, кнопки действий, кнопку избранного с трекингом.

# H-8 — Карточка компании в контексте события (redesign)

## Контекст

Сейчас `/e/[slug]/company/[tenantSlug]` показывает упрощённую карточку из `company_cache`. Нужно сделать полноценную страницу:

1. **Шапка с контекстом выставки** — лого, название, стенд, кнопки действий
2. **Embed страницы Vitrina** — полная страница компании iframe'ом
3. **Кнопка «В избранное»** — гость сохраняет в localStorage, трекается как `save` event
4. **Кнопки-заглушки** — «Запрос на встречу», «Связаться» (UI без логики)

Эмодзи не используем — только Lucide иконки.

---

## Задача

### 1. Структура страницы

`app/e/[slug]/company/[tenantSlug]/page.tsx` — заменить текущий контент.

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Лого]   TouchIn                                                    │
│           Мы хорошая компания.                                       │
│           [Продукты питания]  [Tag]  [Tag]                           │
│           Казахстан · Astana                                         │
│                                                                      │
│  ┌──────────────┐ ┌──────────────────┐ ┌────────────┐ ┌────────────┐│
│  │ MapPin       │ │ ExternalLink     │ │ Handshake  │ │ Star       ││
│  │ На карте     │ │ Открыть профиль  │ │ Встреча    │ │ Сохранить  ││
│  └──────────────┘ └──────────────────┘ └────────────┘ └────────────┘│
│                                                                      │
│  Стенд D-02 · main · этаж 1                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ╔══════════════════════════════════════════════════════════════════╗│
│  ║                                                                  ║│
│  ║         IFRAME страницы Vitrina (если есть)                      ║│
│  ║         https://vitrina.yanbada.com/p/ourcompany?embed=1         ║│
│  ║                                                                  ║│
│  ╚══════════════════════════════════════════════════════════════════╝│
│                                                                      │
│  ← К каталогу                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 2. Шапка с действиями

Компонент `components/public/company-context-header.tsx`:

```typescript
interface Props {
  company: CompanyCache       // из company_cache
  stand?: EventStand          // из event_stands
  event: Event                // hub.events
}
```

Содержимое:
- Логотип (если `company.logo_url`, иначе плейсхолдер с инициалами)
- Название (большим шрифтом)
- Краткое описание `short_description[lang]`
- Бейджи категорий (первые 3-4, остальные «+N» в tooltip)
- Страна, город
- Стенд под кнопками: `«Стенд {stand_number} · {pavilion} · этаж {floor}»`

Кнопки (через shadcn Button, иконки Lucide):

| Кнопка | Иконка | Действие |
|---|---|---|
| На карте | `MapPin` | Редирект `/e/{slug}/map?stand={stand.id}` |
| Открыть профиль | `ExternalLink` | Открывает `vitrina.yanbada.com/p/{vitrina_page_slug}?ref=catalog&event={slug}` в новой вкладке |
| Встреча | `Handshake` | Toast «Функция скоро будет доступна» |
| Сохранить | `Star` / `StarOff` | Toggle избранное (см. ниже) |

### 3. Embed Vitrina-страницы

Если `company.vitrina_page_slug` существует:

```tsx
<div className="rounded-lg overflow-hidden border bg-card">
  <iframe
    src={`${process.env.NEXT_PUBLIC_VITRINA_PUBLIC_URL}/p/${company.vitrina_page_slug}?embed=1&ref=catalog&event=${eventSlug}`}
    className="w-full"
    style={{ minHeight: 600, border: 0 }}
    title={`Профиль ${company.name}`}
    id="vitrina-embed"
  />
</div>
```

Auto-height через `postMessage` — Vitrina в `?embed=1` режиме шлёт высоту, Hub слушает и подгоняет iframe:

```tsx
'use client'
import { useEffect, useRef } from 'react'

export function VitrinaEmbed({ slug, eventSlug }: { slug: string; eventSlug: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.data?.type === 'vitrina-page-height' && iframeRef.current) {
        iframeRef.current.style.height = `${e.data.height}px`
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src={`${process.env.NEXT_PUBLIC_VITRINA_PUBLIC_URL}/p/${slug}?embed=1&ref=catalog&event=${eventSlug}`}
      className="w-full"
      style={{ minHeight: 600, border: 0 }}
      title="Vitrina page"
    />
  )
}
```

Если `vitrina_page_slug` нет — показать сообщение:
> «Компания пока не создала страницу-визитку.»

### 4. «В избранное» — клиентская логика

`lib/hooks/use-favorites.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'yanbada_favorites'

type FavoriteRecord = {
  event_slug: string
  tenant_slug: string
  tenant_name: string
  saved_at: string
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try { setFavorites(JSON.parse(raw)) } catch {}
    }
  }, [])

  function isFavorite(eventSlug: string, tenantSlug: string) {
    return favorites.some(f => f.event_slug === eventSlug && f.tenant_slug === tenantSlug)
  }

  function add(rec: Omit<FavoriteRecord, 'saved_at'>) {
    const next = [...favorites.filter(f =>
      !(f.event_slug === rec.event_slug && f.tenant_slug === rec.tenant_slug)
    ), { ...rec, saved_at: new Date().toISOString() }]
    setFavorites(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function remove(eventSlug: string, tenantSlug: string) {
    const next = favorites.filter(f =>
      !(f.event_slug === eventSlug && f.tenant_slug === tenantSlug)
    )
    setFavorites(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return { favorites, isFavorite, add, remove }
}
```

В кнопке:

```typescript
function handleFavoriteToggle() {
  if (isFavorite(eventSlug, tenantSlug)) {
    remove(eventSlug, tenantSlug)
    toast('Удалено из избранного')
  } else {
    add({ event_slug: eventSlug, tenant_slug: tenantSlug, tenant_name: company.name })
    toast('Добавлено в избранное')
    // Трекаем как событие save
    trackEvent({
      event_slug: eventSlug,
      tenant_id: tenantId,
      type: 'save',
      source: 'profile',
    })
  }
}
```

Иконка кнопки — `Star` (заполненная) если в избранном, `StarOff` (контурная) если нет.

### 5. Трекинг события `save`

Тип `save` уже есть в схеме `hub.track_events`. Используем существующий `/api/track`.

### 6. Edge cases

- Если `vitrina_page_slug` пуст → не показывать iframe, показать заглушку
- Если события в Hub для этого тенанта нет (participation отсутствует или не confirmed) → 404 (уже работает)
- Если `stand` пуст → не показывать строку стенда и кнопку «На карте»

### 7. CSP для iframe

`vitrina.yanbada.com` должен разрешать встройку. У него уже `frame-ancestors *` для `/p/*` (из ARCHITECTURE), так что работать должно из коробки.

### 8. SEO

```typescript
export async function generateMetadata({ params }) {
  // ...
  return {
    title: `${company.name} — ${event.name}`,
    description: company.short_description?.[lang] ?? '',
  }
}
```

### 9. Поддержка в Vitrina — `?embed=1` параметр

В Vitrina на `/p/[slug]` должен поддерживаться `?embed=1`:
- Скрыть шапку/футер если они есть
- Не показывать «Powered by Yanbada» (в embed контексте оно лишнее)
- Отправлять высоту через postMessage:

```typescript
useEffect(() => {
  if (!searchParams.get('embed')) return

  function sendHeight() {
    const height = document.documentElement.scrollHeight
    window.parent.postMessage({ type: 'vitrina-page-height', height }, '*')
  }
  sendHeight()
  const ro = new ResizeObserver(sendHeight)
  ro.observe(document.documentElement)
  return () => ro.disconnect()
}, [])
```

> Эту часть нужно сделать в `vitrina` репо, не в `mega-hub`. Создай отдельный TODO-комментарий или вынеси в отдельный коммит с пометкой `// TODO: enable in vitrina repo`.

### 10. Сборка и коммит

```bash
npm run build
git add .
git commit -m "feat: company card with vitrina embed, favorites, action buttons"
git push
```

---

## Результат

- [ ] Шапка карточки с контекстом выставки и кнопками
- [ ] Iframe с Vitrina-страницей (auto-height через postMessage)
- [ ] Кнопка «В избранное» работает (localStorage)
- [ ] Трекинг `save` в `track_events`
- [ ] Кнопки-заглушки «Встреча», «Связаться» с тостом «Скоро»
- [ ] Если нет vitrina_page_slug — заглушка
- [ ] Билд успешно
