-- Mirror: hub.company_cache public profile fields + TourHub marketplace (shared DB with vitrina)

alter table hub.company_cache
  add column if not exists logo_dark_url text,
  add column if not exists cover_photo_url text,
  add column if not exists gallery jsonb not null default '[]',
  add column if not exists video jsonb not null default '{}',
  add column if not exists about jsonb not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists coverage_cities jsonb not null default '[]',
  add column if not exists license jsonb,
  add column if not exists tourism_business_role text,
  add column if not exists founding_year int,
  add column if not exists employee_count int,
  add column if not exists legal_entity_type text,
  add column if not exists registration_number text,
  add column if not exists legal_name text;

insert into hub.marketplaces (slug, name, description, theme_slugs, is_active)
values (
  'tourhub',
  '{"ru": "TourHub", "en": "TourHub"}'::jsonb,
  '{"ru": "Публичная B2C-витрина экскурсий и услуг", "en": "Public B2C marketplace for tours and services"}'::jsonb,
  array['transport', 'accommodation', 'tourism', 'guides', 'food'],
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  theme_slugs = excluded.theme_slugs,
  is_active = excluded.is_active;

NOTIFY pgrst, 'reload schema';
