-- H-M4b: marketplace membership (tenant access by application)

CREATE TABLE hub.marketplace_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id  uuid NOT NULL REFERENCES hub.marketplaces(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  requested_by    uuid,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace_id, tenant_id)
);

CREATE INDEX marketplace_members_marketplace_status_idx
  ON hub.marketplace_members (marketplace_id, status);

CREATE INDEX marketplace_members_tenant_idx
  ON hub.marketplace_members (tenant_id);

ALTER TABLE hub.marketplace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_members_select" ON hub.marketplace_members
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR public.is_tenant_admin(tenant_id)
  );

CREATE POLICY "marketplace_members_insert" ON hub.marketplace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(tenant_id)
    AND status = 'pending'
    AND (requested_by IS NULL OR requested_by = (SELECT auth.uid()))
  );

CREATE POLICY "marketplace_members_update" ON hub.marketplace_members
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "marketplace_members_delete" ON hub.marketplace_members
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT, INSERT ON hub.marketplace_members TO authenticated;
GRANT ALL ON hub.marketplace_members TO service_role;

REVOKE ALL ON hub.marketplace_members FROM anon;

NOTIFY pgrst, 'reload schema';
