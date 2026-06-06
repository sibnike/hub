> Открой `tasks/prompt_35_hub_postgrest_embed_fix.md` и выполни задачу. Положи в `mega-hub/tasks/`. Срочный фикс — PostgREST не может построить relationship между `hub.event_participations.tenant_id` и `public.tenants.id`. Из-за этого `/api/organizer/events/[slug]/participants` падает с 500.

# Fix — Заменить PostgREST embed на явные JOIN-запросы

## Проблема

```
"error": "Could not find a relationship between 'event_participations' and 'tenant_id' in the schema cache"
```

PostgREST умеет автоматически делать JOIN через embed-синтаксис (`select('*, tenant:tenant_id(...)')`), но **только** когда FK явно объявлен И когда обе таблицы в одной схеме (или явно настроены связи между схемами).

У нас:
- `hub.event_participations.tenant_id` ссылается на `public.tenants.id`
- FK есть, но PostgREST не видит его из-за разных схем

## Решение

Не использовать PostgREST embed для cross-schema запросов. Делать два отдельных запроса и склеивать вручную.

---

## Задача

### 1. Найти все места с cross-schema embed

Поищи в коде Hub паттерны вида:

```typescript
.from('event_participations').select(`
  *,
  tenant:tenant_id(*),
  ...
`)
```

Скорее всего эти места:
- `lib/hub/get-catalog-participants.ts`
- `app/api/organizer/events/[slug]/participants/route.ts`
- Другие эндпоинты `/api/organizer/*` и `/api/exhibitor/*` которые джойнят hub.* с public.tenants

### 2. Заменить на два запроса

#### Пример: API participants

Было:
```typescript
const { data } = await supabase.schema('hub')
  .from('event_participations')
  .select(`
    *,
    tenant:tenant_id(id, name, slug),
    stand:event_stands(stand_number, pavilion, floor)
  `)
  .eq('event_id', eventId)
```

Стало:
```typescript
// 1. Берём participations
const { data: participations } = await supabase.schema('hub')
  .from('event_participations')
  .select('*')
  .eq('event_id', eventId)

// 2. Берём stands в одном запросе (это та же схема hub — embed работает)
const participationIds = participations?.map(p => p.id) ?? []
const { data: stands } = await supabase.schema('hub')
  .from('event_stands')
  .select('*')
  .in('participation_id', participationIds)

// 3. Берём tenants отдельно из public
const tenantIds = participations?.map(p => p.tenant_id).filter(Boolean) ?? []
const { data: tenants } = await supabase
  .from('tenants')
  .select('id, name, slug')
  .in('id', tenantIds)

// 4. Склеиваем
const result = participations?.map(p => ({
  ...p,
  tenant: tenants?.find(t => t.id === p.tenant_id) ?? null,
  stands: stands?.filter(s => s.participation_id === p.id) ?? [],
})) ?? []
```

#### Пример: каталог (lib/hub/get-catalog-participants.ts)

Аналогично — JOIN с `company_cache` (которая тоже в `hub`) делается embed'ом, а tenant.slug нужно дёрнуть отдельно из `public.tenants`.

### 3. Универсальный хелпер

Создай `lib/hub/join-tenants.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export async function joinTenants<T extends { tenant_id: string | null }>(
  rows: T[]
): Promise<(T & { tenant: { id: string; name: string; slug: string } | null })[]> {
  if (!rows.length) return []

  const supabase = createAdminClient()
  const tenantIds = [...new Set(rows.map(r => r.tenant_id).filter(Boolean) as string[])]

  if (!tenantIds.length) {
    return rows.map(r => ({ ...r, tenant: null }))
  }

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .in('id', tenantIds)

  const map = new Map(tenants?.map(t => [t.id, t]) ?? [])
  return rows.map(r => ({
    ...r,
    tenant: r.tenant_id ? map.get(r.tenant_id) ?? null : null,
  }))
}
```

Использование:
```typescript
const { data: participations } = await supabase.schema('hub')
  .from('event_participations')
  .select('*')
  .eq('event_id', eventId)

const withTenants = await joinTenants(participations ?? [])
```

### 4. Проверить все места

Сделай grep по проекту:

```bash
grep -rn "schema('hub')" app/ lib/ | grep -E "tenant:" 
grep -rn ".select(" app/ lib/ | grep -E "tenant_id\("
```

Каждое найденное место — переписать через `joinTenants` или отдельный запрос.

### 5. Edge-cases

- Если `tenant_id` IS NULL (pending participation без подключённой компании) — `tenant: null`, не падать
- Если company_cache нет для tenant_id — показать только имя из public.tenants, без описания/категорий
- Service-role клиент игнорирует RLS — для embed это не помогает, проблема в самой архитектуре PostgREST

### 6. Проверка

```bash
npm run build
```

Закоммитить:
```bash
git add .
git commit -m "fix: replace cross-schema PostgREST embed with manual joins"
git push
```

---

## Результат

- [ ] `joinTenants()` хелпер создан
- [ ] `/api/organizer/events/[slug]/participants` работает
- [ ] Каталог `/e/[slug]/catalog` грузит данные
- [ ] Все cross-schema embed заменены на явные JOIN
- [ ] `npm run build` успешно
- [ ] На проде ошибка "Could not find a relationship" ушла
