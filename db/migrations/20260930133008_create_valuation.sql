-- migrate:up
-- Market values and deal ratings (CS-51; docs/specs/S01-deal-ratings.md; docs/design/data-model.md, layer 6). The worker
-- fits a log-price model once a Tehran day and stores the run, every fitted coefficient, each model's segment and the
-- comparables it learned from; valuation_rate_listing() then values and rates any listing from those stored numbers
-- alone, so the daily run, a listing crawled between runs and a pasted link (CS-65) are rated by the same SQL, and
-- search sorts on the stored result (CS-59). All six tables are derived and rebuildable: a run is replaced, never
-- edited, and runs older than 90 days are deleted by the job.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Ordered: deal_rating <= 'good' is "good or better" (the data model's one enum, section 2).
CREATE TYPE deal_rating AS ENUM ('great', 'good', 'fair', 'high', 'overpriced');
COMMENT ON TYPE deal_rating IS
  'The five deal ratings from best to worst (S01): «معامله‌ی عالی», «معامله‌ی خوب», «قیمت منصفانه», «گران», «خیلی گران».';

CREATE TABLE valuation_run (
  id bigint GENERATED ALWAYS AS IDENTITY,
  as_of_date date NOT NULL,
  method_version smallint NOT NULL,
  status text NOT NULL,
  reference_year_sh smallint NOT NULL,
  mileage_norm_km_per_year integer NOT NULL,
  window_days smallint NOT NULL,
  prior_strength double precision NOT NULL,
  comparable_count integer,
  valued_count integer,
  rated_count integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT valuation_run_pkey PRIMARY KEY (id),
  CONSTRAINT valuation_run_status_valid CHECK (status IN ('running', 'succeeded', 'failed')),
  CONSTRAINT valuation_run_finished_when_done CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT valuation_run_counts_when_succeeded CHECK (
    status <> 'succeeded' OR (comparable_count IS NOT NULL AND valued_count IS NOT NULL AND rated_count IS NOT NULL)),
  CONSTRAINT valuation_run_counts_nonnegative CHECK (comparable_count >= 0 AND valued_count >= 0 AND rated_count >= 0),
  CONSTRAINT valuation_run_method_version_positive CHECK (method_version >= 1),
  CONSTRAINT valuation_run_reference_year_sh_range CHECK (reference_year_sh BETWEEN 1300 AND 1500),
  CONSTRAINT valuation_run_mileage_norm_positive CHECK (mileage_norm_km_per_year > 0),
  CONSTRAINT valuation_run_window_days_positive CHECK (window_days > 0),
  CONSTRAINT valuation_run_prior_strength_nonnegative CHECK (prior_strength >= 0)
);
CREATE UNIQUE INDEX valuation_run_succeeded_unique ON valuation_run (as_of_date, method_version) WHERE status = 'succeeded';
COMMENT ON TABLE valuation_run IS
  'One daily valuation (CS-51, S01): the Tehran day it values the market on, the method version, and the constants the fit and valuation_rate_listing() used. Pages read the latest succeeded run.';
COMMENT ON COLUMN valuation_run.as_of_date IS 'The Tehran day the market values hold for.';
COMMENT ON COLUMN valuation_run.reference_year_sh IS 'The Jalali year of as_of_date: a car''s age is this minus its model_year_sh, floored at 0.';
COMMENT ON COLUMN valuation_run.mileage_norm_km_per_year IS 'Kilometres a year the market treats as normal (20,000 in method 1): mileage is measured against it.';
COMMENT ON COLUMN valuation_run.window_days IS 'How many days before as_of_date a listing may have last been seen and still be a comparable.';
COMMENT ON COLUMN valuation_run.prior_strength IS 'How many listings each coefficient''s prior weighs in the ridge fit.';

-- A fitted coefficient, on the log-price scale. Shared terms name no model; a model's level and age slope name it; a
-- trim's level (an offset from its model's) names the trim and its model.
CREATE TABLE valuation_coefficient (
  id bigint GENERATED ALWAYS AS IDENTITY,
  valuation_run_id bigint NOT NULL,
  term text NOT NULL,
  model_id bigint,
  trim_id bigint,
  coefficient double precision NOT NULL,
  CONSTRAINT valuation_coefficient_pkey PRIMARY KEY (id),
  CONSTRAINT valuation_coefficient_run_fk FOREIGN KEY (valuation_run_id) REFERENCES valuation_run (id) ON DELETE CASCADE,
  CONSTRAINT valuation_coefficient_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT valuation_coefficient_trim_fk FOREIGN KEY (trim_id, model_id) REFERENCES trim (id, model_id) ON DELETE RESTRICT,
  CONSTRAINT valuation_coefficient_term_scope_unique UNIQUE NULLS NOT DISTINCT (valuation_run_id, term, model_id, trim_id),
  CONSTRAINT valuation_coefficient_term_valid CHECK (term IN (
    'model_level', 'model_age_slope', 'trim_level',
    'age_slope', 'mileage_deviation', 'zero_km', 'body_minor', 'body_painted', 'body_painted_around',
    'chassis_repainted', 'gearbox_automatic', 'dual_fuel_aftermarket', 'electrified', 'off_colour', 'day')),
  CONSTRAINT valuation_coefficient_scope_matches_term CHECK (
    CASE term
      WHEN 'model_level' THEN model_id IS NOT NULL AND trim_id IS NULL
      WHEN 'model_age_slope' THEN model_id IS NOT NULL AND trim_id IS NULL
      WHEN 'trim_level' THEN model_id IS NOT NULL AND trim_id IS NOT NULL
      ELSE model_id IS NULL AND trim_id IS NULL
    END),
  CONSTRAINT valuation_coefficient_finite CHECK (coefficient BETWEEN -1000 AND 1000)
);
COMMENT ON TABLE valuation_coefficient IS
  'Every coefficient a run fitted (CS-51, S01), on ln(price in tomans): what valuation_rate_listing() values a listing from.';
