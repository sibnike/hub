import { notFound } from 'next/navigation'
import { CloseIcon } from '@/components/icons'
import { EventThemeShell } from '@/components/design/event-theme-shell'
import { GuideButton } from '@/components/design/guide-buttons'
import { getPublishedEvent } from '@/lib/hub/get-published-event'
import { parseEventSettings } from '@/lib/hub/event-settings'

type PageProps = { params: { slug: string } }

export default async function InvalidLinkPage({ params }: PageProps) {
  const event = await getPublishedEvent(params.slug)
  if (!event) notFound()

  const settings = parseEventSettings(event.settings)
  const contactEmail = settings.organizer_contacts?.email

  return (
    <EventThemeShell settings={event.settings}>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-md)]">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface2)]">
            <CloseIcon size={32} className="text-[var(--error)]" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--brand)]">
            Ссылка недействительна
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Ссылка подтверждения устарела или уже была использована. Запросите новую ссылку у
            организатора.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {contactEmail ? (
              <GuideButton href={`mailto:${contactEmail}`} variant="primary">
                Связаться с организатором
              </GuideButton>
            ) : null}
            <GuideButton href={`/e/${params.slug}`} variant="secondary">
              На главную события
            </GuideButton>
          </div>
        </div>
      </div>
    </EventThemeShell>
  )
}
