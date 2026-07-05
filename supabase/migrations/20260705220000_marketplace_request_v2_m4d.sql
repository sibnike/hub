-- H-M4d: marketplace request v2 (budget, requester tenant, response channel)

ALTER TABLE hub.marketplace_requests
  ADD COLUMN IF NOT EXISTS budget_amount numeric,
  ADD COLUMN IF NOT EXISTS budget_currency text,
  ADD COLUMN IF NOT EXISTS requester_tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS marketplace_id uuid REFERENCES hub.marketplaces(id);

CREATE INDEX IF NOT EXISTS marketplace_requests_requester_idx
  ON hub.marketplace_requests (requester_tenant_id)
  WHERE requester_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketplace_requests_marketplace_idx
  ON hub.marketplace_requests (marketplace_id)
  WHERE marketplace_id IS NOT NULL;

ALTER TABLE hub.marketplace_request_targets
  ADD COLUMN IF NOT EXISTS response_status text NOT NULL DEFAULT 'pending';

ALTER TABLE hub.marketplace_request_targets
  DROP CONSTRAINT IF EXISTS marketplace_request_targets_response_status_check;

ALTER TABLE hub.marketplace_request_targets
  ADD CONSTRAINT marketplace_request_targets_response_status_check
  CHECK (response_status IN ('pending', 'accepted', 'declined', 'expired'));

-- Requester tenant admin sees own requests (M4d wizard flow)
DROP POLICY IF EXISTS "marketplace_requests_requester_tenant" ON hub.marketplace_requests;
CREATE POLICY "marketplace_requests_requester_tenant" ON hub.marketplace_requests
  FOR SELECT TO authenticated
  USING (
    requester_tenant_id IS NOT NULL
    AND public.is_tenant_admin(requester_tenant_id)
  );

-- Requester sees targets of their requests
DROP POLICY IF EXISTS "marketplace_request_targets_requester" ON hub.marketplace_request_targets;
CREATE POLICY "marketplace_request_targets_requester" ON hub.marketplace_request_targets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM hub.marketplace_requests r
      WHERE r.id = marketplace_request_targets.request_id
        AND r.requester_tenant_id IS NOT NULL
        AND public.is_tenant_admin(r.requester_tenant_id)
    )
  );

NOTIFY pgrst, 'reload schema';
