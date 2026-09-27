-- Catalogue for the lab: makes, models, trims and cities of the Iranian used-car market.
-- Base prices are rough 1404 toman levels, only to give prices a realistic spread.
\set ON_ERROR_STOP on
alter table make add column in_title boolean not null default true;

insert into make (id, name_fa, name_en, weight, in_title) values
 (1,'پژو','Peugeot',26,true), (2,'سایپا','Saipa',24,false), (3,'ایران‌خودرو','Iran Khodro',16,false),
 (4,'رنو','Renault',7,true), (5,'کیا','Kia',4,true), (6,'هیوندای','Hyundai',5,true), (7,'تویوتا','Toyota',3,true),
 (8,'ام‌وی‌ام','MVM',5,true), (9,'چری','Chery',3,true), (10,'جک','JAC',2,true), (11,'برلیانس','Brilliance',2,true),
 (12,'هایما','Haima',1,true), (13,'لیفان','Lifan',1,true), (14,'مزدا','Mazda',1,true), (15,'بنز','Mercedes-Benz',1,true);

insert into model (id, make_id, name_fa, name_en, origin, base_price_toman, weight) values
 (1,1,'۲۰۶','206','domestic',620000000,30), (2,1,'۲۰۷','207','domestic',900000000,18), (3,1,'۴۰۵','405','domestic',560000000,12),
 (4,1,'پارس','Pars','domestic',700000000,16), (5,1,'۲۰۰۸','2008','import',2300000000,2),
 (6,2,'پراید','Pride','domestic',330000000,30), (7,2,'تیبا','Tiba','domestic',450000000,16), (8,2,'ساینا','Saina','domestic',480000000,12),
 (9,2,'کوییک','Quick','domestic',520000000,12), (10,2,'شاهین','Shahin','domestic',780000000,8),
 (11,3,'سمند','Samand','domestic',600000000,16), (12,3,'دنا','Dena','domestic',950000000,16), (13,3,'رانا','Runna','domestic',680000000,10),
 (14,3,'تارا','Tara','domestic',1100000000,8),
 (15,4,'تندر ۹۰','Tondar 90','domestic',800000000,12), (16,4,'ساندرو','Sandero','domestic',950000000,5),
 (17,5,'سراتو','Cerato','import',1900000000,8), (18,5,'اسپورتیج','Sportage','import',2800000000,6), (19,5,'اپتیما','Optima','import',2600000000,4),
 (20,5,'ریو','Rio','import',1100000000,4),
 (21,6,'النترا','Elantra','import',2000000000,6), (22,6,'سوناتا','Sonata','import',3200000000,6), (23,6,'توسان','Tucson','import',2900000000,5),
 (24,6,'سانتافه','Santa Fe','import',3800000000,4), (25,6,'آزرا','Azera','import',3500000000,3),
 (26,7,'کمری','Camry','import',4200000000,5), (27,7,'کرولا','Corolla','import',2400000000,4), (28,7,'پرادو','Prado','import',7500000000,2),
 (29,7,'لندکروزر','Land Cruiser','import',14000000000,1), (30,7,'یاریس','Yaris','import',1600000000,3),
 (31,8,'X22','X22','domestic',950000000,8), (32,8,'X33','X33','domestic',1200000000,6), (33,8,'۳۱۵','315','domestic',700000000,4),
 (34,8,'۱۱۰','110','domestic',480000000,4),
 (35,9,'تیگو ۷','Tiggo 7','domestic',1900000000,5), (36,9,'تیگو ۸','Tiggo 8','domestic',2700000000,3),
 (37,9,'آریزو ۵','Arrizo 5','domestic',1150000000,5), (38,9,'آریزو ۶','Arrizo 6','domestic',1500000000,3),
 (39,10,'S5','S5','domestic',1400000000,4), (40,10,'J4','J4','domestic',1050000000,3), (41,10,'S3','S3','domestic',1000000000,3),
 (42,11,'H330','H330','domestic',850000000,4), (43,11,'H230','H230','domestic',780000000,3), (44,11,'H320','H320','domestic',820000000,2),
 (45,12,'S7','S7','domestic',1300000000,3), (46,12,'S5','S5','domestic',1150000000,2),
 (47,13,'X60','X60','domestic',850000000,3), (48,13,'۶۲۰','620','domestic',600000000,2),
 (49,14,'۳','3','import',1800000000,3), (50,14,'کارا','Kara','domestic',900000000,3),
 (51,15,'C200','C200','import',6500000000,1), (52,15,'E250','E250','import',8000000000,1);

