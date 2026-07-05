CREATE TABLE IF NOT EXISTS hub.track_events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tenant_id    uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN (
                 'profile_view', 'stand_view', 'qr_scan',
                 'catalog_view', 'map_view', 'save', 'form_submit'
               )),
  source       text,
  session_id   text,
  user_agent   text,
  ts           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS track_events_event_ts_idx ON hub.track_events(event_id, ts);
CREATE INDEX IF NOT EXISTS track_events_event_tenant_ts_idx ON hub.track_events(event_id, tenant_id, ts);
CREATE INDEX IF NOT EXISTS track_events_event_type_ts_idx ON hub.track_events(event_id, type, ts);

ALTER TABLE hub.track_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizer_track_events" ON hub.track_events;
CREATE POLICY "organizer_track_events" ON hub.track_events
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM hub.events WHERE organizer_tenant_id IN (
        SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "exhibitor_own_track_events" ON hub.track_events;
CREATE POLICY "exhibitor_own_track_events" ON hub.track_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );
