> Открой `tasks/prompt_31_hub_heatmap.md` и выполни задачу. Положи в `mega-hub/tasks/`. Финальная задача роадмапа Hub — тепловая карта активности поверх SVG плана выставки.

# H-7 — Тепловая карта активности

## Контекст

В H-4 уже собирается детальная статистика в `hub.track_events`: просмотры профилей, сканирования QR, клики по стендам. Сейчас нужно визуализировать эту активность поверх карты — чтобы организатор видел «горячие зоны» выставки.

Архитектура: см. `ARCHITECTURE.md`.

---

## Задача

### 1. API тепловой карты

`app/api/organizer/events/[slug]/heatmap/route.ts`:

```typescript
export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url)
  const pavilion = searchParams.get('pavilion') ?? 'main'
  const floor = parseInt(searchParams.get('floor') ?? '1')
  const metric = searchParams.get('metric') ?? 'all'
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const supabase = await createClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('id, organizer_tenant_id').eq('slug', params.slug).single()

  if (!event || !(await assertTenantAdmin(event.organizer_tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Считаем активность по каждому стенду
  const validTypes = metric === 'all'
    ? ['profile_view', 'stand_view', 'qr_scan']
    : [metric]

  const { data: stands } = await supabase.schema('hub').from('event_stands')
    .select('id, tenant_id, map_x, map_y, map_width, map_height')
    .eq('event_id', event.id)
    .eq('pavilion', pavilion)
    .eq('floor', floor)

  const { data: tracks } = await supabase.schema('hub').from('track_events')
    .select('tenant_id, type')
    .eq('event_id', event.id)
    .in('type', validTypes)
    .gte('ts', since)

  // Группируем по tenant_id
  const countsByTenant: Record<string, number> = {}
  for (const t of tracks ?? []) {
    if (!t.tenant_id) continue
    countsByTenant[t.tenant_id] = (countsByTenant[t.tenant_id] ?? 0) + 1
  }

  // Привязываем к стендам
  const points = (stands ?? [])
    .filter(s => s.map_x > 0 || s.map_y > 0)
    .map(s => ({
      x: s.map_x + s.map_width / 2,   // центр стенда
      y: s.map_y + s.map_height / 2,
      value: countsByTenant[s.tenant_id] ?? 0,
    }))

  return NextResponse.json({
    points,
    max: Math.max(1, ...points.map(p => p.value)),
  })
}
```

---

### 2. Heatmap-рендеринг

Используй библиотеку `heatmap.js` или собственный SVG-рендер.

Вариант через SVG-overlay (без зависимостей):

```typescript
'use client'

interface HeatmapOverlayProps {
  points: { x: number; y: number; value: number }[]
  max: number
  width: number
  height: number
}

export function HeatmapOverlay({ points, max, width, height }: HeatmapOverlayProps) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="heat-low">
          <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heat-mid">
          <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heat-high">
          <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {points.map((p, i) => {
        const intensity = p.value / max
        const gradient = intensity < 0.33 ? 'heat-low' : intensity < 0.66 ? 'heat-mid' : 'heat-high'
        const radius = 4 + intensity * 8 // 4-12% от ширины
        return (
          <circle
            key={i}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r={`${radius}%`}
            fill={`url(#${gradient})`}
          />
        )
      })}
    </svg>
  )
}
```

---

### 3. UI на странице аналитики организатора

В `/organizer/events/[slug]/analytics/page.tsx` добавить новую секцию «Тепловая карта»:

- Селектор павильона/этажа (если несколько)
- Селектор метрики:
  - Все события
  - Только просмотры профилей
  - Только сканирования QR
  - Только клики на карте
- Селектор периода: 7д / 30д / 90д / Всё время
- Контейнер карты:
  - SVG плана как фон (из `event_maps.svg_content`)
  - Поверх — `<HeatmapOverlay points={...} max={...} />`
  - Поверх — слабо видимые контуры стендов (для контекста)
- Под картой — топ-10 стендов по активности с цифрами

#### Структура страницы:

```typescript
const [pavilion, setPavilion] = useState(maps[0]?.pavilion ?? 'main')
const [floor, setFloor] = useState(maps[0]?.floor ?? 1)
const [metric, setMetric] = useState<'all' | 'profile_view' | 'qr_scan' | 'stand_view'>('all')
const [days, setDays] = useState(30)

const { data: heatmap } = useSWR(
  `/api/organizer/events/${slug}/heatmap?pavilion=${pavilion}&floor=${floor}&metric=${metric}&days=${days}`,
  fetcher
)

const activeMap = maps.find(m => m.pavilion === pavilion && m.floor === floor)
```

---

### 4. Топ стендов по активности

Под тепловой картой — таблица топ-10:

| # | Компания | Стенд | Профиль просмотрен | QR сканов | Клики на карте | Сумма |
|---|---|---|---|---|---|---|
| 1 | Epson | A-101 | 245 | 89 | 156 | 490 |

API уже даёт нужные данные (`track_events` + `event_stands` + `company_cache`). Можно отдельный endpoint или расширить существующий heatmap-эндпоинт.

---

### 5. Сравнение по дням

Опционально (если время есть): таймлайн-слайдер под картой.

- Range slider от первого дня события до последнего
- При перемещении — тепловая карта пересчитывается за выбранный день / период
- Показывает динамику: «когда стенд был самым популярным»

Без слайдера — просто фильтр период через кнопки (как уже в дашборде).

---

### 6. Экспорт

Кнопка «Скачать тепловую карту»:
- Берёт текущий SVG карты
- Сериализует heatmap overlay поверх
- Возвращает один SVG-файл (или PNG через canvas конвертацию)

Полезно организаторам для отчётов спонсорам, постмортема выставки.

```typescript
async function exportHeatmap() {
  const svg = document.querySelector('#heatmap-container svg')
  if (!svg) return
  const serialized = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([serialized], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `heatmap-${slug}-${pavilion}-${floor}.svg`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

### 7. Edge-cases

- Нет данных за период — показать `«Недостаточно данных для тепловой карты»`
- Все стенды без позиции — показать тот же текст
- Карта одна и всего один стенд — overlay всё равно показываем (точка одна)
- Если `points` пусты — рендерить только фон без overlay
- При смене павильона — переключается активная карта, пересчитываются points

---

### 8. Производительность

- При большом количестве событий (>10к за период) — агрегация на сервере по `tenant_id` уже даёт быстрый ответ
- Кэшировать ответ heatmap-API: `Cache-Control: private, max-age=300` (5 минут)
- На клиенте — `useSWR` или `useQuery` с `staleTime: 5min`

---

## Результат

- [ ] API `/api/organizer/events/[slug]/heatmap` возвращает точки активности
- [ ] Компонент `HeatmapOverlay` рендерит SVG с radial gradient
- [ ] Секция «Тепловая карта» в дашборде организатора
- [ ] Переключатели: павильон, этаж, метрика, период
- [ ] Топ-10 стендов по активности под картой
- [ ] Кнопка экспорта тепловой карты в SVG
- [ ] Edge-cases обработаны (пустые данные, один стенд)
- [ ] `npm run build` — успешно

#### Как тестировать

1. Создать тестовую активность: 5-10 разных tenant_id с разным числом track_events на одном событии
2. Открыть `/organizer/events/[slug]/analytics`
3. Прокрутить до секции «Тепловая карта»
4. Проверить переключатели метрики и периода — heatmap должна меняться
5. Скачать SVG, открыть в браузере или Figma — корректно отображается

После H-7 — Hub-роадмап завершён. Следующий шаг: end-to-end тест всей экосистемы — см. `tasks/prompt_32_e2e_test.md`.
