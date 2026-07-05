-- Fix: keywords affect ranking only, not hard filter (M4c)

CREATE OR REPLACE FUNCTION hub.search_marketplace_listings(
  p_keywords text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_theme_slug text DEFAULT NULL,
  p_marketplace_themes text[] DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  page_slug text,
  title jsonb,
  short_text jsonb,
  categories text[],
  marketplace_themes text[],
  price_from numeric,
  price_currency text,
  synced_at timestamptz,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hub, public
AS $$
DECLARE
  v_query tsquery;
  v_city text := NULLIF(btrim(p_city), '');
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
    l.marketplace_themes,
    l.price_from,
    l.price_currency,
    l.synced_at,
    CASE
      WHEN v_query IS NOT NULL AND l.search_vector @@ v_query THEN ts_rank(l.search_vector, v_query)
      ELSE 0::real
    END AS rank
  FROM hub.listing_cache l
  WHERE
    (
      p_marketplace_themes IS NULL
      OR cardinality(p_marketplace_themes) = 0
      OR l.marketplace_themes && p_marketplace_themes
    )
    AND (
      p_theme_slug IS NULL
      OR btrim(p_theme_slug) = ''
      OR p_theme_slug = ANY (l.marketplace_themes)
    )
    AND (
      v_city IS NULL
      OR l.search_vector @@ plainto_tsquery('russian', v_city)
      OR l.title::text ILIKE '%' || v_city || '%'
      OR l.short_text::text ILIKE '%' || v_city || '%'
    )
  ORDER BY rank DESC, l.synced_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION hub.search_marketplace_listings TO service_role;

NOTIFY pgrst, 'reload schema';
