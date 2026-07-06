'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type MarketplaceAdminNavProps = {
  slug: string
  marketplaceName: string
}

const TABS = [
  { segment: 'members', label: 'Заявки' },
  { segment: 'presets', label: 'Пресеты' },
  { segment: 'branding', label: 'Брендинг' },
] as const

export function MarketplaceAdminNav({ slug, marketplaceName }: MarketplaceAdminNavProps) {
  const pathname = usePathname()
  const base = `/admin/marketplace/${slug}`

  return (
    <div className="mb-6 border-b border-border pb-4">
      <Link href="/marketplace" className="text-sm text-[var(--muted)] hover:text-foreground">
        Yanbada Marketplace
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{marketplaceName}</h1>
      <nav className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const href = `${base}/${tab.segment}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={tab.segment}
              href={href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-[var(--muted)] hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
