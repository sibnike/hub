'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BonusIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  PollIcon,
} from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'
import { HeroBanner } from '@/components/design/hero-banner'
import { modalEntry } from '@/lib/design/animations'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { EventPollRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'

type PollsPageProps = {
  eventId: string
  eventSlug: string
  polls: EventPollRow[]
  answeredMap: Map<string, string[]>
  initialBalance: number
  onBalanceChange?: (balance: number) => void
}

type ConfettiPiece = {
  id: number
  x: number
  y: number
  color: string
  rotation: number
}

const CONFETTI_COLORS = ['#3B82F6', '#16A34A', '#D97706', '#6366F1', '#DC2626']

export function PollsPage({
  eventId,
  polls,
  answeredMap,
  initialBalance,
  onBalanceChange,
}: PollsPageProps) {
  const { locale } = useEventLocale()
  const [balance, setBalance] = useState(initialBalance)
  const [answered, setAnswered] = useState(answeredMap)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [activePoll, setActivePoll] = useState<EventPollRow | null>(null)
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])

  const active = polls.filter((p) => p.is_active)
  const answeredPolls = polls.filter((p) => answered.has(p.id))
  const unanswered = active.filter((p) => !answered.has(p.id))

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function showSuccess(reward: number) {
    const pieces: ConfettiPiece[] = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100 - 50,
      y: Math.random() * -80 - 20,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * 360,
    }))
    setConfetti(pieces)
    window.setTimeout(() => setConfetti([]), 2000)
    if (reward > 0) {
      setToast({ message: `+${reward} баллов`, id: Date.now() })
    }
  }

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
      const reward = json.bonus_reward ?? 0
      setAnswered((prev) => new Map(prev).set(poll.id, selected))
      if (reward) {
        setBalance((b) => {
          const next = b + reward
          onBalanceChange?.(next)
          return next
        })
      }
      setActivePoll(null)
      showSuccess(reward)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative">
      <HeroBanner
        title="Опросы"
        subtitle={`${unanswered.length} активных · ${balance} баллов`}
      />

      {/* Confetti overlay */}
      <AnimatePresence>
        {confetti.length > 0 ? (
          <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            {confetti.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ opacity: 1, x: '50vw', y: '40vh', rotate: 0, scale: 1 }}
                animate={{
                  opacity: 0,
                  x: `calc(50vw + ${piece.x}vw)`,
                  y: `calc(40vh + ${piece.y}vh)`,
                  rotate: piece.rotation,
                  scale: 0.5,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute h-2 w-2 rounded-sm"
                style={{ backgroundColor: piece.color }}
              />
            ))}
          </div>
        ) : null}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-lg)]"
          >
            <BonusIcon size={18} />
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 md:px-6">
        {unanswered.length > 0 ? (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-[var(--brand)]">
              Активные опросы
            </h2>
            {unanswered.map((poll) => (
              <div
                key={poll.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
              >
                <PollIcon size={20} className="text-[var(--accent)]" />
                <p className="mt-3 font-heading font-semibold text-[var(--brand)]">
                  {getI18nText(poll.question, locale)}
                </p>
                {poll.bonus_reward > 0 ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]">
                    <BonusIcon size={14} className="text-[var(--accent)]" />+{poll.bonus_reward}{' '}
                    баллов
                  </p>
                ) : null}
                <GuideButton
                  className="mt-4"
                  onClick={() => {
                    setActivePoll(poll)
                    setSelections((prev) => ({ ...prev, [poll.id]: prev[poll.id] ?? [] }))
                  }}
                >
                  Ответить
                </GuideButton>
              </div>
            ))}
          </section>
        ) : (
          <p className="text-sm text-[var(--muted)]">Нет активных опросов.</p>
        )}

        {answeredPolls.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-[var(--brand)]">Отвеченные</h2>
            {answeredPolls.map((poll) => {
              const selectedIds = answered.get(poll.id) ?? []
              const isOpen = expanded === poll.id
              return (
                <div
                  key={poll.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-5 opacity-90"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpanded(isOpen ? null : poll.id)}
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircleIcon size={20} className="mt-0.5 shrink-0 text-[var(--success)]" />
                      <div>
                        <p className="font-heading font-medium text-[var(--brand)]">
                          {getI18nText(poll.question, locale)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Отвечено
                          {poll.bonus_reward > 0 ? ` · +${poll.bonus_reward} баллов` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                  {isOpen ? (
                    <ul className="mt-3 space-y-1 pl-7 text-sm text-[var(--muted)]">
                      {poll.options
                        .filter((o) => selectedIds.includes(o.id))
                        .map((o) => (
                          <li key={o.id} className="flex items-center gap-2">
                            <CheckIcon size={14} className="text-[var(--success)]" />
                            {getI18nText(o.label, locale)}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </section>
        ) : null}
      </div>

      {/* Answer modal */}
      <AnimatePresence>
        {activePoll ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setActivePoll(null)}
            />
            <motion.div
              {...modalEntry}
              className="fixed inset-x-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-heading text-lg font-semibold text-[var(--brand)]">
                  {getI18nText(activePoll.question, locale)}
                </h3>
                <button
                  type="button"
                  onClick={() => setActivePoll(null)}
                  className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface2)]"
                  aria-label="Закрыть"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {activePoll.options.map((opt) => {
                  const selected = (selections[activePoll.id] ?? []).includes(opt.id)
                  const isMulti = activePoll.type === 'multi'
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(activePoll.id, opt.id, activePoll.type)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                        selected
                          ? 'border-[var(--accent)] bg-[var(--surface2)]'
                          : 'border-[var(--border)] hover:bg-[var(--surface2)]'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border-2',
                          isMulti ? 'rounded-md' : 'rounded-full',
                          selected
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border2)]'
                        )}
                      >
                        {selected ? <CheckIcon size={12} /> : null}
                      </span>
                      {getI18nText(opt.label, locale)}
                    </button>
                  )
                })}
              </div>

              <GuideButton
                className="mt-6 w-full"
                onClick={() => void submitAnswer(activePoll)}
                disabled={busy === activePoll.id || !(selections[activePoll.id]?.length)}
              >
                {busy === activePoll.id ? 'Отправка…' : 'Отправить ответ'}
              </GuideButton>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
