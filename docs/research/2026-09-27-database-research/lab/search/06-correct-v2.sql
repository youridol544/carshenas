\set ON_ERROR_STOP on
create extension if not exists fuzzystrmatch;
create or replace function fa_sorted_letters(x text) returns text
language sql immutable parallel safe strict
return (select string_agg(c, '' order by c) from regexp_split_to_table(x, '') as c);
-- Elasticsearch-style AUTO fuzziness over the vocabulary: words of 3-5 letters get one edit,
-- longer words two; ties go to the word more listings contain.
create or replace function fa_correct(q text) returns text
language sql stable parallel safe
return (
  select string_agg(coalesce(
           case when w ~ '^[0-9]+$' or length(w) < 3
                  or exists (select 1 from search_word sw where sw.word = w)
                  or exists (select 1 from search_alias a where a.t = plainto_tsquery('fa_search', w)) then w end,
           (select sw.word from search_word sw
             where length(sw.word) >= 3
               and abs(length(sw.word) - length(w)) <= case when length(w) <= 5 then 1 else 2 end
               and (levenshtein_less_equal(sw.word, w, 2) <= case when length(w) <= 5 then 1 else 2 end
                    -- one swap of neighbouring letters counts as one edit, as in Damerau-Levenshtein
                    or (length(sw.word) = length(w) and levenshtein_less_equal(sw.word, w, 2) = 2
                        and fa_sorted_letters(sw.word) = fa_sorted_letters(w)))
             order by levenshtein_less_equal(sw.word, w, 2), sw.ndoc desc limit 1),
           w), ' ' order by ord)
  from regexp_split_to_table(fa_normalize(q), ' ') with ordinality as t(w, ord)
);
-- Joined compounds (ZWNJ dropped) and split compounds map to both forms.
insert into search_alias (t, s) values
  (to_tsquery('fa_search', 'صندوقدار'),   to_tsquery('fa_search', '(صندوق <-> دار) | صندوقدار')),
  (to_tsquery('fa_search', 'صندوق & دار'), to_tsquery('fa_search', '(صندوق <-> دار) | صندوقدار')),
  (to_tsquery('fa_search', 'دوگانهسوز'),   to_tsquery('fa_search', '(دوگانه <-> سوز) | دوگانهسوز')),
  (to_tsquery('fa_search', 'دوگانه & سوز'), to_tsquery('fa_search', '(دوگانه <-> سوز) | دوگانهسوز')),
  (to_tsquery('fa_search', 'استپوی'),      to_tsquery('fa_search', '(استپ <-> وی) | استپوی')),
  (to_tsquery('fa_search', 'استپ & وی'),   to_tsquery('fa_search', '(استپ <-> وی) | استپوی'))
on conflict (t) do update set s = excluded.s;
