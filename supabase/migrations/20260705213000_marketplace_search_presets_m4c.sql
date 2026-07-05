-- H-M4c: guided marketplace search presets + themed listing RPC

CREATE TABLE hub.search_presets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id  uuid NOT NULL REFERENCES hub.marketplaces(id) ON DELETE CASCADE,
  theme_slug      text NOT NULL,
  name            jsonb NOT NULL,
  hint_template   jsonb NOT NULL,
  required_params jsonb NOT NULL DEFAULT '[]',
  clarify_hints   jsonb NOT NULL DEFAULT '{}',
  sort_order      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX search_presets_marketplace_active_idx
  ON hub.search_presets (marketplace_id, is_active, sort_order);

ALTER TABLE hub.search_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_presets_select" ON hub.search_presets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "search_presets_admin_write" ON hub.search_presets
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT ON hub.search_presets TO authenticated;
GRANT ALL ON hub.search_presets TO service_role;

REVOKE ALL ON hub.search_presets FROM anon;

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

INSERT INTO hub.search_presets (
  marketplace_id,
  theme_slug,
  name,
  hint_template,
  required_params,
  clarify_hints,
  sort_order
)
SELECT
  m.id,
  v.theme_slug,
  v.name,
  v.hint_template,
  v.required_params,
  v.clarify_hints,
  v.sort_order
FROM hub.marketplaces m
CROSS JOIN (
  VALUES
    (
      'accommodation',
      '{"ru": "Ищу места размещения", "en": "Looking for accommodation"}'::jsonb,
      '{"ru": "Нужны номера в Алматы на 15–18 июля для 4 человек. Предпочтительно центр города.", "en": "Need rooms in Almaty on July 15–18 for 4 people. Prefer city center."}'::jsonb,
      '["city","dates","people"]'::jsonb,
      '{"city": {"ru": "В каком городе нужно размещение?"}, "dates": {"ru": "На какие даты?"}, "people": {"ru": "Сколько человек?"}}'::jsonb,
      1
    ),
    (
      'transport',
      '{"ru": "Ищу транспорт", "en": "Looking for transport"}'::jsonb,
      '{"ru": "Нужен микроавтобус в Алматы на 20 июля для группы 12 человек, трансфер аэропорт — отель.", "en": "Need a minibus in Almaty on July 20 for a group of 12, airport transfer."}'::jsonb,
      '["city","dates","people"]'::jsonb,
      '{"city": {"ru": "В каком городе нужен транспорт?"}, "dates": {"ru": "На какую дату?"}, "people": {"ru": "Сколько пассажиров?"}}'::jsonb,
      2
    ),
    (
      'tourism',
      '{"ru": "Ищу экскурсии", "en": "Looking for tours"}'::jsonb,
      '{"ru": "Нужна экскурсия по Алматы на 22 июля для 6 человек, полдня, русскоязычный гид.", "en": "Need a half-day tour in Almaty on July 22 for 6 people with Russian-speaking guide."}'::jsonb,
      '["city","dates","people"]'::jsonb,
      '{"city": {"ru": "В каком городе?"}, "dates": {"ru": "На какую дату?"}, "people": {"ru": "Сколько участников?"}}'::jsonb,
      3
    )
) AS v(theme_slug, name, hint_template, required_params, clarify_hints, sort_order)
WHERE m.slug = 'tourism';

NOTIFY pgrst, 'reload schema';
