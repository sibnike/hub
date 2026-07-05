ALTER TABLE hub.event_participations
  ALTER COLUMN tenant_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS invited_email text;

ALTER TABLE hub.event_stands
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE hub.event_participations
  DROP CONSTRAINT IF EXISTS event_participations_event_id_tenant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS event_participations_event_email_idx
  ON hub.event_participations(event_id, invited_email)
  WHERE invited_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_participations_event_tenant_idx
  ON hub.event_participations(event_id, tenant_id)
  WHERE tenant_id IS NOT NULL;

-- Организатор управляет участниками своих событий
DROP POLICY IF EXISTS "organizer_participations" ON hub.event_participations;
CREATE POLICY "organizer_participations" ON hub.event_participations
  FOR ALL USING (
    event_id IN (
      SELECT id FROM hub.events WHERE organizer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

-- Участник подтверждает pending-запись
DROP POLICY IF EXISTS "exhibitor_confirm_participation" ON hub.event_participations;
CREATE POLICY "exhibitor_confirm_participation" ON hub.event_participations
  FOR UPDATE USING (
    status = 'pending' AND tenant_id IS NULL
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

-- Чтение pending для join по коду (только авторизованные)
DROP POLICY IF EXISTS "exhibitor_read_pending" ON hub.event_participations;
CREATE POLICY "exhibitor_read_pending" ON hub.event_participations
  FOR SELECT USING (
    status = 'pending' AND tenant_id IS NULL
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "organizer_stands" ON hub.event_stands;
CREATE POLICY "organizer_stands" ON hub.event_stands
  FOR ALL USING (
    event_id IN (
      SELECT id FROM hub.events WHERE organizer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "exhibitor_read_events" ON hub.events;
CREATE POLICY "exhibitor_read_events" ON hub.events
  FOR SELECT USING (
    id IN (
      SELECT event_id FROM hub.event_participations
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "exhibitor_read_own_participations" ON hub.event_participations;
CREATE POLICY "exhibitor_read_own_participations" ON hub.event_participations
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "exhibitor_read_own_stands" ON hub.event_stands;
CREATE POLICY "exhibitor_read_own_stands" ON hub.event_stands
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "exhibitor_update_stands" ON hub.event_stands;
CREATE POLICY "exhibitor_update_stands" ON hub.event_stands
  FOR UPDATE USING (
    participation_id IN (
      SELECT id FROM hub.event_participations
      WHERE status = 'pending' AND tenant_id IS NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );
