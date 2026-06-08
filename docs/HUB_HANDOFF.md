# Exhibitor Hub — как продолжить работу в новом чате

## Что скинуть в новый чат

Обязательно:
1. `docs/ARCHITECTURE.md` (этот репо)
2. `docs/ROADMAP-next.md` (этот репо)

По необходимости:
- `YANBADA_ARCHITECTURE.md` — общая картина экосистемы
- ARCHITECTURE и ROADMAP репо vitrina — если задача затрагивает интеграцию

## Рабочий процесс

- Claude пишет ТЗ в `docs/` и промпт агенту в `tasks/prompt_NN.md`.
- Cursor-агент выполняет, присылает отчёт.
- Деплой: `git push` → Vercel. Миграции: через Supabase Studio SQL Editor.
- env требуют Redeploy после изменения.

## Текущий статус

На проде: H-0...H-8 (все базовые фазы). E2E работает end-to-end:
- Организатор → создаёт событие → загружает SVG карту → расставляет стенды
- Участник → подключается по коду из email → редактирует профиль в Vitrina
- Посетитель → каталог/карта → карточка компании с iframe Vitrina → QR-сканирование
- Аналитика: трекинг, дашборды организатора и участника, тепловая карта
- Embed + white-label работают

## Часть экосистемы Yanbada

Hub работает в связке с Vitrina (`admin.yanbada.com`):
- Данные компании в Vitrina → синхронизируются в `hub.company_cache` через webhook
- Hub встраивает страницу Vitrina в карточку компании через `?embed=1`
- Общий Supabase Auth: cookie на `.yanbada.com`, единый вход
- Hub НИКОГДА не пишет в схему `public`

## Стартовая фраза

> Продолжаем проект Exhibitor Hub. Прикладываю `ARCHITECTURE.md` и `ROADMAP-next.md`.
> На проде H-0...H-8 включительно, базовый поток выставки работает end-to-end.
> Hub интегрирован с Vitrina через webhook + общий Supabase + ?embed=1.
> Хочу взять [фазу H-N]. Пиши ТЗ в `docs/` и промпт в `tasks/`, как обычно.

## Стандартные команды

```bash
cd /Users/nikolayzhdanov/Documents/Yanbada-superApp/mega-hub
git add .
git commit -m "..."
git push
```

Миграции через Supabase Studio → SQL Editor → Run.
ENV изменения → Vercel → Redeploy.
