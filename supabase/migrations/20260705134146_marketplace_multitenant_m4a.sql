-- H-M4a: multitenant marketplaces + theme/price fields in caches

CREATE TABLE hub.marketplaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          jsonb NOT NULL,
  description   jsonb,
  theme_slugs   text[] NOT NULL DEFAULT '{}',
  settings      jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hub.company_cache
  ADD COLUMN marketplace_themes text[] NOT NULL DEFAULT '{}';

ALTER TABLE hub.listing_cache
  ADD COLUMN marketplace_themes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN price_from numeric,
  ADD COLUMN price_currency text;

CREATE INDEX company_cache_marketplace_themes_idx
  ON hub.company_cache USING GIN (marketplace_themes);

CREATE INDEX listing_cache_marketplace_themes_idx
  ON hub.listing_cache USING GIN (marketplace_themes);

ALTER TABLE hub.marketplaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplaces_select" ON hub.marketplaces
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "marketplaces_admin_write" ON hub.marketplaces
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT ON hub.marketplaces TO authenticated;
GRANT ALL ON hub.marketplaces TO service_role;

INSERT INTO hub.marketplaces (slug, name, description, theme_slugs)
VALUES (
  'tourism',
  '{"ru": "Туристический маркетплейс", "en": "Tourism Marketplace"}'::jsonb,
  '{"ru": "B2B-маркетплейс для туроператоров: гиды, экскурсии, транспорт, размещение и питание.", "en": "B2B marketplace for tour operators: guides, tours, transport, accommodation and food."}'::jsonb,
  ARRAY['transport', 'accommodation', 'tourism', 'guides', 'food']
);

NOTIFY pgrst, 'reload schema';
