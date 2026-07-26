# Exhibitor Hub — Архитектура системы (мастер-документ)

> Рабочее имя — Exhibitor Hub.
> Отдельный продукт экосистемы Yanbada. Цифровая платформа для выставок, форумов и конференций:
> каталог участников, интерактивная карта со стендами, QR-коды, аналитика, гайд посетителя.
> Общий Supabase и Auth с Vitrina. Данные компаний — только из Vitrina (через webhook + кэш).
> Для общей картины см. `YANBADA_ARCHITECTURE.md`.

## 1. Стек и инфраструктура

- Next.js 14 (App Router, TypeScript), Tailwind + shadcn/ui, Framer Motion, @dnd-kit, next-intl, recharts.
- Supabase (PostgreSQL + RLS) — **тот же проект что у Vitrina**, схема `hub`.
  prod ref: `bfcfwaakxcqplamcswaq`.
- **DB access из Vercel:** только HTTP через `supabase-js` (`lib/supabase/*`). Прямой
  Postgres/`pg` Pool в Functions не используется; при появлении SQL — только Supavisor `:6543`.
  См. `docs/YANBADA_ARCHITECTURE.md` §«Доступ к БД из Vercel Serverless».
- Vercel (prod). Репозиторий github.com/sibnike/hub. Node 22.
- Resend (рассылка приглашений, подтверждение email посетителя). Домен отправителя — `yanbada.com`.

### Serverless limits (AI match / Events)

Marketplace AI + dispatch и тяжёлые Events-роуты работают **синхронно** в одном
Vercel Function invocation. Очередей (QStash / Inngest / Trigger) пока нет.

| Слой | Статус |
|------|--------|
| `export const maxDuration = 60` на heavy routes | ✅ с 2026-07-26 (`lib/vercel/heavy-api-duration.ts`) |
| Ingest throttle + 429 retry к Vitrina | ✅ уже есть |
| Caps (targets ≤20, book ≤10, results ≤50) | ✅ уже есть |
| Async dispatch / job queue | **P2 backlog** — когда появятся timeout’ы в Vercel logs или вырастет multi-target volume |
| Participants CSV → email после ответа | **P2 backlog** |

Heavy routes: `/api/marketplace/request`, `/api/marketplace/search*`,
`/api/marketplace/[slug]/search/{parse,results,request,book}`,
`/api/organizer/events/[slug]/participants`.

Требуется **Vercel Pro** (Hobby hard-cap 10s; `maxDuration=60` иначе не действует).

### Домены (prod)

- Кабинет организатора и компании: `hub.yanbada.com` → `/organizer/*`, `/exhibitor/*`
- Публичные страницы событий: `hub.yanbada.com/e/{eventSlug}/*`
- Гайд посетителя: `hub.yanbada.com/e/{eventSlug}/guide/*`
- White-label: кастомный домен организатора → rewrite на `/e/{eventSlug}` (через `events.settings.custom_domain`)

### Ключевые env

```
NEXT_PUBLIC_SUPABASE_URL                # общий с Vitrina
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yanbada.com
SESSION_SIGNING_SECRET                  # используется для подписи visitor_session JWT
VITRINA_WEBHOOK_SECRET                  # shared HMAC с Vitrina
VITRINA_INTERNAL_URL=https://admin.yanbada.com
NEXT_PUBLIC_HUB_DOMAIN=hub.yanbada.com
NEXT_PUBLIC_MARKETPLACE_ROOT=microp.app
NEXT_PUBLIC_VITRINA_ADMIN=https://admin.yanbada.com
NEXT_PUBLIC_VITRINA_PUBLIC=https://vitrina.yanbada.com
RESEND_API_KEY
RESEND_FROM_EMAIL=Yanbada Hub <hub@yanbada.com>
```

## 2. Контуры доступа

- **Organizer** (`/organizer/*`): tenant-организатор. Создаёт события, управляет участниками,
  редактирует карту, аналитика, брендинг, посетители, опросы.
- **Exhibitor** (`/exhibitor/*`): tenant-участник. Подключается к событию по access_code,
  видит свой стенд, QR, аналитику по своему участию.
- **Visitor** (`/e/{slug}/guide/*`): посетитель выставки. **Отдельный контур** через
  signed JWT cookie `visitor_session` (не Supabase Auth). Регистрируется по ссылке-приглашению.
- **Public** (`/e/{slug}/catalog`, `/map`): сейчас — fallback с заглушкой «Нужна ссылка-приглашение».
  Раньше был открытый каталог, сейчас закрыт за визитёрской регистрацией.
