> Открой `tasks/prompt_33_hub_rls_recursion.md` и выполни задачу. Положи в `mega-hub/tasks/`. Срочный фикс — при открытии `/organizer/events` ошибка "infinite recursion detected in policy for relation events". Нужно переписать RLS-политики на схеме `hub` без рекурсии и добавить поддержку platform_admin.

# Fix — RLS recursion в hub.events и поддержка platform_admin

## Проблема

При попытке получить данные из `hub.events` Supabase возвращает:
```
infinite recursion detected in policy for relation "events"
```

Это происходит потому что в RLS-политике на `hub.events` есть subquery в `public.tenant_admins`, которая через какую-то цепочку триггеров/политик ссылается обратно на `hub.events`.

Дополнительно: platform_admins (супер-админы) должны иметь доступ ко всем событиям, но текущая политика их не учитывает.

## Решение

1. Переписать RLS-политики на схеме `hub` через SECURITY DEFINER функции — это разрывает цепочку рекурсии
2. Добавить проверку platform_admin во все политики
3. То же сделать для `event_participations`, `event_stands`, `event_maps`, `event_analytics`, `track_events`

---

## Задача

### 1. SECURITY DEFINER функции

Создай миграцию `supabase/migrations/YYYYMMDDHHMMSS_hub_rls_fix.sql`:

```sql
-- Функция: проверить что пользователь — админ тенанта
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid() AND tenant_id = check_tenant_id
  );
$$;

-- Функция: проверить что пользователь — platform_admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Список tenant_id текущего пользователя (для IN-проверок)
CREATE OR REPLACE FUNCTION public.current_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tenants() TO authenticated, anon;
```

### 2. Переписать политики на схеме hub

```sql
-- ─── hub.events ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_events" ON hub.events;
DROP POLICY IF EXISTS "events_select" ON hub.events;
DROP POLICY IF EXISTS "events_all" ON hub.events;

-- Чтение: организатор + platform_admin + публичные published
CREATE POLICY "events_select" ON hub.events
  FOR SELECT USING (
    status = 'published'
    OR public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

-- Запись: только админ организатора + platform_admin
CREATE POLICY "events_insert" ON hub.events
  FOR INSERT WITH CHECK (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "events_update" ON hub.events
  FOR UPDATE USING (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "events_delete" ON hub.events
  FOR DELETE USING (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

-- ─── hub.event_participations ───────────────────────────────────────────────
DROP POLICY IF EXISTS "exhibitor_participations" ON hub.event_participations;
DROP POLICY IF EXISTS "participations_all" ON hub.event_participations;

CREATE POLICY "participations_select" ON hub.event_participations
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_insert" ON hub.event_participations
  FOR INSERT WITH CHECK (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_update" ON hub.event_participations
  FOR UPDATE USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_delete" ON hub.event_participations
  FOR DELETE USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_stands ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stands_all" ON hub.event_stands;
DROP POLICY IF EXISTS "stands_select" ON hub.event_stands;

CREATE POLICY "stands_select" ON hub.event_stands
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE e.status = 'published' OR public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "stands_modify" ON hub.event_stands
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_maps ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "maps_all" ON hub.event_maps;
DROP POLICY IF EXISTS "maps_select" ON hub.event_maps;

CREATE POLICY "maps_select" ON hub.event_maps
  FOR SELECT USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE e.status = 'published' OR public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "maps_modify" ON hub.event_maps
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_analytics ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_all" ON hub.event_analytics;

CREATE POLICY "analytics_select" ON hub.event_analytics
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.track_events ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_track_events" ON hub.track_events;
DROP POLICY IF EXISTS "exhibitor_own_track_events" ON hub.track_events;

CREATE POLICY "track_events_select" ON hub.track_events
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.company_cache ──────────────────────────────────────────────────────
-- Уже разрешён SELECT всем (политика "cache_read") — оставить как есть
```

---

### 3. Поддержка platform_admin в коде Hub

В `lib/auth/current-tenant.ts` добавь функции:

```typescript
import { createClient } from '@/lib/supabase/server'

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return !!data
}

export async function assertTenantAdminOrPlatform(tenantId: string): Promise<boolean> {
  if (await isPlatformAdmin()) return true
  return assertTenantAdmin(tenantId)
}

// Возвращает все тенанты для platform_admin, или только свои для tenant_admin
export async function getAccessibleTenants() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  if (await isPlatformAdmin()) {
    const { data } = await supabase
      .from('tenants')
      .select('id, slug, name')
      .order('name')
    return data ?? []
  }

  const { data } = await supabase
    .from('tenant_admins')
    .select('tenant_id, tenants(id, slug, name)')
    .eq('user_id', user.id)

  return data?.map(r => r.tenants).filter(Boolean) ?? []
}
```

### 4. Использовать новые функции

#### `/organizer/events/page.tsx`

Заменить `getCurrentUserTenants()` на `getAccessibleTenants()`. Если platform_admin — он видит все тенанты в селекторе.

#### Все endpoints `/api/organizer/*`

Заменить `assertTenantAdmin(id)` на `assertTenantAdminOrPlatform(id)`.

#### `/organizer/events` — логика редиректа

Если `getAccessibleTenants()` вернул пустой массив (не platform_admin и нет tenant_admins) — НЕ редиректить, а показать страницу с сообщением:

```
У вас пока нет доступа ни к одному тенанту.
Обратитесь к администратору платформы.
```

То же самое для `/exhibitor/events`.

---

## Проверка

После применения миграции:

1. Открыть `hub.yanbada.com` от platform_admin → должен открыться `/organizer/events` со всеми тенантами в селекторе
2. Привязанный tenant_admin видит только свои тенанты
3. Никаких "infinite recursion" в логах
4. `SELECT * FROM hub.events` через service-role и через authenticated user работает без ошибок

---

## Результат

- [ ] Миграция применена, ошибка recursion ушла
- [ ] platform_admin видит все события и тенанты
- [ ] tenant_admin видит только свои
- [ ] Без записей в tenant_admins пользователь видит понятное сообщение, не редирект на login
- [ ] `npm run build` успешно
