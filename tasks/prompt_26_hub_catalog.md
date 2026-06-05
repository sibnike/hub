> Открой `tasks/prompt_26_hub_catalog.md` и выполни задачу. Продолжение `mega-hub` после H-1 — публичные страницы события: каталог участников с поиском и фильтрами.

# H-2 — Публичный каталог участников

## Контекст

Сейчас в Hub есть кабинеты организатора и участника. Нужно сделать публичные
страницы события — то что видят посетители выставки: каталог компаний с поиском
и фильтрами. Карта пока заглушка (будет в H-3).

Данные компаний берутся из `hub.company_cache` — кэш заполняется webhook'ом из Vitrina.

Архитектура: см. `ARCHITECTURE.md` в корне проекта.

---

## Задача

### 1. Структура маршрутов

```
/e/[slug]/                  — главная события (редирект на /catalog)
/e/[slug]/catalog           — каталог участников (default landing)
/e/[slug]/map               — карта (заглушка для H-3)
/e/[slug]/stand/[standId]   — QR-редирект на профиль в Vitrina (с трекингом)
/e/[slug]/company/[tenantSlug]  — карточка компании в контексте события
```

Все маршруты — `force-dynamic`, `export const dynamic = 'force-dynamic'`.

CSP в `next.config.js` для `/e/*`:
```
frame-ancestors *
```

---

### 2. Главная события `/e/[slug]/page.tsx`

```typescript
import { redirect } from 'next/navigation'

export default async function EventRoot({ params }: { params: { slug: string } }) {
  redirect(`/e/${params.slug}/catalog`)
}
```

---

### 3. Layout события `/e/[slug]/layout.tsx`

Общая шапка для публичных страниц события:

- Загрузить событие по slug (если не `published` — 404)
- Использовать `event.settings.theme` (если есть) для акцента
- Шапка: логотип события, название (i18n), даты, табы «Каталог» / «Карта»
- Селектор языка (если в `event.settings.locales` несколько)
- `generateMetadata`: title и description события для SEO

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata({ params }) {
  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('name, location').eq('slug', params.slug).eq('status', 'published').maybeSingle()
  if (!event) return {}
  const title = event.name?.ru ?? event.name?.en ?? params.slug
  return { title, description: `${title} — ${event.location?.city ?? ''}` }
}

export default async function EventLayout({ children, params }) {
  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('*').eq('slug', params.slug).eq('status', 'published').maybeSingle()

  if (!event) notFound()

  return (
    <div className="min-h-screen">
      <EventHeader event={event} />
      {children}
    </div>
  )
}
```

---

### 4. Каталог `/e/[slug]/catalog/page.tsx`

#### Запрос данных

```typescript
const { data: participations } = await supabase
  .schema('hub')
  .from('event_participations')
  .select(`
    id,
    tenant_id,
    cache:tenant_id(*),
    stands:event_stands(stand_number, pavilion, floor)
  `)
  .eq('event_id', event.id)
  .eq('status', 'confirmed')
```

> ⚠️ Foreign-table embed работает только если в `hub.company_cache.tenant_id`
> есть FK на `public.tenants.id`. Если PostgREST не видит — сделай два запроса
> и join вручную по `tenant_id`.

#### UI каталога

- Сверху: поле поиска + кнопка «Фильтры» (раскрывает панель фильтров)
- Панель фильтров (sheet/sidebar или раскрывающаяся секция):
  - Категории — checkboxes из `industry_categories` (грузим через API)
  - Страна — select
  - Павильон — select из уникальных pavilion в участниках события
- Сетка карточек: grid responsive (1 / 2 / 3 / 4 колонки)
- Каждая карточка:
  - Логотип (из `cache.logo_url`)
  - Название (из `cache.name`)
  - Краткое описание (из `cache.short_description` по текущей локали)
  - Бейджи категорий (первые 2)
  - Номер стенда + павильон
  - Кнопка «Профиль» → `/e/{slug}/company/{tenant_slug}`
  - Кнопка «На карте» (пока disabled, будет работать в H-3)

#### Поиск и фильтры — клиентская часть

Реализуй в клиентском компоненте `<CatalogClient participations={...} categories={...} />`:

- Поиск: debounce 200ms, ищет в `cache.name`, `cache.short_description` (все локали), `cache.tags`, `cache.country`, `stand_number`
- Фильтры обновляют состояние, отфильтрованный список рендерится сразу
- Если есть фильтры — показывать кнопку «Сбросить фильтры»
- Счётчик: «N компаний из M»

---

### 5. API категорий

`app/api/public/industry-categories/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('industry_categories')
    .select('slug, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  return NextResponse.json({ data })
}
```

> Доступ к таблице `public.industry_categories` из Hub — она в общей БД,
> просто читаем напрямую. RLS уже разрешает SELECT всем.

---

### 6. Карточка компании `/e/[slug]/company/[tenantSlug]/page.tsx`

Карточка компании в контексте события (НЕ полный профиль — для полного — ссылка на Vitrina):

- Шапка: лого, название, краткое описание
- Стенд: номер, павильон, кнопка «Показать на карте» (disabled до H-3)
- Категории и теги (бейджи)
- Страна, сайт, соцсети
- Контактные лица (если есть в `cache.contact_persons`)
- Большая кнопка «Открыть полный профиль» → `vitrina.yanbada.com/p/{vitrina_page_slug}?ref=catalog&event={slug}`
- Трекинг: при загрузке страницы — отправить событие `profile_view` (заглушка endpoint в H-4)

Логика поиска tenantSlug:
1. Найти `tenants` по slug
2. Найти `event_participations` где `tenant_id = tenant.id` и `event_id = event.id` и `status = confirmed`
3. Если не найдено — 404
4. Загрузить `company_cache` для этого tenant_id
5. Загрузить стенд из `event_stands`

---

### 7. QR-редирект `/e/[slug]/stand/[standId]/page.tsx`

Серверный компонент-редиректор:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function StandRedirect({
  params,
}: {
  params: { slug: string; standId: string }
}) {
  const supabase = await createClient()

  const { data: stand } = await supabase.schema('hub')
    .from('event_stands')
    .select('tenant_id, event_id, events:event_id(slug)')
    .eq('id', params.standId)
    .maybeSingle()

  if (!stand?.tenant_id) {
    redirect(`/e/${params.slug}/catalog`)
  }

  // Трекинг QR-скана (fire-and-forget, заглушка до H-4)
  // await trackScan({ event_id: stand.event_id, tenant_id: stand.tenant_id })

  // Получаем vitrina_page_slug
  const { data: cache } = await supabase.schema('hub')
    .from('company_cache')
    .select('vitrina_page_slug')
    .eq('tenant_id', stand.tenant_id)
    .maybeSingle()

  if (!cache?.vitrina_page_slug) {
    redirect(`/e/${params.slug}/catalog`)
  }

  const vitrinaUrl = `https://${process.env.NEXT_PUBLIC_VITRINA_PUBLIC}/p/${cache.vitrina_page_slug}?ref=qr&event=${params.slug}`
  redirect(vitrinaUrl)
}
```

---

### 8. Заглушка карты `/e/[slug]/map/page.tsx`

```typescript
export default function MapPage({ params }) {
  return (
    <div className="container py-12 text-center">
      <h2 className="text-2xl font-semibold mb-4">Карта выставки</h2>
      <p className="text-muted-foreground">Карта будет доступна в ближайшее время.</p>
    </div>
  )
}
```

---

### 9. SEO и метаданные

В `generateMetadata` для каталога:
- Title: `Каталог участников — {event.name}`
- Description: `{event.location.city} · {event.dates}`
- OpenGraph image (опционально): можно генерить через `/api/og` или брать из event.settings

---

### 10. Стилизация

- Используй акцентный цвет из `event.settings.accent_color` (если задан, иначе indigo)
- Шрифт из `event.settings.font` (если задан)
- Карточки участников — hover-эффект (lift + shadow)
- Skeleton loader при первой загрузке (необязательно, но желательно)

---

## Результат

- [ ] Открывая `/e/{slug}` — редиректит на `/catalog`
- [ ] Каталог показывает confirmed участников события из `company_cache`
- [ ] Поиск работает по name/description/tags/stand_number
- [ ] Фильтры по категории / стране / павильону работают
- [ ] Карточка компании `/e/{slug}/company/{tenantSlug}` отображает данные с кнопкой профиля
- [ ] Ссылка «Открыть полный профиль» ведёт на Vitrina с правильными query-параметрами
- [ ] `/e/{slug}/stand/{standId}` редиректит на Vitrina с `ref=qr`
- [ ] Заглушка карты по `/e/{slug}/map` работает
- [ ] CSP `frame-ancestors *` для `/e/*`
- [ ] `npm run build` — успешно

#### Как тестировать без реальных данных

1. В Vitrina открыть существующий тенант → `/admin/t/{slug}/profile` → заполнить и сохранить (это запушит в `company_cache`)
2. В Hub создать событие, добавить участника с email того же тенанта, скопировать код
3. От имени тенанта в Hub зайти на `/exhibitor/events/join`, подтвердить участие
4. Опубликовать событие, открыть `/e/{event-slug}/catalog` — должна появиться карточка

Следующая задача: `tasks/prompt_27_hub_map.md` — H-3: интерактивная карта MVP с QR-кодами для печати.
