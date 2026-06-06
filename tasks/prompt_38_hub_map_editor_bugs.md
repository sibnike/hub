> Открой `tasks/prompt_38_hub_map_editor_bugs.md` и выполни задачу. Положи в `mega-hub/tasks/`. Срочный фикс багов редактора карты — стенды «убегают» при перетаскивании, Cmd+D плодит дубликаты бесконтрольно, ресайз не работает корректно.

# Fix — Баги редактора карты выставки

## Контекст

После добавления функционала редактора карты в H-5 (snap-to-grid, дубликаты, multi-select) появились баги:

1. **Стенд «убегает»** при попытке перетащить с включённым snap-to-grid — координаты прыгают, стенд оказывается далеко от курсора
2. **Cmd+D плодит дубликаты бесконтрольно** — за один раз создаётся 5-10 копий вместо одной
3. **Ресайз** работает плохо — размер не задаётся точно, стенд "прыгает" при растягивании

В БД сейчас 10 дубликатов одного стенда — это видно по запросу:
```
D-02 (49, 15) — оригинал
D-02 (11, 14) — 9 копий в одной точке
```

Все копии имеют одинаковые координаты (11, 14) — значит каждое нажатие Cmd+D создавало запись со смещением от **исходного**, а не от **только что созданного** дубликата. Плюс срабатывало многократно.

## Что нужно сделать

### 1. Найти компонент редактора

Скорее всего файл: `components/organizer/map-editor.tsx` или похожий.

```bash
grep -rn "Cmd+D\|duplicate" components/ app/ --include="*.tsx"
grep -rn "map_x\|map_y" components/ --include="*.tsx"
```

### 2. Починить Cmd+D дубликат

**Причина:** Event listener на keydown не имеет debounce/throttle, и при удержании клавиши срабатывает много раз. Или нет проверки `e.preventDefault()` и браузер сам обрабатывает.

Фикс:

```typescript
useEffect(() => {
  let lastDuplicateTs = 0

  const handleKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault()
      // Защита от повторов — минимум 500ms между дубликатами
      const now = Date.now()
      if (now - lastDuplicateTs < 500) return
      lastDuplicateTs = now

      if (selectedStandIds.length === 0) return

      // Делаем дубликат только если есть выделение
      duplicateStands(selectedStandIds)
    }
  }

  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [selectedStandIds])
```

Также убедись что `duplicateStands` использует `useCallback` и не вызывается дважды.

### 3. Починить «убегание» при drag

**Причина:** snap-to-grid пересчитывает координаты в неправильной системе — возможно округляет дельту вместо итоговой позиции, или применяется дважды (в onDrag и в onDrop).

Фикс — snap применять только в `onDragEnd`, не в `onDragMove`:

```typescript
function snap(value: number, gridSize: number = 1): number {
  return Math.round(value / gridSize) * gridSize
}

// При drag — НЕ применяем snap, чтобы стенд плавно следовал за курсором
function handleDragMove(event: DragMoveEvent) {
  const { delta, active } = event
  const stand = stands.find(s => s.id === active.id)
  if (!stand || !containerRef.current) return

  const rect = containerRef.current.getBoundingClientRect()
  const deltaXPct = (delta.x / rect.width) * 100
  const deltaYPct = (delta.y / rect.height) * 100

  setDragPreview({
    standId: stand.id,
    x: stand.map_x + deltaXPct,
    y: stand.map_y + deltaYPct,
  })
}

// При drop — применяем snap и сохраняем
async function handleDragEnd(event: DragEndEvent) {
  const { delta, active } = event
  const stand = stands.find(s => s.id === active.id)
  if (!stand || !containerRef.current) return

  const rect = containerRef.current.getBoundingClientRect()
  const deltaXPct = (delta.x / rect.width) * 100
  const deltaYPct = (delta.y / rect.height) * 100

  const rawX = stand.map_x + deltaXPct
  const rawY = stand.map_y + deltaYPct

  const newX = snapEnabled ? snap(rawX, 1) : rawX
  const newY = snapEnabled ? snap(rawY, 1) : rawY

  // Clamp в границы карты (0-100%)
  const finalX = Math.max(0, Math.min(100, newX))
  const finalY = Math.max(0, Math.min(100, newY))

  await updateStandPosition(stand.id, { map_x: finalX, map_y: finalY })
  setDragPreview(null)
}
```

### 4. Починить ресайз

Если ресайз сделан через mousedown на правом-нижнем углу — проверь что:
- Координаты считаются от того же rect что и drag
- В `width` и `height` тоже clamp 0-100% и проверка минимума (например, минимум 2%)
- snap применяется только на mouseup

```typescript
function handleResize(stand: Stand, deltaX: number, deltaY: number) {
  if (!containerRef.current) return
  const rect = containerRef.current.getBoundingClientRect()

  const deltaWPct = (deltaX / rect.width) * 100
  const deltaHPct = (deltaY / rect.height) * 100

  const newW = Math.max(2, Math.min(100 - stand.map_x, stand.map_width + deltaWPct))
  const newH = Math.max(2, Math.min(100 - stand.map_y, stand.map_height + deltaHPct))

  setResizePreview({ standId: stand.id, width: newW, height: newH })
}

function handleResizeEnd(stand: Stand) {
  const preview = resizePreviewRef.current
  if (!preview) return

  const finalW = snapEnabled ? snap(preview.width, 1) : preview.width
  const finalH = snapEnabled ? snap(preview.height, 1) : preview.height

  updateStandPosition(stand.id, { map_width: finalW, map_height: finalH })
  setResizePreview(null)
}
```

