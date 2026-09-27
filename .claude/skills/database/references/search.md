# Search in PostgreSQL: Persian text, filters, sorts, facets and counts

PostgreSQL is the search engine (owner, 2026-09-27; ADR-0011). The research pass measured the design below at 100,000, 300,000 and 1,000,000 synthetic listings on PostgreSQL 17 (appendix `search.md`, whose section numbers are cited as "search §n"); the pieces that depend on the database's locale were re-checked on our PostgreSQL 18 with the builtin C.UTF-8 locale on 2026-09-27. It serves CS-14 (the search API), CS-15 (plain Farsi into filters) and CS-16 (the results page). Nothing here is installed yet; CS-14 builds it with a labelled query set, because 14 of 14 corrected typos in the lab proves the mechanism, not the accuracy.

## What the numbers say

| Case | 100,000 listings | 300,000 | 1,000,000 |
|---|---|---|---|
| A whole search call (build the query, first 20 results, facets, total), one client | p95 23 ms | p50 14 ms, p95 92 ms | p50 35 ms, p95 116 ms with sampled facets for broad queries (237 ms exact) |
| At 100 calls per second from 8 clients | | p95 78 ms | saturates near 45 calls/s with live facets; p95 59 ms at 100 calls/s with facets from a cache |
| Browsing one model under any of five sorts | | | p95 0.6 ms |
| Keyset paging, any depth | | | p95 under 1 ms |

The expensive parts are **facet counts over many matches** and **ordering by a computed score**; ordering by an indexed column and filtering are cheap. Design around those two and CS-14's 300 ms p95 holds with room to spare. (search §3, lab numbers)

## The text pipeline

1. **One IMMUTABLE normaliser for documents and queries** (below): NFKC first (folds presentation forms), then Arabic ي ى ك ۀ ة and hamza forms to Persian ی ک ه ا, Persian and Arabic-Indic digits to Latin, the zero-width non-joiner and odd spaces to a space, tatweel, harakat, bidi marks and the Arabic thousands separator removed, `unaccent` through an IMMUTABLE wrapper, lower case, letters split from digits («تیپ۲» → «تیپ 2»), spaces collapsed. It folds towards the Persian letters, which is what AGENTS.md asks; Lucene folds the other way, and either works if documents and queries share the function. Never display normalised text. (Lucene's Arabic and Persian normalisers, W3C's alreq) [search §2.1, §2.2]
2. **A text search configuration of our own, a copy of `simple`** (no stemming, no stop words): PostgreSQL ships no Persian configuration, and the Arabic Snowball stemmer mangles Persian («بدون» becomes «دون»). Owning the name lets dictionaries be added later. Always pass the configuration explicitly: the one-argument `to_tsvector(text)` is only STABLE and cannot feed a generated column or index. (PostgreSQL manual) [search §1.1, §1.2]
3. **A stored generated `tsvector` column with a GIN index**, created with the table: `setweight(to_tsvector('fa_search', fa_normalize(title)), 'A') || setweight(to_tsvector('fa_search', coalesce(fa_normalize(description), '')), 'C')`. Every function in it must be IMMUTABLE; changing the expression later rewrites the table under an ACCESS EXCLUSIVE lock (28.8 s for 300,000 rows), so version the vector: add a new column, backfill in batches, swap. [search §1.2]
4. **Build the query once, in a PL/pgSQL function, and pass the result as a constant**: normalise, correct typos against the vocabulary, rewrite aliases with `ts_rewrite`. A STABLE builder called inside `count(*) FILTER (WHERE … @@ builder(…))` ran once per row and was cancelled after two minutes; a tsquery passed as a constant also lets the planner use column statistics. On PostgreSQL 17 the SQL-function version was re-planned on every call (9.5 ms against 0.16 ms for PL/pgSQL); 18 improves SQL-function plan caching, which is not measured yet. Raw user input goes through `websearch_to_tsquery`, which never raises a syntax error. [search §1.3, §2.7]
5. **Aliases in a table, applied with `ts_rewrite`**, not dictionary files on the server: Latin-typed names («peugeot», «pezho», «dena plus turbo») and joined compounds («صندوقدار», «دوگانه‌سوز», «استپ‌وی») map to the Persian lexemes, kept as an OR with the original. A table can change without reindexing; a thesaurus file cannot, and managed hosts forbid server files. `ts_rewrite(tsquery, text)` is VOLATILE; wrapping it as STABLE is our promise that the table does not change within a statement. CS-10 owns the list with the catalogue. (PostgreSQL manual, Rachid Belaid) [search §1.8, §2.3, §2.4]
6. **Typos against a vocabulary, not against titles**: a `search_word` table built with `ts_stat` over active listings (with title frequencies), searched with `levenshtein` (fuzzystrmatch) within 1 edit for 3 to 5 letters and 2 for longer, counting a swap of neighbours as one edit, never correcting numbers, words under 3 letters, vocabulary words or alias keys, ties to the word more frequent in titles. Without the minimum length «دتا» became «تا»; without the title preference «ساندور» became «سنسور». Trigram similarity is weak on short Persian words (`similarity('پزو','پژو')` is 0.14, also on our database) and trigram search over titles was slow and missed (p95 666 ms): keep pg_trgm for the vocabulary and the catalogue's aliases. (PostgreSQL manual) [search §1.6, §1.7, §2.5]
7. **No Persian stemmer**: titles are makes, models, trims, years and condition words, where stemming matters little; plurals written with a zero-width non-joiner split off by rule 1. Spelled-out numbers («دویست و شش») belong to CS-15's query understanding. [search §2.6]

