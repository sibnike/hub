# ROADMAP — Exhibitor Hub, следующие фазы

Статус: на проде H-0...H-10 включительно; Marketplace Механики 1, 2 и 3a — **shipped** (prod, сквозной прогон через Supabase MCP).

Базовый поток выставки работает end-to-end:
- Организатор создаёт событие, добавляет участников, расставляет стенды на карте, генерирует QR
- Участник подключается по коду из email, редактирует профиль в Vitrina
- Посетитель регистрируется по invitation-ссылке, попадает в брендированный гайд
- В гайде: каталог, карта с подсветкой избранных, опросы за бонусы, профиль с историей баллов
- Аналитика собирается, тепловая карта рисуется, embed/white-label работают

Дизайн-система внедрена (H-10): своя библиотека SVG-иконок (43 шт), 5 шрифт-пар через next/font,
CSS-переменные для темы события, EventThemeShell оборачивает гайд и публичные страницы,
Framer Motion анимации, скелетоны вместо спиннеров, страница `/branding` в кабинете организатора.

## Инварианты (сохранять)

- Hub никогда не хранит данные компании — только `tenant_id` и `company_cache`.
- Hub никогда не пишет в схему `public`.
- Cross-schema запросы — через `joinTenants()`.
- Все RLS-политики через SECURITY DEFINER функции.
- SVG санитизация — `sanitize-html`.
- Трекинг — fire-and-forget.
- Маршруты публичных страниц — force-dynamic, без кеша.
- **Эмодзи в UI запрещены.** Только SVG из `/components/icons/`.
- Цвета — только через CSS-переменные, никаких inline hex.
- Шрифты — только из `fontMap`.
- Все новые экраны делать по `docs/DESIGN.md`.

---

## Marketplace — сводка (shipped на prod)

| Механика | Статус | Prod-проверка |
|----------|--------|---------------|
| **1** — AI-поиск тенанта | ✅ shipped (H-M1) | `hub.company_cache` + FTS + `/api/marketplace/search` |
| **2** — AI-поиск услуг/page | ✅ shipped (H-M2) | `hub.listing_cache` + sync listing + единая лента на `/marketplace` |
| **3a** — запрос внешнего заявителя | ✅ shipped (H-M3a) | Hub → Vitrina ingest → `public.submissions` + `vitrina_submission_id` на target |

Все три подтверждены реальным сквозным прогоном на prod (HTTP + сверка в Supabase MCP).

**Отложено — отдельные будущие задачи, не сделаны:**

- **Обратный канал** тенант → заявитель (webhook Vitrina → Hub при ответе на submission).
- **Поток 3b** — внутренние B2B-запросы тенанта (результат в `booking_resources` / кросс-тенантное бронирование).
- **Адресация на уровне сотрудника** (v1 = тенант целиком; персональный исполнитель — отдельная итерация).

Не входит в Marketplace: embedding-поиск; `hub.meeting_requests` (см. фазу H-11).

---

## Marketplace — Механика 1: AI-поиск тенанта ✅ shipped

Реализовано (H-M1), **на prod**:


- Vitrina webhook передаёт `city` в `hub.company_cache`.
- FTS: `search_vector` (GIN) + RPC `hub.search_company_cache`.
- AI-парсинг свободного текста → структурированный фильтр (Anthropic), поиск — детерминированный SQL.
- API: `POST /api/marketplace/search`.
- UI: `/marketplace` (временный entry point до решения по корневому домену).
- Карточки ведут на Vitrina: `/p/{slug}` или `/h/{tenantSlug}` (контекст-нейтрально).

Документация: `docs/TZ-Marketplace-Tenant-Search.md`.

---

## Marketplace — Механика 2: AI-поиск услуг/page ✅ shipped

Реализовано (H-M2), **на prod**:

- `hub.listing_cache` — денормализованный кэш на уровне page (title, short_text, categories).
- FTS: `search_vector` (GIN) + RPC `hub.search_listing_cache`.
- Vitrina webhook: `POST /api/sync/listing` (upsert/delete при публикации/снятии page).
- AI-парсинг — переиспользует `parse-marketplace-query.ts` из Механики 1.
- API: `POST /api/marketplace/search-listings`.
- UI `/marketplace` — единая лента: карточки «Компания» и «Услуга», услуги ведут на `/p/{slug}?tenant=…`.

Документация: `docs/TZ-Marketplace-Listing-Search.md`.

---

## Marketplace — Механика 3a: формирование запроса (внешний заявитель) ✅ shipped

Реализовано (H-M3a), **на prod** (сквозной прогон: `POST /api/marketplace/request` → submission в inbox тенанта, `vitrina_submission_id` в `hub.marketplace_request_targets`):

- `hub.marketplace_requests` + `hub.marketplace_request_targets` + RLS (токен в заголовке `X-Marketplace-Request-Token`, не в URL).
- AI-парсинг, маршрутизация M1/M2, фильтр занятости (Vitrina availability API).
- **Variant B:** Hub → `POST /api/integrations/submissions` (Vitrina, HMAC) → inbox тенанта.
- UI `/marketplace`: вкладки «Поиск» и «Отправить запрос».

