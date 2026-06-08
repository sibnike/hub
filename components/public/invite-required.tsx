import Image from 'next/image'
import Link from 'next/link'
import { GlobeIcon, MailIcon, PhoneIcon, TicketIcon } from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'
import { HeroBanner } from '@/components/design/hero-banner'
import { parseEventSettings, getEventLogoUrl } from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import { formatDateRangeLabel } from '@/lib/hub/event-dates'
import type { HubEventRow } from '@/types/hub-event'

type InviteRequiredProps = {
  slug: string
  eventName?: string
  settings?: Record<string, unknown>
  event?: HubEventRow
}

export function InviteRequired({ slug, eventName, settings, event }: InviteRequiredProps) {
  const parsed = parseEventSettings(settings ?? event?.settings)
  const title = eventName ?? (event ? getI18nText(event.name, 'ru', slug) : 'Выставка')
  const logoUrl = getEventLogoUrl(parsed)
  const city = event?.location?.city ?? ''
  const dates = event ? formatDateRangeLabel(event.dates) : null
  const subtitle = [city, dates && dates !== '—' ? dates : null].filter(Boolean).join(' · ')
  const contacts = parsed.organizer_contacts

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <HeroBanner
        title={title}
        subtitle={subtitle || undefined}
        settings={settings ?? event?.settings}
      >
        {logoUrl ? (
          <div className="relative mt-2 h-12 w-12 overflow-hidden rounded-xl border border-white/20">
            <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : null}
      </HeroBanner>

      <div className="mx-auto max-w-lg px-4 py-12 md:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-sm)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface2)]">
            <TicketIcon size={32} className="text-[var(--accent)]" />
          </div>
          <h2 className="mt-5 font-heading text-xl font-semibold text-[var(--brand)]">
            Доступ по приглашению
          </h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Для просмотра каталога и карты выставки необходимо получить ссылку-приглашение от
            организатора.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Если у вас уже есть ссылка — перейдите по ней для регистрации.
          </p>

          {contacts && (contacts.email || contacts.phone || contacts.website) ? (
            <div className="mt-8 rounded-xl bg-[var(--surface2)] p-5 text-left">
              <p className="font-heading text-sm font-semibold text-[var(--brand)]">
                Контакты организатора
              </p>
              <ul className="mt-3 space-y-2">
                {contacts.email ? (
                  <li>
                    <a
                      href={`mailto:${contacts.email}`}
                      className="flex items-center gap-2 text-sm text-[var(--accent)] hover:opacity-80"
                    >
                      <MailIcon size={16} />
                      {contacts.email}
                    </a>
                  </li>
                ) : null}
                {contacts.phone ? (
                  <li>
                    <a
                      href={`tel:${contacts.phone}`}
                      className="flex items-center gap-2 text-sm text-[var(--accent)] hover:opacity-80"
                    >
                      <PhoneIcon size={16} />
                      {contacts.phone}
                    </a>
                  </li>
                ) : null}
                {contacts.website ? (
                  <li>
                    <a
                      href={contacts.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[var(--accent)] hover:opacity-80"
                    >
                      <GlobeIcon size={16} />
                      {contacts.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            <GuideButton href={`/e/${slug}/guide`} variant="secondary" className="w-full">
              Уже зарегистрированы? Войти в гайд
            </GuideButton>
            <Link
              href={`/e/${slug}`}
              className="block text-sm text-[var(--muted)] hover:text-[var(--accent)]"
            >
              На страницу события
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
