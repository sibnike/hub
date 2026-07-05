# prompt_NN — H-M4d: Запрос с бюджетом + accept/decline + обратный канал + хвосты M4c

> NN — следующий номер по нумерации mega-hub/tasks.

ТЗ: `docs/TZ-Marketplace-Request-V2.md`. Прочитай целиком. Hub-side.
Vitrina-сторона (accept/decline UI + webhook) — отдельный агент по `vitrina/docs/TZ-Marketplace-Response-Channel.md` (V-32).

## План

1. Миграция `marketplace_request_v2_m4d`: расширить `marketplace_requests` (budget, requester_tenant_id,
   marketplace_id) и `marketplace_request_targets` (response_status, response_message, responded_at,
   vitrina_submission_id — не дублировать, если есть). RLS: заказчик видит свои, platform — всё,
   anon нет. Version id = имя файла, дубль в vitrina.
2. Ветка «Отправить запрос» в M4c-wizard: форма с бюджетом → создать request + N targets →
   диспетч в inbox тенантов через исправленный ingest-контракт.
3. Обратный канал: `POST /api/marketplace/response` (HMAC VITRINA_WEBHOOK_SECRET) → обновить
   target status, уведомить заказчика. Идемпотентно.
4. Раздел «Мои запросы» на `/m/[slug]` — статусы ответов по таргетам.
5. **Починка хвостов M4c:**
   - ingest-вызовы переключить на `source_type='marketplace'` + `requester_tenant_id` в теле
     (убрать зависимость только от `data._integration.metadata`);
   - rate-limit мульти-таргета: throttle 300–500ms между вызовами на один tenant или retry-backoff
     на 429, чтобы N/N проходило. Зафиксировать подход в отчёте.
6. Тест-план из ТЗ §8 целиком. **Реальный HTTP** запроса и обратного канала под approved qa-buyer.
7. Документация: `HUB_ARCHITECTURE.md`, `HUB_ROADMAP-next.md` (+ отметить закрытие техдолга «обратный канал»).

## Ограничения

- Гейт M4b не ослаблять. Hub в `public` не пишет (submissions — через Vitrina ingest).
- RLS не ослаблять; эмодзи запрещены; цвета — CSS-переменные.
- Version id = имя файла, дубль в vitrina, не auto-timestamp MCP.
- Коммит+push в main до prod-E2E.

По итогу — отчёт: тест-план по пунктам, созданные requests/targets/submissions с атрибуцией,
подтверждение обратного канала (статусы обновились), подход к rate-limit, version id + дубль.