- **Platform admin**: общий с Vitrina, полный доступ.

Auth tenant-кабинетов — общий с Vitrina через Supabase Auth, cookie `sb-*-auth-token` на `.yanbada.com`.
Auth посетителя — отдельный signed JWT cookie на 90 дней.

## 3. Модель данных (схема `hub`)

> Hub **никогда** не хранит данные компании. Только `company_cache` — снэпшот из Vitrina.

### События и участники

- **`hub.events`** — события (organizer_tenant_id, slug, name jsonb, dates daterange, location jsonb,
  status, settings jsonb, access_code_salt). В settings — тема, custom_domain, branding, font_pair и т.д.
- **`hub.event_participations`** — кто участвует (event_id, tenant_id nullable, invited_email,
  access_code хеш, status pending/confirmed/rejected, joined_at, manager_ids).
- **`hub.event_stands`** — стенды на карте (participation_id, event_id, tenant_id, stand_number,
  pavilion, floor, map_x/y/width/height в %).
- **`hub.event_maps`** — SVG-карты павильонов (event_id, pavilion, floor, svg_content sanitized, sort_order).

### Аналитика

- **`hub.event_analytics`** — агрегаты по дням (event_id, tenant_id, date, profile_views, stand_views, qr_scans, form_submits, saves).
- **`hub.track_events`** — детальные события (type: profile_view, stand_view, qr_scan, catalog_view, map_view, save, form_submit; source, session_id, ts).

### Кэш данных компаний

- **`hub.company_cache`** (read-only из webhook): tenant_id PK, name, logo_url, short_description jsonb,
  categories, tags, country, website, social_links jsonb, contact_persons jsonb, vitrina_page_slug,
  marketplace_themes text[], synced_at.
- **`hub.listing_cache`** (read-only из webhook): tenant_id + page_slug PK, title/short_text jsonb,
  categories, search_vector, marketplace_themes text[], price_from numeric, price_currency text, synced_at.

### Мульти-маркетплейс (H-M4a)

