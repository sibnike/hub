> Открой `tasks/prompt_37_hub_join_rls.md` и выполни задачу. Положи в `mega-hub/tasks/`. Срочный фикс — при подключении к выставке `/api/exhibitor/join` всегда возвращает "Invalid access code" из-за RLS: pending participation не видна пользователю.

# Fix — /api/exhibitor/join должен искать через service-role

## Проблема

`/api/exhibitor/join` ищет pending `event_participations` через клиент с пользовательской сессией. RLS политика разрешает SELECT только если:
- platform_admin, ИЛИ
- tenant_admin того tenant_id что в строке (но он NULL пока pending), ИЛИ
- tenant_admin организатора события (но участник — не организатор)

В итоге пользователь, которого пригласили, не видит свою собственную pending-запись и не может подключиться. Код отвечает 400 "Invalid access code".

## Решение

В этом эндпоинте использовать service-role клиент для поиска и обновления `event_participations`. Авторизацию делать отдельно — через `assertTenantAdmin(tenant_id)` (это уже есть в коде).

---

## Задача

### 1. Обновить `app/api/exhibitor/join/route.ts`

Заменить `createClient()` на `createAdminClient()` для запросов в схему hub:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTenantAdmin } from '@/lib/auth/current-tenant'
import { hashAccessCode } from '@/lib/access-code'

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    event_slug?: string
    access_code?: string
    tenant_id?: string
  }

  const { event_slug, access_code, tenant_id } = body
  if (!event_slug || !access_code || !tenant_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Проверка что пользователь — админ заявленного тенанта
  if (!(await assertTenantAdmin(tenant_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Используем service-role для обхода RLS на pending записях
  const supabase = createAdminClient()

  const { data: event } = await supabase
    .schema('hub')
    .from('events')
    .select('id, access_code_salt')
    .eq('slug', event_slug)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const codeHash = hashAccessCode(access_code)

  const { data: participation } = await supabase
    .schema('hub')
    .from('event_participations')
    .select('*')
    .eq('event_id', event.id)
    .eq('access_code', codeHash)
    .eq('status', 'pending')
    .maybeSingle()

  if (!participation) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 400 })
  }

  // Защита: проверим что эта запись ещё не использована другим тенантом
  if (participation.tenant_id && participation.tenant_id !== tenant_id) {
    return NextResponse.json({ error: 'Access code already used' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .schema('hub')
    .from('event_participations')
    .update({
      tenant_id,
      status: 'confirmed',
      joined_at: new Date().toISOString(),
    })
    .eq('id', participation.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase
    .schema('hub')
    .from('event_stands')
    .update({ tenant_id })
    .eq('participation_id', participation.id)

  return NextResponse.json({ ok: true, participation_id: participation.id })
}
```

### 2. Проверить другие эндпоинты с тем же паттерном

Поищи в Hub коде места где может быть аналогичная проблема — поиск pending/чужих записей через user-client:

```bash
grep -rn "schema('hub').from('event_participations')" app/ lib/
```

Места где участник может искать **свои pending записи до подтверждения** — нужно тоже на service-role.

### 3. Сборка и коммит

```bash
npm run build
git add app/api/exhibitor/join/route.ts
git commit -m "fix: use service-role in /exhibitor/join to bypass RLS on pending participations"
git push
```

---

## Результат

- [ ] `/api/exhibitor/join` использует service-role клиент
- [ ] Авторизация проверяется через `assertTenantAdmin(tenant_id)`
- [ ] Подтверждённое участие нельзя «угнать» другим тенантом
- [ ] Билд успешен
- [ ] На проде участник может ввести код и подключиться
