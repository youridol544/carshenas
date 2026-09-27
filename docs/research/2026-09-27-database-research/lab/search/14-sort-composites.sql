\pset pager off
\timing on
\echo '=== BEFORE: Benz E250 (model 52), cheapest first'
explain (analyze, buffers) select id, title, asking_price_toman from listing
where is_active and model_id = 52 and asking_price_toman is not null order by asking_price_toman, id limit 20;
\echo '=== BEFORE: Pride (model 6), most expensive first is not offered; lowest mileage for Land Cruiser (29) in Karaj (2)'
explain (analyze, buffers) select id, title from listing where is_active and model_id = 29 and city_id = 2 order by mileage_km, id limit 20;
-- equality column first, then each sort key
create index listing_active_model_price   on listing (model_id, asking_price_toman, id)          where is_active;
create index listing_active_model_mileage on listing (model_id, mileage_km, id)                 where is_active;
create index listing_active_model_newest  on listing (model_id, first_seen_at desc, id desc)    where is_active;
create index listing_active_model_year    on listing (model_id, model_year_jalali desc, id desc) where is_active;
analyze listing;
select sum(pg_prewarm(c.oid)) from pg_class c where c.relname like 'listing_active_model_%';
\echo '=== AFTER: Benz E250 (model 52), cheapest first'
explain (analyze, buffers) select id, title, asking_price_toman from listing
where is_active and model_id = 52 and asking_price_toman is not null order by asking_price_toman, id limit 20;
\echo '=== AFTER: lowest mileage for Land Cruiser (29) in Karaj (2)'
explain (analyze, buffers) select id, title from listing where is_active and model_id = 29 and city_id = 2 order by mileage_km, id limit 20;
