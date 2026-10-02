-- migrate:up
-- An instalment-accepting listing priced far below its market value is valued but not rated (CS-87; docs/specs/
-- S01-deal-ratings.md, "Price gap and ratings"). Divar's row «امکان خرید قسطی: دارد» (listing.accepts_installments) marks a
-- post whose price is often a down payment or a first instalment, which lands near half the market value: on 2026-10-02
-- the three best deals of the default search (5432 at -50.2 %, 3685 at -49.6 %, 4594 at -48.3 %) were all of them, each
-- rated «معامله‌ی عالی». Of 4,004 rated listings 270 accept instalments, and of the 27 that lie 20 % or more below
-- their value 4 do (the three, and 6872 at -24.5 %); the other 23 are cash listings and keep their rating. The structured
-- field plus a gap of -20 % or beyond is a rule that is stated and proved without a model, and it uses the existing
-- reason installment_price. It lives in valuation_rate_listing(), so the daily run, a listing crawled between runs and a
-- pasted link agree. The gap is needed to choose the reason, so it is computed first; the stored gap stays null for an
-- unrated listing, as listing_valuation_gap_only_when_rated requires and search's best-deal order relies on. Every other
-- outcome is as before: the guard applies only to a listing that the earlier reasons left rated, so a price outlier, a
-- dealer's zero-km post or an instalment price keeps its reason. CREATE OR REPLACE keeps the function's grants.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION valuation_rate_listing(run_id bigint, rated_listing_id bigint)
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
    SELECT l.price_type, l.asking_price_toman, l.seller_type, l.mileage_km, l.accepts_installments,
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
  ),
  f AS (
    -- The reason once the gap is known. A listing that accepts instalments and asks 20 % or more below its value (CS-87)
    -- shows a down payment or a first instalment, not the car's price: valued, not rated, as a negotiable one is.
    SELECT g.*,
           CASE
             WHEN g.reason IS NOT NULL THEN g.reason
             WHEN g.accepts_installments AND g.gap <= -20 THEN 'installment_price'
           END AS final_reason
      FROM g
  )
  SELECT f.asking_price_toman,
         CASE WHEN f.unrated_reason IS NULL THEN f.value_toman END,
         (CASE WHEN f.final_reason IS NULL THEN f.gap END)::numeric(7,2),
         CASE
           WHEN f.final_reason IS NOT NULL OR f.gap IS NULL THEN NULL
           WHEN f.gap <= -10 THEN 'great'::public.deal_rating
           WHEN f.gap <= -4 THEN 'good'::public.deal_rating
           WHEN f.gap < 4 THEN 'fair'::public.deal_rating
           WHEN f.gap < 10 THEN 'high'::public.deal_rating
           ELSE 'overpriced'::public.deal_rating
         END,
         f.final_reason
    FROM f;
END;
COMMENT ON FUNCTION valuation_rate_listing(bigint, bigint) IS
  'A listing''s asking price, market value, price gap and deal rating (or the reason for none) from a run''s stored coefficients and segments (CS-51, S01); one row, or none when the listing or run does not exist. A listing that accepts instalments and asks 20 % or more below its value is valued but not rated, with the reason installment_price (CS-87).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Back to the function CS-51 created: no guard, the gap chosen with the reason.
CREATE OR REPLACE FUNCTION valuation_rate_listing(run_id bigint, rated_listing_id bigint)
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
