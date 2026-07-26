-- Multi-market channels + gated seller access (TourHub)
-- Themes remain taxonomy; sellers + page.marketplace_slugs control visibility.

-- ─── hub.marketplaces.access_policy ────────────────────────────────────────

ALTER TABLE hub.marketplaces
  ADD COLUMN IF NOT EXISTS access_policy text NOT NULL DEFAULT 'gated';

ALTER TABLE hub.marketplaces
  DROP CONSTRAINT IF EXISTS marketplaces_access_policy_check;

ALTER TABLE hub.marketplaces
  ADD CONSTRAINT marketplaces_access_policy_check
  CHECK (access_policy IN ('open', 'gated'));

-- TourHub B2C is always gated (request → profile review → approve).
-- B2B `tourism` uses marketplace_members (buyers); sellers table is for channel visibility.
UPDATE hub.marketplaces SET access_policy = 'gated' WHERE slug = 'tourhub';
-- ─── hub.marketplace_sellers (seller ≠ buyer members) ────────────────────

CREATE TABLE IF NOT EXISTS hub.marketplace_sellers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id  uuid NOT NULL REFERENCES hub.marketplaces(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  note            text,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS marketplace_sellers_marketplace_status_idx
  ON hub.marketplace_sellers (marketplace_id, status);

CREATE INDEX IF NOT EXISTS marketplace_sellers_tenant_idx
  ON hub.marketplace_sellers (tenant_id);

ALTER TABLE hub.marketplace_sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_sellers_select" ON hub.marketplace_sellers;
CREATE POLICY "marketplace_sellers_select" ON hub.marketplace_sellers
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS "marketplace_sellers_insert" ON hub.marketplace_sellers;
CREATE POLICY "marketplace_sellers_insert" ON hub.marketplace_sellers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "marketplace_sellers_update" ON hub.marketplace_sellers;
CREATE POLICY "marketplace_sellers_update" ON hub.marketplace_sellers
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT, INSERT ON hub.marketplace_sellers TO authenticated;
GRANT ALL ON hub.marketplace_sellers TO service_role;
REVOKE ALL ON hub.marketplace_sellers FROM anon;

-- ─── page / listing channel slugs ──────────────────────────────────────────

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS marketplace_slugs text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS pages_marketplace_slugs_idx
  ON public.pages USING GIN (marketplace_slugs);

ALTER TABLE hub.listing_cache
  ADD COLUMN IF NOT EXISTS marketplace_slugs text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS listing_cache_marketplace_slugs_idx
  ON hub.listing_cache USING GIN (marketplace_slugs);

NOTIFY pgrst, 'reload schema';
