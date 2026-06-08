> Открой `tasks/prompt_40_hub_visitor_guide.md` и выполни задачу. Положи в `mega-hub/tasks/`. Большая фаза H-9: гайд посетителя выставки — брендированная страница с регистрацией, типами посетителей, опросами, бонусами и избранным.

# H-9 — Visitor Guide (гайд посетителя)

## Контекст

Сейчас публичная страница события (`/e/{slug}/catalog`, `/e/{slug}/map`) — открытая для всех.
Меняем модель: гайд доступен только зарегистрированным посетителям, которые получили ссылку-приглашение от организатора.

**Поток:**
1. Организатор создаёт типы посетителей (VIP/Standard/Business) с описанием привилегий и бонусами
2. Организатор создаёт ссылки-приглашения для каждого типа
3. Распространяет ссылки через свой сайт билетов или email-рассылку
4. Посетитель переходит → форма регистрации → подтверждение email → вход в гайд
5. В гайде: каталог участников, карта, избранное, опросы (за бонусы), профиль
6. Организатор видит список зарегистрировавшихся, может менять tier или удалять

## Базовая структура

### 1. Миграция

`supabase/migrations/YYYYMMDDHHMMSS_visitor_guide.sql`:

```sql
-- Типы посетителей события
CREATE TABLE hub.event_visitor_tiers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  slug            text NOT NULL,           -- "vip", "standard", "business"
  name            jsonb NOT NULL,          -- i18n
  description     jsonb,                   -- i18n, что включено в этот тариф
  color           text,                    -- бейдж-цвет
  welcome_bonus   int DEFAULT 0,           -- приветственные баллы
  is_default      boolean DEFAULT false,   -- tier по умолчанию для открытой регистрации
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (event_id, slug)
);

-- Приглашения (ссылки)
CREATE TABLE hub.event_invitations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tier_id         uuid REFERENCES hub.event_visitor_tiers(id) ON DELETE SET NULL,
  invite_token    text UNIQUE NOT NULL,    -- случайный, в URL
  name            text,                    -- для админа: "Рассылка VIP", "Корп. клиенты Алматы"
  uses_count      int DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON hub.event_invitations(invite_token);
CREATE INDEX ON hub.event_invitations(event_id);

-- Посетители
CREATE TABLE hub.event_visitors (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tier_id         uuid REFERENCES hub.event_visitor_tiers(id),
  invitation_id   uuid REFERENCES hub.event_invitations(id),

  -- личные данные
  email           text NOT NULL,
  name            text NOT NULL,
  phone           text,
  country         text,
  city            text,
  language        text DEFAULT 'ru',

  -- сессия
  session_token   text UNIQUE NOT NULL,    -- кука для входа
  email_confirmed boolean DEFAULT false,
  confirm_token   text,                    -- одноразовый для подтверждения email

  -- бонусы
  bonus_balance   int DEFAULT 0,

  -- мета
  created_at      timestamptz DEFAULT now(),
  last_visit_at   timestamptz,

  UNIQUE (event_id, email)
);

CREATE INDEX ON hub.event_visitors(session_token);
CREATE INDEX ON hub.event_visitors(event_id, email);

-- Избранные участники у посетителя
CREATE TABLE hub.event_visitor_favorites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status          text DEFAULT 'planned'   -- planned | met | skipped
                    CHECK (status IN ('planned', 'met', 'skipped')),
  note            text,
  saved_at        timestamptz DEFAULT now(),
  met_at          timestamptz,

  UNIQUE (visitor_id, tenant_id)
);

-- Опросы события
CREATE TABLE hub.event_polls (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  question        jsonb NOT NULL,          -- i18n
  options         jsonb NOT NULL,          -- [{ id, label i18n }]
  type            text NOT NULL CHECK (type IN ('single', 'multi')),
  bonus_reward    int DEFAULT 0,           -- баллов за ответ
  is_active       boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Ответы посетителей
CREATE TABLE hub.event_poll_answers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id         uuid NOT NULL REFERENCES hub.event_polls(id) ON DELETE CASCADE,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  selected_option_ids text[] NOT NULL,
  answered_at     timestamptz DEFAULT now(),

  UNIQUE (poll_id, visitor_id)
);

-- История начисления бонусов (для аудита)
CREATE TABLE hub.event_visitor_bonus_log (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  amount          int NOT NULL,            -- положительное начисление, отрицательное списание
  reason          text NOT NULL,           -- "welcome", "poll:<id>", "manual"
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE hub.event_visitor_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitor_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_poll_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitor_bonus_log ENABLE ROW LEVEL SECURITY;

-- Tiers: организатор управляет, посетители читают через service-role
CREATE POLICY "tiers_organizer" ON hub.event_visitor_tiers
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

-- Invitations: только организатор
CREATE POLICY "invitations_organizer" ON hub.event_invitations
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

-- Visitors: организатор видит всех своих, посетители — только себя (по session_token, через service-role)
CREATE POLICY "visitors_organizer" ON hub.event_visitors
  FOR SELECT USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "visitors_organizer_update" ON hub.event_visitors
  FOR UPDATE USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "visitors_organizer_delete" ON hub.event_visitors
  FOR DELETE USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

-- Favorites, polls, bonus_log читают организатор и сам посетитель (последний через service-role)
CREATE POLICY "favorites_organizer" ON hub.event_visitor_favorites
  FOR SELECT USING (
    public.is_platform_admin()
    OR visitor_id IN (
      SELECT v.id FROM hub.event_visitors v
      JOIN hub.events e ON e.id = v.event_id
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "polls_read" ON hub.event_polls
  FOR SELECT USING (true);  -- публично, посетители видят активные опросы

CREATE POLICY "polls_organizer" ON hub.event_polls
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "poll_answers_organizer" ON hub.event_poll_answers
  FOR SELECT USING (
    public.is_platform_admin()
    OR poll_id IN (
      SELECT p.id FROM hub.event_polls p
      JOIN hub.events e ON e.id = p.event_id
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );
```

