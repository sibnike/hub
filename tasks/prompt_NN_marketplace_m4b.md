# prompt_NN — H-M4b: Membership маркетплейса (доступ по заявке тенанта)

> NN — следующий номер по нумерации mega-hub/tasks.

ТЗ: `docs/TZ-Marketplace-Membership.md`. Прочитай целиком. Только hub-side.

## План

1. Миграция `marketplace_members_m4b`: таблица `hub.marketplace_members` + индексы + RLS
   (SECURITY DEFINER хелперы, `(select auth.uid())`, anon не экспонировать). Локально —
   `npm run db:reset:local`.
2. `lib/marketplace/membership.ts` — `getMembership`, `assertMarketplaceAccess`.
3. `/m/[slug]` — гейт по членству активного тенанта (4 состояния: нет заявки / pending /
   approved / rejected-suspended). Заменяет плейсхолдер M4a.
4. Platform-админка `/admin/marketplace/[slug]/members` — список заявок, approve/reject/suspend.
5. API: request / membership status / admin list / admin patch (см. ТЗ §5).
6. Email-уведомления (Resend `hub@yanbada.com`, по DESIGN.md, без эмодзи).
7. Тест-план из ТЗ §7 целиком, включая prod E2E через два тенанта (qa-sandbox + qa-buyer)
   и сверку `pg_policies`.
8. Документация: `HUB_ARCHITECTURE.md`, `HUB_ROADMAP-next.md`.

## Правило миграций (важно, не нарушать)

Прод-миграцию применяй так, чтобы version id в `schema_migrations` **совпадал** с именем файла:
не полагайся на auto-timestamp MCP `apply_migration`. После применения — **продублируй файл в
vitrina repo с тем же version id**, иначе vitrina `db:push:prod` увидит orphan. В отчёте укажи
итоговый version id и что файл заведён в обоих репо.

## Ограничения

- Hub не пишет в `public`. RLS не ослаблять. Эмодзи запрещены, цвета — CSS-переменные.
- `assertTenantAdminOrPlatform()` в endpoints.

По итогу — отчёт: что сделано, результаты тест-плана по пунктам, version id миграции,
подтверждение дубля файла в vitrina.
