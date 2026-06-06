> Открой `tasks/prompt_34_hub_svg_sanitize_fix.md` и выполни задачу. Положи в `mega-hub/tasks/`. Срочный фикс — на проде `/api/organizer/events/[slug]/maps` падает с `ERR_REQUIRE_ESM` из-за `isomorphic-dompurify`. Нужно заменить на CommonJS-совместимый санитайзер.

# Fix — Заменить isomorphic-dompurify на sanitize-html

## Проблема

На Vercel (Node 22 runtime) при вызове `/api/organizer/events/[slug]/maps`:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module 
/var/task/node_modules/@exodus/bytes/encoding-lite.js 
from /var/task/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js not supported.
```

Причина: `isomorphic-dompurify` тянет цепочку зависимостей (jsdom → html-encoding-sniffer → @exodus/bytes), часть из которых стали pure ESM и не работают через require в serverless.

## Решение

Заменить `isomorphic-dompurify` на `sanitize-html` — она чистый CommonJS, работает на Vercel без проблем, и для нашего сценария (санитизация SVG карты выставки) её возможностей более чем достаточно.

---

## Задача

### 1. Удалить старые зависимости

```bash
npm uninstall isomorphic-dompurify dompurify
npm install sanitize-html
npm install --save-dev @types/sanitize-html
```

### 2. Переписать `lib/svg/sanitize.ts`

```typescript
import sanitizeHtml from 'sanitize-html'

// Разрешённые SVG-теги
const ALLOWED_SVG_TAGS = [
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath',
  'linearGradient', 'radialGradient', 'stop',
  'filter', 'feGaussianBlur', 'feOffset', 'feBlend', 'feMerge', 'feMergeNode',
  'feColorMatrix', 'feFlood', 'feComposite',
  'pattern', 'mask', 'clipPath',
  'image',
]

// Разрешённые атрибуты для всех SVG-тегов
const ALLOWED_SVG_ATTRS = [
  'id', 'class', 'style',
  'viewBox', 'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'x1', 'y1', 'x2', 'y2', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-opacity', 'fill-opacity', 'opacity',
  'transform', 'preserveAspectRatio',
  'xmlns', 'xmlns:xlink', 'version',
  'href', 'xlink:href',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'offset', 'stop-color', 'stop-opacity',
  'in', 'in2', 'result', 'mode', 'type', 'values',
  'stdDeviation', 'flood-color', 'flood-opacity',
  'patternUnits', 'patternContentUnits',
  'maskUnits', 'clipPathUnits',
  'text-anchor', 'font-family', 'font-size', 'font-weight',
  'dominant-baseline', 'alignment-baseline',
  'data-stand-id', 'data-pavilion', // наши атрибуты
]

export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg, {
    allowedTags: ALLOWED_SVG_TAGS,
    allowedAttributes: ALLOWED_SVG_TAGS.reduce((acc, tag) => {
      acc[tag] = ALLOWED_SVG_ATTRS
      return acc
    }, {} as Record<string, string[]>),
    allowedSchemes: ['data', 'https'],
    allowedSchemesByTag: {
      image: ['data', 'https'],
      use: ['data'], // только локальные ссылки в use
    },
    // Запрещённые теги полностью удаляем
    disallowedTagsMode: 'discard',
    // Парсер для XML/SVG
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  })
}

export function extractSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/i)
  if (!match) return null
  const parts = match[1].split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { width: parts[2], height: parts[3] }
}

export function ensureViewBox(svg: string): string {
  if (/viewBox=["']/i.test(svg)) return svg
  // Если viewBox отсутствует — вставляем дефолтный
  return svg.replace(/<svg(\s|>)/i, '<svg viewBox="0 0 1000 700"$1')
}
```

### 3. Проверить импорты

Найди и обнови все места где импортировался санитайзер. Скорее всего это:
- `app/api/organizer/events/[slug]/maps/route.ts`
- Возможно в `lib/svg/limits.ts` или других местах

Импорт не меняется (`import { sanitizeSvg } from '@/lib/svg/sanitize'`), но проверь что вызов работает.

### 4. Локальная проверка

```bash
npm run build
```

Не должно быть ошибок.

### 5. Закоммитить и запушить

```bash
git add .
git commit -m "fix: replace isomorphic-dompurify with sanitize-html (Vercel ESM fix)"
git push
```

После пуша Vercel автодеплоит — попробуй загрузить карту ещё раз.

---

## Результат

- [ ] `isomorphic-dompurify` и `dompurify` удалены из dependencies
- [ ] `sanitize-html` добавлен
- [ ] `lib/svg/sanitize.ts` использует sanitize-html
- [ ] `npm run build` успешно
- [ ] На проде загрузка SVG-карты работает без ERR_REQUIRE_ESM
- [ ] Все тесты что были — проходят (если есть)

## Заметка

`sanitize-html` имеет более строгий фильтр чем DOMPurify, поэтому могут не пройти какие-то экзотические SVG. Если пользователи будут загружать сложные SVG с фильтрами Figma/Illustrator — список разрешённых тегов/атрибутов придётся расширить.
