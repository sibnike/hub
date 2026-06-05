'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  Copy,
  Download,
  Grid3x3,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractSvgViewBox } from '@/lib/svg/sanitize'
import {
  alignBottom,
  alignLeft,
  alignRight,
  alignTop,
  distributeHorizontally,
  exportMapWithStands,
  formatMapTabLabel,
  hasMapForStand,
  snap,
  standMatchesMap,
} from '@/lib/map/utils'
import { cn } from '@/lib/utils'
import type { HubEventRow } from '@/types/hub-event'
import type { EventMapRow, MapStandRow } from '@/types/map'

type MapEditorProps = {
  event: HubEventRow
  eventSlug: string
  initialMaps: EventMapRow[]
  initialStands: MapStandRow[]
}

function standLabel(stand: MapStandRow): string {
  return stand.cache?.name ?? stand.stand_number ?? 'Стенд'
}

function isUnplaced(stand: MapStandRow): boolean {
  return stand.map_x === 0 && stand.map_y === 0
}

type DraggableStandProps = {
  stand: MapStandRow
  selected: boolean
  snapEnabled: boolean
  gridSize: number
  onSelect: (standId: string, additive: boolean) => void
  onResizeEnd: (standId: string, width: number, height: number) => void
  onMoveRequest: (standId: string) => void
}

function DraggableStand({
  stand,
  selected,
  snapEnabled,
  gridSize,
  onSelect,
  onResizeEnd,
  onMoveRequest,
}: DraggableStandProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: stand.id,
  })

  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(
    null
  )
  const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null)

  const width = localSize?.width ?? stand.map_width
  const height = localSize?.height ?? stand.map_height

  const style: React.CSSProperties = {
    left: `${stand.map_x}%`,
    top: `${stand.map_y}%`,
    width: `${width}%`,
    height: `${height}%`,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 20 : selected ? 15 : 10,
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const container = (e.currentTarget as HTMLElement).closest('[data-map-canvas]') as HTMLElement
    if (!container) return

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: stand.map_width,
      startH: stand.map_height,
    }

    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return
      const rect = container.getBoundingClientRect()
      const dw = ((ev.clientX - resizeRef.current.startX) / rect.width) * 100
      const dh = ((ev.clientY - resizeRef.current.startY) / rect.height) * 100
      let newW = Math.max(2, resizeRef.current.startW + dw)
      let newH = Math.max(2, resizeRef.current.startH + dh)
      if (snapEnabled) {
        newW = snap(newW, gridSize)
        newH = snap(newH, gridSize)
      }
      setLocalSize({ width: newW, height: newH })
    }

    function onUp(ev: MouseEvent) {
      if (!resizeRef.current) return
      const rect = container.getBoundingClientRect()
      const dw = ((ev.clientX - resizeRef.current.startX) / rect.width) * 100
      const dh = ((ev.clientY - resizeRef.current.startY) / rect.height) * 100
      let newW = Math.max(2, resizeRef.current.startW + dw)
      let newH = Math.max(2, resizeRef.current.startH + dh)
      if (snapEnabled) {
        newW = snap(newW, gridSize)
        newH = snap(newH, gridSize)
      }
      resizeRef.current = null
      setLocalSize(null)
      onResizeEnd(stand.id, newW, newH)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'absolute flex flex-col items-center justify-center rounded border-2 border-primary/60 bg-primary/15 text-center text-xs shadow-sm',
        isDragging && 'opacity-80 ring-2 ring-primary',
        selected && 'ring-2 ring-amber-500 border-amber-500'
      )}
      onContextMenu={(e) => {
        e.preventDefault()
        onMoveRequest(stand.id)
      }}
      onPointerDown={(e) => {
        if (e.shiftKey) {
          e.stopPropagation()
          onSelect(stand.id, true)
        }
      }}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        className="absolute right-0.5 top-0.5 rounded p-0.5 hover:bg-background/80"
        onClick={(e) => {
          e.stopPropagation()
          onMoveRequest(stand.id)
        }}
        title="Переместить на карту"
      >
        <MoreVertical className="h-3 w-3" />
      </button>
      <span className="pointer-events-none px-1 font-medium leading-tight">
        {stand.stand_number ?? '—'}
      </span>
      <span className="pointer-events-none px-1 text-[10px] text-muted-foreground line-clamp-2">
        {standLabel(stand)}
      </span>
      <div
        role="presentation"
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl bg-primary"
        title="Изменить размер"
      />
    </div>
  )
}

