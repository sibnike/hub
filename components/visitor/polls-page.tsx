'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getI18nText } from '@/lib/i18n/get-text'
import type { EventPollRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'
import { cn } from '@/lib/utils'

type PollsPageProps = {
  eventId: string
  eventSlug: string
  polls: EventPollRow[]
  answeredMap: Map<string, string[]>
  initialBalance: number
  onBalanceChange?: (balance: number) => void
}

export function PollsPage({
  eventId,
  polls,
  answeredMap,
  initialBalance,
}: PollsPageProps) {
  const { locale } = useEventLocale()
  const [balance, setBalance] = useState(initialBalance)
  const [answered, setAnswered] = useState(answeredMap)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string[]>>({})

  const active = polls.filter((p) => p.is_active)
  const answeredPolls = polls.filter((p) => answered.has(p.id))
  const unanswered = active.filter((p) => !answered.has(p.id))

  function toggleOption(pollId: string, optionId: string, type: 'single' | 'multi') {
    setSelections((prev) => {
      const current = prev[pollId] ?? []
      if (type === 'single') return { ...prev, [pollId]: [optionId] }
      const has = current.includes(optionId)
      return {
        ...prev,
        [pollId]: has ? current.filter((id) => id !== optionId) : [...current, optionId],
      }
    })
  }

  async function submitAnswer(poll: EventPollRow) {
    const selected = selections[poll.id] ?? []
    if (!selected.length) return
    setBusy(poll.id)
    try {
      const res = await fetch(`/api/visitor/polls/${poll.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, selected_option_ids: selected }),
      })
      const json = (await res.json()) as { error?: string; bonus_reward?: number }
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      setAnswered((prev) => new Map(prev).set(poll.id, selected))
      if (json.bonus_reward) setBalance((b) => b + json.bonus_reward!)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">Баланс: {balance} баллов</p>

      {unanswered.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-semibold">Активные опросы</h2>
          {unanswered.map((poll) => (
            <Card key={poll.id}>
              <CardContent className="py-4 space-y-3">
                <p className="font-medium">{getI18nText(poll.question, locale)}</p>
                {poll.bonus_reward > 0 ? (
                  <p className="text-xs text-muted-foreground">+{poll.bonus_reward} баллов</p>
                ) : null}
                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const selected = (selections[poll.id] ?? []).includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleOption(poll.id, opt.id, poll.type)}
                        className={cn(
                          'w-full text-left rounded-md border px-3 py-2 text-sm transition-colors',
                          selected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                        )}
                      >
                        {getI18nText(opt.label, locale)}
                      </button>
                    )
                  })}
                </div>
                <Button
                  size="sm"
                  onClick={() => void submitAnswer(poll)}
                  disabled={busy === poll.id || !(selections[poll.id]?.length)}
                >
                  {busy === poll.id ? 'Отправка…' : 'Ответить'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Нет активных опросов.</p>
      )}

      {answeredPolls.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Отвеченные</h2>
          {answeredPolls.map((poll) => {
            const selectedIds = answered.get(poll.id) ?? []
            const isOpen = expanded === poll.id
            return (
              <Card key={poll.id} className="opacity-80">
                <CardContent className="py-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : poll.id)}
                  >
                    <p className="font-medium">{getI18nText(poll.question, locale)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Отвечено{poll.bonus_reward > 0 ? `, +${poll.bonus_reward} баллов` : ''}
                    </p>
                  </button>
                  {isOpen ? (
                    <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5">
                      {poll.options
                        .filter((o) => selectedIds.includes(o.id))
                        .map((o) => (
                          <li key={o.id}>{getI18nText(o.label, locale)}</li>
                        ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
