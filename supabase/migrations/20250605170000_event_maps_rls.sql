DROP POLICY IF EXISTS "organizer_maps" ON hub.event_maps;
CREATE POLICY "organizer_maps" ON hub.event_maps
  FOR ALL USING (
    event_id IN (
      SELECT id FROM hub.events WHERE organizer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "public_read_maps" ON hub.event_maps;
CREATE POLICY "public_read_maps" ON hub.event_maps
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM hub.events WHERE status = 'published'
    )
  );
