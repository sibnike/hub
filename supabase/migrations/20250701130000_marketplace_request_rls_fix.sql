-- Close open RLS on marketplace request tables (PII / commercial terms leak)

ALTER TABLE hub.marketplace_requests
  ADD COLUMN IF NOT EXISTS access_token text;

UPDATE hub.marketplace_requests
SET access_token = encode(gen_random_bytes(24), 'hex')
WHERE access_token IS NULL;

ALTER TABLE hub.marketplace_requests
  ALTER COLUMN access_token SET NOT NULL,
  ALTER COLUMN access_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_requests_access_token_uidx
  ON hub.marketplace_requests (access_token);

DROP POLICY IF EXISTS "marketplace_requests_read" ON hub.marketplace_requests;
DROP POLICY IF EXISTS "marketplace_request_targets_read" ON hub.marketplace_request_targets;

REVOKE SELECT ON hub.marketplace_requests FROM anon, authenticated;
REVOKE SELECT ON hub.marketplace_request_targets FROM anon, authenticated;

-- Targeted tenant admin (or platform admin) may read the parent request
CREATE POLICY "marketplace_requests_tenant_admin" ON hub.marketplace_requests
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM hub.marketplace_request_targets t
      WHERE t.request_id = marketplace_requests.id
        AND public.is_tenant_admin(t.tenant_id)
    )
  );

-- Requester may read only their own row via secret token header (future status UI)
CREATE POLICY "marketplace_requests_requester_token" ON hub.marketplace_requests
  FOR SELECT TO anon, authenticated
  USING (
    access_token IS NOT NULL
    AND access_token = coalesce(
      nullif(current_setting('request.headers', true)::json->>'x-marketplace-request-token', ''),
      nullif(current_setting('request.headers', true)::json->>'X-Marketplace-Request-Token', '')
    )
  );

-- Tenant admin sees only targets addressed to their tenant
CREATE POLICY "marketplace_request_targets_tenant_admin" ON hub.marketplace_request_targets
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(tenant_id)
  );

GRANT SELECT ON hub.marketplace_requests TO authenticated;
GRANT SELECT ON hub.marketplace_request_targets TO authenticated;
GRANT SELECT ON hub.marketplace_requests TO anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_request_targets FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
