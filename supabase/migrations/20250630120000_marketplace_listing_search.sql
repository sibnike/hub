-- Marketplace listing search (Mechanic 2): per-page denormalized cache + FTS

CREATE TABLE hub.listing_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_slug     text NOT NULL,
  title         jsonb NOT NULL DEFAULT '{}'::jsonb,
  short_text    jsonb NOT NULL DEFAULT '{}'::jsonb,
  categories    text[] NOT NULL DEFAULT '{}',
  search_vector tsvector,
  synced_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, page_slug)
);

CREATE INDEX listing_cache_tenant_idx ON hub.listing_cache (tenant_id);
CREATE INDEX listing_cache_search_idx ON hub.listing_cache USING GIN (search_vector);
CREATE INDEX listing_cache_categories_idx ON hub.listing_cache USING GIN (categories);

CREATE OR REPLACE FUNCTION hub.listing_cache_build_search_vector(
  p_title jsonb,
  p_short_text jsonb,
  p_categories text[]
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_tsvector(
    'russian',
    coalesce(
      (
        SELECT string_agg(value, ' ')
        FROM jsonb_each_text(coalesce(p_title, '{}'::jsonb))
      ),
      ''
    ) || ' ' ||
    coalesce(
      (
        SELECT string_agg(value, ' ')
        FROM jsonb_each_text(coalesce(p_short_text, '{}'::jsonb))
      ),
      ''
    ) || ' ' ||
    coalesce(array_to_string(p_categories, ' '), '')
  );
$$;

CREATE OR REPLACE FUNCTION hub.listing_cache_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := hub.listing_cache_build_search_vector(
    NEW.title,
    NEW.short_text,
    NEW.categories
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_cache_search_vector_trg
  BEFORE INSERT OR UPDATE OF title, short_text, categories
  ON hub.listing_cache
  FOR EACH ROW
  EXECUTE FUNCTION hub.listing_cache_search_vector_trigger();

ALTER TABLE hub.listing_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_cache_read" ON hub.listing_cache
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION hub.search_listing_cache(
  p_keywords text DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  page_slug text,
  title jsonb,
  short_text jsonb,
  categories text[],
  synced_at timestamptz,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hub, public
AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_keywords IS NOT NULL AND btrim(p_keywords) <> '' THEN
    v_query := plainto_tsquery('russian', p_keywords);
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.tenant_id,
    l.page_slug,
    l.title,
    l.short_text,
    l.categories,
    l.synced_at,
    CASE
      WHEN v_query IS NOT NULL THEN ts_rank(l.search_vector, v_query)
      ELSE 0::real
    END AS rank
  FROM hub.listing_cache l
  WHERE
    (
      v_query IS NULL
      OR l.search_vector @@ v_query
    )
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR l.categories && p_categories
    )
    AND (
      p_tenant_id IS NULL
      OR l.tenant_id = p_tenant_id
    )
  ORDER BY rank DESC, l.synced_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION hub.search_listing_cache TO service_role;

GRANT ALL ON hub.listing_cache TO service_role;
GRANT SELECT ON hub.listing_cache TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