insert into trim (model_id, seq, name_fa, automatic, price_factor) values
 (1,1,'تیپ ۲',false,1.0),(1,2,'تیپ ۵',false,1.08),(1,3,'SD V8',false,1.05),
 (2,1,'دنده‌ای',false,1.0),(2,2,'اتوماتیک',true,1.12),(2,3,'پانوراما',false,1.08),
 (3,1,'GLX',false,1.0),(3,2,'SLX',false,1.05),
 (4,1,'ساده',false,1.0),(4,2,'ELX',false,1.1),(4,3,'LX',false,1.03),
 (6,1,'۱۳۱ SE',false,1.0),(6,2,'۱۱۱ SE',false,1.02),(6,3,'۱۳۲',false,0.98),
 (7,1,'صندوق‌دار',false,1.0),(7,2,'هاچبک',false,1.02),
 (8,1,'دستی',false,1.0),(8,2,'S',false,1.05),
 (9,1,'دستی',false,1.0),(9,2,'R',false,1.06),(9,3,'S',false,1.04),(9,4,'اتوماتیک',true,1.2),
 (10,1,'G',false,1.0),(10,2,'CVT',true,1.15),
 (11,1,'LX',false,1.0),(11,2,'EF7',false,1.06),(11,3,'سورن',false,1.1),
 (12,1,'معمولی',false,1.0),(12,2,'پلاس',false,1.1),(12,3,'پلاس توربو',false,1.25),
 (13,1,'LX',false,1.0),(13,2,'پلاس',false,1.08),
 (14,1,'دستی',false,1.0),(14,2,'اتوماتیک',true,1.2),
 (15,1,'E2',false,1.0),(15,2,'پلاس',false,1.1),(15,3,'استپ‌وی',false,1.12),
 (16,1,'دستی',false,1.0),(16,2,'اتوماتیک',true,1.12),(16,3,'استپ‌وی',false,1.1),
 (17,1,'۲۰۰۰',true,1.0),(17,2,'۱۶۰۰',true,0.9),
 (22,1,'LF',true,1.0),(22,2,'YF',true,0.85),(22,3,'هیبرید',true,1.1),
 (26,1,'GLX',true,1.0),(26,2,'هیبرید',true,1.1),
 (31,1,'دستی',false,1.0),(31,2,'اتوماتیک',true,1.12),
 (32,1,'S',false,1.0),(32,2,'کراس',false,1.08),
 (35,1,'معمولی',true,1.0),(35,2,'پرو',true,1.08),
 (37,1,'TXL',false,1.05),(37,2,'اسپرت',false,1.1),
 (42,1,'دستی',false,1.0),(42,2,'اتوماتیک',true,1.1),
 (45,1,'توربو',true,1.0),
 (49,1,'تیپ ۴',true,1.0);
update model m set trim_count = (select count(*) from trim t where t.model_id = m.id);

insert into city (id, name_fa, weight) values
 (1,'تهران',52),(2,'کرج',8),(3,'مشهد',7),(4,'اصفهان',6),(5,'شیراز',5),(6,'تبریز',4),(7,'قم',3),(8,'اهواز',3),
 (9,'رشت',2),(10,'کرمانشاه',2),(11,'ارومیه',2),(12,'یزد',1),(13,'ساری',1),(14,'قزوین',1),(15,'کرمان',1),(16,'همدان',1),(17,'اراک',1);

create table cond_pick (n int primary key, name text not null, factor numeric not null);
insert into cond_pick
select row_number() over (order by v.ord, g), v.name, v.factor
from (values (1,'بدون رنگ',1.0,40),(2,'یک لکه رنگ',0.97,14),(3,'دو لکه رنگ',0.95,9),(4,'گلگیر رنگ',0.95,7),
             (5,'کاپوت رنگ',0.93,6),(6,'دور رنگ',0.85,6),(7,'تمام رنگ',0.78,3),(8,'تعویض کاپوت',0.9,5),
             (9,'تعویض درب',0.92,4),(10,'تعویض گلگیر',0.93,4),(11,'صافکاری بدون رنگ',0.98,2)) v(ord,name,factor,w),
     generate_series(1, v.w) g;

