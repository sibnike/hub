import { CloseIcon } from '@/components/icons'
import { GuideButton } from '@/components/design/guide-buttons'

export function InvalidInvite({ slug, reason }: { slug: string; reason: 'inactive' | 'invalid' }) {
  const message =
    reason === 'inactive'
      ? 'Регистрация по этой ссылке закрыта.'
      : 'Ссылка-приглашение недействительна или устарела.'

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-16">
      <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-md)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--surface2)]">
          <CloseIcon size={36} className="text-[var(--error)]" />
        </div>
        <h1 className="mt-6 font-heading text-2xl font-semibold text-[var(--brand)]">
          Нет доступа
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Обратитесь к организатору выставки для получения новой ссылки.
        </p>
        <div className="mt-6">
          <GuideButton href={`/e/${slug}`}>На главную события</GuideButton>
        </div>
      </div>
    </div>
  )
}
