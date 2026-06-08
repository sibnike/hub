-- Visitor Guide (H-9): tiers, invitations, visitors, favorites, polls

CREATE TABLE hub.event_visitor_tiers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  name            jsonb NOT NULL,
  description     jsonb,
  color           text,
  welcome_bonus   int DEFAULT 0,
  is_default      boolean DEFAULT false,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (event_id, slug)
);

CREATE TABLE hub.event_invitations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tier_id         uuid REFERENCES hub.event_visitor_tiers(id) ON DELETE SET NULL,
  invite_token    text UNIQUE NOT NULL,
  name            text,
  uses_count      int DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX event_invitations_invite_token_idx ON hub.event_invitations(invite_token);
CREATE INDEX event_invitations_event_id_idx ON hub.event_invitations(event_id);

CREATE TABLE hub.event_visitors (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tier_id         uuid REFERENCES hub.event_visitor_tiers(id),
  invitation_id   uuid REFERENCES hub.event_invitations(id),

  email           text NOT NULL,
  name            text NOT NULL,
  phone           text,
  country         text,
  city            text,
  language        text DEFAULT 'ru',

  session_token   text UNIQUE NOT NULL,
  email_confirmed boolean DEFAULT false,
  confirm_token   text,

  bonus_balance   int DEFAULT 0,

  created_at      timestamptz DEFAULT now(),
  last_visit_at   timestamptz,

  UNIQUE (event_id, email)
);

CREATE INDEX event_visitors_session_token_idx ON hub.event_visitors(session_token);
CREATE INDEX event_visitors_event_email_idx ON hub.event_visitors(event_id, email);

CREATE TABLE hub.event_visitor_favorites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status          text DEFAULT 'planned'
                    CHECK (status IN ('planned', 'met', 'skipped')),
  note            text,
  saved_at        timestamptz DEFAULT now(),
  met_at          timestamptz,

  UNIQUE (visitor_id, tenant_id)
);

CREATE TABLE hub.event_polls (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  question        jsonb NOT NULL,
  options         jsonb NOT NULL,
  type            text NOT NULL CHECK (type IN ('single', 'multi')),
  bonus_reward    int DEFAULT 0,
  is_active       boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE hub.event_poll_answers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id         uuid NOT NULL REFERENCES hub.event_polls(id) ON DELETE CASCADE,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  selected_option_ids text[] NOT NULL,
  answered_at     timestamptz DEFAULT now(),

  UNIQUE (poll_id, visitor_id)
);

CREATE TABLE hub.event_visitor_bonus_log (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id      uuid NOT NULL REFERENCES hub.event_visitors(id) ON DELETE CASCADE,
  amount          int NOT NULL,
  reason          text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE hub.event_visitor_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitor_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_poll_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_visitor_bonus_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiers_organizer" ON hub.event_visitor_tiers
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "invitations_organizer" ON hub.event_invitations
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "visitors_organizer" ON hub.event_visitors
  FOR SELECT USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "visitors_organizer_update" ON hub.event_visitors
  FOR UPDATE USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "visitors_organizer_delete" ON hub.event_visitors
  FOR DELETE USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "favorites_organizer" ON hub.event_visitor_favorites
  FOR SELECT USING (
    public.is_platform_admin()
    OR visitor_id IN (
      SELECT v.id FROM hub.event_visitors v
      JOIN hub.events e ON e.id = v.event_id
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

CREATE POLICY "polls_read" ON hub.event_polls
  FOR SELECT USING (true);

CREATE POLICY "polls_organizer" ON hub.event_polls
  FOR ALL USING (
    public.is_platform_admin()
    OR event_id IN (SELECT id FROM hub.events e WHERE public.is_tenant_admin(e.organizer_tenant_id))
  );

CREATE POLICY "poll_answers_organizer" ON hub.event_poll_answers
  FOR SELECT USING (
    public.is_platform_admin()
    OR poll_id IN (
      SELECT p.id FROM hub.event_polls p
      JOIN hub.events e ON e.id = p.event_id
      WHERE public.is_tenant_admin(e.organizer_tenant_id)
    )
  );

GRANT ALL ON hub.event_visitor_tiers TO service_role;
GRANT ALL ON hub.event_invitations TO service_role;
GRANT ALL ON hub.event_visitors TO service_role;
GRANT ALL ON hub.event_visitor_favorites TO service_role;
GRANT ALL ON hub.event_polls TO service_role;
GRANT ALL ON hub.event_poll_answers TO service_role;
GRANT ALL ON hub.event_visitor_bonus_log TO service_role;

GRANT SELECT ON hub.event_visitor_tiers TO anon, authenticated;
GRANT SELECT ON hub.event_invitations TO anon, authenticated;
GRANT SELECT ON hub.event_visitors TO anon, authenticated;
GRANT SELECT ON hub.event_visitor_favorites TO anon, authenticated;
GRANT SELECT ON hub.event_polls TO anon, authenticated;
GRANT SELECT ON hub.event_poll_answers TO anon, authenticated;
GRANT SELECT ON hub.event_visitor_bonus_log TO anon, authenticated;
