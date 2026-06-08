'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EventPollRow } from '@/types/visitor'

type PollStats = {
  option_id: string
  label: Record<string, string>
  count: number
  percent: number
}

export function EventPollsPanel({ eventSlug }: { eventSlug: string }) {
  const [polls, setPolls] = useState<EventPollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [statsFor, setStatsFor] = useState<string | null>(null)
  const [stats, setStats] = useState<PollStats[]>([])
  const [statsTotal, setStatsTotal] = useState(0)

  const [questionRu, setQuestionRu] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [pollType, setPollType] = useState<'single' | 'multi'>('single')
  const [bonusReward, setBonusReward] = useState('0')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/polls`)
      const json = (await res.json()) as { data?: EventPollRow[] }
      setPolls(json.data ?? [])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
  }, [load])

  async function createPoll() {
    if (!questionRu.trim() || !optionsText.trim()) {
      setMessage('Укажите вопрос и варианты')
      return
    }
    const optionLines = optionsText.split('\n').map((l) => l.trim()).filter(Boolean)
    const options = optionLines.map((label, i) => ({
      id: `opt_${i + 1}`,
      label: { ru: label },
    }))

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizer/events/${eventSlug}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: { ru: questionRu.trim() },
          options,
          type: pollType,
          bonus_reward: parseInt(bonusReward, 10) || 0,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setQuestionRu('')
      setOptionsText('')
      setBonusReward('0')
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !isActive }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function removePoll(id: string) {
    if (!confirm('Удалить опрос?')) return
    setBusy(true)
    try {
      await fetch(`/api/organizer/events/${eventSlug}/polls`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function loadStats(pollId: string) {
    setStatsFor(pollId)
    const res = await fetch(`/api/organizer/events/${eventSlug}/polls/${pollId}/stats`)
    const json = (await res.json()) as {
      data?: { stats: PollStats[]; total_answers: number }
    }
    setStats(json.data?.stats ?? [])
    setStatsTotal(json.data?.total_answers ?? 0)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Загрузка…</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Опросы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {polls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет опросов</p>
          ) : (
            <ul className="space-y-3">
              {polls.map((p) => (
                <li key={p.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{p.question.ru}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.type === 'single' ? 'Один ответ' : 'Несколько'} · +{p.bonus_reward}б
                        {!p.is_active ? ' · неактивен' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void loadStats(p.id)}>
                        Статистика
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleActive(p.id, p.is_active)} disabled={busy}>
                        {p.is_active ? 'Выкл' : 'Вкл'}
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => void removePoll(p.id)} disabled={busy}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {statsFor === p.id ? (
                    <div className="text-xs space-y-1 pt-2 border-t">
                      <p className="text-muted-foreground">Ответов: {statsTotal}</p>
                      {stats.map((s) => (
                        <p key={s.option_id}>
                          {s.label.ru}: {s.count} ({s.percent}%)
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Новый опрос</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Вопрос (RU)</Label>
            <Input className="mt-1" value={questionRu} onChange={(e) => setQuestionRu(e.target.value)} />
          </div>
          <div>
            <Label>Варианты (по одному на строку)</Label>
            <textarea
              className="mt-1 w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Тип</Label>
              <Select value={pollType} onValueChange={(v) => v && setPollType(v as 'single' | 'multi')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Один ответ</SelectItem>
                  <SelectItem value="multi">Несколько</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Бонус за ответ</Label>
              <Input className="mt-1" type="number" value={bonusReward} onChange={(e) => setBonusReward(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => void createPoll()} disabled={busy}>
            Создать опрос
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
