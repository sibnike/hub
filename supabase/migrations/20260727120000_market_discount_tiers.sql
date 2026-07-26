-- Market discount tiers (%): public (everyone) < silver (platform) < gold (seller's partner).
-- List price stays price_from; unit = price_from * (1 - pct/100).

-- ─── listing discounts (source: pages → listing_cache) ──────────────────────

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS market_discount_tiers jsonb NOT NULL
    DEFAULT '{"public":0,"silver":0,"gold":0}'::jsonb;

ALTER TABLE hub.listing_cache
  ADD COLUMN IF NOT EXISTS market_discount_tiers jsonb NOT NULL
    DEFAULT '{"public":0,"silver":0,"gold":0}'::jsonb;

COMMENT ON COLUMN public.pages.market_discount_tiers IS
  'TourHub: {public,silver,gold} discount percents 0..100; public is lowest, shown on market by default';
COMMENT ON COLUMN hub.listing_cache.market_discount_tiers IS
  'Synced from pages.market_discount_tiers';

-- ─── Silver: platform-assigned buyer tier (marketplace-wide) ───────────────

ALTER TABLE hub.marketplace_members
  ADD COLUMN IF NOT EXISTS partner_tier text NOT NULL DEFAULT 'public';

ALTER TABLE hub.marketplace_members
  DROP CONSTRAINT IF EXISTS marketplace_members_partner_tier_check;

ALTER TABLE hub.marketplace_members
  ADD CONSTRAINT marketplace_members_partner_tier_check
  CHECK (partner_tier IN ('public', 'silver'));

COMMENT ON COLUMN hub.marketplace_members.partner_tier IS
  'public | silver — silver set by platform admin; gold is per-seller via partner_links';

-- ─── Gold: seller assigns their partner (highest discount) ─────────────────

CREATE TABLE IF NOT EXISTS hub.marketplace_partner_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id    uuid NOT NULL REFERENCES hub.marketplaces(id) ON DELETE CASCADE,
  seller_tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  buyer_tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked')),
  note              text,
  assigned_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace_id, seller_tenant_id, buyer_tenant_id),
  CHECK (seller_tenant_id <> buyer_tenant_id)
);

CREATE INDEX IF NOT EXISTS marketplace_partner_links_seller_idx
  ON hub.marketplace_partner_links (seller_tenant_id, marketplace_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS marketplace_partner_links_buyer_idx
  ON hub.marketplace_partner_links (buyer_tenant_id, marketplace_id)
  WHERE status = 'active';

ALTER TABLE hub.marketplace_partner_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_partner_links_select" ON hub.marketplace_partner_links;
CREATE POLICY "marketplace_partner_links_select" ON hub.marketplace_partner_links
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(seller_tenant_id)
    OR public.is_tenant_admin(buyer_tenant_id)
  );

DROP POLICY IF EXISTS "marketplace_partner_links_write" ON hub.marketplace_partner_links;
CREATE POLICY "marketplace_partner_links_write" ON hub.marketplace_partner_links
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(seller_tenant_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_tenant_admin(seller_tenant_id)
  );

GRANT SELECT, INSERT, UPDATE ON hub.marketplace_partner_links TO authenticated;
GRANT ALL ON hub.marketplace_partner_links TO service_role;
REVOKE ALL ON hub.marketplace_partner_links FROM anon;

NOTIFY pgrst, 'reload schema';