---

### 2. Контур посетителя (отдельная авторизация)

Это **не Supabase Auth** — отдельный контур через подписанный cookie, как `/s/*` у staff в Vitrina.

**Cookie:** `visitor_session` — содержит подписанный JWT `{ visitor_id, event_id }`,
expires 90 дней, scope=`hub.yanbada.com` (или поддомен события).

**Хелпер `lib/visitor/session.ts`:**

```typescript
import { sign, verify } from 'jsonwebtoken'

const SECRET = process.env.SESSION_SIGNING_SECRET!

export function signVisitorToken(payload: { visitor_id: string; event_id: string }): string {
  return sign(payload, SECRET, { expiresIn: '90d' })
}

export function verifyVisitorToken(token: string): { visitor_id: string; event_id: string } | null {
  try {
    return verify(token, SECRET) as any
  } catch {
    return null
  }
}
```

**Хелпер `lib/visitor/current.ts`:**

```typescript
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVisitorToken } from './session'

export async function getCurrentVisitor(eventId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get('visitor_session')?.value
  if (!token) return null

  const payload = verifyVisitorToken(token)
  if (!payload || payload.event_id !== eventId) return null

  const supabase = createAdminClient()
  const { data } = await supabase.schema('hub').from('event_visitors')
    .select('*, tier:tier_id(*)')
    .eq('id', payload.visitor_id)
    .eq('email_confirmed', true)
    .maybeSingle()

  return data
}
```

---

### 3. Маршруты гайда

```
app/
├── e/[slug]/
│   ├── invite/[token]/       — landing-page приглашения, форма регистрации
│   ├── confirm/[token]/      — подтверждение email
│   └── guide/                — защищённый кабинет посетителя
│       ├── layout.tsx        — проверка getCurrentVisitor, иначе на /invite
│       ├── page.tsx          — главная гайда (welcome, бейдж tier, баланс, активные опросы)
│       ├── catalog/          — каталог участников (как сейчас /e/[slug]/catalog)
│       ├── map/              — карта (как /e/[slug]/map + слой избранных)
│       ├── favorites/        — мои избранные
│       ├── polls/            — список опросов и форма ответа
│       └── profile/          — мой профиль, баланс, история бонусов
```

**Старые публичные `/e/[slug]/catalog` и `/e/[slug]/map`** — оставить как fallback с заглушкой
«Для просмотра нужно получить ссылку приглашения» + контакт организатора. Или просто 404.

---

### 4. Регистрация посетителя

#### `/e/[slug]/invite/[token]/page.tsx`

Серверный компонент:

```typescript
export default async function InvitePage({ params }) {
  const { slug, token } = await params

  const supabase = createAdminClient()
  const { data: event } = await supabase.schema('hub').from('events')
    .select('id, name, settings').eq('slug', slug).eq('status', 'published').maybeSingle()

  if (!event) notFound()

  const { data: invitation } = await supabase.schema('hub').from('event_invitations')
    .select('*, tier:tier_id(*)').eq('invite_token', token).eq('is_active', true).maybeSingle()

  if (!invitation || invitation.event_id !== event.id) {
    return <InvalidInvite />
  }

  return <RegistrationForm event={event} invitation={invitation} />
}
```

Форма:
- Email
- Имя
- Телефон (опционально)
- Страна (select)
- Город
- Язык интерфейса (select из 22 поддерживаемых)
- Кнопка «Зарегистрироваться»

