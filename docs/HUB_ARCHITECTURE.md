# Exhibitor Hub — Архитектура системы (мастер-документ)

> Рабочее имя — Exhibitor Hub.
> Отдельный продукт экосистемы Yanbada. Назначение: цифровая платформа для выставок,
> форумов и конференций — каталог участников, интерактивная карта, аналитика, QR-код стенда.
> Общий Supabase и Auth с Vitrina. Данные компаний — только из Vitrina (через webhook + кэш).
> Для общей картины экосистемы см. `YANBADA_ARCHITECTURE.md`.

## 1. Стек и инфраструктура

- Next.js 14 (App Router, TypeScript), Tailwind + shadcn/ui, Framer Motion, @dnd-kit, next-intl, recharts.
- Supabase (PostgreSQL + RLS) — **тот же проект что у Vitrina**, схема `hub`.
  prod ref: `bfcfwaakxcqplamcswaq`.
- Vercel (prod). Репозиторий github.com/sibnike/hub. Node 22.
- Resend (рассылка приглашений участникам). Домен отправителя — `yanbada.com`.

### Домены (prod)

- Кабинет организатора и компании: `hub.yanbada.com` → `/organizer/*`, `/exhibitor/*`
- Публичные страницы событий: `hub.yanbada.com` → `/e/{eventSlug}/*`
- Поддомен события (опционально): `{eventSlug}.yanbada.com` → rewrite на `/e/{eventSlug}`
- White-label: кастомный домен организатора → `/e/{eventSlug}` (через `events.settings.custom_domain`)

### Ключевые env (Vercel Production)

```
NEXT_PUBLIC_SUPABASE_URL                # тот же что в Vitrina
NEXT_PUBLIC_SUPABASE_ANON_KEY           # тот же что в Vitrina
SUPABASE_SERVICE_ROLE_KEY               # тот же что в Vitrina
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yanbada.com
SESSION_SIGNING_SECRET
VITRINA_WEBHOOK_SECRET                  # shared HMAC secret с Vitrina
VITRINA_INTERNAL_URL=https://admin.yanbada.com
NEXT_PUBLIC_HUB_DOMAIN=hub.yanbada.com
NEXT_PUBLIC_VITRINA_ADMIN=https://admin.yanbada.com
NEXT_PUBLIC_VITRINA_PUBLIC=https://vitrina.yanbada.com
RESEND_API_KEY
RESEND_FROM_EMAIL=Yanbada Hub <hub@yanbada.com>
```

## 2. Контуры доступа

- **Organizer** (`/organizer/*`): тенант-организатор. Создаёт события, управляет участниками,
  редактирует карту, смотрит аналитику выставки.
- **Exhibitor** (`/exhibitor/*`): тенант-участник. Подключается к событию по access_code,
  видит свой стенд, QR, аналитику по своему участию.
- **Public** (`/e/{slug}/*`): каталог, карта, карточка компании — без авторизации.
  CSP `frame-ancestors *` для встройки.
- **Platform admin**: тот же что в Vitrina, имеет полный доступ во все таблицы `hub.*`.

Auth — общий с Vitrina через Supabase Auth, cookie `sb-*-auth-token` на домене `.yanbada.com`.
Переход между `admin.yanbada.com` и `hub.yanbada.com` без повторного логина.

## 3. Модель данных (схема `hub`)

> Hub **никогда** не хранит данные компании (название, лого, описание, контакты).
> Только `company_cache` — денормализованный снэпшот, обновляемый webhook из Vitrina.

### `hub.events`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `organizer_tenant_id` | uuid FK | `public.tenants.id` — организатор |
| `slug` | text unique | `"digital-bridge-2026"` |
| `name` | jsonb | i18n название мероприятия |
| `dates` | daterange | Период проведения |
| `location` | jsonb | `{city, address, coordinates}` |
| `status` | text | `draft \| published \| archived` |
| `settings` | jsonb | Тема, custom_domain, custom_domain_prefix, лого, шрифт, branding |
| `access_code_salt` | text | Соль для генерации кодов |

Unique index на `settings->>'custom_domain'` для white-label.

