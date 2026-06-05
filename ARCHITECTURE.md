# Yanbada Exhibitor Hub — Architecture

Exhibitor Hub (`mega-hub`) — публичный каталог выставок, кабинеты организатора и участника. Работает в паре с **Vitrina** (профили компаний) через общий Supabase Auth и webhook-синхронизацию.

## Экосистема

```
Vitrina (admin.yanbada.com)
  │  сохранение company_profiles
  │  POST /api/sync/company (HMAC webhook)
  ▼
Hub (hub.yanbada.com)
  │  hub.company_cache
  │  события, участники, карты, аналитика
  ▼
Публичные страницы /e/{slug}/*
  каталог · карта · профиль компании · QR-редиректы
```

## Схема данных (Supabase `hub`)

| Таблица | Назначение |
|---------|------------|
| `events` | Выставки (slug, статус, настройки white-label) |
| `event_maps` | SVG-планы павильонов |
| `event_stands` | Стенды с координатами на карте |
| `event_participations` | Участия компаний (код доступа, статус) |
| `company_cache` | Снимок профиля из Vitrina (read-only для Hub) |
| `track_events` | События аналитики (views, QR, saves) |

Hub **не пишет** в схему `public` (кроме чтения `tenant_admins`, `tenants` через RLS). Vitrina пишет в `hub` только через service-role webhook.

## Маршруты

### Публичные (`/e/[slug]/*`)

- `force-dynamic` на всех страницах
- CSP `frame-ancestors *` для embed
- `?embed=1` — без шапки Hub, postMessage высоты
- `?track=1` — трекинг в embed-режиме

### Организатор (`/organizer/*`)

- Создание/публикация событий
- Участники (CSV, email-приглашения)
- Редактор карты (dnd-kit, snap, align, duplicate)
- QR-печать, аналитика, тепловая карта, embed-инструкции

### Участник (`/exhibitor/*`)

- Подключение по коду `/exhibitor/events/join`
- Аналитика и сравнение событий

## API

Все приватные роуты проверяют `assertTenantAdmin` / `requireTenantAdmin`. При истёкшей сессии position/batch-position возвращают **401**.

| Endpoint | Описание |
|----------|----------|
| `POST /api/sync/company` | Webhook от Vitrina → `company_cache` |
| `POST /api/track` | Запись аналитики (rate limit 60/min, дедуп view по session_id) |
| `GET/POST /api/organizer/events/[slug]/maps` | SVG-карты (лимит 2 МБ) |
| `PATCH .../stands/.../position` | Сохранение координат стенда |

## Middleware

1. **Trailing slash** — `/e/slug/` → 308 на `/e/slug`
2. **Custom domain** — rewrite на `/e/{slug}/...` по `events.settings.custom_domain`
3. **Auth refresh** — Supabase SSR cookies

## Синхронизация Vitrina → Hub

1. Vitrina сохраняет профиль → webhook `POST /api/sync/company` с HMAC-подписью
2. Hub upsert в `hub.company_cache`, обновляет `synced_at`
3. При race condition (Hub ещё не запущен) — ручная кнопка «Синхронизировать» в Vitrina

## Аналитика

- Клиент: `useTrack` / `trackEvent` — дедуп view в `sessionStorage`
- Сервер: дедуп `catalog_view`, `map_view`, `profile_view` по `session_id` + `event_id` + `tenant_id`
- Организатор: дашборд + тепловая карта (Cache-Control 5 min)
- Участник: сравнение по выставкам

## Embed & White-label

- `public/widgets/hub-widget.js` — overlay-виджет
- `events.settings`: `custom_domain`, `brand_logo_url`, `brand_color`, `brand_footer_text`

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный ключ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (track, sync) |
| `VITRINA_WEBHOOK_SECRET` | HMAC для webhook |
| `NEXT_PUBLIC_HUB_DOMAIN` | Домен Hub (middleware) |
| `NEXT_PUBLIC_VITRINA_ADMIN` | URL Vitrina admin |

## Локальная разработка

```bash
npm run dev   # порт 3001
npm run build
```

Миграции: `supabase/migrations/`
