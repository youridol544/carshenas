\set ON_ERROR_STOP on
\timing on
set maintenance_work_mem = '256MB';
-- full-text: GIN over the weighted tsvector
create index listing_search_gin on listing using gin (search_vector);
-- typos and similarity: trigram GIN over the normalised title
create index listing_title_trgm on listing using gin (title_norm gin_trgm_ops);
-- sorts over active listings; the (…, id) tail makes keyset pagination deterministic
create index listing_active_deal       on listing (deal_sort desc, id desc)              where is_active;
create index listing_active_price      on listing (asking_price_toman, id)               where is_active;
create index listing_active_mileage    on listing (mileage_km, id)                       where is_active;
create index listing_active_newest     on listing (first_seen_at desc, id desc)          where is_active;
create index listing_active_year       on listing (model_year_jalali desc, id desc)      where is_active;
-- the most common filter combinations lead with an equality column, then the default sort
create index listing_active_model_deal on listing (model_id, deal_sort desc, id desc)    where is_active;
create index listing_active_make_deal  on listing (make_id, deal_sort desc, id desc)     where is_active;
create index listing_active_city_deal  on listing (city_id, deal_sort desc, id desc)     where is_active;
vacuum (analyze) listing;
select relname as index, pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes where relname = 'listing' or indexrelname like 'listing%' order by pg_relation_size(indexrelid) desc;
select pg_size_pretty(pg_table_size('listing')) as heap_and_toast, pg_size_pretty(pg_indexes_size('listing')) as indexes,
       pg_size_pretty(pg_total_relation_size('listing')) as total;
