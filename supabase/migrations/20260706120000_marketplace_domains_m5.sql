-- H-M5.3: marketplace subdomain + custom_domain columns

ALTER TABLE hub.marketplaces
  ADD COLUMN subdomain text,
  ADD COLUMN custom_domain text;

CREATE UNIQUE INDEX marketplaces_subdomain_key
  ON hub.marketplaces (subdomain) WHERE subdomain IS NOT NULL;

CREATE UNIQUE INDEX marketplaces_custom_domain_key
  ON hub.marketplaces (custom_domain) WHERE custom_domain IS NOT NULL;

UPDATE hub.marketplaces SET subdomain = 'tourism' WHERE slug = 'tourism';

NOTIFY pgrst, 'reload schema';
