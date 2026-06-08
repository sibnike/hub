'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BonusIcon,
  ChevronDownIcon,
  LogoutIcon,
  MenuIcon,
  StarIcon,
  UserIcon,
} from '@/components/icons'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getEventLogoUrl, parseEventSettings } from '@/lib/hub/event-settings'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { EventLocation, I18nMap } from '@/types/hub-event'
import type { EventVisitorRow } from '@/types/visitor'
import { useEventLocale } from '@/components/public/event-locale-context'

type GuideHeaderProps = {
  slug: string
  name: I18nMap
  dates: string | null
  location: EventLocation
  settings: Record<string, unknown>
  visitor: EventVisitorRow
}

const NAV_ITEMS = [
  { href: 'guide', label: 'Главная', key: 'home' },
  { href: 'guide/catalog', label: 'Каталог', key: 'catalog' },
  { href: 'guide/map', label: 'Карта', key: 'map' },
  { href: 'guide/favorites', label: 'Избранное', key: 'favorites' },
  { href: 'guide/polls', label: 'Опросы', key: 'polls' },
  { href: 'guide/profile', label: 'Профиль', key: 'profile' },
] as const

function resolveActiveKey(pathname: string, slug: string): string {
  const base = `/e/${slug}/guide`
  if (pathname === base || pathname === `${base}/`) return 'home'
  for (const item of NAV_ITEMS) {
    if (item.key === 'home') continue
    const segment = item.href.replace('guide/', '')
    if (pathname.startsWith(`${base}/${segment}`)) return item.key
  }
  return 'home'
}

export function GuideHeader({ slug, name, settings, visitor }: GuideHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale } = useEventLocale()
  const parsed = parseEventSettings(settings)
  const title = getI18nText(name, locale, slug)
  const logoUrl = getEventLogoUrl(parsed)
  const tierName = visitor.tier
    ? getI18nText(visitor.tier.name, locale, visitor.tier.slug)
    : null
  const tierColor = visitor.tier?.color ?? 'var(--tier-default)'

  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  const activeKey = resolveActiveKey(pathname, slug)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function logout() {
    await fetch('/api/visitor/logout', { method: 'POST' })
    router.push(`/e/${slug}`)
  }

  function navLinkClass(key: string) {
    return cn(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors font-body',
      activeKey === key
        ? 'bg-[var(--accent)] text-white'
        : 'text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
    )
  }

  const tierBadge = tierName ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `${tierColor}15`,
        color: tierColor,
        border: `1px solid ${tierColor}30`,
      }}
    >
      <StarIcon size={12} />
      {tierName}
    </span>
  ) : null

  const balanceBlock = (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
      <BonusIcon size={18} className="text-[var(--accent)]" />
      {visitor.bonus_balance}
    </span>
  )

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 transition-all duration-300',
          scrolled
            ? 'border-b border-[var(--border)] bg-[var(--surface)]/95 shadow-[var(--shadow-sm)] backdrop-blur-md'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:h-[72px] md:px-6">
          {/* Mobile burger */}
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--text)] hover:bg-[var(--surface2)] md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Меню"
          >
            <MenuIcon size={22} />
          </button>

          {/* Logo */}
          <Link
            href={`/e/${slug}/guide`}
            className="flex min-w-0 flex-1 items-center gap-2 md:flex-none"
          >
            {logoUrl ? (
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)]">
                <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : null}
            <span className="truncate font-heading text-base font-semibold text-[var(--brand)] md:text-lg">
              {title}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={`/e/${slug}/${item.href}`}
                className={navLinkClass(item.key)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop user block */}
          <div className="hidden items-center gap-3 md:flex" ref={userRef}>
            {tierBadge}
            {balanceBlock}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface2)]"
              >
                <UserIcon size={18} className="text-[var(--muted)]" />
                <span className="max-w-[120px] truncate">{visitor.name}</span>
                <ChevronDownIcon size={16} className="text-[var(--subtle)]" />
              </button>
              {userOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
                >
                  <Link
                    href={`/e/${slug}/guide/profile`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--surface2)]"
                    onClick={() => setUserOpen(false)}
                  >
                    <UserIcon size={16} />
                    Профиль
                  </Link>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[var(--error)] hover:bg-[var(--surface2)]"
                  >
                    <LogoutIcon size={16} />
                    Выйти
                  </button>
                </motion.div>
              ) : null}
            </div>
          </div>

          {/* Mobile user icon */}
          <Link
            href={`/e/${slug}/guide/profile`}
            className="rounded-lg p-2 text-[var(--text)] hover:bg-[var(--surface2)] md:hidden"
            aria-label="Профиль"
          >
            <UserIcon size={22} />
          </Link>
        </div>
      </header>

      {/* Mobile bottom sheet menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-[var(--surface)] pb-8">
          <SheetHeader>
            <SheetTitle className="font-heading text-[var(--brand)]">{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4">
            <div className="flex flex-wrap items-center gap-3">
              {tierBadge}
              {balanceBlock}
            </div>
            <p className="text-sm text-[var(--muted)]">{visitor.name}</p>
            <nav className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={`/e/${slug}/${item.href}`}
                  className={cn(navLinkClass(item.key), 'text-center')}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-3 text-sm font-medium text-[var(--error)] hover:bg-[var(--surface2)]"
            >
              <LogoutIcon size={18} />
              Выйти
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