**Отложено — отдельные будущие задачи, не сделаны:**

- Поток **3b** — внутренние B2B-запросы тенанта (встраивание исполнителя в booking заявителя).
- Адресация на уровне сотрудника (v1 = тенант).

**Закрыто в M4d:** обратный канал тенант → заявитель (`POST /api/marketplace/response`, UI «Мои запросы»).

Документация: `docs/TZ-Marketplace-Request.md`, Vitrina `docs/INTEGRATION-VITRINA-SUBMISSIONS-FROM-TOUCHIN.md`.

---

## Marketplace — H-M4a: мульти-маркетплейс (hub-side) ✅ shipped

Реализовано (H-M4a), **на prod** (миграция `20260705134146_marketplace_multitenant_m4a`, деплой `hub.yanbada.com`, сквозной прогон `test-marketplace-m4a.mjs` 14/14):

- `hub.marketplaces` + RLS (SELECT — authenticated, запись — `is_platform_admin()`), сид `tourism`.
- `company_cache.marketplace_themes`, `listing_cache.marketplace_themes`, `price_from`, `price_currency` + GIN-индексы.
- Sync: `/api/sync/company` и `/api/sync/listing` принимают новые поля; отсутствие поля не затирает кэш.
- `lib/marketplace/themes.ts` — чтение `public.marketplace_themes` (кэш 5 мин).
- UI: `/m/[slug]` (плейсхолдер «Доступ по заявке — скоро»), ссылка с `/marketplace` на `/m/tourism`.

**Следующие фазы:** M4b (membership + гейт), M4c (guided-поиск, корзина), M4d (запрос v2).

Документация: `docs/TZ-Marketplace-Multitenant.md`.

---

## Marketplace — H-M4b: membership (доступ по заявке тенанта) ✅ shipped

Реализовано (H-M4b), миграция `20260705201000_marketplace_members_m4b` (дубль в vitrina):

- `hub.marketplace_members` + RLS (tenant admin видит только свои строки, anon не экспонируется).
- `lib/marketplace/membership.ts` — `getMembership`, `assertMarketplaceAccess`.
- UI `/m/[slug]` — гейт: нет заявки / pending / approved (guided-поиск M4c) / rejected|suspended.
- Platform admin: `/admin/marketplace/[slug]/members` — approve / reject / suspend.
- API: `POST .../membership/request`, `GET .../membership`, admin list + PATCH.
- Email (Resend `hub@yanbada.com`): заявка → platform admins; решение → tenant admins.

**Следующие фазы:** M4c (guided-поиск, корзина), M4d (запрос v2).

Документация: `docs/TZ-Marketplace-Multitenant.md`.

---

## Marketplace — H-M4c: guided-поиск (пресеты + AI + выдача + мульти-бронь)

Реализовано (H-M4c), миграция `20260705213000_marketplace_search_presets_m4c` (дубль в vitrina):

- `hub.search_presets` + RLS + сиды tourism (accommodation, transport, tourism).
- RPC `hub.search_marketplace_listings` — themed listing search с городом.
- Guided-флоу на `/m/[slug]` для approved-тенанта: пресет → город → текст → AI → уточнения → выдача → корзина.
- Availability batch через Vitrina `/api/booking/availability` (как M3a).
- Мульти-бронь: `POST .../search/book` → Vitrina ingest HMAC; metadata marketplace-атрибуции.
- Platform admin: `/admin/marketplace/[slug]/presets`.
- Тест: `npm run test:marketplace-m4c`.

**Ограничение v1:** UI accept/decline в Vitrina inbox — V-32 (отдельный агент vitrina). Hub-эндпоинт response готов.

**Следующие фазы:** после M4d — поток 3b, платежи/escrow.

Документация: `docs/TZ-Marketplace-Search-Flow.md`.

---

## Marketplace — H-M4d: запрос v2 (бюджет + accept/decline + обратный канал)

Реализовано (H-M4d), миграция `20260705220000_marketplace_request_v2_m4d` (дубль в vitrina):

- Budget + `requester_tenant_id` на `marketplace_requests`; `response_status` на targets.
- Guided-флоу: «Отправить запрос» с бюджетом → multi-target ingest (`source_type=marketplace`).
- Ingest throttle 400ms/tenant + retry backoff на 429 (мульти-бронь 2/2).
- `POST /api/marketplace/response` — обратный канал Vitrina→Hub (HMAC).
- UI «Мои запросы» на `/m/[slug]`.
- Тест: `npm run test:marketplace-m4d`.

Документация: `docs/TZ-Marketplace-Request-V2.md`.

---

## Фаза H-11 — Запросы и назначение встреч

Сейчас кнопка «Встреча» в карточке компании — заглушка (Toast «Скоро»). Раскрыть её.

### Поток