The locale matters: which characters count as letters for the text parser and for pg_trgm depends on the database's `LC_CTYPE`. Ours is C.UTF-8 (`db/bootstrap/create-database.psql`); on 2026-09-27 it produced 19 trigrams for «پژو ۲۰۶ دوگانه‌سوز» and kept Persian words whole in `to_tsvector('simple', …)`. A database created with `LC_CTYPE=C` would stop treating Persian letters as letters. [search §1.6]

```sql
-- unaccent() is STABLE because it reads a dictionary by name; the wrapper pins it and promises it never changes
-- without a rebuild.
CREATE FUNCTION immutable_unaccent(t text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.unaccent('public.unaccent'::regdictionary, t);

CREATE FUNCTION fa_normalize(t text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN btrim(regexp_replace(regexp_replace(regexp_replace(
    lower(immutable_unaccent(translate(normalize(t, NFKC),
      -- mapped one-to-one: ي ى ك ۀ ة ہ أ إ آ ٱ, Persian digits, Arabic-Indic digits, ZWNJ, NBSP, NNBSP, decimal sign
      U&'\064A\0649\0643\06C0\0629\06C1\0623\0625\0622\0671'
      || U&'\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9'
      || U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669'
      || U&'\200C\00A0\202F\066B'
      -- deleted (no counterpart): tatweel, harakat, superscript alef, ZWJ, LRM, RLM, ALM, BOM, soft hyphen,
      -- Arabic thousands separator, bidi controls
      || U&'\0640\064B\064C\064D\064E\064F\0650\0651\0652\0653\0654\0655\0670'
      || U&'\200D\200E\200F\061C\FEFF\00AD\066C\202A\202B\202C\202D\202E\2066\2067\2068\2069',
      U&'\06CC\06CC\06A9\0647\0647\0647\0627\0627\0627\0627' || '0123456789' || '0123456789' || '   .'))),
    '([ء-يٱ-ۓۺ-ۿ])([0-9])', '\1 \2', 'g'),   -- «تیپ۲» → «تیپ 2»
    '([0-9])([ء-يٱ-ۓۺ-ۿ])', '\1 \2', 'g'),   -- «۲۰۶تیپ» → «206 تیپ»
    '\s+', ' ', 'g'));
```

