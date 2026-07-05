# prompt_NN — H-M4a (hub-side): hub.marketplaces + темы/цена в кэшах + /m/[slug]

> NN — подставить следующий номер по нумерации mega-hub/tasks.

ТЗ: `docs/TZ-Marketplace-Multitenant.md` (§2 — объём этой фазы, §1 — концепция и инварианты).
Прочитай целиком. Vitrina-сторона (справочник тем, маркировка, отправка полей) делается
отдельным агентом в репозитории vitrina — её не трогать. Деплой hub-стороны — первым:
sync-эндпоинты должны принимать новые поля до того, как Vitrina начнёт их слать.

## План

1. **Миграция** `marketplace_multitenant_m4a` (файлом в `supabase/migrations/`):
   `hub.marketplaces` (+RLS: SELECT authenticated, запись `is_platform_admin()`),
   сид `tourism` с theme_slugs `{transport, accommodation, tourism, guides, food}`;
   `company_cache.marketplace_themes text[]`, `listing_cache.marketplace_themes text[]`,
   `listing_cache.price_from numeric`, `listing_cache.price_currency text`; GIN-индексы на темы.
2. **Sync-эндпоинты**: `/api/sync/company` принимает `marketplace_themes`;
   `/api/sync/listing` — `marketplace_themes`, `price_from`, `price_currency`.
   Отсутствие поля в payload → существующее значение не затирать. HMAC-контракт без изменений.
3. **Хелпер** `lib/marketplace/themes.ts` — чтение `public.marketplace_themes`
   (is_active, sort_order), кэш 5 мин. Hub в `public` не пишет.
4. **Маршрут `/m/[marketplaceSlug]`** — резолв по slug (404 если нет/неактивен),
   плейсхолдер по `docs/DESIGN.md` (иконки из `/components/icons/`, CSS-переменные, без эмодзи).
   На существующем `/marketplace` — ссылка на `/m/tourism`, остальное не трогать.
5. **Тест-план из ТЗ §2.5 целиком**: миграция локально; HTTP на оба sync-эндпоинта с новыми
   полями и без них; RLS-проверка `pg_policies` по `hub.marketplaces` (qual/roles, без anon);
   prod smoke `/m/tourism` и `/m/nonexistent`; сверка prod-состояния (колонки, индексы, сид).
6. **Документация**: `HUB_ARCHITECTURE.md` (модель, sync-контракты, роуты),
   `HUB_ROADMAP-next.md` (M4a — статус по факту prod-проверки).

По итогу — отчёт: что сделано, результаты тест-плана по пунктам, каким способом применена
prod-миграция и чем сверено фактическое состояние.