### `hub.event_participations`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK | `hub.events.id` |
| `tenant_id` | uuid FK nullable | `public.tenants.id`, NULL пока pending |
| `invited_email` | text | email приглашения |
| `access_code` | text | HMAC-хеш кода |
| `status` | text | `pending \| confirmed \| rejected` |
| `joined_at` | timestamptz | Когда компания подтвердила |
| `manager_ids` | uuid[] | Сотрудники компании на мероприятии |

### `hub.event_stands`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `participation_id` | uuid FK | `hub.event_participations.id` |
| `event_id` | uuid FK | Для быстрой выборки |
| `tenant_id` | uuid FK nullable | Заполняется при confirm |
| `stand_number` | text | `"A-101"` |
| `pavilion` | text | Идентификатор павильона |
| `floor` | int | Этаж |
| `map_x`, `map_y` | float | Координаты на карте (% от ширины/высоты SVG) |
| `map_width`, `map_height` | float | Размер стенда (%) |

### `hub.event_maps`

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK | |
| `pavilion` | text | |
| `floor` | int | |
| `svg_content` | text | SVG-схема, санитизированная через sanitize-html |
| `sort_order` | int | |

### `hub.event_analytics` (агрегаты по дням)

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK | |
| `tenant_id` | uuid FK nullable | NULL = по всей выставке |
| `date` | date | |
| `profile_views`, `stand_views`, `qr_scans`, `form_submits`, `saves` | int | Счётчики |

### `hub.track_events` (детальные события)

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid FK | |
| `tenant_id` | uuid FK nullable | |
| `type` | text | `profile_view \| stand_view \| qr_scan \| catalog_view \| map_view \| save \| form_submit` |
| `source` | text | `catalog \| map \| qr \| direct \| search \| profile` |
| `session_id` | text | Для дедупликации view-событий |
| `user_agent` | text | |
| `ts` | timestamptz | |

### `hub.company_cache` (только для чтения)

| Поле | Тип | Описание |
|---|---|---|
| `tenant_id` | uuid PK FK | `public.tenants.id` |
| `name` | text | |
| `logo_url` | text | |
| `short_description` | jsonb | i18n |
| `categories` | text[] | Для фильтрации каталога |
| `tags` | text[] | Для поиска |
| `country` | text | |
| `website` | text | |
| `social_links` | jsonb | |
| `contact_persons` | jsonb[] | |
| `vitrina_page_slug` | text | Slug публичной страницы в Vitrina |
| `synced_at` | timestamptz | Время последней синхронизации |

### RLS

Все таблицы используют SECURITY DEFINER хелперы из `public` для разрыва рекурсии:
- `public.is_tenant_admin(tid uuid)`
- `public.is_platform_admin()`
- `public.current_user_tenants()`

Доступ:
- Организатор события видит все его данные (`is_tenant_admin(organizer_tenant_id)`)
- Участник видит свои participations/stands (`is_tenant_admin(tenant_id)`)
- Platform admin видит всё
- Public — только `published` events и связанные с ними carts/maps/stands

### Cross-schema запросы

PostgREST не умеет JOIN между схемами `hub` и `public` автоматически. Используется ручной
JOIN через хелпер `joinTenants()` (`lib/hub/join-tenants.ts`) — два запроса с server-side merge.

## 4. Структура роутов

