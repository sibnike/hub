'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRightIcon,
  BonusIcon,
  CategoryIcon,
  CityGuideIcon,
  HeartIcon,
  MapPinIcon,
  PollIcon,
  StarIcon,
} from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'
import { fadeUp, heroEntry, stagger, staggerItem } from '@/lib/design/animations'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import { parseEventSettings } from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import type { HubEventRow } from '@/types/hub-event'
import type { EventPollRow, EventVisitorRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'

type GuideHomeProps = {
  event: HubEventRow
  visitor: EventVisitorRow
  activePolls: EventPollRow[]
  answeredPollIds: string[]
}

const QUICK_TILES = [
  { href: 'catalog', label: 'Каталог', icon: CategoryIcon },
  { href: 'map', label: 'Карта', icon: MapPinIcon },
  { href: 'favorites', label: 'Избранное', icon: HeartIcon },
  { href: 'polls', label: 'Опросы', icon: PollIcon },
] as const

function parsePrivileges(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/\n|•|·/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function GuideHome({
  event,
  visitor,
  activePolls,
  answeredPollIds,
}: GuideHomeProps) {
  const { locale } = useEventLocale()
  const settings = parseEventSettings(event.settings)
  const eventTitle = getI18nText(event.name, locale, event.slug)
  const welcomeMsg = settings.welcome_message
    ? getI18nText(settings.welcome_message, locale)
    : null
  const tierName = visitor.tier
    ? getI18nText(visitor.tier.name, locale, visitor.tier.slug)
    : 'Стандартный'
  const tierDesc = visitor.tier?.description
    ? getI18nText(visitor.tier.description, locale)
    : null
  const tierColor = visitor.tier?.color ?? 'var(--tier-default)'
  const privileges = parsePrivileges(tierDesc)

  const city = event.location?.city ?? ''
  const dateLabel = formatDateRangeLabel(event.dates)
  const locationLine = [city, dateLabel !== '—' ? dateLabel : null].filter(Boolean).join(' · ')

  const unanswered = activePolls.filter((p) => !answeredPollIds.includes(p.id))

  return (
    <div>
      {/* Hero */}
      <section
        className="relative flex min-h-[50vh] w-full items-end md:min-h-[60vh]"
        style={{
          background: 'var(--hero-bg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/30" aria-hidden />
        <motion.div
          {...heroEntry}
          className="relative z-10 w-full px-4 pb-10 pt-16 text-white md:px-8 md:pb-14"
        >
          <div className="mx-auto max-w-6xl">
            <p className="font-body text-sm text-white/80">
              {welcomeMsg ? 'Добро пожаловать' : `Здравствуйте, ${visitor.name}`}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-semibold md:text-5xl">
              {welcomeMsg ?? `Добро пожаловать на ${eventTitle}`}
            </h1>
            {locationLine ? (
              <p className="mt-3 font-body text-base text-white/85">{locationLine}</p>
            ) : null}
            {!welcomeMsg ? (
              <p className="mt-1 font-body text-sm text-white/70">{visitor.name}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <GuideButton href={`/e/${event.slug}/guide/catalog`}>
                Открыть каталог
                <ArrowRightIcon size={18} className="ml-2 inline" />
              </GuideButton>
              <GuideButton href={`/e/${event.slug}/guide/map`} variant="secondary">
                Карта
              </GuideButton>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 md:px-6 md:py-16">
        {/* Tier block */}
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] md:p-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${tierColor}15`,
                  color: tierColor,
                  border: `1px solid ${tierColor}30`,
                }}
              >
                <StarIcon size={24} />
              </div>
              <div>
                <p className="font-body text-sm text-[var(--muted)]">Ваш статус</p>
                <p className="font-heading text-xl font-semibold text-[var(--brand)]">{tierName}</p>
                {privileges.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {privileges.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-[var(--muted)]"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : tierDesc ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{tierDesc}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--surface2)] px-5 py-4">
              <BonusIcon size={28} className="text-[var(--accent)]" />
              <div>
                <p className="font-heading text-3xl font-semibold text-[var(--brand)]">
                  {visitor.bonus_balance}
                </p>
                <p className="text-xs text-[var(--muted)]">баллов</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Active polls */}
        {unanswered.length > 0 ? (
          <motion.section {...fadeUp}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-xl font-semibold text-[var(--brand)]">
                Активные опросы
              </h2>
              <Link
                href={`/e/${event.slug}/guide/polls`}
                className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:opacity-80"
              >
                Все
                <ArrowRightIcon size={16} />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
              {unanswered.map((poll) => (
                <motion.div
                  key={poll.id}
                  {...staggerItem}
                  className="min-w-[260px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] md:min-w-0"
                >
                  <PollIcon size={20} className="text-[var(--accent)]" />
                  <p className="mt-3 font-heading text-base font-semibold text-[var(--brand)] line-clamp-2">
                    {getI18nText(poll.question, locale)}
                  </p>
                  {poll.bonus_reward > 0 ? (
                    <p className="mt-2 flex items-center gap-1 text-sm text-[var(--muted)]">
                      <BonusIcon size={14} className="text-[var(--accent)]" />+{poll.bonus_reward}{' '}
                      баллов
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <GuideButton href={`/e/${event.slug}/guide/polls`} variant="ghost" className="px-0">
                      Ответить
                    </GuideButton>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : null}

        {/* Quick nav 2x2 */}
        <motion.section {...fadeUp}>
          <h2 className="mb-4 font-heading text-xl font-semibold text-[var(--brand)]">
            Быстрая навигация
          </h2>
          <motion.div {...stagger} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {QUICK_TILES.map((tile) => {
              const Icon = tile.icon
              const count =
                tile.href === 'polls'
                  ? unanswered.length
                  : tile.href === 'favorites'
                    ? undefined
                    : undefined
              return (
                <motion.div key={tile.href} {...staggerItem}>
                  <Link
                    href={`/e/${event.slug}/guide/${tile.href}`}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center transition hover:border-[var(--border2)] hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface2)]">
                      <Icon size={24} className="text-[var(--accent)]" />
                    </div>
                    <span className="font-body text-sm font-medium text-[var(--text)]">
                      {tile.label}
                      {count !== undefined && count > 0 ? (
                        <span className="ml-1 text-[var(--accent)]">({count})</span>
                      ) : null}
                    </span>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </motion.section>

        {/* City guide placeholder */}
        <motion.section
          {...fadeUp}
          className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface2)] px-6 py-12 text-center"
        >
          <CityGuideIcon size={40} className="mx-auto text-[var(--subtle)]" />
          <h3 className="mt-4 font-heading text-lg font-semibold text-[var(--brand)]">Подборки</h3>
          <p className="mt-2 font-body text-sm text-[var(--muted)]">
            Гид по городу скоро будет доступен
          </p>
        </motion.section>
      </div>
    </div>
  )
}
