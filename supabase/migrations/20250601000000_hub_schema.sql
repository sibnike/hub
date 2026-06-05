-- Создаём схему hub
CREATE SCHEMA IF NOT EXISTS hub;

-- Мероприятия
CREATE TABLE hub.events (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug                  text NOT NULL UNIQUE,
  name                  jsonb NOT NULL DEFAULT '{}',
  dates                 daterange,
  location              jsonb DEFAULT '{}',
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  settings              jsonb DEFAULT '{}',
  access_code_salt      text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Участие компании в мероприятии
CREATE TABLE hub.event_participations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_code   text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  joined_at     timestamptz,
  manager_ids   uuid[] DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  UNIQUE(event_id, tenant_id)
);

-- Стенды
CREATE TABLE hub.event_stands (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participation_id   uuid NOT NULL REFERENCES hub.event_participations(id) ON DELETE CASCADE,
  event_id           uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stand_number       text,
  pavilion           text,
  floor              int DEFAULT 1,
  map_x              float DEFAULT 0,
  map_y              float DEFAULT 0,
  map_width          float DEFAULT 5,
  map_height         float DEFAULT 5,
  created_at         timestamptz DEFAULT now()
);

-- Карты павильонов
CREATE TABLE hub.event_maps (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id     uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  pavilion     text NOT NULL DEFAULT 'main',
  floor        int DEFAULT 1,
  svg_content  text,
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Аналитика (агрегаты по дням)
CREATE TABLE hub.event_analytics (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id        uuid NOT NULL REFERENCES hub.events(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  profile_views   int DEFAULT 0,
  stand_views     int DEFAULT 0,
  qr_scans        int DEFAULT 0,
  form_submits    int DEFAULT 0,
  saves           int DEFAULT 0,
  UNIQUE(event_id, tenant_id, date)
);

-- Кэш данных компании из Vitrina (только для чтения в Hub)
CREATE TABLE hub.company_cache (
  tenant_id           uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                text,
  logo_url            text,
  short_description   jsonb DEFAULT '{}',
  categories          text[] DEFAULT '{}',
  tags                text[] DEFAULT '{}',
  country             text,
  website             text,
  social_links        jsonb DEFAULT '{}',
  contact_persons     jsonb[] DEFAULT '{}',
  vitrina_page_slug   text,
  synced_at           timestamptz DEFAULT now()
);

-- Индексы
CREATE INDEX ON hub.events(organizer_tenant_id);
CREATE INDEX ON hub.events(status);
CREATE INDEX ON hub.event_participations(event_id);
CREATE INDEX ON hub.event_participations(tenant_id);
CREATE INDEX ON hub.event_stands(event_id);
CREATE INDEX ON hub.event_stands(tenant_id);
CREATE INDEX ON hub.event_analytics(event_id, date);
CREATE INDEX ON hub.company_cache USING GIN(categories);
CREATE INDEX ON hub.company_cache USING GIN(tags);

-- RLS
ALTER TABLE hub.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.event_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub.company_cache ENABLE ROW LEVEL SECURITY;

-- Политики: организатор видит свои события
CREATE POLICY "organizer_events" ON hub.events
  FOR ALL USING (
    organizer_tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

-- Политики: участник видит события где он участвует
CREATE POLICY "exhibitor_participations" ON hub.event_participations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_admins WHERE user_id = auth.uid()
    )
  );

-- company_cache: только service-role пишет, все авторизованные читают
CREATE POLICY "cache_read" ON hub.company_cache
  FOR SELECT USING (true);
