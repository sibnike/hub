import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function HubHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const adminUrl = process.env.NEXT_PUBLIC_VITRINA_ADMIN ?? 'https://admin.yanbada.com'

  return (
    <header className="border-b px-4 py-3 flex items-center justify-between gap-4">
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link href="/organizer/events" className="font-bold">
          Yanbada Hub
        </Link>
        {user ? (
          <>
            <Link
              href="/organizer/events"
              className="text-muted-foreground hover:text-foreground"
            >
              Кабинет организатора
            </Link>
            <Link
              href="/exhibitor/events"
              className="text-muted-foreground hover:text-foreground"
            >
              Мои выставки
            </Link>
            <Link
              href="/exhibitor/analytics"
              className="text-muted-foreground hover:text-foreground"
            >
              Сравнение событий
            </Link>
          </>
        ) : null}
      </nav>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {user?.email ? <span className="hidden sm:inline">{user.email}</span> : null}
        <a href={adminUrl} className="text-primary hover:underline">
          admin.yanbada.com
        </a>
      </div>
    </header>
  )
}
