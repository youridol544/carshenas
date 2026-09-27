-- Synthetic listing generator. Call: call generate_listings(300000);
\set ON_ERROR_STOP on
create or replace procedure generate_listings(n int) language plpgsql as $$
declare
  model_total int := (select count(*) from model_pick);
  city_total  int := (select count(*) from city_pick);
  cond_total  int := (select count(*) from cond_pick);
begin
insert into listing (source, make_id, model_id, trim_seq, city_id, model_year_jalali, model_year_gregorian, mileage_km,
                     asking_price_toman, market_value_toman, deal_score, deal_rating, body_condition, gearbox, fuel,
                     seller_type, is_active, first_seen_at, title, description)
with r as materialized (
  select g,
         1 + floor(random() * model_total)::int as model_n,
         1 + floor(random() * city_total)::int  as city_n,
         1 + floor(random() * cond_total)::int  as cond_n,
         random() as r_trim, random() as r_year, random() as r_mile, random_normal(0, 0.07) as gap,
         random() as r_neg, random() as r_fuel, random() as r_seller, random() as r_src, random() as r_active,
         random() as r_seen, random() as r_digits, random() as r_arabic, random() as r_zwnj, random() as r_format,
         random() as r_latin, 3 + floor(random() * 5)::int as n_phrases
  from generate_series(1, n) g
), j as (
  select r.*, m.id as model_id, m.make_id, m.name_fa as model_fa, m.name_en as model_en, m.origin,
         m.base_price_toman, mk.name_fa as make_fa, mk.name_en as make_en, mk.in_title,
         cp.city_id, c.name as cond_name, c.factor as cond_factor,
         t.seq as trim_seq, t.name_fa as trim_fa, coalesce(t.automatic, false) as trim_auto, coalesce(t.price_factor, 1) as trim_factor,
         case when m.origin = 'domestic' then 1403 - floor(power(r.r_year, 1.5) * 18)::int
              else 2024 - floor(power(r.r_year, 1.3) * 14)::int - 621 end as year_j
  from r
  join model_pick mp on mp.n = r.model_n
  join model m on m.id = mp.model_id
  join make mk on mk.id = m.make_id
  join city_pick cp on cp.n = r.city_n
  join cond_pick c on c.n = r.cond_n
  left join trim t on t.model_id = m.id and t.seq = 1 + floor(r.r_trim * greatest(m.trim_count, 1))::int
), k as (
  select j.*,
         greatest(0, 1404 - year_j) as age,
         case when r_mile < 0.04 and year_j >= 1403 then 0
              else (round(greatest(1, 1404 - year_j) * 16000 * (0.4 + r_mile) / 1000) * 1000)::int end as mileage,
         case when r_fuel < 0.15 and origin = 'domestic' then 'dual_fuel'
              when r_fuel < 0.03 and origin = 'import' then 'hybrid' else 'petrol' end as fuel
  from j
), v as (
  select k.*,
         (round(base_price_toman * trim_factor * power(0.93, age) * (1 - least(mileage, 300000) / 300000.0 * 0.15)
                * cond_factor / 1e6) * 1e6)::bigint as market
  from k
), p as (
  select v.*,
         case when r_neg < 0.06 then null else (round(market * (1 - gap) / 5e6) * 5e6)::bigint end as asking
  from v
), t as (
  select p.*,
         case when origin = 'domestic' then year_j::text else (year_j + 621)::text end as year_str,
         case when fuel = 'dual_fuel' then ' دوگانه‌سوز' else '' end as fuel_str
  from p
), titled as (
  select t.*,
         case when r_format < 0.5 then
                concat_ws(' ', case when in_title then make_fa end, model_fa, trim_fa, 'مدل',
                          translate(year_str, '0123456789', '۰۱۲۳۴۵۶۷۸۹'), cond_name) || fuel_str
              when r_format < 0.8 then
                concat_ws(' ', case when in_title then make_fa end, model_fa, trim_fa) || '، مدل '
                || translate(year_str, '0123456789', '۰۱۲۳۴۵۶۷۸۹') || '، ' || cond_name || fuel_str
              else concat_ws(' ', model_fa, trim_fa, translate(year_str, '0123456789', '۰۱۲۳۴۵۶۷۸۹'), cond_name) || fuel_str
         end as clean_title
  from t
)
select
  case when r_src < 0.45 then 'bama' when r_src < 0.65 then 'karnameh' when r_src < 0.80 then 'khodro45' else 'sheypoor' end,
  make_id, model_id, trim_seq, city_id, year_j, year_j + 621, mileage,
  asking, market,
  case when asking is null then null else ((market - asking)::numeric / market)::real end,
  case when asking is null then null
       when (market - asking)::numeric / market >= 0.10 then 'great'
       when (market - asking)::numeric / market >= 0.04 then 'good'
       when (market - asking)::numeric / market > -0.04 then 'fair'
       when (market - asking)::numeric / market > -0.10 then 'high'
       else 'overpriced' end,
  cond_name,
  case when trim_auto or origin = 'import' then 'automatic' else 'manual' end,
  fuel,
  case when r_seller < 0.4 then 'dealer' else 'private' end,
  r_active < 0.85,
  now() - power(r_seen, 2) * interval '120 days',
  -- noise the sources really have: digit scripts, Arabic letters, ZWNJ typed as space or dropped
  (select case when r_zwnj < 0.2 then replace(x3, U&'\200C', ' ') when r_zwnj < 0.3 then replace(x3, U&'\200C', '') else x3 end
     from (select case when r_arabic < 0.12 then translate(x2, 'یک', 'يك') else x2 end as x3
             from (select case when r_digits < 0.30 then translate(clean_title, '۰۱۲۳۴۵۶۷۸۹', '0123456789')
                               when r_digits < 0.35 then translate(clean_title, '۰۱۲۳۴۵۶۷۸۹', '٠١٢٣٤٥٦٧٨٩')
                               else clean_title end as x2) s2) s3),
  (select string_agg(dp.p, '، ') from (select p from desc_phrase where g = g order by random() limit n_phrases) dp)
    || case when r_latin < 0.05 then ' ' || make_en || ' ' || model_en else '' end
from titled;
end $$;
