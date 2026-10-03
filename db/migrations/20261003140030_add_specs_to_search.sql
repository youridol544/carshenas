-- migrate:up
-- The engine volume and origin of a listing, for search (CS-99, ADR-0039): listing_filter_row gains two columns, appended
-- so every reader keeps working. A listing's volume is its own title's (listing.engine_volume_cc), else its trim's
-- (model_spec), else its model's; its origin is its trim's, else its model's; each is null when nothing says. The two
-- joins are on model_spec's unique scope key (one trim row at most, one model row at most), so a listing never doubles.
-- search_document gets the same two columns, range-checked, and a b-tree on the volume for range filters (the next
-- migration); origin has three values and no index (ADR-0028: single-column indexes only where values are rare). The table is filled by the
-- worker's rebuild (`pnpm search:rebuild`) and kept by the triggers' marks, including model_spec's own.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE VIEW listing_filter_row AS
SELECT l.id AS listing_id,
    l.source_id,
    l.status,
    l.listed_at,
    l.last_seen_at,
    l.make_id,
    l.model_id,
    l.trim_id,
    mk.slug AS make_key,
    (mk.slug || '.'::text) || m.slug AS model_key,
    (((mk.slug || '.'::text) || m.slug) || '.'::text) || t.slug AS trim_key,
    COALESCE(t.body_type, m.body_type) AS body_type,
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
    (city.slug || '.'::text) || l.district_fa AS district_key,
    l.seller_type,
    l.insurance_months_left,
    l.body_condition,
    l.engine_condition,
    l.gearbox_condition,
        CASE
            WHEN l.front_chassis_condition = 'damaged'::text OR l.rear_chassis_condition = 'damaged'::text OR f.chassis = 'damaged'::text THEN 'damaged'::text
            WHEN l.front_chassis_condition = 'repainted'::text OR l.rear_chassis_condition = 'repainted'::text THEN 'repainted'::text
            WHEN l.front_chassis_condition = 'intact'::text AND l.rear_chassis_condition = 'intact'::text OR l.front_chassis_condition IS NULL AND l.rear_chassis_condition IS NULL AND f.chassis = 'intact'::text THEN 'intact'::text
            ELSE NULL::text
        END AS chassis_condition,
        CASE
            WHEN (f.paint = ANY (ARRAY['spots'::text, 'partial'::text, 'around'::text, 'full'::text])) OR (l.body_condition = ANY (ARRAY['partly_repainted'::text, 'repainted_around'::text, 'fully_repainted'::text, 'accident_damaged'::text, 'salvage'::text])) THEN false
            WHEN f.paint = 'none'::text OR (l.body_condition = ANY (ARRAY['intact'::text, 'minor_scratches'::text, 'paintless_dent_repair'::text])) THEN true
            ELSE NULL::boolean
        END AS paint_free,
        CASE
            WHEN f.accident = 'had_accident'::text OR (l.body_condition = ANY (ARRAY['accident_damaged'::text, 'salvage'::text])) THEN 'had_accident'::text
            WHEN f.accident = 'none'::text THEN 'none'::text
            ELSE NULL::text
        END AS accident,
    f.replaced AS replaced_parts,
    f.ride_hailing,
    f.plate,
        CASE
            WHEN l.accepts_swap OR f.swap = 'yes'::text THEN true
            WHEN NOT l.accepts_swap OR f.swap = 'no'::text THEN false
            ELSE NULL::boolean
        END AS offers_swap,
        CASE
            WHEN l.accepts_installments OR f.installment = 'yes'::text OR l.price_type = 'installment'::text THEN true
            WHEN NOT l.accepts_installments OR f.installment = 'no'::text THEN false
            ELSE NULL::boolean
        END AS offers_installments,
    (EXISTS ( SELECT
           FROM listing_photo p
          WHERE p.listing_id = l.id)) AS has_photo,
    popularity.model_rank,
    COALESCE(l.engine_volume_cc, ts.engine_volume_cc, ms.engine_volume_cc) AS engine_volume_cc,
    COALESCE(ts.car_origin, ms.car_origin) AS car_origin
   FROM listing l
     LEFT JOIN make mk ON mk.id = l.make_id
     LEFT JOIN model m ON m.id = l.model_id
     LEFT JOIN "trim" t ON t.id = l.trim_id
     LEFT JOIN model_spec ts ON ts.model_id = l.model_id AND ts.trim_id = l.trim_id
     LEFT JOIN model_spec ms ON ms.model_id = l.model_id AND ms.trim_id IS NULL
     LEFT JOIN colour c ON c.code = l.colour
     LEFT JOIN city ON city.id = l.city_id
     LEFT JOIN listing_valuation v ON v.listing_id = l.id AND v.valuation_run_id = (( SELECT r.id
           FROM valuation_run r
          WHERE r.status = 'succeeded'::text
          ORDER BY r.as_of_date DESC, r.id DESC
         LIMIT 1))
     LEFT JOIN ( SELECT a.model_id,
            rank() OVER (ORDER BY (count(*)) DESC)::integer AS model_rank
           FROM listing a
          WHERE a.status = 'active'::text AND a.model_id IS NOT NULL
          GROUP BY a.model_id) popularity ON popularity.model_id = l.model_id
     LEFT JOIN ( SELECT e.listing_id,
            max(ef.value) FILTER (WHERE ef.field = 'paint'::text) AS paint,
            max(ef.value) FILTER (WHERE ef.field = 'replaced'::text) AS replaced,
            max(ef.value) FILTER (WHERE ef.field = 'chassis'::text) AS chassis,
            max(ef.value) FILTER (WHERE ef.field = 'accident'::text) AS accident,
            max(ef.value) FILTER (WHERE ef.field = 'installment'::text) AS installment,
            max(ef.value) FILTER (WHERE ef.field = 'swap'::text) AS swap,
            max(ef.value) FILTER (WHERE ef.field = 'ride_hailing'::text) AS ride_hailing,
            max(ef.value) FILTER (WHERE ef.field = 'plate'::text) AS plate
           FROM extraction e
             JOIN listing el ON el.id = e.listing_id
             JOIN extraction_field ef ON ef.extraction_id = e.id AND ef.status = 'accepted'::text AND ef.value <> 'not_stated'::text
          WHERE e.status = 'usable'::text AND NOT (EXISTS ( SELECT
                   FROM extraction later
                  WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)) AND e.snapshot_id = COALESCE(( SELECT fl.snapshot_id
                   FROM fetch_log fl
                  WHERE fl.listing_id = e.listing_id AND fl.source_id = el.source_id AND fl.snapshot_id IS NOT NULL
                  ORDER BY fl.requested_at DESC, fl.id DESC
                 LIMIT 1), ( SELECT s.id
                   FROM snapshot s
                  WHERE s.listing_id = e.listing_id
                  ORDER BY s.first_fetched_at DESC, s.id DESC
                 LIMIT 1))
          GROUP BY e.listing_id) f ON f.listing_id = l.id;

