-- P0+P1: RLS-aligned indexes + marketplace token InitPlan fix
-- Low risk / high gain: small tables, CREATE INDEX IF NOT EXISTS (no CONCURRENTLY —
-- Supabase migrations run in a transaction).

-- ─── P0: hub FK filters used by RLS (event_id) ─────────────────────────────

CREATE INDEX IF NOT EXISTS event_maps_event_id_idx
  ON hub.event_maps (event_id);

CREATE INDEX IF NOT EXISTS event_polls_event_id_idx
  ON hub.event_polls (event_id);

-- ─── P1: photo_bank active / stock list paths ───────────────────────────────

CREATE INDEX IF NOT EXISTS photo_bank_assets_active_tenant_sort_idx
  ON public.photo_bank_assets (tenant_id, sort_order, title)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS photo_bank_assets_stock_active_sort_idx
  ON public.photo_bank_assets (sort_order, title)
  WHERE tenant_id IS NULL AND is_active = true;

-- ─── P1: B2C / public list hot-paths (active rows only) ─────────────────────

CREATE INDEX IF NOT EXISTS page_blocks_page_active_sort_idx
  ON public.page_blocks (page_id, sort_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS catalog_items_block_available_sort_idx
  ON public.catalog_items (block_id, sort_order)
  WHERE is_active = true AND availability_status = 'available';

-- ─── P1: marketplace requester token — evaluate headers once (InitPlan) ────

DROP POLICY IF EXISTS "marketplace_requests_requester_token" ON hub.marketplace_requests;
CREATE POLICY "marketplace_requests_requester_token" ON hub.marketplace_requests
  FOR SELECT TO anon, authenticated
  USING (
    access_token IS NOT NULL
    AND access_token = (
      SELECT coalesce(
        nullif(current_setting('request.headers', true)::json->>'x-marketplace-request-token', ''),
        nullif(current_setting('request.headers', true)::json->>'X-Marketplace-Request-Token', '')
      )
    )
  );

NOTIFY pgrst, 'reload schema';