```
app/
├── (organizer)/                  кабинет организатора
│   └── organizer/
│       ├── events/               список событий
│       ├── events/new            создание события
│       ├── events/[slug]/        управление событием
│       │   ├── (Общее)           даты, статус, публикация
│       │   ├── participants/     CSV-импорт, рассылка приглашений
│       │   ├── map/              редактор карты (drag-and-drop)
│       │   ├── qr/               страница печати QR-кодов
│       │   ├── analytics/        дашборд + тепловая карта
│       │   └── embed/            iframe/виджет/white-label инструкции
│       └── tenant/               переключение тенанта
│
├── (exhibitor)/                  кабинет компании-участника
│   └── exhibitor/
│       ├── events/               «Мои выставки»
│       ├── events/join/          подключение по коду
│       ├── events/[slug]/        стенд, QR, аналитика
│       └── analytics/            сравнение событий
│
├── e/[slug]/                     публичные страницы события
│   ├── page.tsx                  редирект на /catalog
│   ├── catalog/                  каталог участников
│   ├── map/                      карта со стендами
│   ├── stand/[standId]/          QR-редирект → Vitrina с трекингом
│   └── company/[tenantSlug]/     карточка компании (Vitrina iframe)
│
└── api/
    ├── sync/company/             webhook от Vitrina → company_cache
    ├── track/                    публичный трекинг с дедупликацией
    ├── organizer/events/[slug]/
    │   ├── participants/         CSV, добавление, удаление
    │   ├── maps/                 загрузка SVG, замена, удаление
    │   ├── maps/[mapId]/         CRUD карты
    │   ├── stands/[id]/position  обновление map_x/y/w/h
    │   ├── stands/batch-position пакетное обновление
    │   ├── stands/[id]/duplicate копия стенда (rate-limit)
    │   ├── qr/[standId]          PNG QR-код стенда
    │   ├── heatmap               тепловая карта
    │   └── analytics             данные дашборда
    └── exhibitor/
        ├── join/                 подключение по коду (service-role)
        ├── events/[slug]/analytics  данные дашборда участника
        └── analytics             сравнение событий
```

## 5. Ключевые функции

### 5.1 Регистрация участника

```
Организатор создаёт событие
    → загружает CSV (email, stand_number, pavilion, floor)
    → автосоздаются карты-заглушки для новых павильонов
    → access_code = HMAC(event_id + email, salt), 8 символов
    → рассылка email через Resend (или лог в консоль если ключа нет)

Компания получает приглашение
    → заходит на hub.yanbada.com (уже авторизована через Vitrina)
    → /exhibitor/events/join → вводит slug + код
    → /api/exhibitor/join (service-role, обходит RLS pending записей)
    → participation.tenant_id заполняется, status=confirmed
    → stand.tenant_id тоже заполняется
```

### 5.2 Каталог (`/e/[slug]/catalog`)

- Читает confirmed participations JOIN с `hub.company_cache` JOIN stands
- Поиск клиентский с debounce 200ms по name/description/tags/stand_number
- Фильтры server-side: категория, страна, павильон
- Карточка: лого, название, описание, стенд, кнопки «Профиль» и «На карте»
- force-dynamic, no-store

### 5.3 Карта (`/e/[slug]/map`)

- SVG inline + абсолютные div стенды (по `map_x/y/w/h` в %)
- Несколько павильонов через табы (формат «Hall A · Этаж 2»)
- Фильтр по категориям: нерелевантные стенды с opacity 0.25
- Поиск с подсветкой; подсказка если результат на другом павильоне
- Клик на стенд → Sheet с карточкой компании
- Mobile pinch-to-zoom, desktop +/- кнопки

### 5.4 Редактор карты

- Drag-and-drop стендов через @dnd-kit, координаты в %
- Оптимистичный апдейт state (стенд не «возвращается» перед сохранением)
- Snap-to-grid (выключен по умолчанию, переключается)
- Multi-select Shift+click → выравнивание (лево/право/верх/низ/распределение)
- Cmd/Ctrl+D дубликат с защитой 500ms + rate-limit на API
- Ресайз за угол с clamp в границы 0-100% и минимум 2%
- Загрузка/замена SVG (sanitize-html), экспорт SVG со стендами
- Перенос стенда на другую карту

### 5.5 Карточка компании (`/e/[slug]/company/[tenantSlug]`)

- Шапка с контекстом: лого, название, описание, категории, страна, стенд
- 4 кнопки действий: «На карте», «Открыть профиль», «Встреча» (заглушка), «Сохранить»
- Iframe страницы Vitrina (`?embed=1&ref=catalog&event={slug}`) с auto-height
- `useFavorites` хук — localStorage избранного
- Трекинг `save` event при добавлении в избранное

### 5.6 QR-механика

```
URL стенда: hub.yanbada.com/e/{event-slug}/stand/{stand-id}
    ↓ при сканировании (server-side, до редиректа)
INSERT INTO hub.track_events (event_id, tenant_id, type='qr_scan', source='qr')
    ↓
Redirect → vitrina.yanbada.com/p/{vitrina_page_slug}?ref=qr&event={event-slug}
```

Печать QR-кодов: `/organizer/events/[slug]/qr` — сетка 3×N, 5×5 см, `@media print`, разрыв страницы каждые 9 QR.

