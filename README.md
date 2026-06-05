# Exhibitor Hub (mega-hub)

Цифровая платформа для выставок и мероприятий — часть экосистемы Yanbada.

- **Organizer** — `/organizer/*`
- **Exhibitor** — `/exhibitor/*`
- **Public** — `/e/{slug}`

## Локальная разработка

```bash
cp .env.example .env.local
# заполнить ключи из Vitrina .env.local

npm install
npm run dev   # http://localhost:3001
```

## Supabase

Общий проект с Vitrina (`bfcfwaakxcqplamcswaq`). Схема `hub`.

```bash
npx supabase db push --include-all
```

## Архитектура

См. `yanbadadocs/ARCHITECTURE_HUB.md` в репозитории Vitrina.
