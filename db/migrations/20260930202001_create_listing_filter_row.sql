-- migrate:up
-- The row every search filter reads (CS-58, ADR-0027, docs/specs/S02-filters-and-catalogues.md): one row per listing
-- with each column a filter's predicate names, so a filter is one declarative definition in @carshenas/search and its
-- SQL is one named helper over one column. It gathers what is spread over the catalogue, the latest succeeded valuation
-- (CS-51), the colour codes, the photos and the accepted facts of the current extraction (CS-52), and merges the
-- seller's declared condition with what the text says. CS-59 materialises it into search_document with the same column
-- names, so the same predicates run there unchanged. The view runs with its owner's rights: it is the web app's only
-- window onto valuations, extractions and fetches, and it shows value codes only, never evidence text.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW listing_filter_row AS
SELECT
  l.id AS listing_id,
  l.source_id,
  l.status,
  l.listed_at,
  l.last_seen_at,
  l.make_id,
  l.model_id,
  l.trim_id,
  mk.slug AS make_key,
  mk.slug || '.' || m.slug AS model_key,
  mk.slug || '.' || m.slug || '.' || t.slug AS trim_key,
  coalesce(t.body_type, m.body_type) AS body_type,
  l.model_year_sh,
  l.mileage_km,
  l.price_type,
  l.asking_price_toman,
  v.market_value_toman,
  v.price_gap_pct,
  v.deal_rating,
  l.gearbox,
  l.fuel,
  c.family AS colour_family,
  l.city_id,
  city.slug AS city_key,
  l.district_fa,
  city.slug || '.' || l.district_fa AS district_key,
  l.seller_type,
  l.insurance_months_left,
  l.body_condition,
  l.engine_condition,
  l.gearbox_condition,
  -- The worse of the two chassis the seller rates, or damage the text states; intact needs both sound, or the text
  -- saying so when the seller rated neither.
  CASE
    WHEN l.front_chassis_condition = 'damaged' OR l.rear_chassis_condition = 'damaged' OR f.chassis = 'damaged'
      THEN 'damaged'
    WHEN l.front_chassis_condition = 'repainted' OR l.rear_chassis_condition = 'repainted' THEN 'repainted'
    WHEN (l.front_chassis_condition = 'intact' AND l.rear_chassis_condition = 'intact')
      OR (l.front_chassis_condition IS NULL AND l.rear_chassis_condition IS NULL AND f.chassis = 'intact')
      THEN 'intact'
  END AS chassis_condition,
  -- Any paint stated anywhere wins: a spot of paint in the text makes a body the seller rated intact not paint-free.
  CASE
    WHEN f.paint IN ('spots', 'partial', 'around', 'full')
      OR l.body_condition IN ('partly_repainted', 'repainted_around', 'fully_repainted', 'accident_damaged', 'salvage')
      THEN false
    WHEN f.paint = 'none' OR l.body_condition IN ('intact', 'minor_scratches', 'paintless_dent_repair') THEN true
  END AS paint_free,
  CASE
    WHEN f.accident = 'had_accident' OR l.body_condition IN ('accident_damaged', 'salvage') THEN 'had_accident'
    WHEN f.accident = 'none' THEN 'none'
  END AS accident,
  f.replaced AS replaced_parts,
  f.ride_hailing,
  f.plate,
  CASE WHEN l.accepts_swap OR f.swap = 'yes' THEN true WHEN NOT l.accepts_swap OR f.swap = 'no' THEN false END
    AS offers_swap,
  CASE
    WHEN l.accepts_installments OR f.installment = 'yes' OR l.price_type = 'installment' THEN true
    WHEN NOT l.accepts_installments OR f.installment = 'no' THEN false
  END AS offers_installments,
  EXISTS (SELECT FROM listing_photo p WHERE p.listing_id = l.id) AS has_photo,
  popularity.model_rank
FROM listing l
LEFT JOIN make mk ON mk.id = l.make_id
LEFT JOIN model m ON m.id = l.model_id
LEFT JOIN "trim" t ON t.id = l.trim_id
LEFT JOIN colour c ON c.code = l.colour
LEFT JOIN city ON city.id = l.city_id
LEFT JOIN listing_valuation v
  ON v.listing_id = l.id
  AND v.valuation_run_id = (
    SELECT r.id FROM valuation_run r WHERE r.status = 'succeeded' ORDER BY r.as_of_date DESC, r.id DESC LIMIT 1)
