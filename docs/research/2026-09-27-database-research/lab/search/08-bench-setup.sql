\set ON_ERROR_STOP on
-- Query sets the benchmarks draw from at random.
drop table if exists bench_query;
create table bench_query (kind text not null, n int not null, q text not null, primary key (kind, n));
insert into bench_query (kind, n, q)
select 'text', row_number() over (), q from (values
  ('پژو ۲۰۶'),('۲۰۶ تیپ ۲'),('دنا پلاس توربو'),('کوییک اتوماتیک'),('بدون رنگ'),('تیبا صندوق‌دار'),('سمند دوگانه‌سوز'),
  ('پراید ۱۳۱'),('هیوندای سوناتا'),('تارا اتوماتیک'),('ساینا'),('شاهین CVT'),('X22 اتوماتیک'),('پژو'),
  ('سراتو ۲۰۰۰'),('بیمه تا آخر سال'),('تندر ۹۰ پلاس'),('کیا اسپورتیج'),('پارس ELX'),('رانا پلاس')) v(q);
insert into bench_query (kind, n, q)
select 'typo', row_number() over (), q from (values
  ('پزو ۲۰۶'),('پژوو ۲۰۶'),('دتا پلاس'),('تبیا صندوقدار'),('هیونادی سوناتا'),('سمن دوگانه سوز'),('اسپرتیج'),
  ('لندکروز'),('کوئیک اتوماتیک'),('سوناتاا'),('سراتوو ۲۰۰۰'),('شاهبن'),('تاار اتوماتیک'),('ساندور')) v(q);
insert into bench_query (kind, n, q)
select 'latin', row_number() over (), q from (values
  ('peugeot 206'),('pezho 206 tip 2'),('dena plus turbo'),('kia cerato'),('hyundai sonata'),('saipa quick'),
  ('samand lx'),('toyota camry'),('mvm x22'),('renault tondar 90'),('tiba'),('pride 131'),('tara automatic'),('pejo pars')) v(q);
-- Precomputed tsqueries, so benchmarks can also time the search alone.
alter table bench_query add column tsq text;
update bench_query set tsq = fa_query_pl(q)::text;
select kind, n, q, tsq from bench_query order by kind, n;

-- Keyset positions: the 980th row (end of page 49) for each sort, so page 50 starts after it.
drop table if exists bench_key;
create table bench_key as
select 'all_deal_p50' as scenario, deal_sort, id from listing where is_active order by deal_sort desc, id desc offset 979 limit 1;
insert into bench_key
select 'all_deal_p500', deal_sort, id from listing where is_active order by deal_sort desc, id desc offset 9979 limit 1;
insert into bench_key
select 'tehran_deal_p50', deal_sort, id from listing where is_active and city_id = 1 order by deal_sort desc, id desc offset 979 limit 1;
select * from bench_key;