При submit → `POST /api/visitor/register`:

```typescript
{
  invitation_token, email, name, phone, country, city, language
}
```

Логика API:
1. Проверить токен приглашения
2. Проверить нет ли уже посетителя с этим email на этом event
3. Если есть и подтверждён → сразу логиним (выдаём cookie)
4. Если нет — создать запись с `email_confirmed=false`, сгенерировать `confirm_token`
5. Начислить welcome_bonus из tier'а в `bonus_balance` + запись в `bonus_log`
6. Увеличить `invitation.uses_count`
7. Отправить email через Resend со ссылкой `/e/{slug}/confirm/{confirm_token}`
8. Показать «Проверьте почту»

#### `/e/[slug]/confirm/[token]/route.ts`

Серверный handler:

```typescript
export async function GET(request, { params }) {
  const { slug, token } = await params
  const supabase = createAdminClient()

  const { data: visitor } = await supabase.schema('hub').from('event_visitors')
    .select('id, event_id, session_token, events:event_id(slug)')
    .eq('confirm_token', token).maybeSingle()

  if (!visitor || visitor.events.slug !== slug) {
    redirect(`/e/${slug}/invalid-link`)
  }

  await supabase.schema('hub').from('event_visitors')
    .update({ email_confirmed: true, confirm_token: null })
    .eq('id', visitor.id)

  // Выдаём сессию-cookie
  const sessionToken = signVisitorToken({ visitor_id: visitor.id, event_id: visitor.event_id })
  const cookieStore = await cookies()
  cookieStore.set('visitor_session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  })

  redirect(`/e/${slug}/guide`)
}
```

---

### 5. Главная гайда `/e/[slug]/guide/page.tsx`

Структура:

```
┌─────────────────────────────────────────────────────┐
│  [Лого выставки]  Digital Bridge 2026               │
│                                              [Меню] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Добро пожаловать, {name}!                          │
│  [VIP бейдж в цвете tier'а]                         │
│                                                      │
│  Бонусный баланс: 500 баллов                        │
│                                                      │
│  Что включено в ваш статус:                         │
│  {tier.description i18n}                            │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Быстрые действия                                    │
│  [Каталог]  [Карта]  [Избранное]  [Опросы]  [Профиль]│
├─────────────────────────────────────────────────────┤
│  Активные опросы (если есть)                        │
│  - Опрос 1: «Какие категории вас интересуют?» +50б  │
│  - Опрос 2: «Как узнали о выставке?» +20б          │
├─────────────────────────────────────────────────────┤
│  Подборки (placeholder, пока пусто)                 │
│  «Гид по городу скоро будет доступен»               │
└─────────────────────────────────────────────────────┘
```

---

### 6. Каталог в гайде `/e/[slug]/guide/catalog`

То же что текущий публичный каталог, но:
- Иконка-сердечко на каждой карточке для добавления в избранное
- Состояние избранного синхронизировано с БД (не localStorage)
- Кнопка «Профиль» открывает страницу карточки (внутри гайда), кнопка «На карте» — карту

`POST /api/visitor/favorites` — добавить/удалить.

### 7. Карта в гайде `/e/[slug]/guide/map`

То же что публичная карта, но:
- Дополнительный слой: подсветить стенды компаний из моего избранного (золотая рамка)
- Toggle «Показать только избранные»
- Клик на стенд открывает Sheet с карточкой (внутри гайда, не публичный маршрут)

### 8. Избранное `/e/[slug]/guide/favorites`

- Сетка карточек компаний которые добавлены
- Для каждой: статус (planned / met / skipped) — toggle 3 кнопками
- Поле заметки (опционально)
- При смене статуса → запись `met_at`
- Сортировка: planned сверху, потом met, потом skipped
- Кнопка «Экспортировать контакты» — CSV с email/phone тех у кого статус met (на будущее)

### 9. Опросы `/e/[slug]/guide/polls`

- Список активных опросов
- Каждый — карточка с вопросом, вариантами, кнопкой «Ответить»
- После ответа — карточка дизейблится, показывается «Отвечено, +N баллов»
- История отвеченных снизу с возможностью раскрыть свои ответы (не править)

`POST /api/visitor/polls/[pollId]/answer`:
- Записать ответ в `event_poll_answers`
- Начислить `bonus_reward` в `bonus_balance` + лог в `bonus_log`
- Защита от повторного ответа (UNIQUE constraint)

### 10. Профиль посетителя `/e/[slug]/guide/profile`

- Текущие данные (имя, email, телефон, страна, город, язык) с возможностью редактирования
- Текущий баланс баллов
- История начислений из `bonus_log` таблицей
- Кнопка «Выйти» — удалить cookie

---

### 11. Кабинет организатора — управление гайдом

