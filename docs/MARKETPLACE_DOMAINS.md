# Marketplace domains (H-M5.3)

Маркетплейс доступен тремя способами:

| Вход | Пример | Резолв |
|------|--------|--------|
| Internal | `hub.yanbada.com/m/tourism` | Прямой путь, без rewrite |
| Поддомен | `tourism.microp.app` | Middleware → rewrite `/m/tourism` |
| Кастомный домен | `tourhub.kz` | `hub.marketplaces.custom_domain` → rewrite `/m/tourism` |

Флагман `microp.app` (без поддомена) — зарезервирован: marketplace с `subdomain IS NULL AND custom_domain IS NULL`.

## Env

```
NEXT_PUBLIC_MARKETPLACE_ROOT=microp.app
NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yanbada.com   # только для *.yanbada.com
```

На `*.microp.app` и кастомных доменах auth cookie **host-only** (без `domain`).

## Миграция

`20260706120000_marketplace_domains_m5.sql` — колонки `subdomain`, `custom_domain` в `hub.marketplaces`.

Применение (prod, из vitrina):

```bash
CONFIRM_PROD_DB_PUSH=1 npm run db:push:prod
```

## Vercel / DNS (ручной чеклист)

### Партнёрский кастомный домен (например `tourhub.kz`)

1. Партнёр: CNAME `tourhub.kz` → `cname.vercel-dns.com`
2. Николай: добавить `tourhub.kz` в Vercel (проект mega-hub) → SSL автоматически
3. SQL: `UPDATE hub.marketplaces SET custom_domain = 'tourhub.kz' WHERE slug = 'tourism';`

### Дефолтные поддомены `*.microp.app`

**Рекомендация:** делегировать NS домена `microp.app` на Vercel → wildcard `*.microp.app`, авто-SSL, мгновенные поддомены без ручного добавления каждого.

Альтернатива: добавлять каждый поддомен в Vercel Dashboard вручную.

1. `NEXT_PUBLIC_MARKETPLACE_ROOT=microp.app` в Vercel env (mega-hub)
2. Бэкфилл: `UPDATE hub.marketplaces SET subdomain = 'tourism' WHERE slug = 'tourism';` (в миграции)

### Локальная разработка

- `hub.yanbada.com` / `localhost:3001/m/tourism` — как раньше
- Поддомен: `NEXT_PUBLIC_MARKETPLACE_ROOT=localhost` + host `tourism.localhost:3001` (или подмена `Host` header)

## Auth cookie по host

| Host | Cookie `domain` |
|------|-----------------|
| `*.yanbada.com` | `.yanbada.com` |
| `tourhub.kz`, `*.microp.app` | не задан (host-only) |
| `localhost` | не задан |