LEFT JOIN (
  SELECT a.model_id, rank() OVER (ORDER BY count(*) DESC)::integer AS model_rank
  FROM listing a
  WHERE a.status = 'active' AND a.model_id IS NOT NULL
  GROUP BY a.model_id
) popularity ON popularity.model_id = l.model_id
-- The accepted, stated facts of the latest extraction of each listing's current snapshot, when that extraction is
-- usable: the current snapshot is the one its latest fetch with content returned, else the one first fetched last, as
-- the derivation takes it (attribute-store.ts), so a new snapshot never inherits an older one's reading. Grouped once
-- over the extractions and hash-joined, so its cost follows the number of extractions, not of listings.
LEFT JOIN (
  SELECT
    e.listing_id,
    max(ef.value) FILTER (WHERE ef.field = 'paint') AS paint,
    max(ef.value) FILTER (WHERE ef.field = 'replaced') AS replaced,
    max(ef.value) FILTER (WHERE ef.field = 'chassis') AS chassis,
    max(ef.value) FILTER (WHERE ef.field = 'accident') AS accident,
    max(ef.value) FILTER (WHERE ef.field = 'installment') AS installment,
    max(ef.value) FILTER (WHERE ef.field = 'swap') AS swap,
    max(ef.value) FILTER (WHERE ef.field = 'ride_hailing') AS ride_hailing,
    max(ef.value) FILTER (WHERE ef.field = 'plate') AS plate
  FROM extraction e
  JOIN listing el ON el.id = e.listing_id
  JOIN extraction_field ef ON ef.extraction_id = e.id AND ef.status = 'accepted' AND ef.value <> 'not_stated'
  WHERE e.status = 'usable'
    AND NOT EXISTS (SELECT FROM extraction later WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)
    AND e.snapshot_id = coalesce(
      (SELECT fl.snapshot_id
       FROM fetch_log fl
       WHERE fl.listing_id = e.listing_id AND fl.source_id = el.source_id AND fl.snapshot_id IS NOT NULL
       ORDER BY fl.requested_at DESC, fl.id DESC
       LIMIT 1),
      (SELECT s.id
       FROM snapshot s
       WHERE s.listing_id = e.listing_id
       ORDER BY s.first_fetched_at DESC, s.id DESC
       LIMIT 1))
  GROUP BY e.listing_id
) f ON f.listing_id = l.id;

COMMENT ON VIEW listing_filter_row IS
  'One row per listing with every column a search filter reads (CS-58, docs/specs/S02-filters-and-catalogues.md): the predicates of @carshenas/search run on it, or on search_document, which CS-59 builds from it with the same names.';
COMMENT ON COLUMN listing_filter_row.make_key IS 'The make''s slug: the value a URL and a stored search name it by.';
COMMENT ON COLUMN listing_filter_row.model_key IS 'make slug.model slug (peugeot.206): model slugs are unique only within their make.';
COMMENT ON COLUMN listing_filter_row.trim_key IS 'make slug.model slug.trim slug (peugeot.206.5); null when the catalogue knows only the model.';
COMMENT ON COLUMN listing_filter_row.body_type IS 'The trim''s body type where it differs from its model''s, else the model''s (CS-50).';
COMMENT ON COLUMN listing_filter_row.deal_rating IS 'The rating of the latest succeeded valuation run (CS-51); null when unrated or not valued.';
COMMENT ON COLUMN listing_filter_row.colour_family IS 'The family the listing''s colour groups in (colour.family).';
COMMENT ON COLUMN listing_filter_row.city_key IS 'The city''s slug (tehran).';
COMMENT ON COLUMN listing_filter_row.district_key IS 'city slug.district as the listing names it (tehran.ونک): district names repeat across cities.';
COMMENT ON COLUMN listing_filter_row.chassis_condition IS 'damaged when either chassis is rated damaged or the text says so; repainted when either is repainted; intact when both are rated intact, or the text says so and the seller rated neither; else null.';
COMMENT ON COLUMN listing_filter_row.paint_free IS 'false when the seller rates the body repainted, accident-damaged or salvage, or the text states any paint, a spot included; true when the body is rated intact, scratched or dent-repaired without paint, or the text says unpainted; null when neither says.';
COMMENT ON COLUMN listing_filter_row.accident IS 'had_accident when the text states one or the body is rated accident-damaged or salvage; none when the text says so; else null.';
COMMENT ON COLUMN listing_filter_row.replaced_parts IS 'The text''s replaced fact (CS-52): some or none; null when not stated or not accepted.';
COMMENT ON COLUMN listing_filter_row.ride_hailing IS 'The text''s ride_hailing fact: used or not_used; null when not stated or not accepted.';
COMMENT ON COLUMN listing_filter_row.plate IS 'The text''s plate fact: national or free_zone; null when not stated or not accepted.';
COMMENT ON COLUMN listing_filter_row.offers_swap IS 'true when the site''s field or the text says the seller takes a car in exchange; false when either refuses; else null.';
COMMENT ON COLUMN listing_filter_row.offers_installments IS 'true when the site''s field or the text offers instalments, or the shown price is a down payment; false when either refuses; else null.';
COMMENT ON COLUMN listing_filter_row.model_rank IS 'The model''s place by active listings, 1 the most listed; how popular, and so how easy to service and resell, the model is.';

-- Search pages and the search API (CS-59, CS-61, CS-63), the matcher of search files (CS-72), and the superadmin's
-- match counts (CS-70).
GRANT SELECT ON listing_filter_row TO carshenas_web, carshenas_worker, carshenas_admin;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW listing_filter_row;
