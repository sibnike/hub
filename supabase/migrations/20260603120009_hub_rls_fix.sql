-- SECURITY DEFINER helpers — break RLS recursion chains
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE user_id = auth.uid() AND tenant_id = check_tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_tenants()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tenants() TO authenticated, anon;

-- ─── hub.events ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_events" ON hub.events;
DROP POLICY IF EXISTS "exhibitor_read_events" ON hub.events;
DROP POLICY IF EXISTS "events_select" ON hub.events;
DROP POLICY IF EXISTS "events_all" ON hub.events;

CREATE POLICY "events_select" ON hub.events
  FOR SELECT USING (
    status = 'published'
    OR public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "events_insert" ON hub.events
  FOR INSERT WITH CHECK (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "events_update" ON hub.events
  FOR UPDATE USING (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "events_delete" ON hub.events
  FOR DELETE USING (
    public.is_tenant_admin(organizer_tenant_id)
    OR public.is_platform_admin()
  );

-- ─── hub.event_participations ───────────────────────────────────────────────
DROP POLICY IF EXISTS "exhibitor_participations" ON hub.event_participations;
DROP POLICY IF EXISTS "organizer_participations" ON hub.event_participations;
DROP POLICY IF EXISTS "exhibitor_confirm_participation" ON hub.event_participations;
DROP POLICY IF EXISTS "exhibitor_read_pending" ON hub.event_participations;
DROP POLICY IF EXISTS "exhibitor_read_own_participations" ON hub.event_participations;
DROP POLICY IF EXISTS "participations_all" ON hub.event_participations;

CREATE POLICY "participations_select" ON hub.event_participations
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_insert" ON hub.event_participations
  FOR INSERT WITH CHECK (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_update" ON hub.event_participations
  FOR UPDATE USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "participations_delete" ON hub.event_participations
  FOR DELETE USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_stands ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_stands" ON hub.event_stands;
DROP POLICY IF EXISTS "exhibitor_read_own_stands" ON hub.event_stands;
DROP POLICY IF EXISTS "exhibitor_update_stands" ON hub.event_stands;
DROP POLICY IF EXISTS "stands_all" ON hub.event_stands;
DROP POLICY IF EXISTS "stands_select" ON hub.event_stands;

CREATE POLICY "stands_select" ON hub.event_stands
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE e.status = 'published' OR public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "stands_modify" ON hub.event_stands
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_maps ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_maps" ON hub.event_maps;
DROP POLICY IF EXISTS "public_read_maps" ON hub.event_maps;
DROP POLICY IF EXISTS "maps_all" ON hub.event_maps;
DROP POLICY IF EXISTS "maps_select" ON hub.event_maps;

CREATE POLICY "maps_select" ON hub.event_maps
  FOR SELECT USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE e.status = 'published' OR public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "maps_modify" ON hub.event_maps
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.event_analytics ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_all" ON hub.event_analytics;

CREATE POLICY "analytics_select" ON hub.event_analytics
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

-- ─── hub.track_events ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "organizer_track_events" ON hub.track_events;
DROP POLICY IF EXISTS "exhibitor_own_track_events" ON hub.track_events;

CREATE POLICY "track_events_select" ON hub.track_events
  FOR SELECT USING (
    public.is_platform_admin()
    OR (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
    OR event_id IN (
      SELECT id FROM hub.events e
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );
