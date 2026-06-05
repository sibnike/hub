> Открой `tasks/prompt_28_hub_analytics.md` и выполни задачу. Положи файл в `mega-hub/tasks/`. Продолжение `mega-hub` после H-3 — трекинг активности и дашборды аналитики для организатора и для участника.

# H-4 — Аналитика выставки и участника

## Контекст

Сейчас в Hub нет трекинга событий и дашбордов. Заглушка `/api/track` из H-0 ничего не пишет.

Нужно:
1. Трекать просмотры профилей, стендов, сканирования QR
2. Агрегировать в `hub.event_analytics` (по дням, на лету при вставке)
3. Дашборд организатора события — общая аналитика выставки
4. Дашборд участника — аналитика его участия в конкретном событии и сравнение событий

Архитектура: см. `ARCHITECTURE.md`.

---

## Задача

### 1. Миграция — детальная таблица событий трекинга

`hub.event_analytics` хранит агрегаты по дням, но для гибкой аналитики нужна детальная таблица.

`supabase/migrations/YYYYMMDDHHMMSS_event_track_events.sql`:

```sql
CREATE TABLE hub.track_events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tenant_id    uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN (
                 'profile_view', 'stand_view', 'qr_scan',
                 'catalog_view', 'map_view', 'save', 'form_submit'
               )),
  source       text,           -- 'catalog' | 'map' | 'qr' | 'direct' | 'search'
  session_id   text,           -- для дедупликации
  user_agent   text,
  ts           timestamptz DEFAULT now()
);

CREATE INDEX ON hub.track_events(event_id, ts);
CREATE INDEX ON hub.track_events(event_id, tenant_id, ts);
CREATE INDEX ON hub.track_events(event_id, type, ts);

-- RLS
ALTER TABLE hub.track_events ENABLE ROW LEVEL SECURITY;

-- Организатор видит все события своей выставки
CREATE POLICY "organizer_track_events" ON hub.track_events
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM hub.events WHERE organizer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

-- Участник видит только свои события
CREATE POLICY "exhibitor_own_track_events" ON hub.track_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

-- Вставка только через service-role (/api/track)
```

---

### 2. Трекинг API — реализация

Заменить заглушку `app/api/track/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_TYPES = [
  'profile_view', 'stand_view', 'qr_scan',
  'catalog_view', 'map_view', 'save', 'form_submit'
]
const VALID_SOURCES = ['catalog', 'map', 'qr', 'direct', 'search']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_slug, tenant_id, type, source, session_id } = body

    if (!event_slug || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ ok: true }) // тихо игнорим
    }

    const supabase = createAdminClient()
    const { data: event } = await supabase.schema('hub').from('events')
      .select('id').eq('slug', event_slug).eq('status', 'published').maybeSingle()

    if (!event) return NextResponse.json({ ok: true })

    await supabase.schema('hub').from('track_events').insert({
      event_id:   event.id,
      tenant_id:  tenant_id ?? null,
      type,
      source:     VALID_SOURCES.includes(source) ? source : null,
      session_id: session_id ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
```

---

### 3. Клиентский хук трекинга

`lib/hooks/use-track.ts`:

```typescript
'use client'

import { useEffect } from 'react'

function getSessionId(): string {
  let id = sessionStorage.getItem('hub_session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('hub_session_id', id)
  }
  return id
}

interface TrackPayload {
  event_slug: string
  tenant_id?: string
  type: 'profile_view' | 'stand_view' | 'qr_scan' | 'catalog_view' | 'map_view' | 'save' | 'form_submit'
  source?: 'catalog' | 'map' | 'qr' | 'direct' | 'search'
}

export function useTrack(payload: TrackPayload | null) {
  useEffect(() => {
    if (!payload) return

    // Дедупликация в рамках сессии для view-событий
    const key = `tracked_${payload.type}_${payload.event_slug}_${payload.tenant_id ?? 'event'}`
    if (['profile_view', 'catalog_view', 'map_view'].includes(payload.type)) {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, session_id: getSessionId() }),
    }).catch(() => {})
  }, [payload?.event_slug, payload?.tenant_id, payload?.type])
}

export function trackEvent(payload: TrackPayload) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, session_id: getSessionId() }),
  }).catch(() => {})
}
```

---

### 4. Подключить трекинг

**Каталог** (`/e/[slug]/catalog`) — в клиентском компоненте:
```typescript
useTrack({ event_slug, type: 'catalog_view' })
```

**Карта** (`/e/[slug]/map`):
```typescript
useTrack({ event_slug, type: 'map_view' })
```

**Карточка компании** (`/e/[slug]/company/[tenantSlug]`):
```typescript
useTrack({ event_slug, tenant_id, type: 'profile_view', source })
```
где `source` определяется из URL `?ref=` (catalog/map/qr/direct).

**Открытие Sheet со стендом на карте** (клик на стенд):
```typescript
trackEvent({ event_slug, tenant_id, type: 'stand_view', source: 'map' })
```

**QR-редирект** (`/e/[slug]/stand/[standId]`) — серверный трекинг, до редиректа:
```typescript
await supabase.schema('hub').from('track_events').insert({
  event_id: stand.event_id,
  tenant_id: stand.tenant_id,
  type: 'qr_scan',
  source: 'qr',
  user_agent: request.headers.get('user-agent') ?? null,
})
```

