import {
  Cormorant_Garamond,
  DM_Sans,
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' })
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
})
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-playfair',
})

export type FontPairSlug = 'modern' | 'editorial' | 'premium' | 'tech' | 'bold'

export const FONT_PAIR_OPTIONS: {
  slug: FontPairSlug
  label: string
  description: string
}[] = [
  { slug: 'modern', label: 'Modern', description: 'Inter — универсальный технологичный' },
  { slug: 'editorial', label: 'Editorial', description: 'Cormorant + Inter — элегантный' },
  { slug: 'premium', label: 'Premium', description: 'Playfair + Manrope — премиальный' },
  { slug: 'tech', label: 'Tech', description: 'Space Grotesk + DM Sans — IT-конференция' },
  { slug: 'bold', label: 'Bold', description: 'Jakarta + Inter — современный бренд' },
]

const PAIR_VARS: Record<FontPairSlug, { heading: string; body: string }> = {
  modern: { heading: 'var(--font-inter)', body: 'var(--font-inter)' },
  editorial: { heading: 'var(--font-cormorant)', body: 'var(--font-inter)' },
  premium: { heading: 'var(--font-playfair)', body: 'var(--font-manrope)' },
  tech: { heading: 'var(--font-space-grotesk)', body: 'var(--font-dm-sans)' },
  bold: { heading: 'var(--font-jakarta)', body: 'var(--font-inter)' },
}

export const ALL_FONT_CLASS_NAMES = [
  inter.variable,
  manrope.variable,
  jakarta.variable,
  dmSans.variable,
  spaceGrotesk.variable,
  cormorant.variable,
  playfair.variable,
].join(' ')

export function getFontPairStyle(slug?: string): React.CSSProperties {
  const key = (slug as FontPairSlug) in PAIR_VARS ? (slug as FontPairSlug) : 'modern'
  const pair = PAIR_VARS[key]
  return {
    '--font-heading': pair.heading,
    '--font-body': pair.body,
  } as React.CSSProperties
}
