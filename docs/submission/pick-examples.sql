-- Examples for the recording (CS-120). Read-only. From the main checkout:
--
--   pnpm db:psql < docs/submission/pick-examples.sql
--
-- It prints candidates for each scene of docs/submission/shot-list.md from the database the product shows, so the
-- recording uses cars that are on the market the day it is made. Listing ids are this database's ids; the token is
-- Divar's own code for the ad (the last part of its link), which stays the same on another database.
-- Nothing here prints a title, a description, a phone number or a name: only ids, tokens, model, year, kilometres and
-- prices (in millions of tomans).

\pset footer off
\pset null '-'

\echo
\echo '== 0. The state of the data (the valuation day must be today, Tehran time)'
select (now() at time zone 'Asia/Tehran')::timestamp(0) as tehran_now,
       (select as_of_date from valuation_run where status = 'succeeded' order by as_of_date desc, id desc limit 1) as valuation_day,
       (select count(*) from search_document) as searchable,
       (select count(*) from listing where status = 'active') as active,
       (select max(greatest(last_seen_at, last_checked_at)) at time zone 'Asia/Tehran' from listing)::timestamp(0) as newest_read_tehran;

\echo
\echo '== 1. A great deal: rated great, 10 to 20 percent under its market value, paint-free, no accident, ten comparables, a photo'
select d.listing_id as id,
       l.source_listing_key as token,
       m.slug as model,
       d.model_year_sh as year,
       d.mileage_km as km,
       d.asking_price_toman / 1000000 as price_m,
       d.market_value_toman / 1000000 as value_m,
       d.price_gap_pct as gap,
       d.body_condition as body,
       round(extract(epoch from now() - l.last_checked_at) / 3600) as checked_h_ago
from search_document d
join listing l on l.id = d.listing_id
join model m on m.id = d.model_id
where d.deal_rating = 'great'
  and d.price_gap_pct between -20 and -10
  and d.paint_free
  and d.accident is distinct from 'had_accident'
  and d.has_photo
  and (select count(*) from listing_valuation_comparable c
       where c.listing_id = d.listing_id
         and c.valuation_run_id = (select id from valuation_run where status = 'succeeded' order by as_of_date desc, id desc limit 1)) >= 8
order by l.last_checked_at desc nulls last
limit 8;

\echo
\echo '== 2. An expensive one: rated overpriced, 12 to 30 percent over its market value'
select d.listing_id as id,
       l.source_listing_key as token,
       m.slug as model,
       d.model_year_sh as year,
       d.mileage_km as km,
       d.asking_price_toman / 1000000 as price_m,
       d.market_value_toman / 1000000 as value_m,
       d.price_gap_pct as gap,
       round(extract(epoch from now() - l.last_checked_at) / 3600) as checked_h_ago
from search_document d
join listing l on l.id = d.listing_id
join model m on m.id = d.model_id
where d.deal_rating = 'overpriced'
  and d.price_gap_pct between 12 and 30
  and d.has_photo
order by l.last_checked_at desc nulls last
limit 8;

\echo
\echo '== 3. An unrated one with its reason (an instalment sale priced like a down payment, or a price far from the market)'
select d.listing_id as id,
       l.source_listing_key as token,
       m.slug as model,
       d.model_year_sh as year,
       d.mileage_km as km,
       d.asking_price_toman / 1000000 as price_m,
       v.market_value_toman / 1000000 as value_m,
       v.no_rating_reason as reason,
       d.seller_type as seller
from search_document d
join listing l on l.id = d.listing_id
join model m on m.id = d.model_id
join listing_valuation v on v.listing_id = d.listing_id
 and v.valuation_run_id = (select id from valuation_run where status = 'succeeded' order by as_of_date desc, id desc limit 1)
where d.deal_rating is null
  and v.no_rating_reason in ('installment_price', 'price_outlier')
  and d.asking_price_toman is not null
  and d.has_photo
order by v.no_rating_reason, l.last_checked_at desc nulls last
limit 8;

\echo
\echo '== 4. A price drop on a rated listing (the last three days)'
select e.listing_id as id,
       l.source_listing_key as token,
       m.slug as model,
       d.model_year_sh as year,
       d.mileage_km as km,
       e.previous_price_toman / 1000000 as was_m,
       e.asking_price_toman / 1000000 as now_m,
       round((e.asking_price_toman - e.previous_price_toman) * 100.0 / e.previous_price_toman, 1) as change_pct,
       (e.observed_at at time zone 'Asia/Tehran')::timestamp(0) as seen_tehran,
       d.deal_rating as rating
from listing_price_event e
join search_document d on d.listing_id = e.listing_id
join listing l on l.id = e.listing_id
join model m on m.id = d.model_id
where e.price_type = 'asking'
  and e.previous_price_type = 'asking'
  and e.asking_price_toman < e.previous_price_toman
  and (e.previous_price_toman - e.asking_price_toman) * 100.0 / e.previous_price_toman >= 4
  and e.observed_at > now() - interval '3 days'
  and d.deal_rating is not null
  and d.has_photo
order by e.observed_at desc
limit 8;

\echo
\echo '== 5. A link to paste: rated, checked in the last 6 hours, so opening it queues no re-check'
select d.listing_id as id,
       'https://divar.ir/v/' || l.source_listing_key as link,
       m.slug as model,
       d.model_year_sh as year,
       d.mileage_km as km,
       d.asking_price_toman / 1000000 as price_m,
       d.deal_rating as rating,
       round(extract(epoch from now() - l.last_checked_at) / 3600, 1) as checked_h_ago
from search_document d
join listing l on l.id = d.listing_id
join model m on m.id = d.model_id
where d.deal_rating is not null
  and l.last_checked_at > now() - interval '6 hours'
order by l.last_checked_at desc
limit 8;

\echo
\echo '== 6. Why searchable listings have no rating (the shape of the honest part)'
select coalesce(v.no_rating_reason, 'not in today''s run yet') as reason, count(*) as listings
from search_document d
left join listing_valuation v on v.listing_id = d.listing_id
 and v.valuation_run_id = (select id from valuation_run where status = 'succeeded' order by as_of_date desc, id desc limit 1)
where d.deal_rating is null
group by 1
order by 2 desc;

\echo
\echo '== 7. Tracked models, how many listings each has, and whether a photo link is set for it (CS-113)'
select m.slug as model,
       mk.slug as make,
       count(d.listing_id) as searchable,
       count(d.listing_id) filter (where d.deal_rating is not null) as rated,
       (p.model_id is not null) as has_photo_link
from tracked_model t
join model m on m.id = t.model_id
join make mk on mk.id = m.make_id
left join search_document d on d.model_id = m.id
left join model_photo_link p on p.model_id = m.id
group by m.slug, mk.slug, p.model_id
order by searchable desc;