#### Tiers `/organizer/events/[slug]/visitors/tiers`

Список tier'ов с CRUD:
- Создание/редактирование/удаление
- Поля: slug, name i18n, description i18n, color, welcome_bonus, is_default

API: `/api/organizer/events/[slug]/tiers` (GET/POST/PATCH/DELETE).

#### Приглашения `/organizer/events/[slug]/visitors/invitations`

Список ссылок с действиями:
- Создать новую: выбрать tier, name (для админа), сгенерировать токен
- Копировать ссылку: `https://hub.yanbada.com/e/{slug}/invite/{token}`
- Деактивировать / активировать
- Видеть `uses_count`

API: `/api/organizer/events/[slug]/invitations` (GET/POST/PATCH).

#### Посетители `/organizer/events/[slug]/visitors`

Таблица всех зарегистрировавшихся:
- Колонки: имя, email, телефон, страна, tier (с возможностью смены через select), баланс, дата
- Фильтр по tier
- Поиск по name/email
- Действия: сменить tier, удалить, добавить вручную баллы (с reason)

API: `/api/organizer/events/[slug]/visitors` (GET с фильтрами), `/visitors/[id]` (PATCH/DELETE), `/visitors/[id]/bonus` (POST для начисления).

#### Опросы `/organizer/events/[slug]/polls`

Список опросов с CRUD:
- Создать: question i18n, options (массив с label i18n), type (single/multi), bonus_reward
- Активировать/деактивировать
- Просмотр статистики: для каждого опроса — таблица «вариант → N ответов» и % от общего

API: `/api/organizer/events/[slug]/polls` (CRUD), `/polls/[id]/stats` (GET).

---

### 12. Брендирование гайда (минимум для этого этапа)

Использовать существующие `event.settings`:
- `accent_color` — основной цвет акцента
- `brand_logo_url` — логотип в шапке гайда
- `brand_footer_text` — текст в подвале

**Дополнить настройки события** новыми полями (внутри `settings`):
- `welcome_message` — i18n приветствие на главной гайда
- `hero_image_url` — фон шапки гайда (опционально)

Если в будущем будет полноценная дизайн-система — переходим на неё. Сейчас достаточно этих параметров.

---

### 13. Email через Resend

Шаблон `lib/email/templates/visitor-confirm.ts`:

```
Subject: Подтверждение регистрации на {event.name}

Здравствуйте, {name}!

Для входа в гайд посетителя выставки {event.name} перейдите по ссылке:
https://hub.yanbada.com/e/{event-slug}/confirm/{token}

Ссылка действительна 24 часа.
```

После подтверждения — отдельный email-приветствие с базовой информацией о tier'е и ссылкой на гайд.

---

### 14. Edge-cases

- Один email уже зарегистрирован на этом событии → редирект на login или email с magic-link
- Приглашение деактивировано → показать «Регистрация закрыта»
- Cookie expired → редирект на тот же `/invite/{token}` если URL запомнен, иначе на главную
- Tier удалён → показать «Стандартный» или fallback на default tier
- Email не подтверждён в течение 24 часов → отдельная кнопка «Отправить заново»

---

### 15. Что НЕ делаем сейчас (зафиксировать в ROADMAP)

- QR в VIP-зоны (на будущее)
- Списание баллов (на будущее, через приложение)
- Гид по городу (отдельная фаза, через Touchin-интеграцию)
- Запросы встреч (H-11)
- Networking-рекомендации (H-12)
- CSV-импорт списка билетов (позже)
- Приглашения на следующие выставки (post-event фаза)

---

### 16. Результат

- [ ] Миграции применены
- [ ] Организатор может создать tier'ы, приглашения, опросы
- [ ] Посетитель регистрируется по ссылке → email-подтверждение → вход в гайд
- [ ] В гайде работают: главная с tier-инфо и балансом, каталог с избранным, карта с подсветкой избранных, страница избранного со статусами, опросы с начислением баллов, профиль с историей баллов
- [ ] Организатор видит список зарегистрировавшихся, может менять tier, удалять, начислять баллы вручную
- [ ] Email-шаблоны через Resend
- [ ] `npm run build` успешно

---

## Как тестировать

1. Создать tier'ы для события «Digital Bridge 2026»: VIP (200 баллов), Standard (50 баллов)
2. Создать приглашение для VIP → скопировать ссылку
3. Открыть ссылку в инкогнито → заполнить форму → проверить email
4. Перейти по confirm-ссылке → попасть в гайд
5. Добавить компанию в избранное → проверить что она появилась в /favorites
6. Открыть карту → найти стенд избранной компании с золотой рамкой
7. Ответить на опрос → проверить что баланс вырос
8. В кабинете организатора посмотреть список посетителей и статистику опросов

