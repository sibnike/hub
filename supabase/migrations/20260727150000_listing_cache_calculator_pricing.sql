-- Calculator pricing snapshot for TourHub qty-based totals (group/discount tiers).

ALTER TABLE hub.listing_cache
  ADD COLUMN IF NOT EXISTS calculator_pricing jsonb;

NOTIFY pgrst, 'reload schema';
