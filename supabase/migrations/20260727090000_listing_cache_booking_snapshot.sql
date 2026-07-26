-- Snapshot of booking availability for TourHub market cards / calendar.
-- Computed in Vitrina on listing sync (nearest date + horizon slots).

ALTER TABLE hub.listing_cache
  ADD COLUMN IF NOT EXISTS market_booking_mode text
    CHECK (market_booking_mode IS NULL OR market_booking_mode IN ('seats', 'slots')),
  ADD COLUMN IF NOT EXISTS next_departure_date date,
  ADD COLUMN IF NOT EXISTS seats_total integer,
  ADD COLUMN IF NOT EXISTS seats_left integer,
  ADD COLUMN IF NOT EXISTS available_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_config_id uuid,
  ADD COLUMN IF NOT EXISTS availability_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS listing_cache_next_departure_date_idx
  ON hub.listing_cache (next_departure_date)
  WHERE next_departure_date IS NOT NULL;

NOTIFY pgrst, 'reload schema';