Checked on PostgreSQL 18.6 with C.UTF-8 on 2026-09-27 (inside a rolled-back transaction): «پژو 206 تيپ 2 مدل ١٣٩٨ بدون رنگ» and «پژو ۲۰۶ تیپ ۲ مدل ۱۳۹۸ بدون‌رنگ» both became «پژو 206 تیپ 2 مدل 1398 بدون رنگ» with equal vectors; «ﻛﻴﺎ ﺍﺳﭙﻮﺭﺗﻴﺞ» became «کیا اسپورتیج», "Citroën C3" "citroen c3", «قیمت ۱٬۲۰۰ میلیون» «قیمت 1200 میلیون». `unaccent` is a trusted extension, so the migration that adds search can create it; add the PGlite `unaccent` module to the schema tests with it. The same idea in a stored generated `title_norm` column serves catalogue matching (CS-10).

## Filters and sorts

- **Keep the default sort on an indexed column.** For 8,960 matches of «پژو ۲۰۶» in Tehran, `ts_rank_cd` mixed with deal score and freshness took p95 91 ms (a score computed for every match means a heap visit per match); the same query ordered by the deal-score column took p95 0.41 ms, because an index scan stops after 20 rows; as make and model filters, which CS-15 produces, 0.19 ms. Best deal first is CarGurus's default and ours. Xata measured a million-match `ts_rank` sort at 25 seconds. [search §1.5]
- **One partial B-tree per sort on active listings**: `(deal_sort DESC, id DESC)`, `(asking_price_toman, id)`, `(mileage_km, id)`, `(listed_at DESC, id DESC)`, `(model_year_sh DESC, id DESC)`, each `WHERE status = 'active'` written as a literal; about 7.7 MB each at 300,000 rows. `deal_sort` is a non-null key (`coalesce(deal_score, -1000)` in the lab) so unrated listings («توافقی», «بدون ارزیابی») sort last and keyset stays simple; prefer an integer (basis points) to a `real`, whose cursor compares wrongly as a literal. [search §3.3, P-20]
- **The LIMIT trap: composites that lead with the equality column.** For "model X, cheapest first, 20 rows" the planner walked the price index and filtered, assuming the model spread evenly; «بنز E250» discarded 761,721 rows (754 ms), and a random mix of models and sorts ran p95 220 ms, p99 549 ms. `(model_id, asking_price_toman, id)`, `(model_id, mileage_km, id)`, `(model_id, listed_at DESC, id DESC)` and `(model_id, model_year_sh DESC, id DESC)` took it to 0.09 ms and the mix to p99 0.79 ms. Car prices, mileage and years are tied to the model: test sorts on skewed data, never uniform data. [search §3.3]
- **Text plus a filter**: the planner chose well by selectivity in the lab (a broad word in Tehran walked the city-and-deal index, a selective phrase used the GIN bitmap and a top-N sort); watch multi-word queries, whose row estimates multiply correlated selectivities (9 estimated, 6,705 actual). [search §2.7, §3.3]
- **Keyset pagination with `(deal_sort, id) < ($1, $2)`**, served by the same index; OFFSET is fine to about page 50 and degrades linearly after. «نمایش بیشتر» keeps the last row's key. [search §3.4]

## Facets and counts

- **All facets from one scan**: `GROUP BY GROUPING SETS ((make_id), (model_id), (city_id), (year_band), ())`, whose empty set `()` is the total, so «نمایش ۱۲۸ آگهی» costs nothing extra. Disjunctive facets (each facet counted without its own filter, so the other cities stay visible) come from `count(*) FILTER (WHERE …)` per facet over rows that fail at most one filter. [search §3.1]
- **Their cost grows linearly with the rows they count**: all active listings took 58 ms at 100,000, 213 ms at 300,000, 581 ms at 1,000,000 (370 ms with a covering index); broad words dominate («بدون رنگ» matched 489,250 of a million). GROUPING SETS ran on one core; four `GROUP BY`s under `UNION ALL` got parallel index-only scans (350 ms against 893 ms). [search §3.2]
- **So the landing page, make pages and model pages read a `facet_count` table the worker refreshes after each crawl batch**; narrower filtered sets are counted live (p95 30 ms at 100,000, 158 ms at 1,000,000 with the covering index); popular query and filter combinations are cached until the next batch; and when the planner's row estimate for a query exceeds about 30,000, facets come from `TABLESAMPLE SYSTEM (10)` times ten (63 ms instead of 471 ms for «بدون رنگ», errors from −0.9 % to +3.5 % on the six largest models) and the total reads «حدود ۴۹۰ هزار آگهی». A capped exact count is not a cheap decision rule: counting to 30,001 still visits 30,001 rows. [search §3.2, §3.5]
- **Counts shown alone**: exact below a cap, «بیش از …» above it, the planner's estimate only for structured filters (it was nearly exact there and useless for text: 3,844 against 17,208). [search §3.5, P-21]