function GridOverlay({ gridSize }: { gridSize: number }) {
  const lines: React.ReactNode[] = []
  for (let i = gridSize; i < 100; i += gridSize) {
    lines.push(
      <line key={`v-${i}`} x1={i} y1={0} x2={i} y2={100} stroke="currentColor" strokeWidth="0.15" />,
      <line key={`h-${i}`} x1={0} y1={i} x2={100} y2={i} stroke="currentColor" strokeWidth="0.15" />
    )
  }
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-foreground opacity-10"
    >
      {lines}
    </svg>
  )
}

export function MapEditor({
  event,
  eventSlug,
  initialMaps,
  initialStands,
}: MapEditorProps) {
  const [maps, setMaps] = useState(initialMaps)
  const [stands, setStands] = useState(initialStands)
  const [activeMapId, setActiveMapId] = useState(initialMaps[0]?.id ?? '')
  const [svgInput, setSvgInput] = useState('')
  const [pavilion, setPavilion] = useState('main')
  const [floor, setFloor] = useState('1')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editMapOpen, setEditMapOpen] = useState(false)
  const [replaceSvgOpen, setReplaceSvgOpen] = useState(false)
  const [replaceSvg, setReplaceSvg] = useState('')
  const [editPavilion, setEditPavilion] = useState('')
  const [editFloor, setEditFloor] = useState('1')
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [gridSize] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveStandId, setMoveStandId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const activeMap = useMemo(
    () => maps.find((m) => m.id === activeMapId) ?? maps[0] ?? null,
    [maps, activeMapId]
  )

  const viewBox = useMemo(
    () => (activeMap?.svg_content ? extractSvgViewBox(activeMap.svg_content) : null),
    [activeMap]
  )

  const aspectRatio = viewBox ? `${viewBox.width} / ${viewBox.height}` : '16 / 9'

  const standsForMap = useMemo(() => {
    if (!activeMap) return []
    return stands.filter((s) => standMatchesMap(s, activeMap) && !isUnplaced(s))
  }, [stands, activeMap])

  const sortedStandsList = useMemo(() => {
    const forMap = stands.filter((s) => activeMap && standMatchesMap(s, activeMap))
    const withoutMap = stands.filter((s) => !hasMapForStand(s, maps))
    const combined = [...forMap, ...withoutMap.filter((s) => !forMap.includes(s))]
    return [...combined].sort((a, b) => {
      const aNoMap = !hasMapForStand(a, maps)
      const bNoMap = !hasMapForStand(b, maps)
      if (aNoMap !== bNoMap) return aNoMap ? -1 : 1
      const aUnplaced = isUnplaced(a)
      const bUnplaced = isUnplaced(b)
      if (aUnplaced !== bUnplaced) return aUnplaced ? -1 : 1
      return standLabel(a).localeCompare(standLabel(b), 'ru')
    })
  }, [stands, activeMap, maps])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  const savePosition = useCallback(
    async (
      standId: string,
      position: { map_x: number; map_y: number; map_width: number; map_height: number }
    ) => {
      try {
        const res = await fetch(
          `/api/organizer/events/${eventSlug}/stands/${standId}/position`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(position),
          }
        )
        if (res.status === 401) {
          showToast('Сессия истекла. Войдите снова, чтобы сохранить изменения.')
          return
        }
        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error ?? 'Ошибка сохранения')
        }
        setStands((prev) =>
          prev.map((s) => (s.id === standId ? { ...s, ...position } : s))
        )
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Ошибка сохранения')
      }
    },
    [eventSlug, showToast]
  )

  const batchSave = useCallback(
    async (
      updates: Array<{
        standId: string
        map_x: number
        map_y: number
        map_width: number
        map_height: number
      }>
    ) => {
      try {
        const res = await fetch(
          `/api/organizer/events/${eventSlug}/stands/batch-position`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
          }
        )
        if (res.status === 401) {
          showToast('Сессия истекла. Войдите снова, чтобы сохранить изменения.')
          return
        }
        if (!res.ok) throw new Error('Ошибка сохранения')
        setStands((prev) =>
          prev.map((s) => {
            const u = updates.find((x) => x.standId === s.id)
            return u ? { ...s, map_x: u.map_x, map_y: u.map_y, map_width: u.map_width, map_height: u.map_height } : s
          })
        )
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Ошибка сохранения')
      }
    },
    [eventSlug, showToast]
  )

  const handleSelect = useCallback((standId: string, additive: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(additive ? prev : [])
      if (next.has(standId)) next.delete(standId)
      else next.add(standId)
      return next
    })
  }, [])

  const handleDragEnd = useCallback(
    (dragEvent: DragEndEvent) => {
      const standId = String(dragEvent.active.id)
      const stand = stands.find((s) => s.id === standId)
      if (!stand || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const currentPxX = (stand.map_x / 100) * containerRect.width
      const currentPxY = (stand.map_y / 100) * containerRect.height

      let map_x = ((dragEvent.delta.x + currentPxX) / containerRect.width) * 100
      let map_y = ((dragEvent.delta.y + currentPxY) / containerRect.height) * 100

      if (snapEnabled) {
        map_x = snap(map_x, gridSize)
        map_y = snap(map_y, gridSize)
      }

      map_x = Math.max(0, Math.min(100 - stand.map_width, map_x))
      map_y = Math.max(0, Math.min(100 - stand.map_height, map_y))

      void savePosition(standId, {
        map_x,
        map_y,
        map_width: stand.map_width,
        map_height: stand.map_height,
      })
      setSelectedIds(new Set([standId]))
    },
    [stands, savePosition, snapEnabled, gridSize]
  )

  const handleResizeEnd = useCallback(
    (standId: string, map_width: number, map_height: number) => {
      const stand = stands.find((s) => s.id === standId)
      if (!stand) return
      const map_x = Math.min(stand.map_x, 100 - map_width)
      const map_y = Math.min(stand.map_y, 100 - map_height)
      void savePosition(standId, { map_x, map_y, map_width, map_height })
    },
    [stands, savePosition]
  )

  const applyAlign = useCallback(
    (fn: (items: Array<{ id: string; map_x: number; map_y: number; map_width: number; map_height: number }>) => Array<{ id: string; map_x: number; map_y: number; map_width: number; map_height: number }>) => {
      const selected = stands
        .filter((s) => selectedIds.has(s.id))
        .map((s) => ({
          id: s.id,
          map_x: s.map_x,
          map_y: s.map_y,
          map_width: s.map_width,
          map_height: s.map_height,
        }))
      if (selected.length < 2) return
      const aligned = fn(selected)
      void batchSave(
        aligned.map((s) => ({
          standId: s.id,
          map_x: s.map_x,
          map_y: s.map_y,
          map_width: s.map_width,
          map_height: s.map_height,
        }))
      )
    },
    [stands, selectedIds, batchSave]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        const standId = Array.from(selectedIds)[0] ?? standsForMap[0]?.id
        if (!standId) return
        void (async () => {
          const res = await fetch(
            `/api/organizer/events/${eventSlug}/stands/${standId}/duplicate`,
            { method: 'POST' }
          )
          const json = (await res.json()) as { data?: MapStandRow; error?: string }
          if (!res.ok || !json.data) {
            showToast(json.error ?? 'Ошибка дублирования')
            return
          }
          const row = json.data
          setStands((prev) => [
            ...prev,
            {
              ...row,
              tenant_slug: stands.find((s) => s.id === standId)?.tenant_slug ?? null,
              cache: stands.find((s) => s.id === standId)?.cache ?? null,
            } as MapStandRow,
          ])
        })()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, standsForMap, eventSlug, showToast, stands])

  async function uploadMap() {
    if (!svgInput.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pavilion: pavilion.trim() || 'main',
          floor: parseInt(floor, 10) || 1,
          svg_content: svgInput,
          sort_order: maps.length,
        }),
      })
      const json = (await res.json()) as { data?: EventMapRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка загрузки')
      if (json.data) {
        setMaps((prev) => [...prev, json.data!])
        setActiveMapId(json.data.id)
        setSvgInput('')
        setUploadOpen(false)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setBusy(false)
    }
  }

  async function saveMapMeta() {
    if (!activeMap) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/maps/${activeMap.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pavilion: editPavilion.trim() || 'main',
            floor: parseInt(editFloor, 10) || 1,
          }),
        }
      )
      const json = (await res.json()) as {
        data?: EventMapRow
        warning?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data) {
        setMaps((prev) => prev.map((m) => (m.id === json.data!.id ? json.data! : m)))
      }
      if (json.warning) showToast(json.warning)
      setEditMapOpen(false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function replaceMapSvg() {
    if (!activeMap || !replaceSvg.trim()) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/organizer/events/${eventSlug}/maps/${activeMap.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svg_content: replaceSvg }),
        }
      )
      const json = (await res.json()) as { data?: EventMapRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      if (json.data) {
        setMaps((prev) => prev.map((m) => (m.id === json.data!.id ? json.data! : m)))
      }
      setReplaceSvgOpen(false)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function deleteMap(mapId: string) {
    if (
      !window.confirm(
        'Удалить карту? Стенды на этой карте потеряют позицию (останутся привязаны к павильону, но без размещения).'
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/maps/${mapId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Не удалось удалить')
      setMaps((prev) => {
        const next = prev.filter((m) => m.id !== mapId)
        if (activeMapId === mapId) setActiveMapId(next[0]?.id ?? '')
        return next
      })
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  async function moveStandToMap(standId: string, map: EventMapRow) {
    setBusy(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/stands/${standId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pavilion: map.pavilion, floor: map.floor }),
      })
      const json = (await res.json()) as { data?: MapStandRow; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setStands((prev) =>
        prev.map((s) =>
          s.id === standId
            ? {
                ...s,
                pavilion: map.pavilion,
                floor: map.floor,
                map_x: 0,
                map_y: 0,
              }
            : s
        )
      )
      setMoveStandId(null)
      setActiveMapId(map.id)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  function placeStandOnMap(standId: string) {
    const stand = stands.find((s) => s.id === standId)
    if (!stand) return
    void savePosition(standId, {
      map_x: 10,
      map_y: 10,
      map_width: stand.map_width || 5,
      map_height: stand.map_height || 5,
    })
  }

  function exportSvg() {
    if (!activeMap?.svg_content || !viewBox) return
    const content = exportMapWithStands(activeMap.svg_content, standsForMap, viewBox)
    const blob = new Blob([content], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventSlug}-${activeMap.pavilion}-${activeMap.floor}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const eventTitle = event.name.ru ?? event.name.en ?? event.slug

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Редактор карты</h1>
          <p className="text-sm text-muted-foreground">{eventTitle}</p>
        </div>
        <Link
          href={`/organizer/events/${eventSlug}`}
          className="text-sm text-primary hover:underline"
        >
          ← К событию
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Павильоны / этажи</Label>
            {maps.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Карты ещё не загружены</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {maps.map((map) => (
                  <Button
                    key={map.id}
                    size="sm"
                    variant={activeMap?.id === map.id ? 'default' : 'outline'}
                    onClick={() => setActiveMapId(map.id)}
                  >
                    {formatMapTabLabel(map)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUploadOpen((v) => !v)
                setPavilion('main')
                setFloor('1')
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Новый павильон
            </Button>
            {activeMap ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditPavilion(activeMap.pavilion)
                  setEditFloor(String(activeMap.floor))
                  setEditMapOpen((v) => !v)
                }}
              >
                Изменить
              </Button>
            ) : null}
          </div>

          {uploadOpen ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <Label>Павильон</Label>
                <Input className="mt-1" value={pavilion} onChange={(e) => setPavilion(e.target.value)} />
              </div>
              <div>
                <Label>Этаж</Label>
                <Input className="mt-1" value={floor} onChange={(e) => setFloor(e.target.value)} />
              </div>
              <div>
                <Label>SVG</Label>
                <Textarea
                  className="mt-1 font-mono text-xs"
                  rows={5}
                  value={svgInput}
                  onChange={(e) => setSvgInput(e.target.value)}
                />
              </div>
              <input
                type="file"
                accept=".svg,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setSvgInput(String(reader.result ?? ''))
                  reader.readAsText(file)
                }}
              />
              <Button size="sm" className="w-full" disabled={busy || !svgInput.trim()} onClick={() => void uploadMap()}>
                <Upload className="mr-1 h-4 w-4" />
                Сохранить карту
              </Button>
            </div>
          ) : null}

          {editMapOpen && activeMap ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <Label>Название павильона</Label>
                <Input className="mt-1" value={editPavilion} onChange={(e) => setEditPavilion(e.target.value)} />
              </div>
              <div>
                <Label>Этаж</Label>
                <Input className="mt-1" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} />
              </div>
              <p className="text-xs text-amber-600">
                При смене павильона/этажа стенды не переедут автоматически.
              </p>
              <Button size="sm" className="w-full" disabled={busy} onClick={() => void saveMapMeta()}>
                Сохранить
              </Button>
            </div>
          ) : null}

          {activeMap ? (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setReplaceSvg(activeMap.svg_content ?? '')
                  setReplaceSvgOpen((v) => !v)
                }}
              >
                Заменить SVG
              </Button>
              {replaceSvgOpen ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <Textarea
                    className="font-mono text-xs"
                    rows={6}
                    value={replaceSvg}
                    onChange={(e) => setReplaceSvg(e.target.value)}
                  />
                  <Button size="sm" className="w-full" disabled={busy} onClick={() => void replaceMapSvg()}>
                    Сохранить SVG
                  </Button>
                </div>
              ) : null}
              <Button size="sm" variant="outline" className="w-full" onClick={exportSvg}>
                <Download className="mr-1 h-4 w-4" />
                Экспортировать как SVG
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive"
                disabled={busy}
                onClick={() => void deleteMap(activeMap.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Удалить карту
              </Button>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Привязка к сетке</Label>
              <Button
                size="sm"
                variant={snapEnabled ? 'default' : 'outline'}
                onClick={() => setSnapEnabled((v) => !v)}
              >
                <Grid3x3 className="mr-1 h-4 w-4" />
                {snapEnabled ? 'Вкл' : 'Выкл'}
              </Button>
            </div>
            {selectedIds.size >= 2 ? (
              <div className="flex flex-wrap gap-1">
                <Button size="icon-xs" variant="outline" title="По левому краю" onClick={() => applyAlign(alignLeft)}>
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-xs" variant="outline" title="По правому краю" onClick={() => applyAlign(alignRight)}>
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-xs" variant="outline" title="По верху" onClick={() => applyAlign(alignTop)}>
                  <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-xs" variant="outline" title="По низу" onClick={() => applyAlign(alignBottom)}>
                  <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="outline"
                  title="Распределить"
                  onClick={() => applyAlign(distributeHorizontally)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Shift+клик — выделение. Cmd+D — дубликат.</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Стенды</Label>
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm">
              {sortedStandsList.length === 0 ? (
                <li className="text-muted-foreground">Нет подтверждённых стендов</li>
              ) : (
                sortedStandsList.map((stand) => {
                  const noMap = !hasMapForStand(stand, maps)
                  return (
                    <li
                      key={stand.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded border px-2 py-1.5',
                        selectedIds.has(stand.id) && 'border-amber-500 bg-amber-500/5'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {stand.stand_number ?? '—'} · {standLabel(stand)}
                        </p>
                        {noMap ? (
                          <span className="text-xs text-amber-600">Без карты</span>
                        ) : isUnplaced(stand) ? (
                          <span className="text-xs text-amber-600">Не размещён</span>
                        ) : null}
                      </div>
                      {isUnplaced(stand) && !noMap ? (
                        <Button size="xs" variant="outline" disabled={!activeMap} onClick={() => placeStandOnMap(stand.id)}>
                          На карту
                        </Button>
                      ) : null}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </aside>

        <div className="mx-auto w-full max-w-[1200px]">
          {!activeMap?.svg_content ? (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Загрузите SVG-схему павильона
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div
                ref={containerRef}
                data-map-canvas
                className="relative w-full overflow-hidden rounded-lg border bg-muted/30 [&_svg]:h-full [&_svg]:w-full"
                style={{ aspectRatio }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  dangerouslySetInnerHTML={{ __html: activeMap.svg_content }}
                />
                {snapEnabled ? <GridOverlay gridSize={gridSize} /> : null}
                {standsForMap.map((stand) => (
                  <DraggableStand
                    key={stand.id}
                    stand={stand}
                    selected={selectedIds.has(stand.id)}
                    snapEnabled={snapEnabled}
                    gridSize={gridSize}
                    onSelect={handleSelect}
                    onResizeEnd={handleResizeEnd}
                    onMoveRequest={setMoveStandId}
                  />
                ))}
              </div>
            </DndContext>
          )}
        </div>
      </div>

      {moveStandId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
            <p className="mb-3 font-medium">Переместить на карту</p>
            <div className="space-y-1">
              {maps.map((map) => (
                <Button
                  key={map.id}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void moveStandToMap(moveStandId, map)}
                >
                  {formatMapTabLabel(map)}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={() => setMoveStandId(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
