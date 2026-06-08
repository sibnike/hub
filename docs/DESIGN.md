# Yanbada Hub — Design System

> Единственный источник правды по дизайну гайда посетителя и страниц событий.
> Все визуальные решения принимаются здесь, не в коде компонентов.
> Каждое событие может переопределить акцентный цвет, бренд-цвет, hero-фон и шрифт через настройки организатора.

---

## Принципы

- Современный, минималистичный, премиальный
- Mobile-first — гайд в первую очередь для телефона на выставке
- Без эмодзи — только SVG иконки
- Каждое событие переопределяет тему через `event.settings`
- Все иконки в SVG, цвет управляется через `currentColor`
- Анимации без перегруза — поддерживают восприятие, не отвлекают

---

## Типографика

### Подключение

Шрифты подключаются через `next/font/google`. Организатор выбирает шрифт-пару в настройках события:

```ts
// lib/event-fonts.ts
import { Inter, Manrope, Plus_Jakarta_Sans, DM_Sans, Space_Grotesk, Cormorant_Garamond, Playfair_Display } from 'next/font/google'

export const fontMap = {
  inter:           Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-body' }),
  manrope:         Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-body' }),
  jakarta:         Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-body' }),
  dm_sans:         DM_Sans({ subsets: ['latin'], variable: '--font-body' }),
  space_grotesk:   Space_Grotesk({ subsets: ['latin'], variable: '--font-body' }),
  cormorant:       Cormorant_Garamond({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'], variable: '--font-heading' }),
  playfair:        Playfair_Display({ subsets: ['latin', 'cyrillic'], variable: '--font-heading' }),
}
```

### Шрифт-пары (организатор выбирает)

| Slug | Heading | Body | Стиль |
|---|---|---|---|
| `modern` | Inter | Inter | Универсальный технологичный (default) |
| `editorial` | Cormorant Garamond | Inter | Элегантный с засечками для hero |
| `premium` | Playfair Display | Manrope | Премиальный gala-event |
| `tech` | Space Grotesk | DM Sans | IT-конференция |
| `bold` | Plus Jakarta Sans | Inter | Современный бренд-стиль |

В `event.settings.font_pair` хранится slug. Default: `modern`.

### Размеры

```
xs:    12px / line-height 16px
sm:    14px / line-height 20px
base:  16px / line-height 24px
lg:    18px / line-height 28px
xl:    20px / line-height 28px
2xl:   24px / line-height 32px
3xl:   32px / line-height 40px
4xl:   40px / line-height 48px
5xl:   48px / line-height 56px
6xl:   64px / line-height 72px

Веса:
Regular:   400
Medium:    500
Semibold:  600
Bold:      700
```

### Применение в коде

```tsx
<h1 className="font-heading text-5xl font-semibold">Digital Bridge 2026</h1>
<p className="font-body text-base text-[var(--muted)]">Описание</p>
```

CSS-классы `font-heading` и `font-body` подхватывают переменные шрифта события.

---

## Цвета

### Базовая палитра

CSS-переменные, переопределяются для каждого события:

```css
:root {
  /* Из настроек события */
  --brand:    #0F172A;   /* тёмный — заголовки, лого, акценты на светлом */
  --accent:   #3B82F6;   /* акцент — кнопки, активные ссылки, иконки действий */
  --hero-bg:  #F8FAFC;   /* фон hero-секции (можно градиент или картинка) */

  /* Поверхности */
  --bg:       #FFFFFF;   /* фон страницы */
  --surface:  #FFFFFF;   /* карточки */
  --surface2: #F8FAFC;   /* hover, вложенные элементы, заглушки */

  /* Текст */
  --text:     #0F172A;   /* основной */
  --muted:    #64748B;   /* второстепенный */
  --subtle:   #94A3B8;   /* подсказки, плейсхолдеры */

  /* Границы */
  --border:   #E2E8F0;
  --border2:  #CBD5E1;

  /* Статусы */
  --success:  #16A34A;
  --warning:  #D97706;
  --error:    #DC2626;
  --info:     #0284C7;

  /* Тиры посетителей (для бейджей) */
  --tier-default: #6366F1;
}
```

### Применение в гайде

В корневом layout гайда инжектируем переменные из `event.settings`:

```tsx
<div
  style={{
    '--accent': event.settings?.accent_color ?? '#3B82F6',
    '--brand': event.settings?.brand_color ?? '#0F172A',
    '--hero-bg': event.settings?.hero_bg ?? 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
  } as React.CSSProperties}
>
  {children}
</div>
```

### Hero-фон

Поддерживаемые форматы:
- HEX-цвет: `#F8FAFC`
- CSS-градиент: `linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)`
- URL картинки: `url('https://...')` — применяется как `background-image` + затемнение

---

## Иконки

### Принцип

