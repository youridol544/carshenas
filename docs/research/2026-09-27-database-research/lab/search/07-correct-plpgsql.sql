\set ON_ERROR_STOP on
-- Same logic as fa_correct, in PL/pgSQL so its query plans are cached per session.
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
    select sw.word into best from search_word sw
     where length(sw.word) >= 3
       and abs(length(sw.word) - length(w)) <= max_edits
       and (levenshtein_less_equal(sw.word, w, 2) <= max_edits
            or (length(sw.word) = length(w) and levenshtein_less_equal(sw.word, w, 2) = 2
                and fa_sorted_letters(sw.word) = fa_sorted_letters(w)))
     order by levenshtein_less_equal(sw.word, w, 2), sw.ndoc desc
     limit 1;
    out_words := out_words || coalesce(best, w);
  end loop;
  return array_to_string(out_words, ' ');
end $$;

create or replace function fa_query_pl(q text) returns tsquery
language plpgsql stable parallel safe as $$
begin
  return ts_rewrite(websearch_to_tsquery('fa_search', fa_correct_pl(q)), 'select t, s from search_alias');
end $$;
