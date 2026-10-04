-- migrate:up
-- What a listing is, as the catalogue says (CS-99, CS-103, ADR-0039, ADR-0041): one row per listing with the engine volume
-- it is given and where it comes from, its origin, and its country and where that comes from. The inheritance lives here
-- and nowhere else, so search (listing_filter_row), the listing page and the superadmin's coverage cannot disagree:
--   volume: the listing's own title's (listing.engine_volume_cc), else its trim's row, else its model's volume when no trim
--           of the model has another volume (model_spec_agreed); source listing, trim or model;
--   origin: the trim's row, else the model's (model_spec.car_origin);
--   country: the model's own row, else its make's (country_spec); source model or make.
-- Each is null when nothing says; nothing is guessed. The joins are on the tables' unique scope keys, so a listing never
-- doubles. A view runs with its owner's rights, so the web role needs no grant on the tables behind it beyond the ones it has.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW listing_spec AS
SELECT l.id AS listing_id,
       COALESCE(l.engine_volume_cc, ts.engine_volume_cc, ma.engine_volume_cc) AS engine_volume_cc,
       CASE
         WHEN l.engine_volume_cc IS NOT NULL THEN 'listing'
         WHEN ts.engine_volume_cc IS NOT NULL THEN 'trim'
         WHEN ma.engine_volume_cc IS NOT NULL THEN 'model'
       END AS engine_volume_source,
       COALESCE(ts.car_origin, ms.car_origin) AS car_origin,
       COALESCE(mc.country, kc.country) AS country,
       CASE
         WHEN mc.country IS NOT NULL THEN 'model'
         WHEN kc.country IS NOT NULL THEN 'make'
       END AS country_source
FROM listing l
  LEFT JOIN model_spec ts ON ts.model_id = l.model_id AND ts.trim_id = l.trim_id
  LEFT JOIN model_spec ms ON ms.model_id = l.model_id AND ms.trim_id IS NULL
  LEFT JOIN model_spec_agreed ma ON ma.model_id = l.model_id
  LEFT JOIN country_spec mc ON mc.make_id = l.make_id AND mc.model_id = l.model_id
  LEFT JOIN country_spec kc ON kc.make_id = l.make_id AND kc.model_id IS NULL;

COMMENT ON VIEW listing_spec IS
  'One row per listing: its engine volume and where it comes from (listing, trim, model), its origin (trim, else model) and its country and where it comes from (model, else make). The one place the catalogue''s specs are inherited (CS-99, CS-103).';

GRANT SELECT ON listing_spec TO carshenas_web, carshenas_admin, carshenas_readonly, carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW listing_spec;