### 5. Дополнительная защита от дубликатов

В API `POST /api/organizer/events/[slug]/stands/[standId]/duplicate` — добавить идемпотентность по короткому окну времени:

```typescript
// Проверить что в последние 2 секунды не было дубликата этого стенда
const { data: recent } = await supabase.schema('hub')
  .from('event_stands')
  .select('id, created_at')
  .eq('participation_id', source.participation_id)
  .gte('created_at', new Date(Date.now() - 2000).toISOString())

if (recent && recent.length > 2) {
  return NextResponse.json({ error: 'Rate limit' }, { status: 429 })
}
```

### 6. UX-улучшения

- **Toast при дубликате:** «Стенд скопирован» — пользователь видит что произошло, и не давит Cmd+D много раз
- **Disable Cmd+D если выделение пустое** — в текущей логике должно работать но проверь
- **Подсветка при ресайзе:** показывать рамку и размеры в процентах рядом с курсором

### 7. Проверка локально

```bash
npm run dev
```

Проверить:
- Cmd+D 5 раз быстро → создаётся 1 копия (или максимум 2 если успело за 500ms)
- Drag → стенд плавно следует за курсором, на отпускании прыгает к ближайшей сетке (если snap on)
- Resize → можно увеличить/уменьшить, ничего не "убегает"

```bash
npm run build
git add .
git commit -m "fix: map editor drag/resize/duplicate behavior"
git push
```

---

## Результат

- [ ] Cmd+D создаёт строго одну копию за нажатие
- [ ] Drag плавный, snap применяется только на отпускании
- [ ] Resize работает без прыжков
- [ ] Стенды не выезжают за границы карты (0-100%)
- [ ] Toast о создании дубликата
- [ ] Билд успешен

---

## Дополнение — оптимистичный апдейт state

### Стенд "возвращается на место и потом прыгает обратно"

Это значит UI обновляется только после ответа API. Нужно обновлять локальный state **сразу** при отпускании мыши, не дожидаясь сервера. Если сервер потом ответит ошибкой — откатить.

```typescript
async function handleDragEnd(event: DragEndEvent) {
  // ... вычисление finalX, finalY

  // 1. Оптимистичный апдейт UI
  const oldStand = stand
  setStands(prev => prev.map(s =>
    s.id === stand.id ? { ...s, map_x: finalX, map_y: finalY } : s
  ))
  setDragPreview(null)

  // 2. Отправка на сервер
  const { error } = await updateStandPosition(stand.id, {
    map_x: finalX,
    map_y: finalY,
  })

  // 3. Откат при ошибке
  if (error) {
    setStands(prev => prev.map(s => (s.id === stand.id ? oldStand : s)))
    toast.error('Не удалось сохранить позицию')
  }
}
```

То же самое для ресайза.

### Ресайз — точное соответствие размера

Если ручка ресайза в правом-нижнем углу, и пользователь тянет на 100px вниз-вправо — стенд должен расшириться **ровно** на эти 100px.

Текущий баг скорее всего:
- snap округляет до 1% сетки → теряется точность
- или ручка считает delta относительно SVG viewBox а не реального DOM-rect

Фикс:
```typescript
// Ручка ресайза должна считать delta В ПИКСЕЛЯХ относительно контейнера карты
function startResize(e: MouseEvent, stand: Stand) {
  const startX = e.clientX
  const startY = e.clientY
  const startW = stand.map_width
  const startH = stand.map_height
  const rect = containerRef.current!.getBoundingClientRect()

  function onMove(ev: MouseEvent) {
    const deltaXPct = ((ev.clientX - startX) / rect.width) * 100
    const deltaYPct = ((ev.clientY - startY) / rect.height) * 100

    let newW = startW + deltaXPct
    let newH = startH + deltaYPct

    // Минимум 2%, максимум до края карты
    newW = Math.max(2, Math.min(100 - stand.map_x, newW))
    newH = Math.max(2, Math.min(100 - stand.map_y, newH))

    // Только локальный preview, без snap
    setStands(prev => prev.map(s =>
      s.id === stand.id ? { ...s, map_width: newW, map_height: newH } : s
    ))
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)

    // На отпускании — snap и сохранение
    const finalStand = stands.find(s => s.id === stand.id)!
    const finalW = snapEnabled ? snap(finalStand.map_width, 1) : finalStand.map_width
    const finalH = snapEnabled ? snap(finalStand.map_height, 1) : finalStand.map_height

    updateStandPosition(stand.id, { map_width: finalW, map_height: finalH })
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

### Disable snap по умолчанию для точной работы

В UI добавить:
- По умолчанию snap **выключен**
- Включается кнопкой если пользователь хочет ровную сетку
- Текущая логика «по умолчанию on» вызывает «прыжки» которые непонятны

