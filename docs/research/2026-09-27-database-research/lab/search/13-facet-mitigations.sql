\pset pager off
\timing on
set max_parallel_workers_per_gather = 2;
-- 1. covering index: facet columns ride along, so counts can be index-only scans
create index if not exists listing_active_facet_cover on listing (model_year_jalali, asking_price_toman)
  include (make_id, model_id, city_id) where is_active;
vacuum (analyze) listing;
select pg_size_pretty(pg_relation_size('listing_active_facet_cover')) as cover_index_size;
select pg_prewarm('listing_active_facet_cover');
\echo '=== (m1) all-active facets with the covering index'
explain (analyze, buffers)
select make_id, model_id, city_id, year_band, count(*)
from (select make_id, model_id, city_id,
             case when model_year_jalali < 1390 then 1 when model_year_jalali < 1395 then 2
                  when model_year_jalali < 1400 then 3 else 4 end as year_band
      from listing where is_active) f
group by grouping sets ((make_id), (model_id), (city_id), (year_band), ());
\echo '=== (m1b) filtered facets (price 400M-1.5B, year >= 1390) with the covering index'
explain (analyze, buffers)
select make_id, model_id, city_id, year_band, count(*)
from (select make_id, model_id, city_id,
             case when model_year_jalali < 1390 then 1 when model_year_jalali < 1395 then 2
                  when model_year_jalali < 1400 then 3 else 4 end as year_band
      from listing where is_active and asking_price_toman between 400000000 and 1500000000 and model_year_jalali >= 1390) f
group by grouping sets ((make_id), (model_id), (city_id), (year_band), ());
\echo '=== (m2) all-active facets as separate GROUP BYs (parallel-capable), UNION ALL'
explain (analyze, buffers)
select 'make' as facet, make_id as key, count(*) from listing where is_active group by make_id
union all select 'model', model_id, count(*) from listing where is_active group by model_id
union all select 'city', city_id, count(*) from listing where is_active group by city_id
union all select 'year_band', case when model_year_jalali < 1390 then 1 when model_year_jalali < 1395 then 2
                  when model_year_jalali < 1400 then 3 else 4 end, count(*) from listing where is_active group by 2;
\echo '=== (m3) broad text «بدون رنگ» facets, exact'
explain (analyze, buffers)
select make_id, model_id, city_id, count(*) from listing
where is_active and search_vector @@ '''بدون'' & ''رنگ'''::tsquery
group by grouping sets ((make_id), (model_id), (city_id), ());
\echo '=== (m4) broad text «بدون رنگ» facets, approximate from a 10% block sample (x10)'
explain (analyze, buffers)
select make_id, model_id, city_id, count(*) * 10 as approx from listing tablesample system (10) repeatable (1)
where is_active and search_vector @@ '''بدون'' & ''رنگ'''::tsquery
group by grouping sets ((make_id), (model_id), (city_id), ());
\echo '=== accuracy of the sample for the top models'
with exact as (select model_id, count(*) n from listing where is_active and search_vector @@ '''بدون'' & ''رنگ'''::tsquery group by 1),
     approx as (select model_id, count(*) * 10 n from listing tablesample system (10) repeatable (1)
                where is_active and search_vector @@ '''بدون'' & ''رنگ'''::tsquery group by 1)
select e.model_id, e.n as exact, a.n as approx, round(100.0 * (a.n - e.n) / e.n, 1) as error_pct
from exact e join approx a using (model_id) order by e.n desc limit 6;
