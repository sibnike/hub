-- Mirror: pages.service_locations → hub.listing_cache service_* columns

ALTER TABLE hub.listing_cache
  ADD COLUMN IF NOT EXISTS service_country_code text,
  ADD COLUMN IF NOT EXISTS service_scope text,
  ADD COLUMN IF NOT EXISTS service_city_codes text[] NOT NULL DEFAULT '{}';

ALTER TABLE hub.listing_cache
  DROP CONSTRAINT IF EXISTS listing_cache_service_scope_check;

ALTER TABLE hub.listing_cache
  ADD CONSTRAINT listing_cache_service_scope_check
  CHECK (service_scope IS NULL OR service_scope IN ('country', 'cities'));

NOTIFY pgrst, 'reload schema';