### 5.7 Webhook от Vitrina

```
POST /api/sync/company
Headers: x-vitrina-signature: sha256=<HMAC>
Body: { tenant_id, name, logo_url, short_description, categories, tags,
        country, website, social_links, contact_persons, vitrina_page_slug }
```
Действие: upsert в `hub.company_cache` (service-role).

### 5.8 Аналитика

**Организатор** (`/organizer/events/[slug]/analytics`):
- 4 метрики: catalog_view, map_view, profile_view, qr_scan
- LineChart по дням, PieChart источников, BarChart по часам
- Топ-20 компаний с JOIN на company_cache
- **Тепловая карта**: SVG overlay с radial gradient, переключатели метрики/павильона/периода,
  топ-10 стендов, экспорт SVG

**Участник**:
- `/exhibitor/events/[slug]` — метрики, график, источники для этого события
- `/exhibitor/analytics` — сравнение участий: таблица + bar chart

### 5.9 Embed и white-label

- `?embed=1` параметр — скрывает шапку события, адаптирует ширину, шлёт высоту через postMessage
- Виджет `/widgets/hub-widget.js` — overlay с iframe по клику на `[data-yanbada-hub]`
- White-label: middleware распознаёт `events.settings.custom_domain` и делает rewrite на `/e/{slug}`
- Префикс пути `custom_domain_prefix` (например `/exhibitor`)
- Брендирование: `brand_logo_url`, `brand_color`, `brand_footer_text` в settings
- CSP: `frame-ancestors *` для `/e/*`, `'self'` для `/organizer/*` и `/exhibitor/*`

## 6. Фазы (статус: всё на проде)

- **H-0** — инициализация: репо, стек, схема hub, Vercel, shared auth
- **H-1** — события и участники: CRUD событий, CSV-импорт, рассылка приглашений, подключение по коду
- **H-2** — публичный каталог: страница события, поиск, фильтры, карточки
- **H-3** — карта MVP: загрузка SVG, drag-and-drop редактор, клик→Sheet, QR-коды печать
- **H-4** — аналитика: trackEvents, дашборды организатора и участника, сравнение событий
- **H-5** — карта v1.1: фильтры на карте, несколько павильонов, snap, multi-select, экспорт SVG, mobile zoom
- **H-6** — embed и white-label: `?embed=1`, виджет-скрипт, кастомные домены, брендирование
- **H-7** — тепловая карта: SVG overlay, переключатели, топ стендов, экспорт
- **H-8** — карточка компании: контекст-шапка, кнопки действий, Vitrina iframe, избранное

Все фиксы прода: shared auth cookie на `.yanbada.com`, RLS recursion fix через SECURITY DEFINER,
замена `isomorphic-dompurify` на `sanitize-html` (ESM-проблема на Vercel),
service-role в `/api/exhibitor/join`, ручные JOIN вместо cross-schema embed,
`HUB_WEBHOOK_URL` + `VITRINA_WEBHOOK_SECRET` в Vitrina env.

См. `ROADMAP-next.md` для дальнейших фаз.

## 7. Правила разработки

- Иконки — только Lucide. Эмодзи в UI запрещены.
- Схема — только через `supabase/migrations/`.
- RLS не ослаблять. Все политики через SECURITY DEFINER функции.
- Hub **никогда** не пишет в схему `public` (таблицы Vitrina). Только читает `tenant_id`.
- `company_cache` — read-only в Hub. Пишет только `/api/sync/company`.
- Маршруты карты, каталога, событий — `force-dynamic` + `no-store`.
- SVG карт — санитизировать через `sanitize-html` (не `isomorphic-dompurify` — ESM-проблемы на Vercel).
- Трекинг (`/api/track`) — fire-and-forget, не блокировать рендер.
- Все публичные страницы событий (`/e/*`) — `CSP frame-ancestors *` для embed.
- `assertTenantAdminOrPlatform()` вместо `assertTenantAdmin()` во всех endpoints — platform_admin тоже должен работать.
- Cross-schema PostgREST embed не работает — использовать `joinTenants()`.
- Документы в `docs/`, задачи агенту в `tasks/prompt_NN.md`.
