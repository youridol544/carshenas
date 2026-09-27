\set ON_ERROR_STOP on
-- Vocabulary with title frequency: words from titles (weight A) beat words from descriptions.
alter table search_word add column if not exists ndoc_title int not null default 0;
update search_word sw set ndoc_title = t.ndoc
from ts_stat('select search_vector from listing where is_active', 'A') t where t.word = sw.word;

create or replace function fa_correct_pl(q text) returns text
language plpgsql stable parallel safe as $$
declare
  w text;
  best text;
  out_words text[] := '{}';
  max_edits int;
begin
  foreach w in array regexp_split_to_array(fa_normalize(q), ' ') loop
    if w ~ '^[0-9]+$' or length(w) < 3
       or exists (select 1 from search_word sw where sw.word = w)
       or exists (select 1 from search_alias a where a.t = plainto_tsquery('fa_search', w)) then
      out_words := out_words || w;
      continue;
    end if;
    max_edits := case when length(w) <= 5 then 1 else 2 end;
    select c.word into best
    from (select sw.word, sw.ndoc, sw.ndoc_title,
                 -- a swap of two neighbouring letters counts as one edit (Damerau-Levenshtein)
                 case when length(sw.word) = length(w) and levenshtein_less_equal(sw.word, w, 2) = 2
                           and fa_sorted_letters(sw.word) = fa_sorted_letters(w) then 1
                      else levenshtein_less_equal(sw.word, w, 3) end as edits
          from search_word sw
          where length(sw.word) >= 3 and abs(length(sw.word) - length(w)) <= max_edits) c
    where c.edits <= max_edits
    order by c.edits, c.ndoc_title desc, c.ndoc desc
    limit 1;
    out_words := out_words || coalesce(best, w);
  end loop;
  return array_to_string(out_words, ' ');
end $$;
update bench_query set tsq = fa_query_pl(q)::text;
