# ТЗ — H-M4d: Запрос тенантам (бюджет) + accept/decline + обратный канал Vitrina→Hub

> Финальная фаза базового маркетплейса. Мастер-план — `docs/TZ-Marketplace-Multitenant.md`.
> Две стороны: hub (это ТЗ) + vitrina (V-32, отдельный агент, `vitrina/docs/TZ-Marketplace-Response-Channel.md`).
> Закрывает давний техдолг «обратный канал тенант → заявитель».

## 1. Цель

Approved-тенант вместо (или вместе с) прямой брони отправляет **запрос** подходящим тенантам:
описывает задачу, **указывает бюджет**. Запрос уходит в inbox тенантов по теме+городу.
Тенант-поставщик **принимает или отклоняет** запрос у себя (в Vitrina). Ответ возвращается
заказчику в Hub (обратный канал). Плюс здесь чиним 2 хвоста M4c (rate-limit, ingest-контракт).

## 2. Что уже есть (переиспользуем)

- `hub.marketplace_requests` + `hub.marketplace_request_targets` (M3a) — базовая модель запроса.
- Диспетч в inbox через Vitrina ingest (HMAC).
- Guided-флоу M4c — из него добавляем ветку «отправить запрос» рядом с «забронировать».

## 3. Модель данных (миграция, version id = имя файла, дубль в vitrina)

### 3.1 Расширение `hub.marketplace_requests`

```sql
alter table hub.marketplace_requests
  add column if not exists budget_amount numeric,
  add column if not exists budget_currency text,
  add column if not exists requester_tenant_id uuid,  -- заказчик (approved-тенант)
  add column if not exists marketplace_id uuid references hub.marketplaces(id);
```

### 3.2 Расширение `hub.marketplace_request_targets`

```sql
alter table hub.marketplace_request_targets
  add column if not exists response_status text not null default 'pending'
    check (response_status in ('pending','accepted','declined','expired')),
  add column if not exists response_message text,
  add column if not exists responded_at timestamptz,
  add column if not exists vitrina_submission_id uuid;  -- если уже есть из M3a — не дублировать
```

RLS: заказчик видит свои `marketplace_requests` и их `targets` (по requester_tenant_id через
`is_tenant_admin`); platform admin — всё. Anon не экспонировать. Проверить qual/roles.

## 4. Отправка запроса (флоу в M4c-wizard)

- В выдаче — кнопка «Отправить запрос всем подходящим» (альтернатива поштучной броне).
- Форма: тема/город/параметры (уже собраны AI), **бюджет** (сумма + валюта), сообщение.
- Создаётся `marketplace_requests` (requester_tenant_id, budget, marketplace_id) +
  N `request_targets` по кандидатам.
- Каждому таргет-тенанту — заявка в inbox через **исправленный ingest-контракт** (см. §6):
  `source_type='marketplace'`, `requester_tenant_id`, тело с бюджетом и текстом запроса,
  `marketplace_request_target_id` (чтобы Vitrina знала, куда вернуть ответ).

## 5. Обратный канал (Vitrina → Hub)

- Vitrina (V-32) в карточке заявки-из-маркетплейса показывает кнопки **Принять / Отклонить**
  + поле сообщения; при действии шлёт webhook в Hub.
- **Новый эндпоинт Hub:** `POST /api/marketplace/response` (HMAC `VITRINA_WEBHOOK_SECRET`):
  ```
  { marketplace_request_target_id, response_status: 'accepted'|'declined',
    response_message?, vitrina_submission_id? }
  ```
  → UPDATE `marketplace_request_targets` (response_status, message, responded_at) →
  уведомление заказчику (email/Telegram, по факту наличия канала).
- Идемпотентность: повторный ответ на тот же target → обновление, не дубль.
- Заказчик видит статусы ответов в разделе «Мои запросы» на `/m/[slug]`.

## 6. Починка хвостов M4c

1. **Ingest-контракт:** hub-диспетчер (`dispatchMarketplaceBookings` и новый dispatch запроса)
   переключить на `source_type='marketplace'` + `requester_tenant_id` в теле (Vitrina принимает
   с V-31). Убрать старую упаковку в `data._integration.metadata` как единственный носитель.
2. **Rate-limit:** при мульти-таргете/мульти-броне — последовательные вызовы ingest с паузой
   (throttle, напр. 300–500ms между вызовами на один tenant) ИЛИ ретрай с backoff на 429.
   Цель: 2/2 и N/N позиций проходят стабильно. Зафиксировать выбранный подход.

## 7. UI «Мои запросы» (`/m/[slug]`)

Раздел для заказчика: список отправленных запросов, по каждому — таргеты со статусами
(pending/accepted/declined), сообщения ответов, бюджет. Обновляется при приходе обратного канала.

## 8. Тест-план (обязателен целиком)

1. Миграция локально; RLS (qual/roles, anon не виден).
2. **HTTP E2E на prod под approved qa-buyer:**
   - отправить запрос с бюджетом на 2 таргета → 2 submission в inbox тенантов
     (проверить `source_type='marketplace'`, requester_tenant_id, бюджет в теле — MCP);
   - **мульти-таргет 2/2 проходит без rate-limit падения** (проверка починки §6.2);
   - вызвать обратный канал `POST /api/marketplace/response` (accepted для target 1,
     declined для target 2, HMAC) → статусы обновились в `request_targets` (MCP);
   - «Мои запросы» показывает оба статуса;
   - повторный response на тот же target → идемпотентно.
3. Негатив: не-approved → гейт; anon → login; response без валидного HMAC → 401.
4. **Booking-E2E правило:** запрос идёт через ingest → обязателен реальный HTTP (выполнено в п.2).
5. Сверка prod через MCP: requests, targets, статусы, атрибуция.

## 9. Не входит в M4d

Платежи/escrow (Фаза 4 vision-fit); поток 3b (встраивание исполнителя в `booking_resources`
заказчика) — отдельная фаза после M4d; рейтинг; B2B-прайс; адресация на уровне сотрудника.

## 10. Документация

`HUB_ARCHITECTURE.md` (модель запроса, обратный канал, эндпоинт response),
`HUB_ROADMAP-next.md` (M4d + отметить закрытие техдолга «обратный канал»).
