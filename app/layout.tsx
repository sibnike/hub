import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Exhibitor Hub',
  description: 'Yanbada Exhibitor Hub — платформа для выставок и мероприятий',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={cn('font-sans', inter.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
