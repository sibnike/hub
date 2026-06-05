> Открой `tasks/prompt_30_hub_embed.md` и выполни задачу. Положи в `mega-hub/tasks/`. Продолжение `mega-hub` после H-5 — embed для встройки каталога на сайт организатора и white-label на кастомном домене.

# H-6 — Embed и White-label

## Контекст

Организаторы должны иметь возможность интегрировать Hub в свои сайты тремя способами:
1. **Iframe** — простой `<iframe>` с каталогом или картой
2. **Виджет-скрипт** — `hub-widget.js` открывает каталог в overlay
3. **White-label** — страницы события на кастомном домене организатора (`digitalbridge.kz/exhibitor/*`)

Архитектура: см. `ARCHITECTURE.md`. CSP `frame-ancestors *` уже стоит с H-2.

---

## Задача

### 1. Iframe-режим публичных страниц

Все маршруты `/e/[slug]/*` должны уметь работать в iframe:

#### Параметр `?embed=1`

Если в URL есть `?embed=1`:
- Скрыть `EventHeader` (шапка события)
- Убрать максимальную ширину контейнера — растягивать на 100%
- Отключить трекинг `map_view`/`catalog_view` сделать опциональным (по флагу `?track=1`)
- Передавать высоту в parent через `postMessage` для авто-resize

```typescript
'use client'

import { useEffect, useRef } from 'react'

export function EmbedHeightReporter() {
  useEffect(() => {
    function sendHeight() {
      const height = document.documentElement.scrollHeight
      window.parent.postMessage({ type: 'yanbada-hub-height', height }, '*')
    }
    sendHeight()
    const ro = new ResizeObserver(sendHeight)
    ro.observe(document.documentElement)
    window.addEventListener('load', sendHeight)
    return () => ro.disconnect()
  }, [])
  return null
}
```

В `/e/[slug]/layout.tsx` — определить embed-режим из `searchParams` и передать в дочерние компоненты.

---

### 2. Страница инструкций embed в кабинете организатора

`/organizer/events/[slug]/embed/page.tsx` — три блока с примерами кода:

#### Вариант 1: Iframe (фиксированная высота)

```html
<iframe
  src="https://hub.yanbada.com/e/{slug}/catalog?embed=1"
  width="100%"
  height="800"
  frameborder="0"
  style="border: none;"
></iframe>
```

Кнопка «Скопировать».

#### Вариант 2: Iframe с авто-высотой

```html
<iframe
  id="yanbada-hub"
  src="https://hub.yanbada.com/e/{slug}/catalog?embed=1"
  width="100%"
  frameborder="0"
  style="border: none; min-height: 600px;"
></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'yanbada-hub-height') {
      document.getElementById('yanbada-hub').style.height = e.data.height + 'px';
    }
  });
</script>
```

#### Вариант 3: Виджет-скрипт (overlay)

```html
<script src="https://hub.yanbada.com/widgets/hub-widget.js" data-event="{slug}" async></script>
<button data-yanbada-hub="{slug}">Открыть каталог участников</button>
```

Превью каждого варианта в iframe тут же на странице.

---

### 3. Виджет-скрипт `public/widgets/hub-widget.js`

Самодостаточный скрипт без зависимостей. Скрипт:
1. Парсит `data-event` из своего тега
2. Находит все элементы с `[data-yanbada-hub="{slug}"]` или с `[data-yanbada-hub]` (для текущего event)
3. На клик — открывает overlay с iframe каталога/карты события
4. Overlay: затемнённый фон, центрированный контейнер с iframe, кнопка закрытия
5. Реагирует на `postMessage` для авто-высоты

```javascript
(function() {
  'use strict';

  var HUB_URL = 'https://hub.yanbada.com';
  var currentScript = document.currentScript;
  var defaultEvent = currentScript?.dataset?.event;

  function openOverlay(eventSlug, view) {
    view = view || 'catalog';

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';

    var container = document.createElement('div');
    container.style.cssText = 'position:relative;background:#fff;border-radius:12px;width:100%;max-width:1200px;height:90vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;font-size:18px;z-index:10;';
    closeBtn.onclick = function() { document.body.removeChild(overlay); };

    var iframe = document.createElement('iframe');
    iframe.src = HUB_URL + '/e/' + eventSlug + '/' + view + '?embed=1';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  function init() {
    document.querySelectorAll('[data-yanbada-hub]').forEach(function(el) {
      var slug = el.dataset.yanbadaHub || defaultEvent;
      var view = el.dataset.yanbadaView || 'catalog';
      if (!slug) return;
      el.addEventListener('click', function(e) {
        e.preventDefault();
        openOverlay(slug, view);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

Подключение из любого сайта:
```html
<script src="https://hub.yanbada.com/widgets/hub-widget.js" data-event="digitalbridge-2025" async></script>
<button data-yanbada-hub>Каталог</button>
<button data-yanbada-hub data-yanbada-view="map">Карта</button>
```

---

### 4. White-label — кастомные домены

#### Настройки в админке

В `events.settings` добавить поле `custom_domain`:
- На странице события — раздел «Кастомный домен»
- Input для домена (например `digitalbridge.kz/exhibitor`)
- Инструкция: настроить CNAME `digitalbridge.kz` → `cname.vercel-dns.com` или аналог
- После настройки DNS — добавить домен в Vercel UI вручную (для MVP)

API:
- `PATCH /api/organizer/events/[slug]` — расширить чтобы принимало `settings.custom_domain`

#### Middleware распознавания домена

`middleware.ts` — расширить:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')

  // Известные домены — пропускаем
  if (host === 'hub.yanbada.com' || host?.endsWith('.yanbada.com') || host?.startsWith('localhost')) {
    return await refreshAuth(request)
  }

  // Кастомный домен — ищем событие
  const supabase = createServiceClient()
  const { data: event } = await supabase
    .schema('hub').from('events')
    .select('slug')
    .filter('settings->>custom_domain', 'eq', host)
    .eq('status', 'published')
    .maybeSingle()

  if (event) {
    // Rewrite на /e/{slug}/<original-path>
    const url = request.nextUrl.clone()
    const originalPath = url.pathname
    url.pathname = `/e/${event.slug}${originalPath === '/' ? '/catalog' : originalPath}`
    return NextResponse.rewrite(url)
  }

  return await refreshAuth(request)
}
```

