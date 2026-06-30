-- Writes only via service_role (Hub API); clients read through RLS policies only

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_requests FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON hub.marketplace_request_targets FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