---

### 5. API аналитики организатора

`app/api/organizer/events/[slug]/analytics/route.ts`:

```typescript
export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('id, organizer_tenant_id').eq('slug', params.slug).single()

  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Все события трекинга за период
  const { data: tracks } = await supabase.schema('hub').from('track_events')
    .select('type, source, tenant_id, ts')
    .eq('event_id', event.id)
    .gte('ts', since)

  // JOIN c company_cache для топа компаний
  const { data: cache } = await supabase.schema('hub').from('company_cache').select('tenant_id, name, logo_url')

  return NextResponse.json({ tracks, cache })
}
```

---

### 6. Дашборд организатора

`/organizer/events/[slug]/analytics/page.tsx` — заменить заглушку.

UI:
- Фильтр периода: 7д / 30д / 90д / Всё время
- **Метрики (сверху, 4 карточки):**
  - Просмотры каталога (`catalog_view`)
  - Просмотры карты (`map_view`)
  - Открытия профилей (`profile_view`)
  - Сканирования QR (`qr_scan`)
- **График по дням** (LineChart) — динамика всех типов событий, разные линии
- **Топ компаний** (таблица): JOIN tracks с company_cache, группировка по tenant_id
  - Колонки: Лого + Название | Просмотры профиля | Сканирования QR | Просмотры стенда
  - Сортировка по сумме всех событий, top 20
- **Распределение по источникам** (PieChart): для `profile_view` — откуда пришли (catalog/map/qr/direct)
- **Активность по часам** (BarChart): группировка по часу дня — в какое время суток выставка живёт

---

### 7. Аналитика участника

`/exhibitor/events/[slug]/page.tsx` — заменить текущую заглушку аналитики.

Для конкретного события показать:
- Метрики: профиль просмотрен N раз, стенд N, QR-сканов N, форм отправлено N
- График по дням
- Источники: где люди находили компанию (catalog/map/qr/direct)

**API** `app/api/exhibitor/events/[slug]/analytics/route.ts`:

```typescript
export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url)
  const tenant_id = searchParams.get('tenant_id')
  if (!tenant_id || !(await assertTenantAdmin(tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('id').eq('slug', params.slug).single()

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data: tracks } = await supabase.schema('hub').from('track_events')
    .select('type, source, ts')
    .eq('event_id', event.id)
    .eq('tenant_id', tenant_id)
    .gte('ts', since)

  return NextResponse.json({ tracks })
}
```

---

### 8. Сравнение событий (для участника)

Новая страница `/exhibitor/analytics/page.tsx`:

- Заголовок «Эффективность участия в выставках»
- Селектор тенанта (если несколько)
- Таблица всех событий где tenant участвовал:
  - Колонки: Событие | Даты | Просмотры профиля | Сканирования QR | Заявок (из Vitrina — оставить — на будущее) | Источник №1
  - Сортировка по дате
- Под таблицей — bar chart сравнения событий по просмотрам

**API** `app/api/exhibitor/analytics/route.ts`:

Агрегирует все события участия:
```typescript
const { data: participations } = await supabase.schema('hub').from('event_participations')
  .select('event_id, events:event_id(slug, name, dates)')
  .eq('tenant_id', tenant_id)
  .eq('status', 'confirmed')

// Для каждого event_id посчитать события трекинга по типам
```

---

### 9. Навигация

В шапке Hub из `app/layout.tsx`:
- В кабинете участника добавить пункт «Сравнение событий» → `/exhibitor/analytics`

На странице события у организатора:
- В табе «Аналитика» — открыть полноценный дашборд

---

### 10. Edge-cases

- Если за период нет ни одного события — показать пустое состояние с иконкой и текстом «Пока нет данных»
- Дедупликация view-событий: одна сессия = один view. Сканы QR и form_submit — не дедупим
- При смене периода — не пересчитывать на сервере, использовать React Query / fetch при изменении фильтра
- Учитывать часовой пояс при группировке по дням (по умолчанию UTC, но в UI отображать локально)

---

## Результат

- [ ] Миграция `track_events` применена
- [ ] `POST /api/track` пишет события в `track_events`
- [ ] Хук `useTrack` подключён на каталоге, карте, карточке компании
- [ ] QR-редирект трекает `qr_scan` перед редиректом
- [ ] Дашборд организатора `/organizer/events/[slug]/analytics` работает
- [ ] Дашборд участника на странице события работает
- [ ] Страница сравнения событий `/exhibitor/analytics` работает
- [ ] Дедупликация view-событий по `session_id`
- [ ] `npm run build` — успешно

#### Как тестировать

1. Открыть `/e/{slug}/catalog` от лица посетителя — записывается `catalog_view`
2. Кликнуть карточку → открыть `/e/{slug}/company/{tenantSlug}` — записывается `profile_view`
3. Открыть карту → клик по стенду — `map_view` + `stand_view`
4. Отсканировать QR (или открыть `/e/{slug}/stand/{standId}`) — `qr_scan` + редирект
5. В кабинете организатора → таб Аналитика → видны графики и метрики
6. В кабинете участника → событие → видны цифры по своей компании
7. `/exhibitor/analytics` → таблица всех событий с сравнением

Следующая задача: `tasks/prompt_29_hub_map_v11.md` — H-5: фильтр на карте, несколько павильонов, редактор v1.1.
