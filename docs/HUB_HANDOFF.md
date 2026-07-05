# Exhibitor Hub — как продолжить работу в новом чате

## Что скинуть в новый чат

Обязательно:
1. `docs/ARCHITECTURE.md`
2. `docs/ROADMAP-next.md`
3. `docs/DESIGN.md`

По необходимости:
- `YANBADA_ARCHITECTURE.md` — общая картина экосистемы
- `YANBADA_PRODUCT.md` — бизнес-описание
- Документы Vitrina если задача затрагивает интеграцию

## Рабочий процесс

- Claude пишет ТЗ в `docs/` и промпт агенту в `tasks/prompt_NN.md`
- Cursor-агент выполняет, присылает отчёт
- Деплой: `git push` → Vercel
- **Миграции prod (shared Supabase с Vitrina):**
  - **Нельзя** применять hub-DDL через Supabase MCP `apply_migration` — MCP ставит auto-timestamp,
    version id не совпадает с именем файла в git → orphan в `schema_migrations`, ломает `db:push:prod`.
  - **Предпочтительно:** файл в `vitrina/supabase/migrations/` (+ зеркало здесь в
    `mega-hub/supabase/migrations/`) → из **vitrina**:
    `CONFIRM_PROD_DB_PUSH=1 npm run db:push:prod`.
  - **Если SQL уже выполнен вручную:** тот же DDL + ручной INSERT в
    `supabase_migrations.schema_migrations` с `version = <timestamp из имени файла>` (не MCP).
  - После нестандартного пути — `npx supabase migration list --linked` (из vitrina) и repair/rename.
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
> На проде H-0...H-10 включительно, базовый поток выставки работает end-to-end,
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
HUB_WEBHOOK_URL (в Vitrina env)
RESEND_API_KEY
RESEND_FROM_EMAIL=Yanbada Hub <hub@yanbada.com>
```

