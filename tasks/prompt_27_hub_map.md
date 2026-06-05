> Открой `tasks/prompt_27_hub_map.md` и выполни задачу. Продолжение `mega-hub` после H-2 — интерактивная карта выставки MVP и генерация QR-кодов для печати.

# H-3 — Интерактивная карта MVP + QR для печати

## Контекст

Организатор загружает SVG-схему павильона, расставляет стенды drag-and-drop'ом.
Посетитель открывает карту, видит расположение стендов, кликает — открывается карточка компании.
Каждый стенд имеет QR-код который ведёт на профиль компании в Vitrina (через `/e/{slug}/stand/{standId}`).

Архитектура: см. `ARCHITECTURE.md`. QR-редирект уже реализован в H-2.

---

## Задача

### 1. Зависимости

```bash
npm install dompurify isomorphic-dompurify
npm install qrcode
npm install --save-dev @types/qrcode
```

`@dnd-kit` уже установлен в H-0.

---

### 2. Санитизация SVG

`lib/svg/sanitize.ts`:

```typescript
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover'],
    ADD_TAGS: ['use'],
  })
}

export function extractSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1].split(/\s+/).map(Number)
  if (parts.length !== 4) return null
  return { width: parts[2], height: parts[3] }
}
```

---

### 3. API карт

#### `app/api/organizer/events/[eventId]/maps/route.ts`

**GET** — список карт события (по павильонам/этажам):

```typescript
export async function GET(request, { params }) {
  const supabase = await createClient()

  const { data: event } = await supabase.schema('hub').from('events')
    .select('organizer_tenant_id').eq('id', params.eventId).single()

  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase.schema('hub').from('event_maps')
    .select('*').eq('event_id', params.eventId).order('sort_order')

  return NextResponse.json({ data })
}
```

**POST** — загрузить новую карту (SVG):

```typescript
export async function POST(request, { params }) {
  const body = await request.json()
  // { pavilion: string, floor: number, svg_content: string }

  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('organizer_tenant_id').eq('id', params.eventId).single()

  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sanitized = sanitizeSvg(body.svg_content)

  const { data, error } = await supabase.schema('hub').from('event_maps').insert({
    event_id: params.eventId,
    pavilion: body.pavilion ?? 'main',
    floor: body.floor ?? 1,
    svg_content: sanitized,
    sort_order: body.sort_order ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
```

**DELETE** `/api/organizer/events/[eventId]/maps/[mapId]` — удалить карту.

---

### 4. API стендов — расстановка на карте

#### `app/api/organizer/events/[eventId]/stands/[standId]/position/route.ts`

**PATCH** — обновить координаты стенда:

```typescript
export async function PATCH(request, { params }) {
  const { map_x, map_y, map_width, map_height } = await request.json()

  const supabase = await createClient()
  const { data: stand } = await supabase.schema('hub').from('event_stands')
    .select('event_id, events:event_id(organizer_tenant_id)')
    .eq('id', params.standId).single()

  if (!stand || !(await assertTenantAdmin(stand.events.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.schema('hub').from('event_stands').update({
    map_x, map_y, map_width, map_height,
  }).eq('id', params.standId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

---

### 5. Редактор карты (организатор)

#### `app/(organizer)/organizer/events/[slug]/map/page.tsx`

Серверный компонент: загрузка события, всех карт, всех стендов confirmed-участников.
Передача в клиентский `<MapEditor event={...} maps={...} stands={...} />`.

#### `components/organizer/map-editor.tsx` (клиентский)

UI:
- Слева: панель управления
  - Список павильонов/этажей (табы или select)
  - Кнопка «Загрузить карту» (textarea для вставки SVG или upload .svg файла)
  - Список стендов: имя компании + номер стенда. Стенды без позиции (`map_x = 0 AND map_y = 0`) — наверху списка, помечены «Не размещён»
- Справа: канвас с картой
  - SVG карты как фон (через `dangerouslySetInnerHTML`)
  - Поверх — абсолютные `<div>` для каждого стенда с `map_x`, `map_y`, `map_width`, `map_height` в %
  - Стенды можно перетаскивать (`@dnd-kit`)
  - Можно ресайзить за правый-нижний угол (custom resize handle)
  - Подпись стенда: номер + название компании

Контейнер карты:
- Соотношение сторон по viewBox SVG
- max-width: 1200px, центрирован
- Позиции стендов в % — относительно размера контейнера

Сохранение:
- При окончании drag/resize — `PATCH /api/organizer/events/{id}/stands/{standId}/position`
- Без debounce — каждое движение → один запрос на отпускании мыши
- Toast при ошибке

#### Drag-and-drop через @dnd-kit

Используй `useDraggable` для стендов и кастомный coordinate getter — потому что
позиции хранятся в %, а не в px.

При drop:
```typescript
const containerRect = containerRef.current.getBoundingClientRect()
const map_x = ((event.delta.x + currentPxX) / containerRect.width) * 100
const map_y = ((event.delta.y + currentPxY) / containerRect.height) * 100
```

---

### 6. Публичная карта `/e/[slug]/map/page.tsx`

Заменить заглушку на полноценную карту.

UI:
- Если у события несколько павильонов — табы переключения
- SVG карты как фон
- Стенды только с `map_x > 0 OR map_y > 0` (то есть размещённые)
- Hover на стенде — подсветка + tooltip с названием компании
- Клик на стенде — открыть Sheet справа с карточкой компании:
  - Лого, название
  - Краткое описание
  - Номер стенда
  - Кнопка «Открыть профиль» → `/e/{slug}/company/{tenantSlug}`
- Поиск по строке: при вводе — стенды найденных компаний пульсируют/подсвечиваются

#### Клиентский компонент `<EventMap stands={...} maps={...} cache={...} />`

```typescript
'use client'

