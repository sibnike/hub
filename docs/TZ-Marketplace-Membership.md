# ТЗ — H-M4b: Membership маркетплейса (доступ по заявке тенанта)

> Фаза M4b мульти-маркетплейс инициативы. Мастер-план — `docs/TZ-Marketplace-Multitenant.md`.
> Только hub-side. Покупатель = тенант (Supabase Auth), нового auth-контура нет.

## 1. Цель

Вход в маркетплейс `/m/[slug]` — только для тенантов с одобренным членством.
Тенант подаёт заявку → platform-админ одобряет/отклоняет → доступ открывается.

## 2. Модель данных (миграция)

`supabase/migrations/<prod-ts>_marketplace_members_m4b.sql` (version id взять из prod-истории
после apply — см. правило миграций; файл продублировать в vitrina repo тем же id):

```sql
create table hub.marketplace_members (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references hub.marketplaces(id) on delete cascade,
  tenant_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended')),
  requested_by uuid,             -- auth.uid() заявителя
  reviewed_by uuid,              -- platform admin
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  unique (marketplace_id, tenant_id)
);
```

- Индексы: `(marketplace_id, status)`, `(tenant_id)`.
- RLS (SECURITY DEFINER хелперы, `(select auth.uid())`):
  - SELECT: `is_platform_admin()` ИЛИ `is_tenant_admin(tenant_id)` (тенант видит только свои строки).
  - INSERT: `is_tenant_admin(tenant_id)` И status='pending' (тенант заводит только заявку на себя).
  - UPDATE/DELETE: только `is_platform_admin()` (одобрение/отклонение/смена статуса).
- Не экспонировать anon (урок H-M3a — проверить `qual`/`roles` в `pg_policies`).

## 3. Хелпер доступа

`lib/marketplace/membership.ts`:
- `getMembership(marketplaceId, tenantId)` → строка или null.
- `assertMarketplaceAccess(marketplaceSlug, tenantId)` → резолвит маркетплейс, проверяет
  approved-членство; иначе бросает / возвращает флаг для гейта.
- Кэш не обязателен (запрос дешёвый, доступ проверяется на входе в раздел).

## 4. UI

### 4.1 `/m/[slug]` — гейт вместо плейсхолдера M4a

Под tenant-сессией показывать одно из четырёх состояний по членству активного тенанта:
- **нет записи** → экран «Подать заявку на доступ» + кнопка (POST заявки);
- **pending** → «Заявка на рассмотрении» (дата подачи);
- **approved** → вход в маркетплейс (пока — заглушка «Поиск скоро», M4c; но гейт уже боевой);
- **rejected/suspended** → «Доступ отклонён» + reject_reason, кнопка «Подать повторно»
  (повторная заявка = UPDATE своей строки в pending, reviewed_* очищаются).

Не залогинен → редирект на общий tenant-login (`.yanbada.com` cookie).
Тенант без выбранного активного тенанта → предложить выбрать (существующий tenant-switch).

### 4.2 Platform-админка `/organizer/... ` или `/admin/marketplace/[slug]/members`

Список заявок по маркетплейсу: тенант (name из `joinTenants()`), статус, дата, кнопки
Одобрить / Отклонить (с причиной) / Приостановить. Фильтр по статусу.
Только `is_platform_admin()`.

## 5. API

- `POST /api/marketplace/[slug]/membership/request` — тенант подаёт/повторяет заявку
  (service-role после проверки `is_tenant_admin` активного тенанта; status=pending).
- `GET /api/marketplace/[slug]/membership` — статус членства активного тенанта.
- `GET /api/admin/marketplace/[slug]/members` — список (platform admin).
- `PATCH /api/admin/marketplace/[slug]/members/[id]` — approve/reject/suspend (platform admin,
  проставляет reviewed_by/at, reject_reason).

Все — `assertTenantAdminOrPlatform()` / `is_platform_admin()` соответственно.

## 6. Уведомления (Resend, `hub@yanbada.com`)

- Заявка подана → email platform-админам (или дайджест — по факту, если списка нет, лог + TODO).
- Одобрено/отклонено → email tenant-админам заявителя (reject_reason в тексте при отказе).
- Шаблоны по DESIGN.md, без эмодзи.

## 7. Тест-план (обязателен целиком)

1. Миграция локально (`npm run db:reset:local`), RLS — `pg_policies` qual/roles, anon не виден.
2. HTTP E2E на prod через два тенанта (qa-sandbox + второй; если второго нет — завести
   qa-buyer по образцу qa-sandbox):
   - подать заявку → pending; повторно тем же тенантом → 409/idempotent (не плодить дубли);
   - approve platform-админом → `/m/tourism` под этим тенантом пускает;
   - reject → показывает причину, «подать повторно» возвращает в pending;
   - suspend approved → доступ закрывается.
3. Негатив: тенант без членства → гейт «подать заявку», не внутрь; anon → login-redirect;
   тенант A не видит членство тенанта B (RLS).
4. Сверка prod через Supabase MCP: строки `marketplace_members`, статусы, отсутствие anon-экспозиции.

## 8. Не входит в M4b

Поиск, пресеты, AI, выдача, корзина (M4c); запрос v2 и обратный канал (M4d); B2B-прайс; рейтинг.

## 9. Документация

`HUB_ARCHITECTURE.md` (модель, роуты, API), `HUB_ROADMAP-next.md` (M4b — статус по prod E2E).
