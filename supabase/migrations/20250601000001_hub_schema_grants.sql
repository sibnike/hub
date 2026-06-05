-- Expose hub schema to PostgREST and grant roles
GRANT USAGE ON SCHEMA hub TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA hub TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA hub TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA hub GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA hub GRANT SELECT ON TABLES TO anon, authenticated;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, hub';
NOTIFY pgrst, 'reload schema';