- Все иконки — SVG в `/components/icons/`
- Цвет через `currentColor` — наследуется от родителя через Tailwind text-*
- Размер через пропсы `width` / `height` (default: 20)
- Можно заменить любую иконку не трогая компоненты

### Структура

```
/components/icons/
  index.ts                 — реэкспорт + iconMap
  SearchIcon.tsx
  FilterIcon.tsx
  HeartIcon.tsx
  HeartFilledIcon.tsx
  StarIcon.tsx
  StarFilledIcon.tsx
  MapPinIcon.tsx
  ExternalLinkIcon.tsx
  HandshakeIcon.tsx
  ChevronRightIcon.tsx
  CloseIcon.tsx
  CheckIcon.tsx
  CheckCircleIcon.tsx
  PlusIcon.tsx
  MinusIcon.tsx
  MenuIcon.tsx
  UserIcon.tsx
  BonusIcon.tsx          — медаль/монета для баланса
  PollIcon.tsx           — диаграмма для опросов
  QrIcon.tsx
  TicketIcon.tsx
  CityGuideIcon.tsx      — для будущего гида по городу
  CalendarIcon.tsx
  ClockIcon.tsx
  PhoneIcon.tsx
  MailIcon.tsx
  GlobeIcon.tsx
  LocationIcon.tsx
  BuildingIcon.tsx
  CategoryIcon.tsx       — теги/категории
  ArrowLeftIcon.tsx
  ArrowRightIcon.tsx
  ChevronDownIcon.tsx
  ChevronUpIcon.tsx
  EyeIcon.tsx
  EditIcon.tsx
  TrashIcon.tsx
  CopyIcon.tsx
  SettingsIcon.tsx
  LogoutIcon.tsx
  ZoomInIcon.tsx
  ZoomOutIcon.tsx
```

### Стиль SVG

- Outline-стиль (stroke), не filled
- `stroke="currentColor"`, `fill="none"`
- `strokeWidth="1.5"`
- `strokeLinecap="round"`, `strokeLinejoin="round"`
- viewBox 24x24

### Пример

```tsx
interface IconProps {
  size?: number
  className?: string
}

export function SearchIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
```

### Использование

```tsx
<SearchIcon className="text-[var(--accent)]" />
<HeartFilledIcon className="text-[var(--accent)]" size={24} />
<MapPinIcon className="text-[var(--muted)]" />
```

---

## Компоненты

Используем shadcn/ui как основу, кастомизируем через CSS-переменные.

```bash
npx shadcn-ui@latest add button card sheet dialog badge skeleton input select tabs
```

### Кнопки

Все кнопки используют `--accent`. Три варианта:

```tsx
// Primary — основное действие
<button className="px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition">
  Подключиться
</button>

// Secondary — второстепенное
<button className="px-5 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-medium hover:bg-[var(--surface2)] transition">
  На карте
</button>

// Ghost — третичное
<button className="px-4 py-2 rounded-lg text-[var(--accent)] hover:bg-[var(--surface2)] transition">
  Подробнее
</button>
```

### Карточки участников (для гайда)

Современный стиль: крупная карточка с акцентом на изображение/лого:

```tsx
<article className="
  group relative
  rounded-2xl bg-[var(--surface)]
  border border-[var(--border)]
  hover:border-[var(--border2)]
  hover:shadow-lg transition-all duration-300
  overflow-hidden
">
  {/* Логотип с фоном */}
  <div className="h-32 bg-[var(--surface2)] flex items-center justify-center">
    <img src={logo} className="max-h-20 max-w-[60%]" />
  </div>

  {/* Контент */}
  <div className="p-5">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-heading text-lg font-semibold text-[var(--brand)]">
        {name}
      </h3>
      <button className="text-[var(--muted)] hover:text-[var(--accent)] transition">
        <HeartIcon size={22} />
      </button>
    </div>

    <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
      {short_description}
    </p>

    <div className="mt-4 flex items-center gap-2">
      <MapPinIcon size={14} className="text-[var(--subtle)]" />
      <span className="text-xs text-[var(--muted)]">
        Стенд {stand_number} · {pavilion}
      </span>
    </div>

    <div className="mt-3 flex flex-wrap gap-1.5">
      {categories.slice(0, 3).map(cat => (
        <span key={cat} className="px-2 py-1 rounded-md bg-[var(--surface2)] text-xs text-[var(--text)]">
          {cat}
        </span>
      ))}
    </div>
  </div>
</article>
```

### Tier-бейдж

```tsx
<span
  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
  style={{
    backgroundColor: `${tier.color}15`,
    color: tier.color,
    border: `1px solid ${tier.color}30`,
  }}
>
  <StarIcon size={12} />
  {tier.name[lang]}
</span>
```

---

## Структура гайда (визуальная)

### Шапка

Sticky-шапка с лого выставки, навигацией и блоком пользователя:

```
┌───────────────────────────────────────────────────────────────┐
│ [Лого выставки]   Главная Каталог Карта Избранное Опросы      │
│                                          [VIP] [1000 баллов]  │
└───────────────────────────────────────────────────────────────┘
```