ALTER TABLE search_document
  ADD COLUMN engine_volume_cc integer,
  ADD COLUMN car_origin text,
  ADD CONSTRAINT search_document_engine_volume_cc_range CHECK (engine_volume_cc >= 500 AND engine_volume_cc <= 9000) NOT VALID,
  ADD CONSTRAINT search_document_car_origin_valid CHECK (car_origin IN ('domestic', 'joint_venture', 'imported')) NOT VALID;

COMMENT ON COLUMN search_document.engine_volume_cc IS 'The listing''s engine volume in cc: its own title''s, else its trim''s, else its model''s (model_spec); null when unknown, and then excluded by a volume filter.';
COMMENT ON COLUMN search_document.car_origin IS 'domestic, joint_venture or imported: the listing''s trim''s origin, else its model''s (model_spec); null when unknown.';

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE search_document DROP COLUMN engine_volume_cc, DROP COLUMN car_origin;

DROP VIEW listing_filter_row;
CREATE VIEW listing_filter_row AS
SELECT l.id AS listing_id,
    l.source_id,
    l.status,
    l.listed_at,
    l.last_seen_at,
    l.make_id,
    l.model_id,
    l.trim_id,
    mk.slug AS make_key,
    (mk.slug || '.'::text) || m.slug AS model_key,
    (((mk.slug || '.'::text) || m.slug) || '.'::text) || t.slug AS trim_key,
    COALESCE(t.body_type, m.body_type) AS body_type,
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
    (city.slug || '.'::text) || l.district_fa AS district_key,
    l.seller_type,
    l.insurance_months_left,
    l.body_condition,
    l.engine_condition,
    l.gearbox_condition,
        CASE
            WHEN l.front_chassis_condition = 'damaged'::text OR l.rear_chassis_condition = 'damaged'::text OR f.chassis = 'damaged'::text THEN 'damaged'::text
            WHEN l.front_chassis_condition = 'repainted'::text OR l.rear_chassis_condition = 'repainted'::text THEN 'repainted'::text
            WHEN l.front_chassis_condition = 'intact'::text AND l.rear_chassis_condition = 'intact'::text OR l.front_chassis_condition IS NULL AND l.rear_chassis_condition IS NULL AND f.chassis = 'intact'::text THEN 'intact'::text
            ELSE NULL::text
        END AS chassis_condition,
        CASE
            WHEN (f.paint = ANY (ARRAY['spots'::text, 'partial'::text, 'around'::text, 'full'::text])) OR (l.body_condition = ANY (ARRAY['partly_repainted'::text, 'repainted_around'::text, 'fully_repainted'::text, 'accident_damaged'::text, 'salvage'::text])) THEN false
            WHEN f.paint = 'none'::text OR (l.body_condition = ANY (ARRAY['intact'::text, 'minor_scratches'::text, 'paintless_dent_repair'::text])) THEN true
            ELSE NULL::boolean
        END AS paint_free,
        CASE
            WHEN f.accident = 'had_accident'::text OR (l.body_condition = ANY (ARRAY['accident_damaged'::text, 'salvage'::text])) THEN 'had_accident'::text
            WHEN f.accident = 'none'::text THEN 'none'::text
            ELSE NULL::text
        END AS accident,
    f.replaced AS replaced_parts,
    f.ride_hailing,
    f.plate,
        CASE
            WHEN l.accepts_swap OR f.swap = 'yes'::text THEN true
            WHEN NOT l.accepts_swap OR f.swap = 'no'::text THEN false
            ELSE NULL::boolean
        END AS offers_swap,
        CASE
            WHEN l.accepts_installments OR f.installment = 'yes'::text OR l.price_type = 'installment'::text THEN true
            WHEN NOT l.accepts_installments OR f.installment = 'no'::text THEN false
            ELSE NULL::boolean
        END AS offers_installments,
    (EXISTS ( SELECT
           FROM listing_photo p
          WHERE p.listing_id = l.id)) AS has_photo,
    popularity.model_rank
   FROM listing l
     LEFT JOIN make mk ON mk.id = l.make_id
     LEFT JOIN model m ON m.id = l.model_id
     LEFT JOIN "trim" t ON t.id = l.trim_id
     LEFT JOIN colour c ON c.code = l.colour
     LEFT JOIN city ON city.id = l.city_id
     LEFT JOIN listing_valuation v ON v.listing_id = l.id AND v.valuation_run_id = (( SELECT r.id
           FROM valuation_run r
          WHERE r.status = 'succeeded'::text
          ORDER BY r.as_of_date DESC, r.id DESC
         LIMIT 1))
     LEFT JOIN ( SELECT a.model_id,
            rank() OVER (ORDER BY (count(*)) DESC)::integer AS model_rank
           FROM listing a
          WHERE a.status = 'active'::text AND a.model_id IS NOT NULL
          GROUP BY a.model_id) popularity ON popularity.model_id = l.model_id
     LEFT JOIN ( SELECT e.listing_id,
            max(ef.value) FILTER (WHERE ef.field = 'paint'::text) AS paint,
            max(ef.value) FILTER (WHERE ef.field = 'replaced'::text) AS replaced,
            max(ef.value) FILTER (WHERE ef.field = 'chassis'::text) AS chassis,
            max(ef.value) FILTER (WHERE ef.field = 'accident'::text) AS accident,
            max(ef.value) FILTER (WHERE ef.field = 'installment'::text) AS installment,
            max(ef.value) FILTER (WHERE ef.field = 'swap'::text) AS swap,
            max(ef.value) FILTER (WHERE ef.field = 'ride_hailing'::text) AS ride_hailing,
            max(ef.value) FILTER (WHERE ef.field = 'plate'::text) AS plate
           FROM extraction e
             JOIN listing el ON el.id = e.listing_id
             JOIN extraction_field ef ON ef.extraction_id = e.id AND ef.status = 'accepted'::text AND ef.value <> 'not_stated'::text
          WHERE e.status = 'usable'::text AND NOT (EXISTS ( SELECT
                   FROM extraction later
                  WHERE later.snapshot_id = e.snapshot_id AND later.id > e.id)) AND e.snapshot_id = COALESCE(( SELECT fl.snapshot_id
                   FROM fetch_log fl
                  WHERE fl.listing_id = e.listing_id AND fl.source_id = el.source_id AND fl.snapshot_id IS NOT NULL
                  ORDER BY fl.requested_at DESC, fl.id DESC
                 LIMIT 1), ( SELECT s.id
                   FROM snapshot s
                  WHERE s.listing_id = e.listing_id
                  ORDER BY s.first_fetched_at DESC, s.id DESC
                 LIMIT 1))
          GROUP BY e.listing_id) f ON f.listing_id = l.id;
GRANT SELECT ON listing_filter_row TO carshenas_web, carshenas_readonly, carshenas_worker, carshenas_admin;
COMMENT ON VIEW listing_filter_row IS 'One row per listing with every column a search filter reads (CS-58, docs/specs/S02-filters-and-catalogues.md): the predicates of @carshenas/search run on it, or on search_document, which CS-59 builds from it with the same names.';
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