- **`hub.marketplaces`** — конфиг тематических маркетплейсов (slug, name/description i18n,
  theme_slugs → slug'и из `public.marketplace_themes`, settings jsonb, is_active).
  Сид: `tourism` с темами transport, accommodation, tourism, guides, food.
- Справочник тем **`public.marketplace_themes`** Hub только читает (`lib/marketplace/themes.ts`, кэш 5 мин).

### Membership маркетплейса (H-M4b)

- **`hub.marketplace_members`** — заявки тенантов на доступ к маркетплейсу
  (marketplace_id, tenant_id, status: pending|approved|rejected|suspended,
  requested_by, reviewed_by/at, reject_reason). UNIQUE (marketplace_id, tenant_id).
- RLS: SELECT — `is_platform_admin()` или `is_tenant_admin(tenant_id)`; INSERT — tenant admin,
  status=pending; UPDATE/DELETE — только platform admin. Anon не экспонируется.
- Хелперы: `lib/marketplace/membership.ts` (`getMembership`, `assertMarketplaceAccess`).

### Guided-поиск маркетплейса (H-M4c)

- **`hub.search_presets`** — предустановленные запросы (marketplace_id, theme_slug, name/hint_template i18n,
  required_params jsonb, clarify_hints jsonb, sort_order, is_active). Сиды tourism: accommodation, transport, tourism.
- RLS: SELECT — authenticated; запись — `is_platform_admin()`. Anon не экспонируется.
- RPC **`hub.search_marketplace_listings`** — выдача из `listing_cache` с фильтром по theme_slugs маркетплейса,
  теме пресета и городу (FTS + ILIKE).
- Флоу на `/m/[slug]` (только approved membership): пресет → город → текст → AI-разбор → уточнения
  по недостающим `required_params` → выдача с availability (Vitrina `/api/booking/availability`) →
  сортировка/фильтр по цене → корзина → мульти-бронь.
- Состояние флоу и корзины — на клиенте (v1 без таблицы корзины в БД).
- API (все с гейтом approved): `GET .../presets`, `POST .../search/parse`, `POST .../search/results`,
  `POST .../search/book`.
- Бронирование: `dispatchMarketplaceBookings()` → Vitrina ingest HMAC (`VITRINA_SUBMISSIONS_INGEST_SECRET`).
  Тело ingest: `source_type='marketplace'`, `requester_tenant_id` (колонки Vitrina V-31).
  Throttle 400ms между вызовами на tenant + retry backoff на 429.
- Platform admin: `/admin/marketplace/[slug]/presets` — CRUD пресетов.

### Запрос v2 маркетплейса (H-M4d)

- Расширение `hub.marketplace_requests`: `budget_amount`, `budget_currency`, `requester_tenant_id`, `marketplace_id`.
- Расширение `hub.marketplace_request_targets`: `response_status` (pending/accepted/declined/expired).
- RLS: заказчик (`requester_tenant_id` + `is_tenant_admin`) видит свои requests/targets; platform admin — всё; anon — нет.
- В guided-флоу M4c: «Отправить запрос» с бюджетом → `POST .../search/request` → N targets → ingest с `marketplace_request_target_id`.
- Обратный канал: `POST /api/marketplace/response` (HMAC `VITRINA_WEBHOOK_SECRET`) → update target → email requester admins.
- UI: вкладка «Мои запросы» на `/m/[slug]` — статусы ответов по таргетам.


- **`hub.event_visitor_tiers`** — типы посетителей события (event_id, slug, name i18n,
  description i18n, color, welcome_bonus int, is_default bool, sort_order).
- **`hub.event_invitations`** — ссылки-приглашения (event_id, tier_id, invite_token,
  name админский, uses_count, is_active).
- **`hub.event_visitors`** — зарегистрировавшиеся посетители (event_id, tier_id, invitation_id,
  email, name, phone, country, city, language, session_token, email_confirmed, confirm_token,
  bonus_balance, last_visit_at). UNIQUE (event_id, email).
- **`hub.event_visitor_favorites`** — избранное (visitor_id, tenant_id, status: planned/met/skipped, note, saved_at, met_at).
- **`hub.event_polls`** — опросы (event_id, question i18n, options jsonb i18n, type single/multi,
  bonus_reward, is_active, sort_order).
- **`hub.event_poll_answers`** — ответы (poll_id, visitor_id, selected_option_ids, answered_at).
- **`hub.event_visitor_bonus_log`** — лог начислений (visitor_id, amount, reason, created_at).

### RLS

Все таблицы используют SECURITY DEFINER хелперы из `public`:
- `public.is_tenant_admin(tid uuid)`
- `public.is_platform_admin()`
- `public.current_user_tenants()`

Это разрывает рекурсию когда политика hub ссылается на tenant_admins.

Cross-schema запросы (`hub.*` ↔ `public.tenants`) — через ручной JOIN `joinTenants()` в `lib/hub/`. PostgREST embed не работает между схемами.

### Prod/shared migrations ledger

Prod Supabase общий с Vitrina. Version id в `schema_migrations` должен совпадать с timestamp из имени файла и быть уникальным во всём shared DB.

| Version id | Файл | Область |
|------------|------|---------|
| `20260603120001` | `20260603120001_hub_schema.sql` | базовая схема `hub` |
| `20260603120002` | `20260603120002_hub_schema_grants.sql` | grants/RLS helpers |
| `20260603120005` | `20260603120005_participations_invited_email.sql` | invited email для participations |
| `20260603120006` | `20260603120006_event_maps_rls.sql` | слот 20006, RLS для event maps |
| `20260603120007` | `20260603120007_event_track_events.sql` | слот 20007, track events |
| `20260603120008` | `20260603120008_events_custom_domain.sql` | слот 20008, custom domain |
| `20260603120009` | `20260603120009_hub_rls_fix.sql` | слот 20009, RLS recursion fix |
| `20260603120010` | `20260603120010_visitor_guide.sql` | слот 20010, visitor guide |
| `20260630102157` | `20260630102157_marketplace_tenant_search.sql` | Marketplace M1: tenant search |
| `20260630120257` | `20260630120257_marketplace_listing_search.sql` | Marketplace M2: listing search |
| `20260630141012` | `20260630141012_marketplace_request.sql` | Marketplace M3a: request/targets |
| `20260630141559` | `20260630141559_marketplace_request_rls_fix.sql` | Marketplace M3a RLS fix |
| `20260630141627` | `20260630141627_marketplace_request_revoke_writes.sql` | Marketplace M3a revoke writes |
| `20260705134146` | `20260705134146_marketplace_multitenant_m4a.sql` | Marketplace H-M4a |
| `20260705201000` | `20260705201000_marketplace_members_m4b.sql` | Marketplace H-M4b |
| `20260705213000` | `20260705213000_marketplace_search_presets_m4c.sql` | Marketplace H-M4c |
| `20260705214500` | `20260705214500_marketplace_search_listings_fix_m4c.sql` | Marketplace H-M4c prod fix |
| `20260705230000` | `20260705230000_marketplace_request_v2_m4d.sql` | Marketplace H-M4d |

Исторические имена с `2025...` не использовать: все hub timestamps приведены к `2026...`. Слоты `20260603120006`–`20260603120010` заняты как указано выше.

Связанные prod-соседи из Vitrina, важные для проверки дублей:

| Version id | Файл | Область |
|------------|------|---------|
| `20260705135638` | Vitrina themes markup | V-30 для M4a |
| `20260705220000` | `20260705220000_submissions_marketplace_requester.sql` | V-31, занят в prod |
| `20260705232000` | Vitrina response channel | V-32 |

После сессии `npx supabase migration list --linked` из `vitrina` показывает `local = remote` для `20260705220000`, `20260705230000`, `20260705232000`; дублей, local-only и remote-only нет.

## 4. Структура роутов

```
app/
├── (organizer)/                          кабинет организатора
│   └── organizer/
│       ├── events/                       список событий
│       ├── events/new                    создание
│       ├── events/[slug]/
│       │   ├── (Общее)                   даты, статус, публикация
│       │   ├── participants/             CSV-импорт, рассылка приглашений
│       │   ├── visitors/                 посетители + tiers + invitations + опросы
│       │   ├── map/                      редактор карты (drag-and-drop)
│       │   ├── qr/                       страница печати QR-кодов
│       │   ├── analytics/                дашборд + тепловая карта
│       │   ├── branding/                 настройки темы и шрифтов события
│       │   └── embed/                    инструкции встройки
│       └── tenant/                       переключение тенанта
│
├── (exhibitor)/                          кабинет компании-участника
│   └── exhibitor/
│       ├── events/
│       ├── events/join/                  подключение по коду
│       ├── events/[slug]/                стенд, QR, аналитика
│       └── analytics/                    сравнение событий
│
├── e/[slug]/                             публичные страницы события
│   ├── invite/[token]/                   landing-форма регистрации посетителя
│   ├── confirm/[token]/                  подтверждение email + вход
│   ├── invalid-link/                     заглушка невалидной ссылки
│   ├── guide/                            ЗАЩИЩЁННЫЙ гайд посетителя
│   │   ├── layout.tsx                    проверка visitor_session + EventThemeShell
│   │   ├── page.tsx                      главная: hero, tier, бонусы, опросы, навигация
│   │   ├── catalog/                      каталог участников
│   │   ├── map/                          карта с подсветкой избранных
│   │   ├── favorites/                    избранные со статусами planned/met/skipped
│   │   ├── polls/                        опросы и ответы
│   │   ├── profile/                      профиль, история бонусов
│   │   └── (.)company/[tenantSlug]       intercepting modal компании
│   ├── company/[tenantSlug]/             полная страница компании (прямая ссылка)
│   ├── stand/[standId]/                  QR-редирект на Vitrina + трекинг
│   ├── catalog/                          fallback заглушка с брендингом
│   └── map/                              fallback заглушка с брендингом
│
├── marketplace/                          AI-поиск и запросы (механики 1–3a)
├── m/[marketplaceSlug]/                  тематический маркетплейс (H-M4b: гейт; H-M4c: guided-поиск)
├── admin/marketplace/[slug]/members/     platform admin: заявки на доступ
├── admin/marketplace/[slug]/presets/     platform admin: пресеты guided-поиска
│
└── api/
    ├── sync/company/                     webhook от Vitrina → company_cache (+ marketplace_themes)
    ├── sync/listing/                     webhook от Vitrina → listing_cache (+ themes, price)
    ├── marketplace/[slug]/
    │   ├── membership/                   GET статус членства активного тенанта
    │   ├── membership/request/           POST подать/повторить заявку
    │   ├── presets/                      GET активные search_presets (approved)
    │   └── search/
    │       ├── parse/                    POST AI-разбор guided-запроса
    │       ├── results/                  POST выдача + availability
    │       └── book/                     POST мульти-бронь → Vitrina ingest
    ├── admin/marketplace/[slug]/members/ GET список (platform admin)
    ├── admin/marketplace/[slug]/members/[id]/ PATCH approve|reject|suspend
    ├── admin/marketplace/[slug]/presets/ GET|POST CRUD пресетов
    ├── admin/marketplace/[slug]/presets/[id]/ PATCH|DELETE
    ├── track/                            публичный трекинг с дедупликацией
    ├── visitor/                          API контура посетителя
    │   ├── register/                     регистрация по приглашению
    │   ├── resend-confirm/
    │   ├── logout/
    │   ├── profile/
    │   ├── favorites/
    │   └── polls/[id]/answer/
    ├── organizer/events/[slug]/
    │   ├── participants/
    │   ├── maps/
    │   ├── maps/[mapId]/
    │   ├── stands/[id]/position
    │   ├── stands/batch-position
    │   ├── stands/[id]/duplicate
    │   ├── qr/[standId]
    │   ├── heatmap
    │   ├── analytics
    │   ├── branding/                     PATCH темы события
    │   ├── tiers/
    │   ├── invitations/
    │   ├── visitors/
    │   └── polls/
    └── exhibitor/
        ├── join/                         подключение (service-role)
        ├── events/[slug]/analytics
        └── analytics
```

## 5. Ключевые функции

### 5.1 Регистрация участника-компании

CSV-импорт или вручную добавление email участника. Генерируется access_code = HMAC(event_id + email, salt), 8 символов. Рассылка через Resend.
Компания заходит в `/exhibitor/events/join`, вводит код → `/api/exhibitor/join` через service-role обходит RLS pending записей.

### 5.2 Каталог `/e/[slug]/guide/catalog`

После H-10: hero-полоса с брендингом, sticky-поиск с SearchIcon, фильтры в Sheet, stagger-сетка карточек по DESIGN.md, сердечко избранного.

### 5.3 Карта `/e/[slug]/guide/map`

SVG inline + абсолютные div-стенды. Несколько павильонов через табы. Фильтры. Подсветка избранных золотой рамкой. Mobile pinch-zoom, desktop +/-.

### 5.4 Редактор карты

Drag-and-drop через @dnd-kit, оптимистичный апдейт state, snap-to-grid (выключен по умолчанию), multi-select Shift+click, Cmd+D дубликат с защитой 500ms + rate-limit на API, ресайз с clamp 0-100%, загрузка/замена SVG через sanitize-html, экспорт SVG, перенос стенда между картами.

### 5.5 Карточка компании

`/guide/(.)company/[tenantSlug]` — intercepting modal внутри гайда. Прямая ссылка `/e/[slug]/company/[tenantSlug]` — полная страница.
Шапка с tier-стилем, 4 кнопки действий (избранное, на карте, открыть профиль, встреча-заглушка), Vitrina iframe с auto-height через postMessage.

### 5.6 QR-механика

Стенд: `hub.yanbada.com/e/{slug}/stand/{id}` → server-side трек `qr_scan` → редирект на Vitrina `?ref=qr&event={slug}`.
Печать QR: `/organizer/events/{slug}/qr` — сетка 3×N, 5×5 см, @media print, разрыв страницы каждые 9.

### 5.7 Webhook от Vitrina

`POST /api/sync/company` с HMAC-подписью → upsert в `hub.company_cache` (service-role).
Опционально `marketplace_themes: string[]` — при отсутствии поля существующее значение не затирается.

`POST /api/sync/listing` с HMAC → upsert/delete в `hub.listing_cache`.
Опционально `marketplace_themes`, `price_from`, `price_currency` — та же толерантность к отсутствию полей.

### 5.8 Аналитика

**Организатор:** 4 метрики, графики по дням/часам/источникам, топ-20 компаний, тепловая карта с переключателями.
**Участник:** дашборд по событию + сравнение нескольких событий.

### 5.9 Embed и white-label

`?embed=1` режим скрывает шапку события, postMessage высоты.
Виджет `/widgets/hub-widget.js` — overlay по клику на `[data-yanbada-hub]`.
White-label: middleware распознаёт `events.settings.custom_domain` и rewrite на `/e/{slug}`.

### 5.10 Гайд посетителя (H-9 + H-10)

**Регистрация:**
1. Организатор создаёт tier'ы (VIP/Standard) с welcome_bonus
2. Создаёт invitation-ссылки на конкретный tier
3. Посетитель идёт по `/e/{slug}/invite/{token}` → форма (имя, email, phone, страна, город, язык)
4. Email с confirm-ссылкой через Resend
5. `/e/{slug}/confirm/{token}` → выдаётся `visitor_session` JWT cookie → редирект в `/guide`

**Авторизация контура:** хелперы `lib/visitor/session.ts`, `lib/visitor/current.ts`, `lib/visitor/cookie.ts`.
JWT подписан `SESSION_SIGNING_SECRET`, expires 90d, scope `.yanbada.com`.

**Гайд:**
- Главная с hero, tier-блоком, балансом, опросами, навигацией
- Каталог с избранным в БД (не localStorage)
- Карта с подсветкой избранных
- Избранное со статусами planned/met/skipped + заметки
- Опросы с начислением баллов
- Профиль с историей бонусов

### 5.11 Дизайн-система (H-10)

`docs/DESIGN.md` — источник правды.

- **Шрифты:** `lib/event-fonts.ts` со словарём 5 пар через next/font (modern, editorial, premium, tech, bold). Организатор выбирает в `/branding`.
- **Цвета:** CSS-переменные `--accent`, `--brand`, `--hero-bg` инжектируются из `event.settings` через `<EventThemeShell>`.
- **Иконки:** 43 SVG в `/components/icons/` с `iconMap` для динамической подмены. Outline-стиль, currentColor, stroke 1.5.
- **Анимации:** `lib/design/animations.ts` — Framer Motion паттерны (fadeUp, heroEntry, stagger, btnHover, modalEntry).
- **Скелетоны** вместо спиннеров. Пустые состояния с иконками и CTA.
- **Брендинг события:** `/organizer/events/[slug]/branding` — accent_color, brand_color, hero_bg (градиент/картинка/однотон), font_pair, welcome_message i18n, brand_logo_url, brand_footer_text, organizer_contacts.

## 6. Фазы (статус: всё на проде)

- **H-0** — init: репо, стек, схема hub, Vercel, shared auth
- **H-1** — события и участники, CSV-импорт, рассылка приглашений, подключение по коду
- **H-2** — публичный каталог + поиск + фильтры + карточки
- **H-3** — карта MVP: загрузка SVG, drag-and-drop редактор, клик→Sheet, QR-печать
- **H-4** — аналитика: trackEvents, дашборды организатора и участника, сравнение событий
- **H-5** — карта v1.1: фильтры на карте, несколько павильонов, snap, multi-select, экспорт SVG, mobile zoom
- **H-6** — embed и white-label: ?embed=1, виджет, кастомные домены, брендирование
- **H-7** — тепловая карта: SVG overlay с radial gradient, переключатели, топ стендов, экспорт
- **H-8** — карточка компании: контекст-шапка, кнопки действий, Vitrina iframe, избранное (localStorage)
- **H-9** — гайд посетителя: tiers, invitations, регистрация по ссылке, email-подтверждение, избранное в БД, опросы, бонусы, кабинет посетителя
- **H-10** — дизайн-система: DESIGN.md, шрифты, иконки, EventThemeShell, брендинг события, полная переработка визуала гайда

### Прод-фиксы по ходу

- Shared auth cookie на `.yanbada.com`
- RLS recursion fix через SECURITY DEFINER
- Замена `isomorphic-dompurify` на `sanitize-html` (ESM-проблема на Vercel)
- Service-role в `/api/exhibitor/join` для pending записей
- Ручные JOIN вместо cross-schema embed
- HUB_WEBHOOK_URL + VITRINA_WEBHOOK_SECRET в Vitrina env
- Email domain ota.kz → yanbada.com
- Map editor: оптимистичный апдейт, snap только на drop, защита от Cmd+D дубликатов

## 7. Правила разработки

- Иконки — только из `/components/icons/`. Никакого Lucide в новых компонентах.
- **Эмодзи в UI запрещены.**
- Цвета — только через CSS-переменные (`var(--accent)`, `var(--brand)` и т.д.). Никаких inline hex.
- Шрифты — только из `fontMap` в `lib/event-fonts.ts`.
- Схема — только через `supabase/migrations/`.
- RLS не ослаблять. Все политики через SECURITY DEFINER функции.
- Hub **никогда** не пишет в схему `public`. Только читает по tenant_id.
- `company_cache` — read-only в Hub. Пишет только `/api/sync/company`.
- Маршруты карты, каталога, событий — `force-dynamic` + `no-store`.
- SVG карт — санитизировать через `sanitize-html`.
- Трекинг (`/api/track`) — fire-and-forget.
- Все публичные `/e/*` — `CSP frame-ancestors *` для embed.
- `assertTenantAdminOrPlatform()` вместо `assertTenantAdmin()` во всех endpoints.
- Cross-schema PostgREST embed не работает — `joinTenants()`.
- Документы в `docs/`, задачи агенту в `tasks/prompt_NN.md`.
- Скелетоны вместо спиннеров.
- Анимации с `once: true` в viewport.