## Rebuilds and hybrid search

- **There is no second store to rebuild**: `REINDEX INDEX CONCURRENTLY` or a versioned backfill (CS-14 #3). A full rebuild of a denormalised search projection is fastest as a shadow table plus a swap (3.4 s for 244,090 rows: load 0.37 s, six indexes 3.0 s) rather than in place (12.8 to 14.6 s, mostly trigram GIN maintenance). [search §1.2, data-model]
- **Keyword and vector results fuse with reciprocal rank fusion in one statement** (`vectors.md`): two CTEs limited to about 50 rows each, `FULL OUTER JOIN` on `id`, score `1/(k + rank)` summed, `k` about 60 tuned on the evaluation set. Not measured on Persian listings yet. [P-44]

## When to add a search engine

Only when one of these fires on production data, and only after the cheaper fix was tried. Then OpenSearch (Apache 2.0) with an outbox drained by the existing worker and a nightly full rebuild, or ParadeDB's `pg_search` if AGPL and single-node are acceptable; **never Elasticsearch, whose download terms name Iran as a prohibited destination** (ADR-0011). PostgreSQL stays the only source of truth, and displayed rows are re-read from it. [search, "Triggers for adding a search engine"]

| # | Trigger | Threshold | Try first |
|---|---|---|---|
| 1 | Search API p95 from the server log, network excluded | above 300 ms for a week, or p99 above 800 ms | EXPLAIN the slow calls; equality-first composites; cached or sampled facets; a read replica |
| 2 | Peak search calls per second against the production box's measured capacity | sustained above half of it (lab, 4 CPUs: about 190 calls/s at 300,000, 45 at 1,000,000 with live facets, 133 with cached facets) | cache facets per query until the next crawl batch; precompute landing, make and model facets; a replica or CPUs |
| 3 | Active listings in the search table (snapshots never count) | above 1 million | keep inactive listings and snapshots out; partition by status |
| 4 | Queries that need text relevance ranking | the product ranks by relevance and common queries match more than 20,000 listings | deal score stays the default sort; CS-15 turns text into filters; RUM for ordering inside the index |
| 5 | Live facet counts | p95 above 250 ms after the covering index, sampling and precomputation | a `facet_count` table; parallel per-facet `GROUP BY`s; pgfaceting |
| 6 | Typo and synonym quality on the labelled query set | recall below 90 %, and Elasticsearch-class fuzzy matching measures at least 5 points better on the same set | grow the alias table from zero-result queries; a catalogue-weighted vocabulary |
| 7 | Search load hurting ingestion | crawl or valuation batches slowed more than two times | route reads to a streaming replica |
| 8 | Elasticsearch-class features | relevance tuning on long free text, highlighting at scale, personalisation, many languages | ParadeDB `pg_search` or OpenSearch, as above |

## What we give up, knowingly

BM25 relevance with corpus statistics, a maintained Persian analyser with a stemmer, Damerau-Levenshtein inside the engine, fast aggregations over hundreds of thousands of matches, and a synonym API that updates without reindexing. None of them is needed for CS-14's criteria (medium confidence); the lab recreated what is needed in about 150 lines of SQL, not relevance ranking. What we avoid: a JVM service wanting about 4 GB for one node, a synchronisation pipeline with a window where sold listings still show, a second store to back up and pay for (Iranian clouds price managed Elasticsearch like managed PostgreSQL). [search, short answer]

Optional extensions, none installed: RUM (ordering inside the index; slower builds), PGroonga (bigrams, but its normaliser does not fold ي/ك or digits), pg_bigm, pgfaceting (its authors warn of rough edges), ParadeDB `pg_search` (AGPL). A hosted extension can disappear (Neon removed `pg_search` for new projects in 2026). [search §1.9]
