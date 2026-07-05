# prompt_NN — H-M4c: Guided-поиск маркетплейса (пресеты + AI + выдача + мульти-бронь)

> NN — следующий номер по нумерации mega-hub/tasks.

ТЗ: `docs/TZ-Marketplace-Search-Flow.md`. Прочитай целиком. Только hub-side.
Референс флоу — demo v3 (пресет → текст → AI-разбор → уточнения → выдача → корзина).

## План

1. Миграция `search_presets_m4c`: `hub.search_presets` + RLS (SELECT authenticated, запись
   platform admin, anon не экспонировать) + сиды 3 пресета для tourism. Version id из
   prod-истории, **дубль файла в vitrina** (правило миграций).
2. Guided-флоу на `/m/[slug]` (внутри approved-гейта M4b): экраны пресет / город / текст с
   `hint_template` / AI-разбор (переиспользовать `parse-marketplace-query.ts`) / уточнения
   только по недостающим `required_params`.
3. Выдача: кандидаты из `listing_cache` (темы ∩ marketplace + тема пресета + город) →
   фильтр доступности через Vitrina availability API (батч, как в M3a) → карточки с поставщиком
   из `company_cache`, `price_from`, сортировка/фильтр по цене. Рейтинг скрыт.
4. Мульти-бронь: корзина → по каждой позиции вызов Vitrina ingest
   (`POST /api/integrations/submissions`, HMAC) с атрибуцией source_type=marketplace,
   source_partner=slug, requester_tenant_id (если Vitrina принимает; иначе TODO). Сводка результатов.
5. Platform-админка `/admin/marketplace/[slug]/presets` — CRUD пресетов.
6. Тест-план из ТЗ §8 целиком. **Обязателен реальный HTTP-прогон booking через ingest**
   (правило booking-E2E) — проверить созданные `public.submissions` через MCP с атрибуцией.
   Прогон под approved qa-buyer на prod.
7. Документация: `HUB_ARCHITECTURE.md`, `HUB_ROADMAP-next.md`.

## Ограничения

- Гейт M4b не ослаблять — выдача/бронь только approved-тенанту.
- Hub не пишет в `public` напрямую (submissions — только через Vitrina ingest HMAC).
- RLS не ослаблять; эмодзи запрещены; цвета — CSS-переменные; иконки из `/components/icons/`.
- Прод-миграция: version id = имя файла, дубль в vitrina, не полагаться на auto-timestamp MCP.
- Коммитить и пушить в main до prod-E2E (git и prod в синхроне).

По итогу — отчёт: что сделано, результаты тест-плана по пунктам, созданные submissions с
атрибуцией, version id миграции + подтверждение дубля в vitrina.
