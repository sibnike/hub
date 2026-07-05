# ТЗ — H-M4c: Guided-поиск маркетплейса (пресеты + AI-уточнение + выдача с доступностью + мульти-бронирование)

> Фаза M4c. Мастер-план — `docs/TZ-Marketplace-Multitenant.md`. Только hub-side.
> Референс флоу — demo v3 (category → текст → AI-разбор → уточнения → выдача → корзина).
> Гейт доступа — из M4b (approved membership). Внутри `/m/[slug]` для approved-тенанта.

## 1. Цель

Approved-тенант ищет предложения других тенантов в теме маркетплейса через guided-флоу:
пресет → город → текст с заготовкой → AI-разбор → уточняющие вопросы (только чего не хватает)
→ выдача pages с учётом доступности на даты → фильтр/сортировка по цене → **бронирование
у нескольких поставщиков за один заход** (корзина).

## 2. Модель данных (миграция, version id из prod-истории, дубль в vitrina)

### 2.1 `hub.search_presets` — предустановленные запросы (контент, правит platform admin)

```sql
create table hub.search_presets (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references hub.marketplaces(id) on delete cascade,
  theme_slug text not null,               -- одна из marketplace.theme_slugs
  name jsonb not null,                    -- i18n «Ищу места размещения»
  hint_template jsonb not null,           -- i18n заготовка текста для textarea
  required_params jsonb not null default '[]',  -- ["city","dates","people"] — что нужно собрать
  clarify_hints jsonb not null default '{}',    -- подсказки AI по каждому param
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

RLS: SELECT authenticated; запись — `is_platform_admin()`. Anon не экспонировать.
Сиды для tourism: минимум 3 пресета (размещение/транспорт/экскурсия) с осмысленными
`hint_template` и `required_params`.

### 2.2 Корзина/сессия поиска — **без БД** в v1

Состояние флоу (пресет, текст, распарсенные параметры, ответы, выбранные для брони позиции)
держим на клиенте + в query, как в demo. Бронирование пишется в существующие submissions
Vitrina (см. §6). Отдельную таблицу корзины в v1 не заводим — зафиксировать как решение.

## 3. Флоу (экраны)

По референсу demo v3, на живых данных:

1. **Пресет** — сетка активных `search_presets` темы (карточки с name).
2. **Город** — выбор/ввод города (из `required_params`, если содержит "city").
3. **Текст** — textarea с `hint_template` как placeholder; примеры-подсказки.
4. **AI-разбор** — `parse-marketplace-query.ts` (переиспользуем из M1/M2) → структура полей;
   карточка «AI понял так» (город, даты, кол-во людей, тип, заметки).
5. **Уточнения** — задаём вопросы **только по недостающим** `required_params` (карточные,
   как в demo). AI-вопросы генерим по `clarify_hints`; без лишних вопросов, если всё собрано.
6. **Выдача** — см. §4.

## 4. Выдача

1. Кандидаты из `hub.listing_cache`: `marketplace_themes && marketplace.theme_slugs`
   И тема пресета ∈ page.marketplace_themes И город совпал (FTS/поле) → RPC-поиск как в M2.
2. **Фильтр доступности** (если пресет требует dates): батч-запрос в Vitrina availability API
   (тот же, что в M3a) по кандидатам с booking-конфигом на нужные даты; недоступные —
   помечаем «нет мест», не выкидываем (показываем внизу).
3. Карточка предложения: title page, поставщик (name/logo из `company_cache`), `price_from`,
   «профиль» (ссылка на company card в контексте маркетплейса), кнопка «В бронь».
4. Сортировка/фильтр: по `price_from` (asc/desc), доступность. **Рейтинга нет** (заглушка/скрыт).
5. Профиль поставщика — переиспользуем существующую company card (`?embed=1` Vitrina).

## 5. Уведомления / трекинг

Трекинг поиска (fire-and-forget в `track_events` или отдельный лог) — опционально, если дёшево.
Не блокирует фазу.

## 6. Мульти-бронирование (корзина → N submissions)

- Тенант отмечает несколько предложений «в бронь», указывает по каждому дату/слот/людей
  (из уже собранных параметров, с возможностью правки).
- «Забронировать всё» → для каждой позиции — вызов существующего Vitrina ingest
  (`POST /api/integrations/submissions`, HMAC, как в M3a) с booking-payload и атрибуцией:
  `source_type='marketplace'`, `source_partner='<marketplace_slug>'`,
  **`requester_tenant_id=<активный тенант>`** (новое поле в payload — согласовать с Vitrina;
  если Vitrina ещё не принимает — v1 без него, зафиксировать TODO для M4d/3b).
- Результат по каждой позиции: успех (submission_id) / занято / ошибка — показать сводку.
- Заявки падают в inbox соответствующих тенантов-поставщиков как обычные booking-заявки.

> **Зависимость от Vitrina:** если для requester-атрибуции нужна колонка в submissions —
> это отдельный маленький V-* в vitrina repo (отдельный агент). В M4c без неё флоу работает
> (заявки просто без requester_tenant_id), но пометить как ограничение.

## 7. Platform-админка пресетов

`/admin/marketplace/[slug]/presets` — CRUD `search_presets` (name, hint_template,
required_params, clarify_hints, theme, sort_order, is_active). Только platform admin.

## 8. Тест-план (обязателен целиком)

1. Миграция локально; RLS `search_presets` (qual/roles, anon не виден).
2. **Данные для E2E:** на qa-sandbox page `qa-booking` уже тема tourism (M4a). Для полноты —
   завести хотя бы одну page с catalog-блоком (чтобы `price_from` был не null) и booking-конфигом
   на даты, тема accommodation/tourism. Одобрить membership qa-buyer в tourism (M4b).
3. **HTTP E2E на prod под qa-buyer (approved):**
   - пройти флоу: пресет → город Алматы → текст → AI-разбор вернул структуру →
     уточнения по недостающему → выдача содержит qa-page;
   - фильтр по цене работает; недоступные на даты помечены;
   - мульти-бронь по 2 позициям → **реальные submissions в inbox тенантов** (проверить в
     `public.submissions` через MCP, атрибуция source_type=marketplace);
   - **это трогает booking-флоу через ingest → обязателен реальный HTTP** (правило booking-E2E).
4. Негатив: не-approved тенант на выдачу/бронь → гейт M4b; anon → login.
5. Сверка prod через MCP: `search_presets` сиды, созданные submissions, атрибуция.

## 9. Не входит в M4c

Запрос v2 с бюджетом и accept/decline тенанта + обратный канал — **M4d**.
B2B-прайс, рейтинг/отзывы, таблица корзины в БД, seat map.

## 10. Документация

`HUB_ARCHITECTURE.md` (search_presets, флоу, выдача, ingest-атрибуция),
`HUB_ROADMAP-next.md` (M4c — статус по prod E2E).
