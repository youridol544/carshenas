\set ON_ERROR_STOP on
\timing on
-- Vocabulary of indexed words, for "did you mean" correction with pg_trgm.
drop table if exists search_word;
create table search_word as
  select word, ndoc from ts_stat('select search_vector from listing where is_active');
alter table search_word add primary key (word);
create index search_word_trgm on search_word using gin (word gin_trgm_ops);
analyze search_word;
select count(*) as vocabulary_size from search_word;

-- Replace each query word that is not in the vocabulary by its most similar known word.
-- Words shorter than 3 characters and numbers are kept as typed.
create or replace function fa_correct(q text) returns text
language sql stable parallel safe
return (
  select string_agg(coalesce(
           case when w ~ '^[0-9]+$' or length(w) < 3
                  or exists (select 1 from search_word sw where sw.word = w)
                  or exists (select 1 from search_alias a where a.t = plainto_tsquery('fa_search', w)) then w end,
           (select sw.word from search_word sw
             where sw.word % w
             order by similarity(sw.word, w) desc, sw.ndoc desc limit 1),
           w), ' ' order by ord)
  from regexp_split_to_table(fa_normalize(q), ' ') with ordinality as t(w, ord)
);

-- Query builder: normalise, correct, parse, then apply the alias table.
create or replace function fa_query(q text) returns tsquery
language sql stable parallel safe
return ts_rewrite(websearch_to_tsquery('fa_search', fa_correct(q)), 'select t, s from search_alias');