COMMENT ON COLUMN valuation_coefficient.coefficient IS
  'On the log scale: a shared term adds it once per unit of its feature; model_age_slope is the model''s whole slope per year of age.';
COMMENT ON CONSTRAINT valuation_coefficient_model_fk ON valuation_coefficient IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); coefficients are read by run.';
COMMENT ON CONSTRAINT valuation_coefficient_trim_fk ON valuation_coefficient IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); coefficients are read by run.';

-- A catalogue model in a run: how much it learned from and whether its listings may be rated.
CREATE TABLE valuation_segment (
  valuation_run_id bigint NOT NULL,
  model_id bigint NOT NULL,
  comparable_count integer NOT NULL,
  zero_km_count integer NOT NULL,
  min_model_year_sh smallint NOT NULL,
  max_model_year_sh smallint NOT NULL,
  error_pct numeric(6,2),
  rates_listings boolean NOT NULL,
  CONSTRAINT valuation_segment_pkey PRIMARY KEY (valuation_run_id, model_id),
  CONSTRAINT valuation_segment_run_fk FOREIGN KEY (valuation_run_id) REFERENCES valuation_run (id) ON DELETE CASCADE,
  CONSTRAINT valuation_segment_model_fk FOREIGN KEY (model_id) REFERENCES model (id) ON DELETE RESTRICT,
  CONSTRAINT valuation_segment_comparable_count_positive CHECK (comparable_count > 0),
  CONSTRAINT valuation_segment_zero_km_count_range CHECK (zero_km_count BETWEEN 0 AND comparable_count),
  CONSTRAINT valuation_segment_years_ordered CHECK (min_model_year_sh <= max_model_year_sh),
  CONSTRAINT valuation_segment_error_pct_nonnegative CHECK (error_pct >= 0),
  CONSTRAINT valuation_segment_rates_with_error CHECK (NOT rates_listings OR error_pct IS NOT NULL)
);
COMMENT ON TABLE valuation_segment IS
  'A catalogue model in a run (CS-51, S01): its comparables, the model years they span, its leave-one-out median absolute percentage error, and whether it rates listings (enough comparables, error within bounds).';
