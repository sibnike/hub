# Exhibitor Hub — как продолжить работу в новом чате

## Что скинуть в новый чат

Обязательно:
1. `docs/HUB_ARCHITECTURE.md`
2. `docs/HUB_ROADMAP-next.md`
3. `docs/DESIGN.md`

По необходимости:
- `YANBADA_ARCHITECTURE.md` — общая картина экосистемы
- `YANBADA_PRODUCT.md` — бизнес-описание
- Документы Vitrina если задача затрагивает интеграцию

## Рабочий процесс

- Claude пишет ТЗ в `docs/` и промпт агенту в `tasks/prompt_NN.md`
- Cursor-агент выполняет, присылает отчёт
- **Деплой (экономия Build CPU Minutes):**
  - Не деплоить каждый коммит — **коммитить пачкой**, prod-деплой **один раз по готовности фазы**.
  - Только **git-триггер** (`git push origin main`); **не использовать** ручной `vercel --prod` — дублирует билд и создаёт рассинхрон git↔prod.
  - Коммиты **только** с `docs/**`, `*.md`, `tasks/**` (без кода/миграций) **деплой не требуют** — Vercel пропустит билд через Ignored Build Step (`scripts/vercel-should-build.sh` в `vercel.json`).
  - Причина: Build CPU Minutes — основной расход Vercel; лишние билды жгут кредиты.
  - Исключение: смена ENV на Vercel → один redeploy после push с кодом или вручную через dashboard (не CLI `vercel --prod` из локальной машины).
- **Миграции prod (shared Supabase с Vitrina):**
  - **Нельзя** применять hub-DDL через Supabase MCP `apply_migration` — MCP ставит auto-timestamp,
    version id не совпадает с именем файла в git → orphan в `schema_migrations`, ломает `db:push:prod`.
  - Version id должен быть уникальным во всём shared DB и равен timestamp из имени `.sql`.
    Если слот занят в Vitrina/prod — переименовать файл в `mega-hub` и дубль в `vitrina` до применения/repair.
  - **Предпочтительно:** файл в `vitrina/supabase/migrations/` (+ зеркало здесь в
    `mega-hub/supabase/migrations/`) → из **vitrina**:
    `CONFIRM_PROD_DB_PUSH=1 npm run db:push:prod`.
  - **Если SQL уже выполнен вручную:** тот же DDL + ручной INSERT в
    `supabase_migrations.schema_migrations` с `version = <timestamp из имени файла>` (не MCP).
  - После нестандартного пути — `npx supabase migration list --linked` (из vitrina) и repair/rename.
    Проверить отсутствие дублей, `local-only` и `remote-only`.
  - Текущий конфликт зафиксирован: `20260705220000` занят V-31
    (`submissions_marketplace_requester`), H-M4d перенесён на
    `20260705230000_marketplace_request_v2_m4d`.
- ENV изменения требуют Redeploy

## Текущий статус (на момент закрытия чата)

На проде: **H-0...H-10** включительно.

E2E работает end-to-end:
- Организатор → создаёт событие → загружает SVG карту → расставляет стенды
- Участник → подключается по коду из email → редактирует профиль в Vitrina
- Посетитель → регистрируется по invitation-ссылке → получает email-подтверждение → попадает в брендированный гайд
- Аналитика собирается, дашборды организатора и участника работают
- Тепловая карта, embed, white-label работают
- Дизайн-система внедрена: 43 SVG иконки, 5 шрифт-пар, CSS-переменные темы события, Framer Motion анимации, скелетоны, страница `/branding`

## Часть экосистемы Yanbada

Hub работает в связке с Vitrina (`admin.yanbada.com`):
- Данные компании в Vitrina → синхронизируются в `hub.company_cache` через webhook
- Hub встраивает страницу Vitrina в карточку компании через `?embed=1`
- Общий Supabase Auth для tenant-кабинетов на `.yanbada.com`
- Visitor-кабинет — отдельный signed JWT cookie (90 дней)
- Hub НИКОГДА не пишет в схему `public`

## Стартовая фраза для нового чата

> Продолжаем проект Exhibitor Hub. Прикладываю `ARCHITECTURE.md`, `ROADMAP-next.md`, `DESIGN.md`.
> На проде H-0...H-10 и Marketplace M1/M2/M3a/H-M4a...H-M4d включительно,
> базовый поток выставки работает end-to-end,
> гайд посетителя с регистрацией и дизайн-системой запущен.
> Hub интегрирован с Vitrina через webhook + общий Supabase + ?embed=1.
> Хочу взять [фазу H-N] из роадмапа. Пиши ТЗ в `docs/` и промпт в `tasks/`, как обычно.

## Что готово к следующему шагу

Следующая логичная фаза — **H-11 запросы и назначение встреч**: текущая кнопка «Встреча» в карточке компании сейчас заглушка, нужно сделать полноценную логику запросов от посетителя к участнику с одобрением, email-уведомлениями и календарём встреч в обоих кабинетах.

Альтернативы: H-13 программа мероприятия, H-14 PWA, H-15 погашение бонусов, H-16 гид по городу, H-17 post-event.

## Стандартные команды

```bash
cd /Users/nikolayzhdanov/Documents/Yanbada-superApp/mega-hub
git add .
git commit -m "..."
git push

# Prod миграции — из vitrina (shared DB), не MCP apply_migration:
cd /Users/nikolayzhdanov/Documents/Yanbada-superApp/vitrina
CONFIRM_PROD_DB_PUSH=1 npm run db:push:prod
npx supabase migration list --linked

# Hub-DDL: version id в schema_migrations = timestamp из имени .sql-файла.
# Ручной SQL на prod → обязателен ручной INSERT в schema_migrations с тем же id.
# ENV изменения → Vercel → Redeploy.
```

## Ключевые ENV (проверять при проблемах)

```
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yanbada.com
SESSION_SIGNING_SECRET                          # JWT для visitor_session
VITRINA_WEBHOOK_SECRET                          # shared с Vitrina
VITRINA_SUBMISSIONS_INGEST_SECRET               # shared HMAC для Hub → Vitrina submissions ingest
HUB_WEBHOOK_URL (в Vitrina env)
RESEND_API_KEY
RESEND_FROM_EMAIL=Yanbada Hub <hub@yanbada.com>
```

## E2E / QA-аккаунты

Prod E2E (`scripts/test-marketplace-*.mjs`) — **только** выделенные `@vitrina.test` аккаунты
из `.env.local` (`QA_SANDBOX_*`, `QA_BUYER_*`, `QA_PLATFORM_*`). Боевые логины, личные
`@gmail.com` и любые не-`@vitrina.test` адреса в тестах **не использовать**.

Заведение QA:
- `node scripts/setup-qa-buyer.mjs` — qa-sandbox + qa-buyer
- `node scripts/setup-qa-platform.mjs` — qa-platform (`platform_admin`)

Скрипты с `signIn` обязаны проверять домен через `scripts/lib/qa-env-guard.mjs`; если добавляется новый prod E2E с логином, сначала подключить этот guard.