```
Посетитель в гайде → карточка компании → кнопка «Встреча»
    → форма: предлагаемое время (из расписания мероприятия), тема, сообщение
    → создаётся meeting_request (status: pending)
    → email участнику + уведомление в кабинете Hub
    → участник одобряет / предлагает другое время / отклоняет
    → подтверждённая встреча видна обоим в календаре кабинета
    → за 1 час до встречи — email-напоминание обоим
    → после встречи — посетитель может пометить «состоялась» в избранном
```

### Модель данных

- `hub.meeting_requests`:
  - id, event_id, visitor_id, tenant_id, proposed_time_from/to, topic, message
  - status: pending | accepted | rescheduled | rejected | completed | no_show
  - response_message, response_time_from/to
  - created_at, responded_at

### UI

**Для компании-участника:** новый раздел «Входящие запросы на встречи» в кабинете `/exhibitor/events/[slug]/meetings`.

**Для посетителя:** новый пункт навигации «Встречи» в гайде. Страница `/guide/meetings`:
- Запрошенные (pending) — ожидают ответа
- Подтверждённые — с возможностью добавить в Google Calendar (ICS-файл)
- Прошедшие — с пометкой состоялась/нет

**Для организатора:** общая статистика встреч на дашборде события (топ компаний по запросам = метрика популярности).

### Email-уведомления

- Запрос → email компании-участнику
- Ответ → email посетителю
- За 1 час → email обоим
- После окончания — email посетителю с просьбой поставить отметку

---

## Фаза H-12 — Networking and discovery

Расширение поверх кабинета посетителя.

- Рекомендации компаний на основе категорий из профиля посетителя
- «Похожие профили» — компании похожих категорий
- Match-предложения «вам стоит встретиться» когда категории интересов посетителя совпадают с категориями компании
- Импорт LinkedIn-профиля при регистрации (опционально) для быстрого заполнения

---

## Фаза H-13 — Программа мероприятия

Сейчас Hub знает только про каталог и карту. Добавить расписание докладов.

- `hub.event_sessions` (event_id, title i18n, description i18n, start_at, end_at,
  speakers jsonb, room, capacity, sort_order)
- `hub.session_attendees` — кто записался на сессию (visitor_id, session_id)
- Публичная страница в гайде `/guide/program` — расписание по дням
- Подсветка идущих сейчас сессий
- Посетитель добавляет сессии в «Мой план»
- Push-уведомления за 15 минут (если PWA подключено)

---

## Фаза H-14 — Mobile app (PWA)

Превратить гайд в PWA для удобства на телефоне на выставке.

- Manifest, service worker, иконки из `event.settings.brand_logo_url`
- Offline-кеш каталога и карты
- Push-уведомления через Web Push API
- Установка как приложение на главный экран
- Геолокация (если совпадает с координатами выставки) — «найти ближайший стенд»

---

## Фаза H-15 — Бонусная система: погашение

Сейчас бонусы только начисляются. Добавить погашение через интеграцию с приложением Yanbada/Touchin.

- Партнёрский каталог наград (кофе, скидки, мерч)
- Generate QR для погашения у партнёра
- Стимулирование скачивания основного приложения для удобства

---

## Фаза H-16 — Гид по городу

Внутри гайда посетителя — раздел с рекомендациями по городу.

- Подборки: рестораны, что посмотреть, как добраться
- Можно реализовать через интеграцию с блоками Touchin (если есть API)
- Или своя простая CMS для организатора (`/organizer/events/[slug]/city-guide`)

---

## Фаза H-17 — Post-event

Когда событие закончилось — что дальше?

- Архивный режим события (read-only, исторические данные)
- Посетитель получает финальный email с экспортом контактов (из избранного со статусом met) в CSV
- Компания-участник видит итоговую аналитику (сравнение с другими своими выставками)
- Опросы NPS — оценить событие и компании
- «Возможно вам будет интересно» — другие предстоящие события на платформе
- Рассылка следующих мероприятий организатора всем посетителям прошлых событий (opt-in)

---

## Фаза H-18 — CSV-импорт списка билетов

Сейчас регистрация только открытая по invitation-ссылке. Добавить импорт списка купивших билет.

- В кабинете организатора `/organizer/events/[slug]/visitors` — кнопка «Импорт CSV»
- Формат: email, name, phone, tier_slug
- Создаются preregistered записи с tier'ом
- На email уходит персональная одноразовая ссылка
- После клика — короткая форма (доп.поля если нужны) → подтверждение

---

## Технический долг

- Магик-link при регистрации в Vitrina иногда требует второй вход — изучить
- Дедупликация в `track_events` сейчас по session_id, при agressive краулерах может ложно срабатывать — нужна проверка User-Agent
- Тёмная тема гайда (опционально, по toggle посетителем)
- Авто-высота iframe в карточке компании иногда долго догоняет — добавить скелетон до получения высоты
- Тепловая карта при большом количестве событий (10к+) тяжёлая — рассмотреть агрегацию на бэке через ежедневный cron
- Embed-виджет (`hub-widget.js`) минифицирован вручную — настроить build pipeline
- E2E тесты — Playwright для основных потоков (регистрация посетителя, добавление в избранное, ответ на опрос)
