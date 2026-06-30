-- Marketplace request routing (Mechanic 3a): external applicant requests

CREATE TABLE hub.marketplace_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name    text NOT NULL,
  requester_contact text NOT NULL,
  request_text      text NOT NULL,
  ai_parsed         jsonb,
  access_token      text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status            text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hub.marketplace_request_targets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            uuid NOT NULL REFERENCES hub.marketplace_requests(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id),
  vitrina_submission_id uuid,
  status                text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'viewed', 'responded', 'declined', 'selected')),
  proposed_price        numeric,
  response_message      text,
  responded_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, tenant_id)
);

CREATE INDEX marketplace_requests_status_idx ON hub.marketplace_requests (status);
CREATE INDEX marketplace_requests_created_idx ON hub.marketplace_requests (created_at DESC);
CREATE UNIQUE INDEX marketplace_requests_access_token_uidx ON hub.marketplace_requests (access_token);
CREATE INDEX marketplace_request_targets_request_idx ON hub.marketplace_request_targets (request_id);
CREATE INDEX marketplace_request_targets_tenant_idx ON hub.marketplace_request_targets (tenant_id);

ALTER TABLE hub.marketplace_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.marketplace_request_targets ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "marketplace_requests_requester_token" ON hub.marketplace_requests
  FOR SELECT TO anon, authenticated
  USING (
    access_token IS NOT NULL
    AND access_token = coalesce(
      nullif(current_setting('request.headers', true)::json->>'x-marketplace-request-token', ''),
      nullif(current_setting('request.headers', true)::json->>'X-Marketplace-Request-Token', '')
    )
  );

CREATE POLICY "marketplace_request_targets_tenant_admin" ON hub.marketplace_request_targets
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(tenant_id)
  );

GRANT ALL ON hub.marketplace_requests TO service_role;
GRANT ALL ON hub.marketplace_request_targets TO service_role;
GRANT SELECT ON hub.marketplace_requests TO authenticated;
GRANT SELECT ON hub.marketplace_request_targets TO authenticated;
GRANT SELECT ON hub.marketplace_requests TO anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_request_targets FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