На мобильном — burger-меню, лого слева, иконка пользователя справа.

### Hero на главной

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [hero-фон: градиент или картинка с затемнением]            │
│                                                             │
│    Добро пожаловать на Digital Bridge 2026                  │
│    Astana · 1-4 октября                                     │
│                                                             │
│    [Открыть каталог →]  [Карта]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Hero занимает ~60vh на десктопе, 50vh на мобильном.

### Блок tier-привилегий

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────┐  Ваш статус: VIP                                 │
│  │ icon │  • Доступ в VIP-зону                             │
│  └──────┘  • Приветственный кофе                           │
│            • Сертификат участника                          │
└────────────────────────────────────────────────────────────┘
```

### Опросы (превью на главной)

```
┌────────────────────────────────────────────────────────────┐
│  Активные опросы                                  [Все →]  │
│  ┌──────────────────────────┐ ┌──────────────────────────┐ │
│  │ Какие категории          │ │ Откуда вы узнали         │ │
│  │ вас интересуют?          │ │ о выставке?              │ │
│  │                          │ │                          │ │
│  │       +50 баллов         │ │       +20 баллов         │ │
│  └──────────────────────────┘ └──────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Анимации (Framer Motion)

```bash
npm install framer-motion
```

### Базовые паттерны

```ts
// Появление при скролле
export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: 'easeOut' }
}

// Hero entry
export const heroEntry = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: 'easeOut' }
}

// Stagger карточек
export const stagger = {
  whileInView: { transition: { staggerChildren: 0.06 } },
  viewport: { once: true }
}

export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.4, ease: 'easeOut' }
}

// Кнопки
export const btnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 }
}

// Модалки
export const modalEntry = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { type: 'spring', stiffness: 300, damping: 30 }
}
```

---

## Отступы и радиусы

```
Радиусы:
sm:   6px    — теги, бейджи
md:   12px   — поля ввода, маленькие кнопки
lg:   16px   — карточки, кнопки
xl:   24px   — большие карточки, модалки
2xl:  32px   — hero-блоки
full: 9999px — pill-кнопки, аватары

Отступы (внутренние блоки страницы):
padding-x: px-4 (mobile) / px-6 (tablet) / px-8 (desktop)
padding-y: py-12 (mobile) / py-16 (desktop) / py-20 (большие секции)

Максимальная ширина:
- Контент: max-w-6xl (1152px)
- Текстовые блоки: max-w-3xl (768px)
- Узкие модалки: max-w-md (448px)
```

---

## Тени

```css
--shadow-sm:  0 1px 2px rgba(15, 23, 42, 0.05);
--shadow-md:  0 4px 12px rgba(15, 23, 42, 0.08);
--shadow-lg:  0 8px 24px rgba(15, 23, 42, 0.12);
--shadow-xl:  0 16px 48px rgba(15, 23, 42, 0.16);
```

### Применение

- Карточки участников: `shadow-sm` в покое, `shadow-lg` при hover
- Sticky-шапка: `shadow-sm` при скролле
- Модалки: `shadow-xl`
- Floating элементы (action bar внизу): `shadow-lg`

---

## Скелетоны (загрузка)

Все async-блоки показывают skeleton пока грузятся данные. Без spinner'ов.

```tsx
<div className="rounded-2xl border border-[var(--border)] overflow-hidden">
  <Skeleton className="h-32 w-full" />
  <div className="p-5 space-y-3">
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-1/2" />
  </div>
</div>
```

---

## Состояния пустых списков

Когда список пуст — большой иконичный блок с описанием и CTA.

```tsx
<div className="py-20 flex flex-col items-center text-center">
  <div className="w-20 h-20 rounded-2xl bg-[var(--surface2)] flex items-center justify-center mb-5">
    <HeartIcon size={32} className="text-[var(--subtle)]" />
  </div>
  <h3 className="font-heading text-xl font-semibold text-[var(--brand)]">
    Пока никого не добавили в избранное
  </h3>
  <p className="mt-2 text-sm text-[var(--muted)] max-w-md">
    Откройте каталог, найдите интересные компании и нажмите на сердечко.
  </p>
  <Link href={`/e/${slug}/guide/catalog`} className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium">
    Перейти в каталог
  </Link>
</div>
```

---

## Что нельзя

- **Эмодзи в UI** — только SVG иконки
- **Inline цвета** (`#3B82F6`) — только CSS переменные (`var(--accent)`)
- **Жёстко заданные иконки в компонентах** — только через `iconMap`
- **Анимации без `once: true`** в viewport — будут повторяться при скролле
- **Lucide иконки в новых компонентах** — только свои из `/components/icons/`
- **Spinner'ы** для загрузки — только skeleton
- **Кастомные шрифты вне списка** — только из `fontMap`
