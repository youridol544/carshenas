-- Carshenas search lab, schema. PostgreSQL 17, extensions shipped with core only.
\set ON_ERROR_STOP on
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() is STABLE because it reads a dictionary by name; pinning the dictionary
-- by schema-qualified name inside an IMMUTABLE wrapper is the usual workaround.
-- The promise we make: the unaccent rules file never changes without a rebuild.
create or replace function immutable_unaccent(t text) returns text
language sql immutable parallel safe strict
return public.unaccent('public.unaccent'::regdictionary, t);

-- Persian normalisation for both documents and queries. IMMUTABLE so it can feed
-- generated columns and expression indexes. Mapping follows Lucene's Persian and
-- Arabic normalisers, but folds towards the Persian letters (ی ک) like AGENTS.md says.
create or replace function fa_normalize(t text) returns text
language sql immutable parallel safe strict
return btrim(regexp_replace(
  regexp_replace(
    regexp_replace(
      lower(immutable_unaccent(
        translate(normalize(t, NFKC),
          -- mapped characters (one-to-one with the second argument)
          U&'\064A\0649\0643\06C0\0629\06C1\0623\0625\0622\0671'   -- ي ى ك ۀ ة ہ أ إ آ ٱ
          || U&'\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9' -- Persian digits
          || U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669' -- Arabic-Indic digits
          || U&'\200C\00A0\202F\066B'                                -- ZWNJ, NBSP, NNBSP, Arabic decimal sep
          -- deleted characters (no counterpart): tatweel, harakat, superscript alef,
          -- ZWJ, LRM, RLM, ALM, BOM, soft hyphen, Arabic thousands separator, bidi controls
          || U&'\0640\064B\064C\064D\064E\064F\0650\0651\0652\0653\0654\0655\0670'
          || U&'\200D\200E\200F\061C\FEFF\00AD\066C\202A\202B\202C\202D\202E\2066\2067\2068\2069',
          U&'\06CC\06CC\06A9\0647\0647\0647\0627\0627\0627\0627'     -- ی ی ک ه ه ه ا ا ا ا
          || '0123456789'
          || '0123456789'
          || '   .'))),
      -- split Arabic-script letters from digits: «تیپ۲» -> «تیپ 2», «۲۰۶تیپ» -> «206 تیپ»
      '([ء-يٱ-ۓۺ-ۿ])([0-9])', '\1 \2', 'g'),
    '([0-9])([ء-يٱ-ۓۺ-ۿ])', '\1 \2', 'g'),
  '\s+', ' ', 'g'));

-- A search configuration of our own, a copy of 'simple' (no stemming, no stop words):
-- PostgreSQL ships no Persian configuration, and the Arabic Snowball stemmer mangles
-- Persian (it turns «بدون» into «دون»). Owning the name lets us add dictionaries later.
drop text search configuration if exists fa_search;
create text search configuration fa_search (copy = pg_catalog.simple);

-- Catalogue (CS-10 will own the real one).
create table make  (id smallint primary key, name_fa text not null, name_en text not null, weight int not null);
create table model (id smallint primary key, make_id smallint not null references make, name_fa text not null,
                    name_en text not null, origin text not null check (origin in ('domestic','import')),
                    base_price_toman bigint not null, weight int not null, trim_count int not null default 0);
create table trim  (model_id smallint not null references model, seq int not null, name_fa text not null,
                    automatic boolean not null default false, price_factor numeric not null default 1,
                    primary key (model_id, seq));
create table city  (id smallint primary key, name_fa text not null, weight int not null);

create table listing (
  id                   bigint generated always as identity primary key,
  source               text not null check (source in ('bama','karnameh','khodro45','sheypoor')),
  make_id              smallint not null references make,
  model_id             smallint not null references model,
  trim_seq             int,
  city_id              smallint not null references city,
  model_year_jalali    smallint not null,
  model_year_gregorian smallint not null,
  mileage_km           integer not null check (mileage_km >= 0),
  asking_price_toman   bigint check (asking_price_toman > 0),          -- null = «توافقی»
  market_value_toman   bigint check (market_value_toman > 0),
  deal_score           real,                                           -- (market - asking) / market
  deal_rating          text check (deal_rating in ('great','good','fair','high','overpriced')),
  body_condition       text not null,
  gearbox              text not null check (gearbox in ('manual','automatic')),
  fuel                 text not null check (fuel in ('petrol','dual_fuel','hybrid','electric')),
  seller_type          text not null check (seller_type in ('dealer','private')),
  is_active            boolean not null,
  first_seen_at        timestamptz not null,
  title                text not null,
  description          text,
  -- keyset pagination needs a non-null sort key: unrated listings sort last
  deal_sort            real generated always as (coalesce(deal_score, -1000)) stored,
  title_norm           text generated always as (fa_normalize(title)) stored,
  search_vector        tsvector generated always as (
                         setweight(to_tsvector('fa_search'::regconfig, fa_normalize(title)), 'A') ||
                         setweight(to_tsvector('fa_search'::regconfig, coalesce(fa_normalize(description), '')), 'C')
                       ) stored
);

-- Synonyms and transliterations, applied to the query with ts_rewrite (no server files needed).
create table search_alias (t tsquery primary key, s tsquery not null);
