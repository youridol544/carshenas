\set ON_ERROR_STOP on
-- planner's row estimate for the search's WHERE clause: about a millisecond, no heap visits
create or replace function listing_match_estimate(tsq tsquery, city int, ymin int, pmax bigint) returns bigint
language plpgsql volatile as $$
declare plan jsonb;
begin
  execute format('explain (format json) select 1 from listing where is_active and search_vector @@ %L::tsquery
                  and (%s = 0 or city_id = %s) and model_year_jalali >= %s and asking_price_toman <= %s',
                 tsq, city, city, ymin, pmax) into plan;
  return (plan->0->'Plan'->>'Plan Rows')::bigint;
end $$;
