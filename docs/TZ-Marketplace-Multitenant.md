# ТЗ — Мульти-маркетплейс (тематические B2B-маркетплейсы). Мастер-план + фаза H-M4a (hub-side)

> Продолжение Marketplace-механик 1/2/3a. Vitrina-сторона фазы M4a — `vitrina/docs/TZ-Marketplace-Themes-Markup.md` (V-30), отдельный агент.

## 1. Концепция

В системе несколько **тематических маркетплейсов**. Первый — **туристический B2B**:
внутренние игроки (тенанты, напр. туроператоры) находят у других тенантов гидов, готовые
экскурсии, транспорт, размещение — и бронируют, в т.ч. **у нескольких поставщиков сразу**.

- **Покупатель = тенант** (Supabase Auth, общий cookie `.yanbada.com`). Никакого нового auth-контура.
- Доступ в маркетплейс — членство (`marketplace_members`), одобряется platform-админом.
- Контент — существующие `pages` тенантов; отбор по **темам** (`marketplace_themes`,
  справочник в `public`, правит супер-админ Vitrina).
- Поиск — guided-флоу как в demo v3: пресет → город → текст с заготовкой → AI-парсинг →
  уточняющие вопросы → выдача с учётом доступности на даты → фильтр по цене → бронирование.
- Запрос тенантам (аналог 3a) — с бюджетом заказчика и ответом accept/decline от тенанта
  (это закрывает отложенный «обратный канал»).

### Фазы

| Фаза | Репо | Содержание | Статус |
|------|------|------------|--------|
| **H-M4a** | vitrina + mega-hub | Справочник тем, маркировка, расширение кэшей и sync, `hub.marketplaces` | **это ТЗ (hub-side)** |
| H-M4b | mega-hub | Membership: заявка тенанта, одобрение, гейт доступа `/m/[slug]` | после M4a |
| H-M4c | mega-hub | Guided-поиск (пресеты, AI-уточнение), выдача с availability, фильтр цены, профиль поставщика, мульти-бронирование (корзина) | после M4b |
| H-M4d | vitrina + mega-hub | Запрос v2: бюджет, таргетинг по теме, accept/decline тенанта + обратный канал Vitrina→Hub | после M4c |
| (3b) | оба | Встраивание забронированного исполнителя в `booking_resources` заказчика | отдельно, после M4d |

### Инварианты (не нарушать)

- Hub **не пишет** в схему `public`. Справочник `public.marketplace_themes` Hub только читает.
- RLS через SECURITY DEFINER хелперы; `auth.uid()` — только `(select auth.uid())`.
- Cross-schema — ручной JOIN, не PostgREST embed.
- Рейтинга в v1 нет. B2B-прайс в v1 нет (публичные цены).
- Дизайн — по `docs/DESIGN.md`: иконки из `/components/icons/`, CSS-переменные, без эмодзи.

## 2. Фаза H-M4a (hub-side) — объём этого ТЗ

### 2.1 Миграция

`supabase/migrations/<ts>_marketplace_multitenant_m4a.sql`:

```sql
-- Конфиг маркетплейсов
create table hub.marketplaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name jsonb not null,                     -- i18n
  description jsonb,
  theme_slugs text[] not null default '{}',-- slug'и из public.marketplace_themes
  settings jsonb not null default '{}',    -- branding и пр., на вырост
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Кэши: темы + цена
alter table hub.company_cache add column marketplace_themes text[] not null default '{}';
alter table hub.listing_cache add column marketplace_themes text[] not null default '{}';
alter table hub.listing_cache add column price_from numeric;
alter table hub.listing_cache add column price_currency text;
```

- GIN-индексы на оба `marketplace_themes`.
- RLS `hub.marketplaces`: SELECT — authenticated; запись — только `public.is_platform_admin()`
  (Hub-приложение управляет через service-role / platform-админку).
- Сид: маркетплейс `tourism` («Туристический маркетплейс»),
  `theme_slugs = {transport, accommodation, tourism, guides, food}`.
- Миграция — файлом в `supabase/migrations/`, применение на prod зафиксировать в отчёте
  (каким способом применена и сверка фактического состояния через Supabase MCP).

### 2.2 Приём новых полей в sync-эндпоинтах

- `POST /api/sync/company`: принять `marketplace_themes: string[]` → upsert в
  `company_cache.marketplace_themes`. Отсутствие поля → не трогать существующее значение.
- `POST /api/sync/listing`: принять `marketplace_themes`, `price_from`, `price_currency` →
  в `listing_cache`. Та же толерантность к отсутствию полей.
- HMAC-проверка и остальной контракт — без изменений. Лишние ключи не ломают обработку.

### 2.3 Чтение справочника тем

Хелпер `lib/marketplace/themes.ts`: чтение `public.marketplace_themes` (is_active, sort_order)
c кэшем в памяти на 5 мин. Используется дальше в M4b/M4c для лейблов и конфигуратора.

### 2.4 Заготовка маршрута `/m/[marketplaceSlug]`

- Резолв маркетплейса по slug (404 если нет/неактивен).
- Пока — плейсхолдер-страница по DESIGN.md: название, описание, плашка «Доступ по заявке —
  скоро» (membership — M4b). Существующий `/marketplace` не трогать (работает как раньше),
  добавить на него ненавязчивую ссылку на `/m/tourism`.

### 2.5 Тест-план (обязателен целиком)

1. Локально: миграция применяется; сид `tourism` на месте.
2. HTTP на sync-эндпоинты (локально и затем prod): payload с новыми полями → значения в кэшах;
   payload без новых полей → старое поведение, существующие значения не затираются.
3. RLS: `pg_policies` по `hub.marketplaces` — `qual`/`roles`, без экспозиции anon
   (урок H-M3a: проверить именно `qual`, не только наличие политики).
4. Prod smoke: `/m/tourism` открывается под tenant-логином, `/m/nonexistent` → 404.
5. Сверка prod через Supabase MCP: колонки, индексы, сид.

### 2.6 Не входит в M4a

Membership и гейт (M4b); поиск/пресеты/AI/корзина (M4c); запрос v2 и обратный канал (M4d);
рейтинг; B2B-прайс.

## 3. Набросок следующих фаз (для контекста, не реализовывать сейчас)

- **M4b:** `hub.marketplace_members` (marketplace_id, tenant_id, status pending|approved|rejected,
  requested_by, reviewed_by/at). Кнопка «Подать заявку» на `/m/[slug]` под tenant-сессией;
  ревью platform-админом; гейт всех разделов маркетплейса по approved-членству.
- **M4c:** `hub.search_presets` (marketplace_id, theme_slug, name i18n, hint_template i18n —
  заготовка текста в поле, required_params jsonb, clarify_hints jsonb); guided-флоу;
  выдача из `listing_cache` (темы ∈ marketplace.theme_slugs + город + FTS) → батч-проверка
  доступности через Vitrina availability API → фильтр/сортировка по `price_from`;
  карточка поставщика из `company_cache`; корзина → N бронирований у N тенантов через
  существующий ingest (атрибуция source_type=marketplace, requester_tenant_id).
- **M4d:** `marketplace_requests.budget`; таргетинг по теме; в Vitrina — accept/decline в карточке
  заявки + webhook Vitrina→Hub (новый, HMAC) → статус на `marketplace_request_targets` →
  уведомление заказчику. Закрывает техдолг «обратный канал».

## 4. Документация по итогу

Агент обновляет `HUB_ARCHITECTURE.md` (модель данных, sync-контракты, роуты) и
`HUB_ROADMAP-next.md` (секция Marketplace: M4a со статусом по факту prod-проверки).