create table model_pick as
  select row_number() over (order by m.id, g)::int as n, m.id as model_id from model m, generate_series(1, m.weight) g;
create table city_pick as
  select row_number() over (order by c.id, g)::int as n, c.id as city_id from city c, generate_series(1, c.weight) g;
alter table model_pick add primary key (n);
alter table city_pick add primary key (n);

create table desc_phrase (p text not null);
insert into desc_phrase values ('فنی سالم'),('موتور سالم'),('گیربکس سالم'),('شاسی سالم'),('بیمه ۶ ماه'),('بیمه ۱۰ ماه'),
 ('بیمه تا آخر سال'),('لاستیک‌ها ۸۰ درصد'),('لاستیک نو'),('کولر سرد'),('دست اول'),('سند تک‌برگ'),('سند آزاد'),
 ('کارشناسی شده'),('قابل کارشناسی در محل'),('بدون تصادف'),('بدون خط و خش'),('معاوضه با خودروی پایین‌تر'),
 ('معاوضه نمی‌کنم'),('قیمت مقطوع'),('قیمت کمی قابل تخفیف'),('تعویض روغن به‌موقع'),('سرویس کامل'),('رینگ اسپرت'),
 ('سیستم صوتی'),('سنسور دنده عقب'),('دوربین دنده عقب'),('بدون دود'),('موتور تازه تعمیر'),('کیلومتر واقعی'),
 ('فقط تماس'),('پلاک ملی'),('پلاک تهران'),('رنگ فابریک'),('داخل تمیز'),('صندلی‌ها تمیز'),('آپشن کامل'),
 ('سانروف'),('استارت دکمه‌ای'),('اقساط ندارد');

-- Latin names and transliterations mapped to the normalised Persian lexeme, plus Persian
-- spelling variants. The substitute keeps the original term so literal matches still count.
insert into search_alias (t, s)
select distinct on (t) t, s from (
  select to_tsquery('fa_search', a.latin) as t,
         to_tsquery('fa_search', quote_literal(fa_normalize(a.fa)) || ' | ' || quote_literal(a.latin)) as s
  from (values ('peugeot','پژو'),('pezho','پژو'),('pejo','پژو'),('peugot','پژو'),('saipa','سایپا'),('pride','پراید'),
               ('tiba','تیبا'),('saina','ساینا'),('quick','کوییک'),('shahin','شاهین'),('samand','سمند'),('dena','دنا'),
               ('runna','رانا'),('rana','رانا'),('tara','تارا'),('renault','رنو'),('reno','رنو'),('tondar','تندر'),
               ('sandero','ساندرو'),('kia','کیا'),('cerato','سراتو'),('sportage','اسپورتیج'),('optima','اپتیما'),('rio','ریو'),
               ('hyundai','هیوندای'),('elantra','النترا'),('sonata','سوناتا'),('tucson','توسان'),('azera','آزرا'),
               ('toyota','تویوتا'),('camry','کمری'),('corolla','کرولا'),('prado','پرادو'),('yaris','یاریس'),
               ('chery','چری'),('tiggo','تیگو'),('arrizo','آریزو'),('jac','جک'),('brilliance','برلیانس'),('haima','هایما'),
               ('lifan','لیفان'),('mazda','مزدا'),('benz','بنز'),('mercedes','بنز'),('plus','پلاس'),('turbo','توربو'),
               ('tip','تیپ'),('type','تیپ'),('automatic','اتوماتیک'),('auto','اتوماتیک'),('pars','پارس'),('mvm','ام وی ام')) a(latin, fa)
  union all
  -- Persian spelling variants seen in listings
  select to_tsquery('fa_search', quote_literal(fa_normalize(v.variant))),
         to_tsquery('fa_search', quote_literal(fa_normalize(v.canonical)) || ' | ' || quote_literal(fa_normalize(v.variant)))
  from (values ('کوئیک','کوییک'),('هیوندا','هیوندای'),('هیوندائی','هیوندای'),('پرشیا','پارس'),('ال ایکس','LX')) v(variant, canonical)
) x;
