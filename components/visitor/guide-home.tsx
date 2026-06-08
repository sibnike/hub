'use client'

import Link from 'next/link'
import { BookOpen, Heart, LayoutGrid, Map, MessageSquare, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { parseEventSettings } from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import type { HubEventRow } from '@/types/hub-event'
import type { EventPollRow, EventVisitorRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'
import { Badge } from '@/components/ui/badge'

type GuideHomeProps = {
  event: HubEventRow
  visitor: EventVisitorRow
  activePolls: EventPollRow[]
  answeredPollIds: string[]
}

const QUICK_ACTIONS = [
  { href: 'catalog', label: 'Каталог', icon: LayoutGrid },
  { href: 'map', label: 'Карта', icon: Map },
  { href: 'favorites', label: 'Избранное', icon: Heart },
  { href: 'polls', label: 'Опросы', icon: MessageSquare },
  { href: 'profile', label: 'Профиль', icon: User },
]

export function GuideHome({
  event,
  visitor,
  activePolls,
  answeredPollIds,
}: GuideHomeProps) {
  const { locale } = useEventLocale()
  const settings = parseEventSettings(event.settings)
  const welcomeMsg = settings.welcome_message
    ? getI18nText(settings.welcome_message, locale)
    : null
  const tierName = visitor.tier
    ? getI18nText(visitor.tier.name, locale, visitor.tier.slug)
    : 'Стандартный'
  const tierDesc = visitor.tier?.description
    ? getI18nText(visitor.tier.description, locale)
    : null
  const tierColor = visitor.tier?.color ?? 'var(--event-accent)'

  const unanswered = activePolls.filter((p) => !answeredPollIds.includes(p.id))

  return (
    <div className="container py-8 space-y-8 max-w-3xl">
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">
          {welcomeMsg ?? `Добро пожаловать, ${visitor.name}!`}
        </h2>
        <Badge className="text-white border-0" style={{ backgroundColor: tierColor }}>
          {tierName}
        </Badge>
        <p className="text-lg">
          Бонусный баланс: <strong>{visitor.bonus_balance}</strong> баллов
        </p>
        {tierDesc ? (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Что включено в ваш статус:</p>
            <p>{tierDesc}</p>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="font-semibold mb-3">Быстрые действия</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.href}
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                render={<Link href={`/e/${event.slug}/guide/${action.href}`} />}
              >
                <Icon className="h-5 w-5" />
                {action.label}
              </Button>
            )
          })}
        </div>
      </section>

      {unanswered.length > 0 ? (
        <section>
          <h3 className="font-semibold mb-3">Активные опросы</h3>
          <div className="space-y-2">
            {unanswered.map((poll) => (
              <Card key={poll.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <p className="text-sm">{getI18nText(poll.question, locale)}</p>
                  {poll.bonus_reward > 0 ? (
                    <span className="text-xs text-muted-foreground shrink-0">
                      +{poll.bonus_reward}б
                    </span>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="outline"
            render={<Link href={`/e/${event.slug}/guide/polls`} />}
          >
            Все опросы
          </Button>
        </section>
      ) : null}

      <section>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Подборки</p>
            <p className="text-sm mt-1">Гид по городу скоро будет доступен</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