> Middleware вызывается на каждый запрос, поэтому используем `service-role` клиент без аутентификации (только чтение публичных опубликованных событий).

#### Префикс пути для white-label

Если организатор хочет `digitalbridge.kz/exhibitor/{slug}` (а не корень домена):
- В `events.settings.custom_domain_prefix` — `/exhibitor`
- Middleware дополнительно проверяет что path начинается с префикса:

```typescript
const prefix = event.settings?.custom_domain_prefix ?? ''
if (prefix && !originalPath.startsWith(prefix)) {
  return NextResponse.next() // не наш URL, пусть домен обрабатывает сам
}
const cleanPath = originalPath.replace(prefix, '') || '/catalog'
url.pathname = `/e/${event.slug}${cleanPath}`
```

#### Брендирование

В `events.settings` добавить:
- `brand_logo_url` — лого организатора (заменяет «Yanbada Hub»)
- `brand_color` — основной цвет (override accent_color)
- `brand_footer_text` — текст в подвале (например «© 2025 DigitalBridge»)

EventHeader и layout читают эти поля — если есть `custom_domain` режим, скрывают «powered by Yanbada» (или показывают мелким шрифтом).

---

### 5. Безопасность embed

#### CSP

Уже стоит `frame-ancestors *` для `/e/*` — это правильно для embed.

Для других маршрутов (`/organizer/*`, `/exhibitor/*`) — установить строгий CSP:
```
frame-ancestors 'self'
```

Чтобы кабинеты нельзя было встраивать.

#### Rate limiting

Виджет-скрипт `/widgets/hub-widget.js` — отдавать с длинным `Cache-Control: public, max-age=3600`.

API `/api/track` — добавить простой rate limit (по IP):
- Максимум 60 запросов в минуту с одного IP
- При превышении — 429 (но всё равно возвращать `{ ok: true }` чтобы не ломать клиент)

---

### 6. Превью embed

На странице `/organizer/events/[slug]/embed` — кроме инструкций показать живые превью:

```typescript
<div>
  <h3>Превью каталога</h3>
  <iframe src={`/e/${slug}/catalog?embed=1`} style={{ width: '100%', height: 600 }} />
</div>
<div>
  <h3>Превью карты</h3>
  <iframe src={`/e/${slug}/map?embed=1`} style={{ width: '100%', height: 600 }} />
</div>
```

---

### 7. Edge-cases

- Кастомный домен пока не работает (DNS не прописан) — событие открывается на основном домене `hub.yanbada.com`, ничего не ломается
- Несколько событий с одинаковым `custom_domain` — middleware берёт первое (запретить на уровне UNIQUE constraint? — да)
- Виджет открывается на странице с CSP — overlay через iframe всё равно работает, потому что мы загружаем iframe с нашего домена
- Mobile: overlay виджета должен корректно скейлиться, не разламывать viewport

```sql
CREATE UNIQUE INDEX events_custom_domain_idx
  ON hub.events ((settings->>'custom_domain'))
  WHERE settings->>'custom_domain' IS NOT NULL;
```

---

## Результат

- [ ] `?embed=1` скрывает шапку и адаптирует layout
- [ ] `EmbedHeightReporter` отправляет высоту через postMessage
- [ ] Страница `/organizer/events/[slug]/embed` с тремя примерами и превью
- [ ] `public/widgets/hub-widget.js` работает: клик по элементу → overlay с iframe
- [ ] Middleware распознаёт кастомные домены и делает rewrite
- [ ] Поддержка префикса пути (`/exhibitor`)
- [ ] Брендирование: лого, цвет, футер организатора
- [ ] CSP `frame-ancestors 'self'` для `/organizer/*` и `/exhibitor/*`
- [ ] Rate limit на `/api/track`
- [ ] Unique constraint на `custom_domain`
- [ ] `npm run build` — успешно

#### Как тестировать

1. На странице embed скопировать код iframe → вставить на тестовую страницу → проверить отображение
2. Скопировать виджет-код → вставить → клик по кнопке открывает overlay
3. Проверить авто-высоту: каталог большой → iframe растягивается
4. В настройках события прописать `localhost:3001` как `custom_domain` (для теста) → открыть localhost — должно открыть каталог напрямую
5. Проверить что `/organizer/*` не открывается в iframe (CSP блокирует)

Следующая задача: `tasks/prompt_31_hub_heatmap.md` — H-7: тепловая карта активности.
