-- Marketplace tenant search: city + FTS search_vector on company_cache

ALTER TABLE hub.company_cache
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE hub.company_cache
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION hub.company_cache_build_search_vector(
  p_name text,
  p_short_description jsonb,
  p_categories text[],
  p_tags text[],
  p_country text,
  p_city text
) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_tsvector(
    'russian',
    coalesce(p_name, '') || ' ' ||
    coalesce(
      (
        SELECT string_agg(value, ' ')
        FROM jsonb_each_text(coalesce(p_short_description, '{}'::jsonb))
      ),
      ''
    ) || ' ' ||
    coalesce(array_to_string(p_categories, ' '), '') || ' ' ||
    coalesce(array_to_string(p_tags, ' '), '') || ' ' ||
    coalesce(p_country, '') || ' ' ||
    coalesce(p_city, '')
  );
$$;

CREATE OR REPLACE FUNCTION hub.company_cache_search_vector_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := hub.company_cache_build_search_vector(
    NEW.name,
    NEW.short_description,
    NEW.categories,
    NEW.tags,
    NEW.country,
    NEW.city
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_cache_search_vector_trg ON hub.company_cache;

CREATE TRIGGER company_cache_search_vector_trg
  BEFORE INSERT OR UPDATE OF name, short_description, categories, tags, country, city
  ON hub.company_cache
  FOR EACH ROW
  EXECUTE FUNCTION hub.company_cache_search_vector_trigger();

UPDATE hub.company_cache
SET name = name
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS company_cache_search_vector_idx
  ON hub.company_cache USING GIN (search_vector);

CREATE OR REPLACE FUNCTION hub.search_company_cache(
  p_keywords text DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  tenant_id uuid,
  name text,
  logo_url text,
  short_description jsonb,
  categories text[],
  tags text[],
  country text,
  city text,
  website text,
  social_links jsonb,
  contact_persons jsonb[],
  vitrina_page_slug text,
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
    c.tenant_id,
    c.name,
    c.logo_url,
    c.short_description,
    c.categories,
    c.tags,
    c.country,
    c.city,
    c.website,
    c.social_links,
    c.contact_persons,
    c.vitrina_page_slug,
    c.synced_at,
    CASE
      WHEN v_query IS NOT NULL THEN ts_rank(c.search_vector, v_query)
      ELSE 0::real
    END AS rank
  FROM hub.company_cache c
  WHERE
    (
      v_query IS NULL
      OR c.search_vector @@ v_query
    )
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR c.categories && p_categories
    )
    AND (
      p_tags IS NULL
      OR cardinality(p_tags) = 0
      OR c.tags && p_tags
    )
    AND (
      p_country IS NULL
      OR btrim(p_country) = ''
      OR c.country ILIKE p_country
    )
    AND (
      p_city IS NULL
      OR btrim(p_city) = ''
      OR c.city ILIKE '%' || p_city || '%'
    )
  ORDER BY rank DESC, c.name ASC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION hub.search_company_cache TO service_role;

NOTIFY pgrst, 'reload schema';