import { useState } from 'react'

export function EventMap({ maps, stands }) {
  const [activeMap, setActiveMap] = useState(maps[0])
  const [selectedStand, setSelectedStand] = useState(null)
  const [search, setSearch] = useState('')

  const filteredStandIds = stands
    .filter(s => {
      if (!search) return false
      const q = search.toLowerCase()
      return s.cache?.name?.toLowerCase().includes(q)
          || s.stand_number?.toLowerCase().includes(q)
    })
    .map(s => s.id)

  const standsForMap = stands.filter(s =>
    s.pavilion === activeMap.pavilion &&
    s.floor === activeMap.floor &&
    (s.map_x > 0 || s.map_y > 0)
  )

  return (
    <div className="container py-6">
      {/* Табы павильонов если их больше одного */}
      {/* Поиск */}
      {/* Карта */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: activeMap.svg_content }}
        />
        {standsForMap.map(stand => (
          <button
            key={stand.id}
            className={`absolute border-2 rounded transition-all
              ${filteredStandIds.includes(stand.id) ? 'animate-pulse border-accent' : 'border-foreground/30 hover:border-accent'}`}
            style={{
              left:   `${stand.map_x}%`,
              top:    `${stand.map_y}%`,
              width:  `${stand.map_width}%`,
              height: `${stand.map_height}%`,
            }}
            onClick={() => setSelectedStand(stand)}
          >
            <span className="text-xs">{stand.stand_number}</span>
          </button>
        ))}
      </div>

      {/* Sheet с карточкой компании */}
    </div>
  )
}
```

---

### 7. QR-коды для печати

#### `app/api/organizer/events/[eventId]/qr/[standId]/route.ts`

GET — возвращает PNG QR-кода стенда:

```typescript
import QRCode from 'qrcode'

export async function GET(request, { params }) {
  const url = `https://${process.env.NEXT_PUBLIC_HUB_DOMAIN}/e/${eventSlug}/stand/${params.standId}`

  const buffer = await QRCode.toBuffer(url, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'H',
  })

  return new Response(buffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}
```

> Заранее получи `eventSlug` через JOIN с проверкой что вызывающий — админ организатора.

#### Страница печати `/organizer/events/[slug]/qr/page.tsx`

Сетка QR-кодов всех стендов, готовая к печати:

- Заголовок (не печатается): кнопка «Печать»
- Сетка 3×N: каждая ячейка — QR + название компании + номер стенда + павильон
- CSS `@media print` — убрать всё кроме сетки, формат A4
- Размер QR: 5×5 см
- Перенос на новую страницу через `page-break-after: always` каждые 9 QR (3×3 на лист)

```css
@media print {
  .no-print { display: none; }
  .qr-grid { grid-template-columns: repeat(3, 1fr); }
  .qr-cell { break-inside: avoid; }
}
```

Кнопка «Скачать всё PDF» — опционально (можно через `window.print()` → «сохранить как PDF» в браузере).

---

### 8. Обновление страницы события

В `/organizer/events/[slug]` (страница управления событием):
- В табе «Карта» — теперь не заглушка, а ссылка-кнопка «Открыть редактор карты» → `/organizer/events/{slug}/map`
- В табе «Участники» — кнопка «Печать QR-кодов» → `/organizer/events/{slug}/qr`
- На карточке стенда в списке участников — превью QR (маленький, через `<img src="/api/.../qr/{standId}">`)

---

### 9. Edge-cases

- Если у события нет карты — на публичной `/e/{slug}/map` показать «Карта будет добавлена скоро»
- Если стенды есть, но не размещены — на публичной показать только размещённые + сообщение «N стендов ещё не размещены на карте»
- При загрузке SVG — проверить что после санитизации остался валидный SVG с viewBox
- Если viewBox отсутствует — установить дефолтный `viewBox="0 0 1000 700"`

---

## Результат

- [ ] Организатор может загрузить SVG-карту павильона
- [ ] Организатор может перетаскивать стенды на карте drag-and-drop
- [ ] Организатор может ресайзить стенды
- [ ] Позиции стендов сохраняются в `event_stands.map_x/y/width/height`
- [ ] Публичная карта `/e/{slug}/map` показывает SVG + стенды + клик открывает Sheet
- [ ] Поиск на публичной карте подсвечивает найденные стенды
- [ ] Несколько павильонов работают через табы
- [ ] QR-код стенда генерируется как PNG через `/api/.../qr/{standId}`
- [ ] Страница печати QR-кодов `/organizer/events/{slug}/qr` готова к печати на A4
- [ ] При сканировании QR — редирект на Vitrina с `?ref=qr&event={slug}` (уже работает с H-2)
- [ ] `npm run build` — успешно

#### Как тестировать

1. Скачать тестовый SVG плана этажа (или нарисовать в Figma и экспортнуть)
2. В кабинете организатора → событие → таб «Карта» → «Открыть редактор»
3. Загрузить SVG, перетащить стенды
4. Открыть `/e/{slug}/map` от лица посетителя — должна показаться карта со стендами
5. Кликнуть на стенд — открыть Sheet с карточкой
6. Открыть страницу QR-кодов, распечатать (или сохранить PDF), отсканировать телефоном

Следующая задача: `tasks/prompt_28_hub_analytics.md` — H-4: аналитика выставки и участника.