COMMENT ON COLUMN valuation_segment.zero_km_count IS 'How many of its comparables (outliers left out) are zero-km, under 1,000 km.';
COMMENT ON COLUMN valuation_segment.error_pct IS
  'Median absolute percentage error of the model''s comparables, each valued by the fit without itself (leave-one-out); null when too few to measure.';
COMMENT ON CONSTRAINT valuation_segment_model_fk ON valuation_segment IS
  'unindexed: catalogue rows are curated and never deleted (merged by re-pointing); segments are read by run.';

-- Every listing that entered a run's fit, with the attributes it entered with, so a run explains itself even after a
-- listing's attributes are re-derived.
CREATE TABLE valuation_comparable (
  valuation_run_id bigint NOT NULL,
  listing_id bigint NOT NULL,
  model_id bigint NOT NULL,
  model_year_sh smallint NOT NULL,
  mileage_km integer NOT NULL,
  asking_price_toman bigint NOT NULL,
  fitted_value_toman bigint NOT NULL,
  is_outlier boolean NOT NULL,
  CONSTRAINT valuation_comparable_pkey PRIMARY KEY (valuation_run_id, listing_id),
  CONSTRAINT valuation_comparable_segment_fk FOREIGN KEY (valuation_run_id, model_id)
    REFERENCES valuation_segment (valuation_run_id, model_id) ON DELETE CASCADE,
  CONSTRAINT valuation_comparable_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  CONSTRAINT valuation_comparable_asking_price_toman_range CHECK (asking_price_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT valuation_comparable_fitted_value_toman_range CHECK (fitted_value_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT valuation_comparable_mileage_km_range CHECK (mileage_km BETWEEN 0 AND 9999999)
);
-- Serves the segment foreign key and valuation_rate_listing()'s count of comparables within two model years.
CREATE INDEX valuation_comparable_segment_year_idx ON valuation_comparable (valuation_run_id, model_id, model_year_sh)
  INCLUDE (is_outlier);
CREATE INDEX valuation_comparable_listing_idx ON valuation_comparable (listing_id);
COMMENT ON TABLE valuation_comparable IS
  'A listing a run learned from (CS-51, S01 "Comparables"), with the attributes and asking price it entered with and the value the fit gave it; an outlier was dropped from the second fit and is not rated.';

CREATE TABLE listing_valuation (
  valuation_run_id bigint NOT NULL,
  listing_id bigint NOT NULL,
  asking_price_toman bigint,
  market_value_toman bigint,
  price_gap_pct numeric(7,2),
  deal_rating deal_rating,
  no_rating_reason text,
  CONSTRAINT listing_valuation_pkey PRIMARY KEY (valuation_run_id, listing_id),
  CONSTRAINT listing_valuation_run_fk FOREIGN KEY (valuation_run_id) REFERENCES valuation_run (id) ON DELETE CASCADE,
  CONSTRAINT listing_valuation_listing_fk FOREIGN KEY (listing_id) REFERENCES listing (id) ON DELETE CASCADE,
  CONSTRAINT listing_valuation_asking_price_toman_range CHECK (asking_price_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT listing_valuation_market_value_toman_range CHECK (market_value_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT listing_valuation_rating_or_reason CHECK ((deal_rating IS NULL) <> (no_rating_reason IS NULL)),
  CONSTRAINT listing_valuation_rating_has_numbers CHECK (
    deal_rating IS NULL
    OR (asking_price_toman IS NOT NULL AND market_value_toman IS NOT NULL AND price_gap_pct IS NOT NULL)),
  CONSTRAINT listing_valuation_gap_only_when_rated CHECK (price_gap_pct IS NULL OR deal_rating IS NOT NULL),
  CONSTRAINT listing_valuation_no_rating_reason_valid CHECK (no_rating_reason IN (
    'unmatched_model', 'missing_attributes', 'excluded_condition',
    'too_few_comparables', 'uncertain_segment', 'year_out_of_range',
    'unknown_price', 'no_asking_price', 'placeholder_price', 'installment_price', 'dealer_new_car', 'price_outlier'))
);
CREATE INDEX listing_valuation_listing_idx ON listing_valuation (listing_id);
COMMENT ON TABLE listing_valuation IS
  'A listing''s market value, price gap and deal rating in one run (CS-51 criteria 3 and 4): exactly one of a rating and a reason for none.';
COMMENT ON COLUMN listing_valuation.asking_price_toman IS
  'The asking price that was rated, as the listing showed it when the run read it; null when its price type is not asking.';
COMMENT ON COLUMN listing_valuation.market_value_toman IS
  'The market value on the run''s day; null when the listing''s model, attributes or condition cannot be valued. A negotiable listing keeps its value but no rating.';
COMMENT ON COLUMN listing_valuation.price_gap_pct IS '(asking - market value) / market value, in percent; negative is cheaper than the market.';

-- The comparables shown beside a rated listing (CS-64): its model's nearest by year and mileage, and their prices
-- adjusted to its attributes. The value itself comes from the whole model.
CREATE TABLE listing_valuation_comparable (
  valuation_run_id bigint NOT NULL,
  listing_id bigint NOT NULL,
  comparable_listing_id bigint NOT NULL,
  position smallint NOT NULL,
  asking_price_toman bigint NOT NULL,
  adjusted_price_toman bigint NOT NULL,
  CONSTRAINT listing_valuation_comparable_pkey PRIMARY KEY (valuation_run_id, listing_id, comparable_listing_id),
  CONSTRAINT listing_valuation_comparable_valuation_fk FOREIGN KEY (valuation_run_id, listing_id)
    REFERENCES listing_valuation (valuation_run_id, listing_id) ON DELETE CASCADE,
  CONSTRAINT listing_valuation_comparable_comparable_fk FOREIGN KEY (valuation_run_id, comparable_listing_id)
    REFERENCES valuation_comparable (valuation_run_id, listing_id) ON DELETE CASCADE,
  CONSTRAINT listing_valuation_comparable_not_itself CHECK (comparable_listing_id <> listing_id),
  CONSTRAINT listing_valuation_comparable_position_unique UNIQUE (valuation_run_id, listing_id, position),
  CONSTRAINT listing_valuation_comparable_position_range CHECK (position BETWEEN 1 AND 10),
  CONSTRAINT listing_valuation_comparable_asking_price_toman_range CHECK (asking_price_toman BETWEEN 1 AND 999999999999999),
  CONSTRAINT listing_valuation_comparable_adjusted_price_toman_range CHECK (adjusted_price_toman BETWEEN 1 AND 999999999999999)
);
CREATE INDEX listing_valuation_comparable_comparable_idx ON listing_valuation_comparable (valuation_run_id, comparable_listing_id);
COMMENT ON TABLE listing_valuation_comparable IS
  'Up to ten comparables of a rated listing, nearest in model year and mileage within its model (CS-51, shown by CS-64), with each one''s asking price and that price adjusted to this listing''s attributes.';

-- The market value and rating of any listing from a run's stored numbers (S01 "Market value", "Enough comparables",
-- "Price gap and ratings"). The worker calls it for every active listing; later pages call it for a listing that
-- arrived after the run. Reasons are checked in S01's order: what cannot be valued first, then what cannot be rated.
-- A listing that cannot be valued (most are seen only on list pages) skips every lookup: CASE evaluates a scalar
-- subquery only in the branch taken.
CREATE FUNCTION valuation_rate_listing(run_id bigint, rated_listing_id bigint)
  RETURNS TABLE (
    asking_price_toman bigint,
    market_value_toman bigint,
    price_gap_pct numeric(7,2),
    deal_rating deal_rating,
    no_rating_reason text)
  LANGUAGE sql STABLE PARALLEL SAFE
BEGIN ATOMIC
  WITH l AS (
    SELECT li.*, r.reference_year_sh, r.mileage_norm_km_per_year,
           greatest(r.reference_year_sh - li.model_year_sh, 0) AS age,
           coalesce(co.family, 'white') AS colour_family,
           CASE
             WHEN li.model_id IS NULL THEN 'unmatched_model'
             -- Seen only on a list page: its details, price type included, are not read yet.
             WHEN li.price_type IS NULL THEN 'unknown_price'
             WHEN li.model_year_sh IS NULL OR li.mileage_km IS NULL OR li.gearbox IS NULL THEN 'missing_attributes'
             WHEN li.body_condition IN ('fully_repainted', 'accident_damaged', 'salvage')
               OR li.engine_condition IN ('replaced', 'needs_repair')
               OR li.gearbox_condition IN ('replaced', 'needs_repair')
               OR 'damaged' IN (li.front_chassis_condition, li.rear_chassis_condition) THEN 'excluded_condition'
           END AS unvalued_reason
      FROM public.listing li
      JOIN public.valuation_run r ON r.id = run_id
      LEFT JOIN public.colour co ON co.code = li.colour
     WHERE li.id = rated_listing_id
  ),
  c AS (
    SELECT l.id, l.unvalued_reason,
           CASE WHEN l.unvalued_reason IS NULL THEN (SELECT seg.rates_listings FROM public.valuation_segment seg
             WHERE seg.valuation_run_id = run_id AND seg.model_id = l.model_id) END AS rates_listings,
           CASE WHEN l.unvalued_reason IS NULL THEN (SELECT seg.comparable_count FROM public.valuation_segment seg
             WHERE seg.valuation_run_id = run_id AND seg.model_id = l.model_id) END AS segment_count,
           CASE WHEN l.unvalued_reason IS NULL THEN (SELECT count(*) FROM public.valuation_comparable vc
             WHERE vc.valuation_run_id = run_id AND vc.model_id = l.model_id AND NOT vc.is_outlier
               AND vc.model_year_sh BETWEEN l.model_year_sh - 2 AND l.model_year_sh + 2) END AS near_year_count,
           CASE WHEN l.unvalued_reason IS NULL THEN (SELECT CASE WHEN l.mileage_km < 1000 THEN seg.zero_km_count ELSE seg.comparable_count - seg.zero_km_count END
              FROM public.valuation_segment seg
             WHERE seg.valuation_run_id = run_id AND seg.model_id = l.model_id) END AS same_zero_km_count,
           CASE WHEN l.unvalued_reason IS NULL THEN (SELECT vc.is_outlier FROM public.valuation_comparable vc
             WHERE vc.valuation_run_id = run_id AND vc.listing_id = l.id) END AS is_outlier,
           CASE WHEN l.unvalued_reason IS NULL THEN
           (SELECT sum(k.coefficient) FROM public.valuation_coefficient k
             WHERE k.valuation_run_id = run_id AND k.model_id = l.model_id
               AND (k.term = 'model_level' OR (k.term = 'trim_level' AND k.trim_id = l.trim_id)))
           + l.age * (SELECT k.coefficient FROM public.valuation_coefficient k
                       WHERE k.valuation_run_id = run_id AND k.term = 'model_age_slope' AND k.model_id = l.model_id)
           + coalesce((SELECT sum(k.coefficient * CASE k.term
                 WHEN 'mileage_deviation'
                   THEN (l.mileage_km - l.mileage_norm_km_per_year * greatest(l.age, 0.5)) / 100000.0
                 WHEN 'zero_km' THEN (l.mileage_km < 1000)::int
                 WHEN 'body_minor' THEN (l.body_condition = 'minor_scratches')::int
                 WHEN 'body_painted' THEN (l.body_condition = 'partly_repainted')::int
                 WHEN 'body_painted_around' THEN (l.body_condition = 'repainted_around')::int
                 WHEN 'chassis_repainted' THEN ('repainted' IN (l.front_chassis_condition, l.rear_chassis_condition))::int
                 WHEN 'gearbox_automatic' THEN (l.gearbox = 'automatic')::int
                 WHEN 'dual_fuel_aftermarket' THEN (l.fuel = 'dual_fuel_aftermarket')::int
                 WHEN 'electrified' THEN (l.fuel IN ('hybrid', 'plug_in_hybrid', 'electric'))::int
                 WHEN 'off_colour' THEN (l.colour_family NOT IN ('white', 'black', 'silver', 'grey'))::int
                 ELSE 0 END)
               FROM public.valuation_coefficient k
              WHERE k.valuation_run_id = run_id AND k.model_id IS NULL), 0)
           END AS ln_value
      FROM l
  ),
  v AS (
    SELECT l.price_type, l.asking_price_toman, l.seller_type, l.mileage_km,
           CASE
             WHEN c.unvalued_reason IS NOT NULL THEN c.unvalued_reason
             WHEN c.ln_value IS NULL OR c.segment_count IS NULL OR c.segment_count < 8 THEN 'too_few_comparables'
             WHEN NOT c.rates_listings THEN 'uncertain_segment'
             WHEN c.near_year_count < 3 OR c.same_zero_km_count < 1 THEN 'year_out_of_range'
           END AS unrated_reason,
           round(exp(c.ln_value))::bigint AS value_toman,
           c.is_outlier
      FROM l JOIN c ON c.id = l.id
  ),
  p AS (
    SELECT v.*,
           CASE
             WHEN v.unrated_reason IS NOT NULL THEN v.unrated_reason
             WHEN v.price_type = 'negotiable' THEN 'no_asking_price'
             WHEN v.price_type = 'placeholder' THEN 'placeholder_price'
             WHEN v.price_type = 'installment' THEN 'installment_price'
             -- A dealer's zero-km post shows a teaser (a down payment, a pre-sale or a price "from"), about 20 % below
             -- private zero-km prices on 2026-09-30: valued, not rated, until CS-52 reads what the price means.
             WHEN v.seller_type = 'dealer' AND v.mileage_km < 1000 THEN 'dealer_new_car'
             -- A comparable the fit dropped, or any other listing (a repost, one crawled after the run, a pasted link)
             -- priced beyond a factor of 3 of its value, as comparables rule 7 bounds them.
             WHEN v.is_outlier OR v.asking_price_toman NOT BETWEEN v.value_toman / 3.0 AND v.value_toman * 3.0
               THEN 'price_outlier'
           END AS reason
      FROM v
  ),
  g AS (
    SELECT p.*,
           CASE WHEN p.reason IS NULL
             THEN round((p.asking_price_toman - p.value_toman)::numeric * 100 / p.value_toman, 2)
           END AS gap
      FROM p
  )
  SELECT g.asking_price_toman,
         CASE WHEN g.unrated_reason IS NULL THEN g.value_toman END,
         g.gap::numeric(7,2),
         CASE
           WHEN g.gap IS NULL THEN NULL
           WHEN g.gap <= -10 THEN 'great'::public.deal_rating
           WHEN g.gap <= -4 THEN 'good'::public.deal_rating
           WHEN g.gap < 4 THEN 'fair'::public.deal_rating
           WHEN g.gap < 10 THEN 'high'::public.deal_rating
           ELSE 'overpriced'::public.deal_rating
         END,
         g.reason
    FROM g;
END;
COMMENT ON FUNCTION valuation_rate_listing(bigint, bigint) IS
  'A listing''s asking price, market value, price gap and deal rating (or the reason for none) from a run''s stored coefficients and segments (CS-51, S01); one row, or none when the listing or run does not exist.';

REVOKE EXECUTE ON FUNCTION valuation_rate_listing(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION valuation_rate_listing(bigint, bigint) TO carshenas_worker, carshenas_readonly;
-- The worker opens, closes and deletes runs; a run's rows are only added, and leave with it through the cascades.
GRANT SELECT, INSERT, UPDATE, DELETE ON valuation_run TO carshenas_worker;
GRANT SELECT, INSERT
  ON valuation_coefficient, valuation_segment, valuation_comparable, listing_valuation, listing_valuation_comparable
  TO carshenas_worker;

-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION valuation_rate_listing(bigint, bigint);
DROP TABLE listing_valuation_comparable;
DROP TABLE listing_valuation;
DROP TABLE valuation_comparable;
DROP TABLE valuation_segment;
DROP TABLE valuation_coefficient;
DROP TABLE valuation_run;
DROP TYPE deal_rating;
