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
- Vercel (prod). Репозиторий github.com/sibnike/hub. Node 22.
- Resend (рассылка приглашений, подтверждение email посетителя). Домен отправителя — `yanbada.com`.

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
  categories, tags, country, website, social_links jsonb, contact_persons jsonb, vitrina_page_slug, synced_at.

### Гайд посетителя (H-9)

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
└── api/
    ├── sync/company/                     webhook от Vitrina → company_cache
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
