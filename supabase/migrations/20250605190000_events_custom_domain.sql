CREATE UNIQUE INDEX IF NOT EXISTS events_custom_domain_idx
  ON hub.events ((settings->>'custom_domain'))
  WHERE (settings->>'custom_domain') IS NOT NULL
  AND (settings->>'custom_domain') <> '';
