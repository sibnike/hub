/** TourHub market: three discount percents off list price (price_from). */

export type MarketPartnerTier = 'public' | 'silver' | 'gold'

export type MarketDiscountTiers = {
  public: number
  silver: number
  gold: number
}

export const EMPTY_DISCOUNT_TIERS: MarketDiscountTiers = {
  public: 0,
  silver: 0,
  gold: 0,
}

function clampPct(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, Math.round(v)))
}

export function normalizeMarketDiscountTiers(
  input: Partial<MarketDiscountTiers> | null | undefined
): MarketDiscountTiers {
  let publicPct = clampPct(input?.public)
  let silverPct = clampPct(input?.silver)
  let goldPct = clampPct(input?.gold)

  if (silverPct < publicPct) silverPct = publicPct
  if (goldPct < silverPct) goldPct = silverPct

  return { public: publicPct, silver: silverPct, gold: goldPct }
}

export function parseMarketDiscountTiers(raw: unknown): MarketDiscountTiers {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_DISCOUNT_TIERS }
  const o = raw as Record<string, unknown>
  return normalizeMarketDiscountTiers({
    public: o.public as number,
    silver: o.silver as number,
    gold: o.gold as number,
  })
}

export function discountPctForTier(
  tiers: MarketDiscountTiers,
  tier: MarketPartnerTier
): number {
  return tiers[tier] ?? tiers.public
}

export function applyDiscountPct(listPrice: number, discountPct: number): number {
  if (!Number.isFinite(listPrice) || listPrice <= 0) return 0
  const pct = clampPct(discountPct)
  return Math.round(listPrice * (1 - pct / 100))
}

export function resolvePartnerTier(opts: {
  hasGoldLink: boolean
  memberTier: MarketPartnerTier | null | undefined
}): MarketPartnerTier {
  if (opts.hasGoldLink) return 'gold'
  if (opts.memberTier === 'silver') return 'silver'
  return 'public'
}
