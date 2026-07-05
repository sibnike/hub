-- LOCAL ONLY — не в supabase/migrations/, не участвует в `supabase db push --linked`.
-- Минимальные public-зависимости для hub-миграций при `npm run db:reset:local`.
-- Prod: public.* создаёт Vitrina (phase1_schema и др.), Hub в public не пишет.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenants (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.tenant_admins (
  user_id   uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.tenants TO anon, authenticated, service_role;
