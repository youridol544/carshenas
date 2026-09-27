# Can PostgreSQL alone serve Carshenas's search?

- Research pass A for CS-4 (question: PostgreSQL alone, or PostgreSQL plus Elasticsearch?)
- Date: 2026-09-27
- Status: draft for the owner; nothing in the repository was changed
- Related: ADR-0007 (proposed), CS-4, CS-14, CS-15, CS-16, CS-23, `.claude/skills/ui-design/references/listing-patterns.md`
- Lab files: the schema, generator, helpers and the facet and sort scripts are kept in `lab/search/` (`01-schema.sql` … `15-match-estimate.sql`, without `10` to `12`); the benchmark queries (`bench/*.sql`), the harness scripts and the logs (`logs/`) were in the research session's lab (not kept)

Conventions in this note: every quotation is at most 25 words and carries author, title, URL and date. "Inference" marks my own reasoning. Each finding carries a confidence (high, medium or low). "Lab" means measured in the Docker lab described below.

## Short answer

**Yes. At Carshenas's planned scale, PostgreSQL alone can meet all four CS-14 criteria.** Measured in the lab at 300,000 and 1,000,000 listings, the stack is PostgreSQL 17's built-in full-text search plus three contrib modules that ship with it (pg_trgm, fuzzystrmatch, unaccent), with:

- a Persian normalisation function feeding a stored `tsvector` column;
- an alias table applied with `ts_rewrite` for Latin-typed and variant spellings;
- a small vocabulary table for typo correction.

The criteria, one by one:

1. **Filters and sorts** (CS-14 #1). Every filter in the listing patterns is a plain column. All five sorts are backed by indexes: best deal, price, mileage, newest listing and model year.
2. **Persian analysis** (#2).
   - Arabic ي and ك, the zero-width non-joiner (ZWNJ) and three digit scripts are normalised by one IMMUTABLE SQL function.
   - Latin-typed names ("peugeot 206", "pezho", "dena plus turbo") and joined compounds («صندوقدار») are rewritten through a table.
   - Short Persian typos («پزو»، «دتا»، «تبیا») are corrected against the vocabulary.
   - Lab test cases pass. Evaluation on real queries is still to do.
3. **Rebuild with one command** (#3). There is no second store to rebuild: `REINDEX INDEX CONCURRENTLY` or a versioned backfill does it.
4. **p95 under 300 ms** (#4). A complete search call is: build the query, fetch the first 20 results, count facets and the total.

   | Case | 100,000 | 300,000 | 1,000,000 listings |
   |---|---|---|---|
   | Search call, one client | p95 23 ms | p50 14 ms, p95 92 ms | p50 35 ms, p95 116 ms (sampled facets for broad queries; exact facets: p95 237 ms) |
   | Search call at 100 calls/s from 8 clients | — | p95 78 ms | Saturates at about 45 calls/s with live facets. With facets from a cache, search results ran p95 59 ms at 100 calls/s |

   - At 1,000,000: browse calls p95 58 ms, typo queries p95 37 ms, Latin queries p95 36 ms.
   - Browsing a model under any of the five sorts: p95 0.6 ms.
   - Keyset paging: p95 under 1 ms.

**Three things must be designed around, not ignored:**

- **Facet counts are the expensive part, and they grow linearly with the rows they count.**
  - Facets over all active listings took p50 58 ms at 100,000 listings, 213 ms at 300,000 and 581 ms at 1,000,000 (370 ms with a covering index).
  - At 1,000,000 listings on 4 CPUs, live facets cap throughput at about 45 calls per second. With facets served from a cache, the same box handles about 133.
  - So the worker should precompute the landing page and the per-make and per-model counts after each crawl batch. Broad queries get facets from a 10% table sample (errors under 4% on the top models in the lab), and repeated queries get cached facets.
- **Ranking by a computed score is slow in PostgreSQL; ordering by an indexed column is not.** For 8,960 matches of «پژو ۲۰۶» in Tehran at 300,000 listings:
  - `ts_rank_cd` relevance mixed with deal score and freshness: p95 91 ms;
  - the same query ordered by the deal-score column: p95 0.41 ms, because an index scan can stop after 20 rows;
  - as make and model filters, which is what CS-15 would produce: p95 0.19 ms.
  - So keep the default sorts on indexed columns (deal score first, as CarGurus does).
  - The cost of computed scores grows with the number of matches: Xata measured 25 s at a million.
- **The LIMIT trap.** The planner assumes model and price are independent; in car listings they are not.
  - «بنز E250» sorted cheapest first walked the price index past 761,721 rows (754 ms).
  - Composite indexes that lead with the equality column (`(model_id, asking_price_toman, id)` and one per sort) brought it to 0.09 ms.

**What we lose without Elasticsearch** (medium confidence that none of it matters for CS-14):

- BM25 relevance with corpus statistics and top-k pruning;
- a maintained Persian analyser with a stemmer (Elasticsearch 9 indices);
- Damerau-Levenshtein fuzzy matching inside the query engine;
- fast aggregations over hundreds of thousands of matches;
- a synonym API that updates without reindexing.

The lab recreated the pieces CS-14 needs in about 150 lines of SQL. It did not recreate relevance ranking.

**What we avoid:**

- A JVM service that wants about 4 GB of RAM for one node, when Elastic advises against single-node production.
- A synchronisation pipeline (outbox or change data capture) with a window where sold listings and old prices still show up in results.
- Elastic's download terms, which name Iran as a prohibited destination (OpenSearch, under Apache 2.0, would be the clean alternative).
- A second store to monitor, back up, upgrade and pay for. Iranian clouds price managed Elasticsearch like managed PostgreSQL: Liara charges 4,125,000 toman a month for 4 GB of either.

**Recommendation** (inference): supersede point 2 of ADR-0007. Make PostgreSQL both the record and the search index, and record the measurable triggers below for adding OpenSearch or ParadeDB later.
- Confidence: high up to a few hundred thousand active listings, which is the plan.
- Medium-high at 1,000,000 active listings, provided facets are precomputed, sampled or cached.
- Medium beyond that.
- Snapshots do not count toward this, because they do not belong in the search table.

## Evidence by question

### 1. What PostgreSQL offers for this search

**1.1 Text search configurations: 29 ship, Arabic has a stemmer, Persian has none** (high; lab plus docs).

- The lab's PostgreSQL 17.11 lists these configurations: arabic, armenian, basque, catalan, danish, dutch, english, finnish, french, german, greek, hindi, hungarian, indonesian, irish, italian, lithuanian, nepali, norwegian, portuguese, romanian, russian, serbian, simple, spanish, swedish, tamil, turkish and yiddish (`select cfgname from pg_ts_config`).
- Every one except `simple` has a Snowball stemmer.
- The Arabic stemmer is wrong for Persian. `to_tsvector('arabic', …)` turned «بدون» ("without", as in «بدون رنگ», paint-free) into «دون», and «کارکرده» into «کارکرد» (lab).
- The right base is therefore a copy of `simple` (lowercasing, no stemming, no stop words), with normalisation done in SQL.
- Discourse does the same for languages PostgreSQL does not know. Its indexer comment reads "use the 'simple' stemmer for other languages" (Discourse, `app/services/search_indexer.rb`, https://github.com/discourse/discourse, main at bf55a44, accessed 2026-09-27).

**1.2 A stored generated `tsvector` column with GIN works, if every function in it is IMMUTABLE** (high).

- PostgreSQL documents the pattern with `ALTER TABLE … ADD COLUMN … tsvector GENERATED ALWAYS AS (to_tsvector('english', …)) STORED`. It adds: "searches will be faster, since it will not be necessary to redo the to_tsvector calls to verify index matches" (PostgreSQL Global Development Group, "12.2 Tables and Indexes", https://www.postgresql.org/docs/17/textsearch-tables.html, undated; accessed 2026-09-27).
- The constraint: "The generation expression can only use immutable functions and cannot use subqueries or reference anything other than the current row in any way" (PGDG, "5.4 Generated Columns", https://www.postgresql.org/docs/17/ddl-generated-columns.html, undated; accessed 2026-09-27).
- Also: "Only text search functions that specify a configuration name can be used in expression indexes" (PGDG, textsearch-tables, as above).
- Lab check through `pg_proc`: `to_tsvector(regconfig, text)`, `websearch_to_tsquery(regconfig, text)`, `translate`, `regexp_replace`, `lower` and `normalize` are IMMUTABLE. `unaccent()` in both forms, and the one-argument `to_tsvector(text)`, are only STABLE.
- So `unaccent` needs an IMMUTABLE wrapper that pins the dictionary by schema-qualified name. That is a promise we make to the planner, not something it checks.
- A generated column cannot read the make/model catalogue (no subqueries). Latin aliases therefore go to the query side (1.8), or the worker writes them into an ordinary column.
- **Cost of changing the normaliser** (lab):
  - `ALTER TABLE … ALTER COLUMN … SET EXPRESSION` rewrote both stored columns for 300,000 rows in 28.8 s under an ACCESS EXCLUSIVE lock, before any index existed. The first measurement, 59.8 s, was on battery; this one is on mains power.
  - In production, add a new column, backfill it in batches and swap. Or version the vector the way Discourse does: "every 2 hours 10,000 topics and 20,000 of the newest posts with an old index version will be reindexed" (mcwumbly, Discourse staff, "Refinements to search being tested on meta", https://meta.discourse.org/t/refinements-to-search-being-tested-on-meta/254158, 2023-03-20).
  - Elasticsearch has the same cost in another form: a mapping or analyser change means a new index and a full reindex (section 4.5).

**1.3 `websearch_to_tsquery` accepts raw user input safely** (high). "this function will never raise syntax errors, which makes it possible to use raw user-supplied input for search" (PGDG, "12.3 Controlling Text Search", https://www.postgresql.org/docs/17/textsearch-controls.html, undated; accessed 2026-09-27). It understands quoted phrases, `or` and `-`.

**1.4 Prefix matching exists for search-as-you-type** (high).

- "Such a lexeme will match any word in a tsvector that begins with the given string" (PGDG, textsearch-controls, as above).
- Lab: `search_vector @@ to_tsquery('fa_search', 'سانتا:*')` with `LIMIT 8`, best deal first, took 1.0 ms.
- Suggestions for the search box come better from the vocabulary or catalogue table: a 286-word table answered `word like 'سان%'` in 0.8 ms.
- Caveat from Discourse, whose stemming plus prefix search "can sometimes lead to very surprising results" (Sam Saffron, same Discourse thread, 2023-02-06). Inference: a prefix «۲۰» would match both 206 and 207.

**1.5 Ranking: `ts_rank`, `ts_rank_cd` and custom scores; no corpus statistics; costly over many matches** (high).

- `ts_rank_cd` "requires lexeme positional information to perform its calculation" (PGDG, textsearch-controls).
- "the ranking functions do not use any global information" (same page), so there is no IDF and no BM25.
- "Ranking can be expensive since it requires consulting the tsvector of each matching document, which can be I/O bound and therefore slow" (same page).
- Custom scores are allowed: "You can write your own ranking functions and/or combine their results with additional factors to fit your specific needs" (same page).
- Lab, 8,960 matches of «پژو & 206» in Tehran, 300,000 listings, pgbench on mains power, p50 / p95:
  - `ts_rank_cd × 0.3 + deal × 2 + freshness`: 80 / 91 ms;
  - `ts_rank` in the same formula: 63 / 68 ms;
  - deal plus freshness computed with no text rank: 60 / 70 ms. Most of the cost is visiting 7,723 heap pages to compute a score for every match.
  - The same text query ordered by the `deal_sort` column: 0.30 / 0.41 ms. The planner walks the city-and-deal index and stops after 20 matches.
  - The same intent as `model_id = 1 and city_id = 1`: 0.14 / 0.19 ms.
  - Inference: what makes PostgreSQL slow here is a computed ordering, not text matching.
- Xata measured the extreme: a query matching 1,038,914 rows, sorted by `ts_rank`, "gets as bad as 25 seconds latency", and "If we're only interested in matching and we order by an (indexed) column, it is fast" (Tudor Golubenco, "Full-text search engine with PostgreSQL (part 2)", https://xata.io/blog/postgres-full-text-search-postgres-vs-elasticsearch, 2023-07-19; vendor of PostgreSQL hosting).

**1.6 pg_trgm: similarity, word similarity and index-backed `LIKE`, but weak on short Persian words** (high).

- Documented operators:
  - `word_similarity` returns "the greatest similarity between the set of trigrams in the first string and any continuous extent" of trigrams in the second;
  - defaults: `pg_trgm.similarity_threshold` 0.3 and `pg_trgm.word_similarity_threshold` 0.6;
  - ordering by distance "can be implemented quite efficiently by GiST indexes, but not by GIN indexes";
  - "pg_trgm ignores non-word characters (non-alphanumerics) when extracting trigrams from a string".

  (PGDG, "F.33 pg_trgm", https://www.postgresql.org/docs/17/pgtrgm.html, undated; accessed 2026-09-27.)
- Which characters count as letters depends on the database locale: "The parser's notion of a “letter” is determined by the database's locale setting, specifically lc_ctype" (PGDG, "12.5 Parsers", https://www.postgresql.org/docs/17/textsearch-parsers.html, undated; accessed 2026-09-27). Fork C read the PG17 source: under `LC_CTYPE=C`, pg_trgm falls back to single-byte `isalnum()` (inference: Persian letters would then stop counting as letters). The lab database uses `en_US.utf8`, and `show_trgm('پژو ۲۰۶ دوگانه‌سوز')` returned 19 trigrams.
- Lab weaknesses:
  - `similarity('پزو','پژو')` is 0.14 and `similarity('دنا','دتا')` is 0.14. Three-letter Persian words share too few trigrams, and many Iranian car names are that short (پژو، دنا، رانا، تارا، تیبا، کیا، جک).
  - Trigram word-similarity against titles was slow and missed: «پزو 206» pulled 20,283 candidates (the trigrams of «206» are everywhere), rechecked them all and returned nothing, in 178 ms.
  - Over the query set it measured p50 79 ms and p95 666 ms. That path should not be used.
- The documented alternative works: "The first step is to generate an auxiliary table containing all the unique words in the documents" (PGDG, pg_trgm, as above). Section 2.5 shows the lab version.

**1.7 fuzzystrmatch gives Levenshtein on Persian** (high). Fork C quotes the docs: soundex and metaphone "do not work well with multibyte encodings (such as UTF-8). Use daitch_mokotoff or levenshtein with such data" (PGDG, "F.17 fuzzystrmatch", https://www.postgresql.org/docs/17/fuzzystrmatch.html, undated; accessed 2026-09-27). Lab: `levenshtein('پزو','پژو') = 1`. Over the vocabulary, the search for «پزو» took p50 0.12 ms.

**1.8 Synonyms and transliteration: dictionary files, or a table with `ts_rewrite`** (high).

- File-based synonym and thesaurus dictionaries live on the server: "The file's full name will be $SHAREDIR/tsearch_data/my_synonyms.syn" (PGDG, "12.6 Dictionaries", https://www.postgresql.org/docs/17/textsearch-dictionaries.html, undated; accessed 2026-09-27).
- "Thesauruses are used during indexing so any change in the thesaurus dictionary's parameters requires reindexing" (same page).
- Managed hosts cannot take such files. Rachid Belaid on RDS: "restrictions on search features imposed by RDS are those that require access to the file system such as custom dictionaries" ("Postgres full-text search is Good Enough!", http://rachbelaid.com/postgres-full-text-search-is-good-enough/, 2015-07-13).
- `ts_rewrite` with a table avoids both problems: "you can modify a set of rewrite rules on-the-fly without reindexing, whereas updating a thesaurus requires reindexing to be effective" (PGDG, "12.4 Additional Features", https://www.postgresql.org/docs/17/textsearch-features.html, undated; accessed 2026-09-27).
- Lab: 63 alias rows. `ts_rewrite` also matched a two-word subset of a longer AND query: «سمن دوگانه سوز» became `'سمند' & ('دوگانهسوز' | 'دوگانه' <-> 'سوز')`.
- Caveat: `ts_rewrite(tsquery, text)` is VOLATILE. The wrapper I marked STABLE is a deliberate promise that the alias table does not change within a statement.

**1.9 Extensions worth knowing** (fork C unless noted; all accessed 2026-09-27).

| Extension | Licence | What it adds | Persian | Installing inside Iran | Maturity and caveats |
|---|---|---|---|---|---|
| Contrib: pg_trgm, unaccent, dict_xsyn, dict_int, fuzzystrmatch, btree_gin | PostgreSQL | Trigrams, character folding, synonyms, Levenshtein, GIN on scalars | Works with a UTF-8 lc_ctype; our SQL function does the Persian folding | In the Ubuntu 24.04 and Debian archives, so reachable from any Iranian mirror; in the official Docker image; "trusted", so a non-superuser can create them | Core PostgreSQL |
| RUM (Postgres Professional) | PostgreSQL-like | Positions and one extra column inside the index: ranking, phrases, `ORDER BY first_seen_at <=> …` | Same tsvector pipeline | Ubuntu 24.04 archive `postgresql-16-rum` 1.3.13; Debian trixie `postgresql-17-rum`; PGDG 1.3.15 | "slower build and insert time as compared to GIN" (postgrespro, RUM README, https://github.com/postgrespro/rum, accessed 2026-09-27); sorts by one attached column only |
| ParadeDB pg_search | AGPL-3.0; the Enterprise edition is commercial | Tantivy BM25, tokenizers, `pdb.agg` facets, columnar filters and sorts | Arabic Snowball stemmer, no Persian; normalise in an indexed expression | GitHub .deb (foreign), or the `paradedb/paradedb` image through an Iranian registry mirror; needs pgvector, `shared_preload_libraries` and a restart | 0.25.x and changing fast. In Community, "The ParadeDB index does not get physically replicated" (ParadeDB, "Guarantees", https://www.paradedb.com/docs/concepts/guarantees, undated) |
| PGroonga | PostgreSQL | Groonga bigram engine, web-style `&@~` queries, `pgroonga_score` | Bigrams fit Arabic script, but its NFKC normaliser does not fold ي/ك, digits or ZWNJ (fork C measured this); a NormalizerTable might (untested) | packages.groonga.org (foreign), or `groonga/pgroonga` through a mirror | 4.0.9 (2026-09-23); its crash-safety module is "still an experimental feature" (PGroonga, "Crash safe", https://pgroonga.github.io/, undated) |
| pg_bigm | PostgreSQL | Bigram GIN for `LIKE '%…%'` | Script-agnostic bigrams | Source build on Ubuntu (not in PGDG apt or the archives) | v1.2-20250903 |
| pgfaceting (Cybertec) | — | Roaring-bitmap facet counts | n/a | PGDG apt `postgresql-17-pgfaceting` 0.2.0 | Its authors warn of "API changes, needing to rebuild between upgrades and other rough edges" (Ants Aasma, "Faceting large result sets in PostgreSQL", https://www.cybertec-postgresql.com/en/faceting-large-result-sets/, 2022-12) |

- A hosted extension can disappear. Neon promoted pg_search in 2025; then "As of March 19, 2026, pg_search is no longer available for new Neon projects", with existing installs removed on 2026-09-21 (Neon, "pg_search", https://neon.com/docs/extensions/pg_search, undated; accessed 2026-09-27; fork B).
- Inference: build on core full-text search plus contrib, and keep any extension optional.

### 2. Persian specifics

**2.1 What raw Persian looks like to PostgreSQL** (high; lab, `ts_debug('simple', …)`).

- Persian digits («۲۰۶») are tokens of type `word`, while Latin «206» is `uint`, so the two never match.
- The ZWNJ stays inside a token: «بدون‌رنگ» is one token, «بدون رنگ» is two.
- Arabic «كيا» does not match Persian «کیا».
- The W3C describes why these characters coexist:
  - the ZWNJ is for when "two Arabic letters sit next to each other (in one word) which would normally join together, but should not";
  - it notes "the misuse of space in place of ZWNJ";
  - it lists U+064A and U+0643 as auxiliary for Persian, and the Persian yeh U+06CC and keheh U+06A9 as the letters in use.

  (Richard Ishida, ed., "Arabic & Persian Layout Requirements", W3C Group Draft Note, https://www.w3.org/TR/alreq/, 2025-10-02.)

**2.2 One IMMUTABLE normalisation function for documents and queries** (high; lab). The full version is in `01-schema.sql`:

```sql
create function fa_normalize(t text) returns text
language sql immutable parallel safe strict
return btrim(regexp_replace(regexp_replace(regexp_replace(
  lower(immutable_unaccent(translate(normalize(t, NFKC),
    -- mapped: ي ى ك ۀ ة ہ أ إ آ ٱ, Persian digits, Arabic-Indic digits, ZWNJ, NBSP, NNBSP, Arabic decimal sign
    -- deleted: tatweel, harakat, superscript alef, ZWJ, LRM, RLM, ALM, BOM, soft hyphen, Arabic thousands sign, bidi controls
    U&'\064A\0649\0643\06C0\0629\06C1\0623\0625\0622\0671' || U&'\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9'
    || U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669' || U&'\200C\00A0\202F\066B'
    || U&'\0640\064B\064C\064D\064E\064F\0650\0651\0652\0653\0654\0655\0670'
    || U&'\200D\200E\200F\061C\FEFF\00AD\066C\202A\202B\202C\202D\202E\2066\2067\2068\2069',
    U&'\06CC\06CC\06A9\0647\0647\0647\0627\0627\0627\0627' || '0123456789' || '0123456789' || '   .'))),
  '([\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF])([0-9])', '\1 \2', 'g'),   -- «تیپ۲» -> «تیپ 2»
  '([0-9])([\u0621-\u064A\u0671-\u06D3\u06FA-\u06FF])', '\1 \2', 'g'),
  '\s+', ' ', 'g'));
```

- It reproduces Lucene's Arabic normaliser: "Normalization of hamza with alef seat to a bare alef", "Normalization of teh marbuta to heh", removal of harakat and tatweel (Apache Lucene, "ArabicNormalizer" 9.12 javadoc, https://lucene.apache.org/core/9_12_0/analysis/common/org/apache/lucene/analysis/ar/ArabicNormalizer.html, accessed 2026-09-27).
- It also reproduces the character work of Lucene's Persian normaliser, with one difference. Lucene folds towards Arabic: "Normalization of farsi yeh and yeh barree to arabic yeh" (Apache Lucene, PersianNormalizer 9.12 javadoc; fork B). This function folds towards the Persian letters, as AGENTS.md asks.
- Both directions match equally well if documents and queries go through the same function. Never display the normalised text (inference).
- NFKC runs first because it folds presentation forms (lab: «ﻛﻴﺎ ﺍﺳﭙﻮﺭﺗﻴﺞ» becomes «کیا اسپورتیج»). NFKC alone does not fold Arabic ي/ك (lab, and fork C's measurement), so the `translate` step is required.
- Lab results:
  - «پژو 206 تيپ 2 مدل ١٣٩٨ بدون رنگ» and «پژو ۲۰۶ تیپ ۲ مدل ۱۳۹۸ بدون‌رنگ» give identical vectors;
  - «قیمت ۱٬۲۰۰ میلیون» becomes «قیمت 1200 میلیون»;
  - "Citroën C3" becomes "citroen c3".
- Cost: p50 0.11 ms per call, round trip included. The whole query builder in 2.5 (normalise, correct, rewrite) takes p50 0.16 ms for a clean query and 0.62 ms for one with a typo.

**2.3 ZWNJ policy: split at ZWNJ, and alias the known joined compounds** (medium; lab).

- ZWNJ becomes a space, which is exactly what Elasticsearch's `persian` analyser does: a character filter that "Replaces zero-width non-joiners with an ASCII space" (Elastic, "Language analyzers", https://www.elastic.co/docs/reference/text-analysis/analysis-lang-analyzer, undated; accessed 2026-09-27; fork A).
- Both engines therefore share one gap: a word typed with no ZWNJ and no space («صندوقدار») is a different token from «صندوق دار».
- In the lab, alias rows map both the joined form and the split pair to `('صندوق' <-> 'دار') | 'صندوقدار'`. Same for «دوگانه‌سوز» and «استپ‌وی».
- The compounds that matter are catalogue values (trims, fuel types, body condition), so the list is short and CS-10 can own it (inference).

**2.4 Latin-typed model names** (high that the mechanism works; medium that the list is complete).

- `search_alias(t tsquery, s tsquery)` maps "peugeot", "pezho", "pejo", "dena", "plus", "tip", "quick", "sonata" and others to the normalised Persian lexeme, kept as an OR with the Latin form.
- Lab rewrites:
  - "peugeot 206" → `'206' & ('peugeot' | 'پژو')`;
  - "pezho 206 tip 2" → `'206' & '2' & ('tip' | 'تیپ') & ('پژو' | 'pezho')`;
  - "dena plus turbo" → `('دنا' | 'dena') & ('plus' | 'پلاس') & ('turbo' | 'توربو')`.
- Latin digits and Persian digits meet in the normaliser.
- Elasticsearch has no built-in answer here either: the ICU plugin's transliteration filter says "Custom rulesets are not yet supported" (Elastic, "ICU transform token filter", https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-icu-transform, undated; accessed 2026-09-27; fork A). A synonym list is needed in either engine.

**2.5 Typo correction: the vocabulary pattern, Elasticsearch-style "AUTO" fuzziness, and swaps counted as one edit** (medium; lab).

- `search_word` is built with `ts_stat` over active listings: 286 words in the synthetic data (real listings will have more), with a title-only document count from `ts_stat(…, 'A')`.
- The corrector keeps numbers, words under 3 letters, vocabulary words and alias keys as they are. For any other word it picks the vocabulary word within 1 edit (3 to 5 letters) or 2 edits (longer), counting a swap of neighbouring letters as one edit. Candidates must be at least 3 letters. Ties go to title frequency, then overall frequency.
- Results: all 14 misspellings in my set were corrected:
  - «پزو»→«پژو», «پژوو»→«پژو», «دتا»→«دنا»;
  - «تبیا»→«تیبا», «هیونادی»→«هیوندای», «سمن»→«سمند»;
  - «اسپرتیج»→«اسپورتیج», «لندکروز»→«لندکروزر», «سوناتاا»→«سوناتا»;
  - «سراتوو»→«سراتو», «شاهبن»→«شاهین», «تاار»→«تارا»;
  - «ساندور»→«ساندرو», with «کوئیک» handled as an alias.
- Two earlier versions failed in instructive ways:
  - without the minimum length, «دتا» became «تا» (a description word);
  - without the title preference, «ساندور» became «سنسور» ("sensor", from descriptions).
- Caution: I wrote this 14-query set and tuned against it, so 14 of 14 proves the mechanism, not the accuracy. The CS-9 rule applies by analogy: build a labelled set from real queries before claiming a rate.
- Elasticsearch's fuzzy query is Damerau-Levenshtein inside the engine. That remains the better tool at scale (section 4.6).

**2.6 No Persian stemmer** (high on the fact; medium on the impact).

- PostgreSQL has none. Elasticsearch added `persian_stem` in 8.11 (rezatorabi, PR #99106, https://github.com/elastic/elasticsearch/pull/99106, merged 2023-09-05), and its built-in `persian` analyser stems only in indices created on 9.0 or later (cbuescher, PR #113482, merged 2024-10-02; fork A).
- Impact on listings (inference): titles are makes, models, trims, years and condition words, where stemming matters little.
- Plural and comparative suffixes written with a ZWNJ («ماشین‌ها») are split off by the ZWNJ rule. Suffixes written joined («ماشینها») are not.
- Spelled-out numbers («دویست و شش») are handled by neither engine. They belong to CS-15's query understanding.

**2.7 Implementation traps found in the lab** (high).

- **Build the query once.** A STABLE query-builder called inside `count(*) filter (where … @@ fa_query(…))` ran once per row and was cancelled after more than 2 minutes. Build the tsquery once, then pass it as a constant.
- **Pass the tsquery as a constant.** The planner can then use column statistics. As a function call inside the query, it falls back to default selectivity.
- **Write the query builder in PL/pgSQL on PostgreSQL 17.** The SQL-function version cost p50 9.5 to 9.9 ms per call, because PostgreSQL 17 plans a non-inlined SQL function body on every call. The PL/pgSQL version, whose plans are cached per session, cost 0.16 to 0.62 ms. PostgreSQL 18 lists "Improve SQL-language function plan caching" (Alexander Pyhalov, Tom Lane) (PGDG, "PostgreSQL 18 release notes", https://www.postgresql.org/docs/18/release-18.html, 18.0 released 2025-09-25; accessed 2026-09-27); not measured here.
- **Create the database with a UTF-8 `lc_ctype`** (1.6).
- **Expect bad row estimates for multi-word text queries.** The planner multiplies per-word selectivities that are strongly correlated in listing titles: 9 rows estimated, 6,705 actual for `'2' & 'تیپ' & 'پژو' & '206'`. The plans were still right in the lab. Watch it with `EXPLAIN (ANALYZE)` in the performance checklist.

### 3. Facets and counts

**3.1 All facets from one scan** (high).

- GROUPING SETS: "The data selected by the FROM and WHERE clauses is grouped separately by each specified grouping set" (PGDG, "7.2.4 GROUPING SETS, CUBE, and ROLLUP", https://www.postgresql.org/docs/17/queries-table-expressions.html, undated; accessed 2026-09-27).
- The lab query returns counts per make, model, city and model-year band, plus the total (the empty set `()`), in one pass:

```sql
select make_id, model_id, city_id, year_band, count(*)
from (select make_id, model_id, city_id,
             case when model_year_jalali < 1390 then 1 when model_year_jalali < 1395 then 2
                  when model_year_jalali < 1400 then 3 else 4 end as year_band
      from listing
      where is_active and search_vector @@ $1::tsquery and (… filters …)) f
group by grouping sets ((make_id), (model_id), (city_id), (year_band), ());
```

- Faceted interfaces usually count each facet without its own filter (disjunctive facets), so the buyer still sees the other cities while one city is selected.
- One scan does this with `count(*) filter (where …)` per facet over rows that fail at most one filter. Lab: 90 ms at 300,000 listings for 92,146 candidate rows.

**3.2 Cost grows linearly with the number of matching rows** (high; lab plus practitioners).

- Lab, one client, p50 / p95 in ms:

  | Facet case | 100,000 listings (85,115 active) | 300,000 (255,065) | 1,000,000 (850,368) |
  |---|---|---|---|
  | Price, year and city filters | 6.2 / 29.5 | 23 / 109 | 60 / 283; 63 / 158 with a covering index |
  | The 20 benchmark text queries | 2.7 / 19.6 | 9.7 / 153 | 25 / 460 |
  | All active listings | 58 / 61 | 213 / 237 | 581 / 673; 370 / 418 with a covering index |

- Broad words dominate. At 1,000,000 listings «بدون رنگ» matches 489,250 active listings, «پژو» 147,797, «بیمه تا آخر سال» 105,798 and «پژو ۲۰۶» 56,778.
- Why it is expensive in PostgreSQL 17:
  - A GROUPING SETS aggregate ran on a single core in every plan. Four separate `GROUP BY`s under `UNION ALL` did get parallel index-only scans: 350 ms against 893 ms under EXPLAIN at 1,000,000 rows.
  - Every counted row is a heap visit, unless a covering index makes the scan index-only. The index `(model_year_jalali, asking_price_toman) include (make_id, model_id, city_id) where is_active` is 33 MB with zero heap fetches.
  - JIT is not the cause: it fired but cost 10.7 ms.
- Mitigations measured at 1,000,000 listings:
  - **Approximate facets.** `tablesample system (10)` plus the same WHERE clause, times 10: facets for «بدون رنگ» took 63 ms instead of 471 ms, with errors from −0.9% to +3.5% on the six largest models.
  - **Choosing when to sample.** The planner's row estimate costs about a millisecond (`explain (format json)` in a VOLATILE function; EXPLAIN is refused inside a STABLE one). Sampling when the estimate exceeds 30,000 brought the search call to p50 35 ms and p95 116 ms, against p95 237 ms with exact facets.
  - **A capped exact count is not a cheap decision rule.** Counting to 30,001 still visits 30,001 heap rows: p95 328 ms.
  - **Capacity with facets from a cache.** Saturated with 8 clients, the mix handled 133 calls per second with facets from a cache against 44 with live facets.
- Cybertec: "when you start to get up in the tens to hundreds of thousands of rows, the response times start to become noticeable", and "At around half a million matching results, the execution times go above 1 second even if lots of parallel workers are allowed" (Ants Aasma, Cybertec, as above; PostgreSQL consultancy promoting pgfaceting).
- ParadeDB found native tsvector faceting "already being 27x slower at 200,000 results" than its BM25 index on 46 million rows (James Blackwood-Sewell, "Teaching Postgres to Facet Like Elasticsearch", https://www.paradedb.com/blog/faceting, 2025-12-10; vendor of pg_search).
- Inference: the expensive case is the one CS-16 serves most often, the unfiltered landing page and one-word searches. Precompute it.

**3.3 Indexes for the filter and sort combinations** (high; lab).

- Partial B-trees on active listings, one per sort (about 7.7 MB each at 300,000 rows; 0.12 to 0.31 s to build):
  - `(deal_sort desc, id desc)`
  - `(asking_price_toman, id)`
  - `(mileage_km, id)`
  - `(first_seen_at desc, id desc)`
  - `(model_year_jalali desc, id desc)`
- Composites that lead with the most common equality filter, then the default sort: `(model_id, deal_sort desc, id desc)`, `(make_id, …)` and `(city_id, …)`.
- GIN on `search_vector` (11 MB, 1.4 s). A trigram GIN on the normalised title (19 MB, 3.1 s) turned out not to be needed; the trigram index belongs on the vocabulary.
- The planner picked sensibly:
  - broad «بدون رنگ» in Tehran walked the city-and-deal index and filtered: p50 0.16 ms;
  - selective text used a GIN bitmap plus a top-N sort: p50 4.0 ms for «شاهین CVT» (3,300 matches), 9.5 ms for «پژو ۲۰۶ تیپ ۲» plus city, year and price (6,705 matches);
  - a model filter walked `(model_id, deal_sort)`: p50 0.14 ms.
- **The LIMIT trap, and its fix** (high; lab at 1,000,000 listings). For «model X, sorted by Y, first 20», the planner may walk the index of the sort column and filter until it finds 20 rows. It assumes the model is spread evenly along that index. In car listings it is not: price, mileage and year are strongly tied to the model.
  - «بنز E250» (model 52) sorted cheapest first walked `listing_active_price` and discarded 761,721 rows: 754 ms.
  - Over random models and sorts, the browse query ran p50 5.9 ms but p95 220 ms and p99 549 ms.
  - Four composites that lead with the equality column fixed it: `(model_id, asking_price_toman, id)`, `(model_id, mileage_km, id)`, `(model_id, first_seen_at desc, id desc)` and `(model_id, model_year_jalali desc, id desc)`. They are 26 to 33 MB each and build in 0.7 to 0.9 s.
  - With them the same query took 0.09 ms, and the random mix ran p50 0.42 ms, p95 0.63 ms, p99 0.79 ms.
  - Text queries with any of the five sorts ran p95 45 ms without extra indexes: a GIN bitmap plus a top-N sort.
  - Inference: this is the rule "equality columns first, then the sort column". A database review checklist should test it against skewed data, not uniform data.
- `deal_sort` is `coalesce(deal_score, -1000)`, a non-null key, so unrated listings («بدون ارزیابی», «توافقی») sort last and keyset pagination stays simple.
- PostgreSQL 18 adds B-tree skip scan: it "allows multi-column btree indexes to be used in more cases such as when there are no restrictions on the first or early indexed columns" (PGDG, PostgreSQL 18 release notes, as above). Not measured.

**3.4 Keyset pagination, not OFFSET** (high).

- Markus Winand on OFFSET: "the database must still fetch these rows from the disk and bring them in order before it can send the following ones". The alternative is "called seek method or keyset pagination" ("We need tool support for keyset pagination", https://use-the-index-luke.com/no-offset, 2014-08-06, updated 2023-09-08).
- Lab, best deal first, 20 per page, OFFSET against keyset, p50 / p95 in ms:

  | Page | 300,000: OFFSET | 300,000: keyset | 1,000,000: OFFSET | 1,000,000: keyset |
  |---|---|---|---|---|
  | Page 50, all active | 0.86 / 1.57 | 0.24 / 0.38 | 0.55 / 0.85 | 0.20 / 0.33 |
  | Page 500, all active | 11.3 / 13.7 | 0.24 / 0.36 | 9.6 / 13.6 | 0.42 / 0.54 |
  | Page 50, Tehran | 0.99 / 1.91 | 0.26 / 0.38 | 1.36 / 2.16 | 0.46 / 0.63 |

- The keyset predicate is `(deal_sort, id) < ($1, $2)`, served by the same index.
- The listing patterns' «نمایش بیشتر» button suits keyset paging well: the client keeps the last row's key. OFFSET is fine to page 50 and degrades linearly after that.

**3.5 Counts: exact where cheap, estimated or capped where not, cached for the landing page** (medium).

- "PostgreSQL has to check visibility for all rows, due to the MVCC model" ("Count estimate", PostgreSQL wiki, https://wiki.postgresql.org/wiki/Count_estimate, last edited 2024-11-17; accessed 2026-09-27).
- Lab:
  - Exact count of active Tehran listings from 1395 on: 33 ms for 85,726 rows (parallel scan).
  - The wiki's `count_estimate` (reading `EXPLAIN`'s row estimate) returned 85,637, almost exact, for these structured filters.
  - For the text query «پژو & 206» it returned 3,844 against an exact 17,208, which is useless.
- Suggested rule (inference, backed by the numbers in 3.2):
  - The total and the facets come from the same scan: the empty grouping set `()` is the total. The «نمایش ۱۲۸ آگهی» button therefore costs nothing extra when facets are exact.
  - When the planner's estimate is above about 30,000 rows, show sampled facets and the total as «حدود ۴۹۰ هزار آگهی».
  - Facet lists for the landing page, make pages and model pages come from a `facet_count` table the worker refreshes after each crawl batch.
  - Facets for narrower filtered sets are computed live (p95 30 ms at 100,000 listings, 109 ms at 300,000, 158 ms at 1,000,000 with the covering index).
  - Popular query and filter combinations can be cached until the next crawl batch.

### 4. Elasticsearch or OpenSearch: cost and operations (fork A unless noted)

**4.1 Memory** (high).

- Elasticsearch sizes its own heap. For a node with every role, the source comment says "50% of total system memory when greater than 1 gigabyte up to a maximum of 31 gigabytes" (Elastic, `MachineDependentHeap.java`, https://github.com/elastic/elasticsearch, main; accessed 2026-09-27). That means 1 GB of heap on a 2 GB machine and 2 GB on a 4 GB machine; inside Docker, the container limit counts.
- Manual rule: "Set Xms and Xmx to no more than 50% of the total memory available to each Elasticsearch node" (Elastic, "JVM settings", https://www.elastic.co/docs/reference/elasticsearch/jvm-settings, undated; accessed 2026-09-27).
- Host requirements:
  - `vm.max_map_count` must be raised: "must be set to 1048576" (Elastic, Docker production install page). Sources disagree here: Elastic's own bootstrap check and OpenSearch accept 262144 (fork A);
  - "Swapping is very bad for performance, for node stability, and should be avoided at all costs" (Elastic, "Disable swapping");
  - TLS and passwords are on by default since 8.x.
- OpenSearch: "OpenSearch defaults to -Xms1g -Xmx1g"; "OpenSearch 2.12 or later requires that you set a custom admin password when starting" (OpenSearch, "Installing OpenSearch" and "Docker", https://docs.opensearch.org/latest/install-and-configure/install-opensearch/, undated; accessed 2026-09-27).

**4.2 A realistic minimum machine** (medium; partly inference).

- Elastic: "we do not recommend using one-node clusters in production", and "A two-node cluster with an additional tiebreaker node is the smallest possible cluster suitable for production deployments" (Elastic, "Resilience in small clusters", https://www.elastic.co/docs/deploy-manage/production-guidance/availability-and-resilience/resilience-in-small-clusters, undated; accessed 2026-09-27).
- 300,000 to 3 million small listing documents fit in one shard ("Aim for shard sizes between 10GB and 50GB"; Elastic, "Size your shards").
- Inference:
  - About 4 GB of RAM and 2 vCPU for one node with a 2 GB heap. A single node is acceptable only because the index can be rebuilt from PostgreSQL, and search is down while it rebuilds.
  - It should not share the database's machine, because both live off the OS page cache.
  - For comparison, the whole 300,000-listing PostgreSQL dataset is 303 MB including every index. At 1,000,000 listings it is 1,142 MB with 16 indexes, served from a container using 1.1 GiB with `shared_buffers` at 1 GB.

**4.3 Licences and sanctions** (high on the text; inference on its application; not legal advice).

- Elastic added AGPL as a third option: "We will be adding AGPL as another license option next to ELv2 and SSPL in the coming weeks" (Shay Banon, "Elasticsearch is Open Source, Again", https://www.elastic.co/blog/elasticsearch-is-open-source-again, 2024-08-29).
- The binaries stay under the Elastic License: "This change only affects the source code — our releases will continue to be open source under the Elastic License" (Elastic, "Licensing FAQ", https://www.elastic.co/pricing/faq/licensing, accessed 2026-09-27).
- ELv2: "You may not provide the software to third parties as a hosted or managed service" (Elastic, "Elastic License 2.0", https://www.elastic.co/licensing/elastic-license, undated; fork A). Carshenas would use it internally, which that clause does not cover (inference).
- AGPL section 13 attaches its source-offer duty to someone who modifies the program (inference from the licence text; not legal advice). Using Elasticsearch under the AGPL would also mean building it from source, since the released binaries are ELv2 (fork A).
- OpenSearch is Apache 2.0 and moved to the Linux Foundation's OpenSearch Software Foundation (Linux Foundation press release, 2024-09-16).
- **Sanctions:** Elastic's download page says "Such prohibition includes the following countries: Cuba, Iran, North Korea, Syria, Russia, Belarus" (Elastic, "Downloads", export-control section, https://www.elastic.co/downloads, accessed 2026-09-27).
- Elastic's CDN has refused countries with HTTP 451 before (Luca Belluccini, Elastic, https://discuss.elastic.co/t/232494, 2020-05-13). There is no first-hand Iranian report, so that part is medium confidence.
- Inference: Elastic Cloud is out of the question, and self-hosting Elastic's binaries in Iran conflicts with Elastic's terms. OpenSearch is the option that stays clean.
- Docker Hub also blocks Iranian IP addresses: Docker's 403 message reads "we now block all IP addresses that are located in Cuba, Iran, North Korea, Republic of Crimea, Sudan, and Syria" (as quoted by ilya-lesikov, werf discussion #6166, https://github.com/werf/werf/discussions/6166, 2024-05-30; fork C).
- Iranian registry mirrors exist; fork C found these answering on 2026-09-27: docker.arvancloud.ir, hub.hamdocker.ir, focker.ir, docker.iranserver.com and others. They affect Elasticsearch, OpenSearch and PostgreSQL images alike.

**4.4 What Iranian clouds offer** (medium; prices as published, accessed 2026-09-27).

| Provider | Managed PostgreSQL | Managed Elasticsearch / OpenSearch | Notes |
|---|---|---|---|
| Liara | Yes: 13 to 18.4 | Yes: Elasticsearch 7.17, 8.4, 8.11, 9.1 | The same price table for every engine: 2 GB 2,300,000, 4 GB 4,125,000, 8 GB 7,250,000 toman a month. Only PostGIS and pgvector are listed as PostgreSQL extensions, and «افزونه Pgvector لیارا، از قابلیت HNSW indexing، پشتیبانی نمی‌کند» (Liara docs, https://docs.liara.ir/dbaas/postgresql/quick-setup/). Of Elasticsearch: «در حال حاضر، امکان تهیه فایل پشتیبان به صورت مستقیم از دیتابیس ElasticSearch وجود ندارد» (https://docs.liara.ir/dbaas/elastic-search/quick-setup/) |
| Hamravesh | Yes: PostgreSQL and MySQL, with point-in-time recovery and replicas | Not found | No prices visible |
| ArvanCloud | Unverified: a 2024 archived page said MySQL only, with PostgreSQL "in future"; a 2026 headline suggests PostgreSQL 17 | Not found | Its pages sit behind a JavaScript challenge from outside Iran; check from inside |
| Pancake | Yes | Yes | Identical prices per engine; page last modified 2024-09-01, so likely stale |
| Runflare | Listed | "Elastic" listed | No prices found |

- pg_trgm and unaccent are "trusted" modules that "can be installed by non-superusers who have CREATE privilege on the current database" (PGDG, pg_trgm and unaccent pages, v18; fork A).
- Inference: they probably work on Liara and Hamravesh even though neither lists them. Verify on a trial database before CS-23 picks a host.
- A self-managed VPS with Ubuntu's own PostgreSQL has all of contrib (fork C).

**4.5 The cost of keeping a second store in sync** (high).

- Martin Fowler: "This will come at a cost in complexity. Each data storage mechanism introduces a new interface to be learned." He also expects polyglot persistence to come "because the benefits are worth it" ("PolyglotPersistence", https://martinfowler.com/bliki/PolyglotPersistence.html, 2011-11-16).
- For Carshenas at this scale, the benefits have not been shown (this note).
- Dual writes fail silently: "you probably won't even notice that your database and your search indexes have gone out of sync, because no errors occur" (Martin Kleppmann, "Using logs to build a solid data infrastructure (or: why dual writes are a bad idea)", https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html, 2015-05-27).
- The outbox pattern is the standard cure, and it adds an asynchronous relay with at-least-once delivery (Gunnar Morling, "Reliable Microservices Data Exchange With the Outbox Pattern", https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/, 2019-02-19).
- Change data capture into Elasticsearch used Debezium, Kafka, ZooKeeper, Kafka Connect and a sink connector (Jiri Pechanec, Debezium blog, 2018-01-17).
- A logical replication slot "will prevent removal of required resources even when there is no connection using them" (PGDG, "Logical decoding concepts", v18), so a dead consumer fills the disk.
- Elasticsearch is near-real-time: `refresh_interval` defaults to 1 s.
- A field type cannot be changed in place: "create a new index with the desired mapping and reindex your data", with an alias swap for zero downtime (Elastic, mapping and alias docs, undated; accessed 2026-09-27).
- GitLab, which runs both, documents the pain: "You cannot automatically find discrepancies and resync an Elasticsearch index" (GitLab Docs, "Elasticsearch", https://docs.gitlab.com/integration/advanced_search/elasticsearch/, undated; accessed 2026-09-27; fork B).
- Instacart fixed its data drift the hard way: "the indexing load and throughput caused the cluster to struggle so much that fixing erroneous data would take days to be corrected" (Ankit Mittal et al., "How Instacart Built a Modern Search Infrastructure on Postgres", https://tech.instacart.com/how-instacart-built-a-modern-search-infrastructure-on-postgres-c528fa601d54, 2025-05-28; fork B).
- What staleness would mean for Carshenas (inference), until the relay runs and the index refreshes, which is seconds normally and silently longer when the relay stalls:
  - a sold listing stays in results;
  - a listing whose price rose still matches «زیر ۷۰۰ میلیون»;
  - facet counts disagree with the listing page, which reads PostgreSQL;
  - a saved search (CS-20) alerts on a deal rating that is already stale.

  The usual fix is to re-read the shown rows from PostgreSQL, which keeps PostgreSQL in the request path anyway.

**4.6 What Elasticsearch really does better for Persian** (high).

- The `persian` analyser bundles:
  - the ZWNJ-to-space character filter;
  - `decimal_digit`, `arabic_normalization` and `persian_normalization`;
  - Persian stop words;
  - since 9.0 indices, `persian_stem`.
- The `fuzzy` query applies Damerau-Levenshtein automata inside the index, with no vocabulary table to maintain.
- BM25 uses corpus statistics, and the engine prunes to the top k.
- Aggregations run over columnar doc values.
- Synonym sets can be updated through an API at search time: "Search time is recommended because you can update your synonym sets without reindexing" (Elastic, "Search with synonyms", https://www.elastic.co/docs/solutions/search/full-text/search-with-synonyms, undated; fork B).
- OpenSearch's documentation lists its `persian` analyser without a stemmer (fork A). The Persian-stemming advantage is therefore Elasticsearch's, not necessarily OpenSearch's.

### 5. Practitioners and real migrations (fork B unless noted)

| Who | What they did or said | Scale and context | Bias |
|---|---|---|---|
| Rachid Belaid (the brief says "Rachel"), "Postgres full-text search is Good Enough!", 2015-07-13 | Weighted tsvector, `ts_rank`, `unaccent`, and pg_trgm over a table of unique lexemes for misspellings. Concedes: "Probably not if your core business needs revolve around search." | Blog-scale examples | None commercial |
| Instacart (Mittal et al., 2025-05-28; InfoQ 2025-08-25) | Moved full-text search from Elasticsearch to sharded PostgreSQL, because "frequent partial writes to documents were needed to update billions of items to reflect price changes and inventory availability". A normalised model gave "a 10x reduction in write workload". Later replaced FAISS with pgvector because "Storing data in two separate systems and keeping them in-sync led to inconsistencies." | Billions of items, millions of searches a day, a team with deep PostgreSQL skills; built a modified `ts_rank` | Engineering blog |
| Discourse (code, and Sam Saffron 2023-02-06/07) | All search on PostgreSQL: `*_search_data` tables, weights A to D, `ts_rank_cd` times category factors, `simple` for unknown languages, versioned background reindexing. On an external engine: "Hosting another process to run indexing, risking out-of-date indexes, complexity… etc all are not free." Estimated about 3 months to integrate Meilisearch robustly. | A widely self-hosted forum platform; scale per site varies | A user in the same thread disagreed: "postgres is not adapted as a search engine" |
| GitLab docs | Basic search on PostgreSQL; advanced search on Elasticsearch or OpenSearch as a derived store: "All of the data stored in Elasticsearch can be derived again from other data sources". A 2019 post calls a full re-index "painful!" | Code search across millions of repositories | Runs both |
| Mattermost docs | "database search starts to show performance degradation at around 2 million posts, on a server with 32 GB RAM and 4 CPUs"; recommends Elasticsearch or OpenSearch before 3 million | Long chat messages with permission joins, not short titles | The page documents an Enterprise-edition feature, a possible bias |
| Zulip docs | "PostgreSQL's built-in full-text search feature supports only one language at a time"; PGroonga supports all languages at once | Chat | None |
| Crunchy Data (Kat Batuigas, 2021-07-27) | "you won't have to maintain and sync a separate data store"; a dedicated engine only if you need "search at super scale" | General | Sells PostgreSQL |
| Supabase (guest post, 2022-10-14) | PostgreSQL returned 0 results for "suprman" (no pg_trgm used); "Only Typesense and MeiliSearch properly handled mis-spellings" | 32 MB movie dataset | Sells PostgreSQL |
| Xata (Golubenco, 2023-07-19) | Below 100,000 rows both systems do well; at a few million, Elasticsearch is faster; ranking a million matches takes about 25 s | 2.3 million rows | Sells PostgreSQL |
| ParadeDB (Ming Ying, 2024-07-31; faceting 2025-12-10) | Native full-text search "performs well over tables with a few million rows" and degrades at tens of millions; native faceting 27 times slower at 200,000 results | 46 million rows | Sells pg_search |
| Neon (Ben Hagan, 2025-06-13; docs 2026) | Called pg_search "hard to beat", then withdrew it for new projects on 2026-03-19 | — | Vendor that changed position |
| Rocky Warren (2020-09-02) | The first benchmark favoured Elasticsearch. After a stored tsvector column and `websearch_to_tsquery`: "6-10ms … practically the same as Elasticsearch for this specific query" | 1.5 million rows | None |
| Stack Overflow (Nick Craver, 2016-02-17) | Chose Elasticsearch over SQL Server full-text search because "SQL CPUs are comparatively very expensive" | Per-core SQL Server licensing | Does not apply to PostgreSQL (inference) |
| Meilisearch docs (undated) | "PostgreSQL's default full-text search cannot handle misspellings"; enough only for "a small dataset (thousands of documents)" | — | Sells a search engine |

**Where sources disagree.**

- **Where PostgreSQL stops being enough.** Meilisearch says thousands of documents; Xata, about 100,000 rows with ranking; Mattermost, 2 million posts; ParadeDB, tens of millions of rows; Instacart runs billions of items.
- The gap tracks what each measured: ranking every match versus sorting on an indexed column, long text versus short titles, and team expertise (inference).
- **Typo tolerance.** Meilisearch and Supabase say PostgreSQL has none. Belaid, the PostgreSQL docs and this lab show the vocabulary-plus-trigram or Levenshtein route. The lab also shows plain trigram matching is weak for short Persian words.
- **How far behind a second store runs.** ParadeDB says hours (batch ETL); others say seconds (change data capture); GitLab says drift cannot be detected automatically.
- **Normalisation direction.** Lucene folds Persian letters to Arabic; AGENTS.md folds Arabic to Persian. Either works for matching; only the displayed text must never be the normalised form.
- **Elasticsearch host settings.** Elastic says `vm.max_map_count` "must be set to 1048576", while its bootstrap check and OpenSearch accept 262144. OpenSearch's compose file says heap should be "at least 50% of system RAM", while its settings page says half (fork A).
- **Persian stemming.** Elasticsearch 9 stems Persian by default; OpenSearch's documentation lists no stemmer yet offers `stem_exclusion` (fork A).
- **ArvanCloud's database offer.** Its 2024 docs said MySQL only; a 2026 headline implies managed PostgreSQL. Unresolved from outside Iran.
- **Iranian prices.** Pancake's 2024 page is about four times cheaper per GB than Liara's current one, probably stale (fork A, inference).
- **GitHub from Iran.** GitHub's US licence says it is fully available (Nat Friedman, 2021-01-05), while Iranian mirror lists still advertise tools to get around GitHub download restrictions. That is US-side licensing against Iranian-side filtering, and it matters for installing pg_search from GitHub releases (fork C).
- **Neon on pg_search.** Neon called it "hard to beat" in June 2025 and withdrew it in 2026 (fork B).

### 6. The lab

See the section "Lab (method, SQL, numbers)" below.

### 7. Verdict

**Can PostgreSQL alone meet CS-14?** Yes.
- High confidence at the planned scale: tens of thousands of listings, up to 300,000.
- Medium-high at 1,000,000 listings, with the facet measures in 3.2.

| CS-14 criterion | Status in the lab |
|---|---|
| #1 Filters and sorts | Met. Every filter in the listing patterns is a column, and all five sorts are indexed. Model browsing under any sort ran p95 0.63 ms at 1,000,000 listings once the equality-first composites existed. Only city, model, year, price and text filters were benchmarked (see "What the lab does not prove") |
| #2 Persian analysis | Met on the lab's test cases for ي/ك, ZWNJ, every digit script, Latin-typed names and short typos. Needs a labelled set of real queries |
| #3 One-command rebuild | Met. At 1,000,000 listings, rebuilding every search index took about 27 s; `REINDEX … CONCURRENTLY` avoids blocking; refreshing the vocabulary took 4.4 s |
| #4 p95 under 300 ms | Met. Search call p95 23 ms at 100,000 listings, 92 ms at 300,000, and 116 ms at 1,000,000 with sampled facets for broad queries (237 ms exact). Under load at 1,000,000, live facets cap a 4-CPU box at about 45 calls per second; cached facets raise that to about 133 |

**What is lost without Elasticsearch** (medium confidence that none of it matters before the triggers below fire):

- relevance ranking with IDF and BM25, and fast top-k over large match sets;
- a Persian stemmer;
- engine-level fuzzy matching and a synonym API;
- fast aggregations over hundreds of thousands of matches;
- per-field boosting and relevance tuning tools.

## Lab (method, SQL, numbers)

### Machine and settings

- **Host:** Intel Core i7-10510U laptop (4 cores, 8 threads, up to 4.9 GHz boost), 31 GiB RAM, Ubuntu 24.04 kernel 7.0, Docker 29.1.3.
- **Container:** `pgvector/pgvector:pg17`, **PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2)**, limited with `docker update --cpus 4 --memory 8g` to imitate a mid-size VPS.
  - Settings: `shared_buffers` 1 GB, `effective_cache_size` 4 GB, `work_mem` 16 MB, `random_page_cost` 1.1, `maintenance_work_mem` 256 MB, `max_parallel_workers_per_gather` 2, JIT on (the default).
  - Database locale en_US.utf8, encoding UTF8.
- **CPU clock:** 2.3 to 4.0 GHz during single-client runs (recorded per script in `logs/*/…pgbench.txt`); 1.8 GHz with all four cores busy.
- The first exploratory runs were on battery at about 0.9 GHz. Every timing in this note comes from a mains-power run, except the bracketed first-build numbers and the per-row query cancelled in 2.7. The ranking, plan and helper timings were re-measured in a rebuild of the same seeded 300,000 rows (`logs/ac-300k`, 15 s per script, 3.3 to 4.0 GHz).
- **Calibration** so the owner can compare the target VPS: a serial `count(*)` sequential scan of the 205 MB heap took p50 75 ms (parallel: 43 ms) on this machine (`bench/calib_seqscan_*.sql`).

### Data

- **Catalogue:** 15 makes, 52 models and 59 trims of the Iranian market, from «پژو ۲۰۶ تیپ ۲» to «تویوتا لندکروزر», with rough 1404 base prices; 17 cities, Tehran weighted at 52%.
- **Listings:** 300,000 generated listings (255,065 active), seeded:
  - Sources: bama 45%, karnameh 20%, khodro45 15%, sheypoor 20%.
  - Model years in both calendars (domestic models by Jalali year 1385 to 1403, imports by Gregorian 2010 to 2024).
  - Mileage from age.
  - Asking price in toman as `bigint`, derived from a market value by condition, age, mileage and trim, with a normal price gap (sd 7%) and 6% «توافقی».
  - Deal ratings: 7.3% great, 19.6% good, 40.4% fair, 19.5% high, 7.3% overpriced, 6.0% unrated.
  - `first_seen_at` over 120 days.
- **Title noise the sources really have:**
  - 12% with Arabic ي/ك;
  - 30% with Latin digits;
  - 5% with Arabic-Indic digits;
  - 20% with the ZWNJ typed as a space, 10% with it dropped;
  - three title formats, e.g. «پژو ۲۰۶ تیپ ۲ مدل ۱۳۹۸ بدون رنگ»، «سمند سورن، مدل 1403، تعویض گلگیر».
- **Descriptions:** three to seven phrases («فنی سالم، بیمه ۶ ماه، سند تک‌برگ …»); 5% mention the make and model in Latin letters.
- **Sizes:**
  - 300,000 rows: heap 205 MB, indexes 98 MB, total 303 MB.
  - 1,000,000 rows (850,368 active, grown with the same generator and a new seed): heap 681 MB. The original 10 indexes take 312 MB (total 992 MB); with the covering index and the four composites, 16 indexes take 461 MB (total 1,142 MB).
  - The trigram title index (53 MB) is not needed.
  - A 100,000-row subset (the first 100,000 ids, 85,115 active) was copied into its own table with six indexes for the scaling rows.

### Method

- `pgbench -M extended` (unnamed statements, so every call is planned with its actual values), inside the container.
- Each transaction picks a random query and random filters, and runs what the API would run:
  1. a benchmark lookup of the query text;
  2. `fa_query_pl(q)` to normalise, correct and rewrite;
  3. the search with the tsquery as a constant;
  4. for page calls, the facet query.
- Per script: 3 s warm-up, then 20 s logged at 1 client. Per-transaction latencies come from pgbench's log, reduced to median, 95th and 99th percentiles (`stats.py`).
- The mixed workload (`run-mixed.sh`: 40% search page, 30% browse page, 10% typo, 10% Latin, 10% keyset page) ran with 8 clients, first unthrottled (saturation) and then at fixed rates of 50 and 100 calls per second. `--rate` counts queueing delay in latency.
- The cache was warm (`pg_prewarm`), as it is on a running server.

### Key SQL

- `lab/search/01-schema.sql`: normaliser, generated columns, `fa_search` configuration.
- `lab/search/02-catalogue.sql`: catalogue, alias table.
- `lab/search/03-generate.sql`: generator.
- `lab/search/04-indexes.sql`: indexes.
- `lab/search/05` to `09` `.sql`: vocabulary, corrector, query builder (`08` sets up the benchmark queries). `09` is the final version.
- `10`, `11`, `12` `.sql`: growth to 1,000,000 and the 100,000 subset (not kept; `call generate_listings(n)` grows the table).
- `lab/search/13-facet-mitigations.sql`: covering index, sampling, parallel `GROUP BY`s.
- `lab/search/14-sort-composites.sql`: the LIMIT trap and its fix.
- `lab/search/15-match-estimate.sql`: the planner-estimate function.
- `bench/*.sql`: every benchmark query (not kept).
- `run-bench.sh`, `run-mixed*.sh`, `stats*.py`: the harness (not kept).

The core of query (a):

```sql
-- 1. build the query once (p50 0.16 ms, or 0.62 ms with a typo to correct)
select fa_query_pl($1)::text;   -- normalise, correct against search_word, ts_rewrite through search_alias
-- 2. search with it as a constant
select id, title, asking_price_toman, deal_score, mileage_km, model_year_jalali, city_id
from listing
where is_active and search_vector @@ $2::tsquery
  and ($3 = 0 or city_id = $3) and model_year_jalali >= $4 and asking_price_toman <= $5
order by deal_sort desc, id desc
limit 20;
```

### Numbers at 300,000 listings (warm, one client, milliseconds)

| Case | Script | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| (a) text plus city, year and price filters, best deal first, 20 rows | `a_text_filters` | 2,424 | 6.2 | 19.0 | 48.8 | 83.8 |
| (a) text only, best deal first | `a2_text_only` | 1,929 | 8.0 | 22.1 | 62.9 | 76.3 |
| (b) facets: price, year and city filters | `b_facets_filters` | 549 | 23.2 | 109.0 | 142.7 | 191.8 |
| (b) facets: text query set | `b2_facets_text` | 751 | 9.7 | 153.3 | 181.3 | 224.0 |
| (b) facets: all 255,000 active listings | `b3_facets_all` | 94 | 213.4 | 236.6 | 253.0 | 257.8 |
| (c) misspelled query, corrected against the vocabulary | `c_typo` | 2,968 | 5.6 | 14.9 | 18.4 | 30.9 |
| (c) misspelled query, trigram word similarity on titles (rejected) | `c2_trgm_titles` | 120 | 78.7 | 666.1 | 691.3 | 745.1 |
| (d) Latin-typed query through the alias table | `d_latin` | 2,465 | 7.7 | 15.4 | 19.1 | 35.2 |
| (e) page 50 with OFFSET 980 | `e_offset_p50` | 20,707 | 0.86 | 1.57 | 2.02 | 5.6 |
| (e) page 50 with keyset | `e_keyset_p50` | 74,761 | 0.24 | 0.38 | 0.47 | 3.5 |
| (e) page 500 with OFFSET 9,980 | `e_offset_p500` | 1,717 | 11.3 | 13.7 | 16.2 | 23.4 |
| (e) page 500 with keyset | `e_keyset_p500` | 76,289 | 0.24 | 0.36 | 0.43 | 2.4 |
| (e) Tehran page 50, OFFSET / keyset | `e_*_tehran_p50` | — | 0.99 / 0.26 | 1.91 / 0.38 | 2.35 / 0.47 | — |
| **Search call**: query + 20 results + facets and total | `page_search` | 839 | **14.4** | **91.6** | 140.0 | 179.3 |
| **Browse call**: model and city filters + 20 results + facets | `page_browse` | 3,538 | **4.1** | **12.9** | 21.7 | 41.2 |

**Mixed workload at 300,000 listings, 8 clients, 60 s:**

| Load | Search call p50 / p95 / p99 | Browse call p95 | All calls p95 | Throughput |
|---|---|---|---|---|
| 50 calls/s | 15.2 / 77.1 / 117.5 ms | 18.5 ms | 38.9 ms | 48.8 /s |
| 100 calls/s | 15.7 / 77.9 / 133.8 ms | 20.3 ms | 41.4 ms | 99.2 /s |
| Saturated (no think time, 4 CPUs busy at 1.8 GHz) | 54.0 / 269.1 / 499.4 ms | 68.7 ms | 129.0 ms | 192 /s (77 search calls/s) |

**Build and maintenance at 300,000 listings:**

Measured on mains power in a rebuild of the same seeded data (the first build ran on battery; its numbers are in brackets):
- Generation with the generated columns computed: 57.8 s (97 s).
- GIN on `search_vector`: 1.4 s, 11 MB (2.5 s). Trigram GIN on titles: 3.1 s, 19 MB (5.6 s). Each B-tree: 0.12 to 0.31 s, 7.7 MB.
- `VACUUM ANALYZE`: 1.1 s (2.1 s).
- Rewriting both stored columns after a normaliser change: 28.8 s under ACCESS EXCLUSIVE (59.8 s).
- Inserting 100,000 more listings with all 11 indexes in place: 29.5 s (about 3,400 listings per second, generator included).

### Numbers at 1,000,000 listings (warm, one client, milliseconds)

First run with the original 10 indexes (`logs/single-1m.stats.txt`):

| Case | Script | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| (a) text plus filters, best deal first | `a_text_filters` | 1,078 | 14.3 | 39.6 | 127.5 | 144.1 |
| (a) text only, best deal first | `a2_text_only` | 852 | 17.7 | 148.2 | 159.1 | 193.7 |
| (b) facets: price, year and city filters | `b_facets_filters` | 195 | 60.4 | 283.2 | 322.3 | 484.0 |
| (b) facets: text query set | `b2_facets_text` | 266 | 24.6 | 460.4 | 472.2 | 486.1 |
| (b) facets: all 850,368 active | `b3_facets_all` | 35 | 581.2 | 673.3 | 697.9 | 709.8 |
| (c) misspelled query, vocabulary correction | `c_typo` | 1,780 | 9.6 | 37.3 | 41.5 | 66.2 |
| (c) misspelled query, trigram on titles (rejected) | `c2_trgm_titles` | 51 | 279.5 | 972.7 | 1,031.8 | 1,061.1 |
| (d) Latin-typed query | `d_latin` | 1,153 | 16.6 | 35.6 | 43.4 | 64.2 |
| (e) page 50, OFFSET / keyset | `e_*_p50` | — | 0.55 / 0.20 | 0.85 / 0.33 | 1.18 / 0.50 | — |
| (e) page 500, OFFSET / keyset | `e_*_p500` | — | 9.6 / 0.42 | 13.6 / 0.54 | 14.7 / 0.70 | — |
| Search call, exact facets | `page_search` | 283 | 46.8 | 251.9 | 384.6 | 640.0 |
| Browse call | `page_browse` | 881 | 15.3 | 58.1 | 89.3 | 126.6 |
| Calibration: serial / parallel `count(*)` of the 681 MB heap | `calib_*` | — | 227 / 147 | 256 / 182 | — | — |

After adding the covering facet index, the four equality-first sort composites and the estimate-based facet strategy (`logs/cover-1m`, `logs/final-1m`):

| Case | Script | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| Model browse under a random one of five sorts, before the composites | `f_sorts_browse` | 543 | 5.9 | 220.1 | 549.0 | 607.4 |
| The same, after the composites | `f_sorts_browse` | 48,511 | 0.42 | 0.63 | 0.79 | 4.3 |
| Text query under a random one of five sorts | `f_sorts_text` | 871 | 18.6 | 45.3 | 149.4 | 172.5 |
| Facets, all active, covering index | `b3_facets_all` | 54 | 369.8 | 418.3 | 427.5 | 429.4 |
| Facets, filters, covering index | `b_facets_filters` | 274 | 63.1 | 158.2 | 224.5 | 240.4 |
| Search call, exact facets (second run) | `page_search` | 361 | 34.3 | 236.9 | 298.1 | 373.9 |
| Search call, capped count to 30,001 (rejected) | `page_search_v2` | 198 | 70.6 | 327.7 | 370.0 | 424.0 |
| **Search call, sampled facets above an estimate of 30,000** | `page_search_v3` | 413 | **35.3** | **116.4** | 256.2 | 292.5 |
| Browse call, covering index present | `page_browse` | 815 | 17.5 | 55.1 | 67.7 | 125.8 |

**Mixed workload at 1,000,000 listings, 8 clients, 60 s:**

| Mix | Load | Search call p50 / p95 / p99 | Browse p95 | All calls p95 | Throughput reached |
|---|---|---|---|---|---|
| Live facets (`page_search_v3`, `page_browse`) | 50 calls/s requested | 2,208 / 6,268 / 6,707 ms (queue building) | 6,119 ms | 6,198 ms | 44.8 /s |
| Live facets | 100 calls/s requested | 15,501 / 31,757 / 33,409 ms (queue building) | 31,785 ms | 31,680 ms | 45.5 /s |
| Live facets | Saturated | 200.8 / 864.5 / 1,772.0 ms | 563.4 ms | 569.5 ms | 44.2 /s |
| Results only, facets from a cache (`a_text_filters`, `f_sorts_browse`) | 100 calls/s | 18.2 / 59.4 / 150.3 ms | 2.2 ms | 44.5 ms | 97.6 /s |
| Results only | Saturated | 86.6 / 305.6 / 876.4 ms | 3.2 ms | 212.3 ms | 132.7 /s |

**Facet mitigations under EXPLAIN (ANALYZE) at 1,000,000 listings** (`logs/facet-mitigations-1m.out`; instrumented timings, higher than pgbench's):

| Case | Time |
|---|---|
| All-active facets, heap sequential scan | 893 ms with JIT (compiled in 10.7 ms), 890 ms without |
| All-active facets, covering index-only scan (0 heap fetches) | 432 ms |
| All-active facets as four parallel `GROUP BY`s under `UNION ALL` | 350 ms |
| Price and year filtered facets (373,979 rows), covering index | 210 ms |
| «بدون رنگ» facets over 489,250 matches, exact | 471 ms |
| The same from a 10% sample | 63 ms; top-six model errors −0.9% to +3.5% |

**Numbers at 100,000 listings** (subset, one client; `logs/subset-100k`), p50 / p95 in ms:

- facets with filters: 6.2 / 29.5;
- facets for text: 2.7 / 19.6;
- facets over all active: 57.8 / 60.7;
- search call: 4.3 / 22.7;
- browse call: 1.7 / 4.5.

**Build and maintenance at 1,000,000 listings:**

- Generating 600,000 listings without indexes: 159 s.
- Rebuilding the original 10 indexes: about 27 s (tsvector GIN 6.5 s and 32 MB; trigram GIN 14.0 s and 53 MB; B-trees 0.5 to 1.0 s and 26 MB each).
- `VACUUM ANALYZE`: 1.6 s.
- The four composites: 0.7 to 0.9 s each.
- Refreshing the vocabulary with `ts_stat`: 4.4 s.

### What the lab does not prove

- **Synthetic data.** Titles are cleaner and more formulaic than real ads, and the vocabulary (286 words) is far smaller than real listings will produce. Real descriptions are longer; that makes the tsvector and the heap larger, and GIN recheck and ranking slower.
- **Typo and alias accuracy.** The 14 misspellings and 14 Latin queries were written by me and tuned against. They prove the mechanism, not the accuracy on real buyers' queries. That needs a labelled set from real query logs, in the spirit of CS-9.
- **Hardware.** A laptop CPU under a Docker quota, with a warm cache, and the benchmark client on the same machine.
  - The laptop also ran a desktop session and an editor, which took some CPU during the concurrency runs.
  - The numbers exclude the network, Node.js, JSON serialisation and TLS; add a few to tens of milliseconds for a real API call (inference).
  - A shared VPS vCPU may be slower than this laptop core. Re-run the calibration query on the target VPS before relying on the absolute numbers.
- **Concurrency with writes.** The benchmark ran no crawler writes, autovacuum under load or replication.
  - The ingestion rate measured (100,000 listings in 29.5 s with 11 indexes) is far above what the crawlers will produce.
  - Mixed read and write latency was not measured, nor the write cost of the final 16 indexes.
- **Filters not benchmarked.** Only city, model, year, price and text filters were timed. The rest of the listing-pattern filters (trim, body condition, gearbox, fuel, seller type, deal rating, source) exist as columns and are low-cardinality equality predicates, but were not benchmarked. The make-model-trim cascade is a catalogue lookup.
- **Skewed plans.** The synthetic data reproduces the model-price correlation that caused the LIMIT trap. Real data will have other correlations (city and make, year and mileage) that only `EXPLAIN (ANALYZE)` on real data will reveal.
- **Sampled facets and cached facets.**
  - `tablesample system` samples whole pages. Its error was checked only for the six largest models of one broad query (−0.9% to +3.5%). Rare facet values and small filtered sets will have larger relative errors, and can show zero.
  - The capacity "with facets from a cache" was measured by removing the facet query from the workload, not by building a cache.
- **No Elasticsearch comparison.** The same data was not measured on Elasticsearch or OpenSearch, so "PostgreSQL is fast enough" is shown and "PostgreSQL is as fast as Elasticsearch" is not.
- **Relevance.** Nothing here measures whether results are good, only whether they are fast and whether normalisation matches. Ranking quality needs judged queries.
- **Scale.** Beyond 1,000,000 listings, and on PostgreSQL 18, nothing was measured.

## Triggers for adding a search engine

Adopt PostgreSQL-only search now. Add OpenSearch (Apache 2.0; avoids Elastic's download terms) or ParadeDB pg_search (inside PostgreSQL, but AGPL and single-node in Community) only when one of these fires on production data, and after the cheaper fix listed has been tried. The thresholds are my inference, anchored where marked.

| # | Trigger (measure) | Threshold | Try first |
|---|---|---|---|
| 1 | p95 of the search API from the server log, excluding the network | Above 300 ms for a week (CS-14 #4), or p99 above 800 ms | `EXPLAIN (ANALYZE, BUFFERS)` of the slow calls; the equality-first composites; cached or sampled facets; a read replica for search |
| 2 | Peak search and browse calls per second against the measured capacity of the production box (re-run the lab's mixed workload there) | Sustained peaks above half the capacity. In the lab, 4 CPUs handled about 190 calls/s at 300,000 listings, about 45 at 1,000,000 with live facets, and about 133 with facets from a cache | Cache facets per query and filter until the next crawl batch; precompute landing, make and model facets; add a read replica or CPUs. PostgreSQL scales reads with replicas before a second engine is needed |
| 3 | Active listings in the search table (not snapshots) | Above 1 million. Xata: Elasticsearch pulls ahead at "a few million" rows; Mattermost degrades around 2 million posts; this lab needed facet measures at 1 million | Keep inactive listings and snapshots out of the search table; partition by status |
| 4 | Matches per typical query that need text ranking | The product decides to rank by text relevance and common queries match more than 20,000 listings (the lab's 8,960-match ranking already took 150 to 260 ms) | Keep deal score as the default sort; let CS-15 turn text into filters; RUM for ordering inside the index |
| 5 | Live facet counts | p95 above 250 ms after the covering index, sampling and precomputation (Cybertec: about 500,000 matches pass 1 s) | A `facet_count` table refreshed by the worker; parallel per-facet `GROUP BY`s; pgfaceting |
| 6 | Typo and synonym quality on the labelled query set | Recall of the intended listing below 90%, where Elasticsearch's fuzzy query plus the Persian analyser measures at least 5 points better on the same set | Grow the alias table from zero-result query logs (Instacart reports 6% fewer zero-result searches after its hybrid work); a catalogue-weighted vocabulary |
| 7 | Search load hurting ingestion | Crawl or valuation batches slowed more than 2× by search traffic | Route reads to a streaming replica |
| 8 | Product needs Elasticsearch-class features | Relevance tuning on long free-text descriptions, highlighting at scale, per-user personalisation, multi-language analysis | ParadeDB pg_search if AGPL and single-node are acceptable; otherwise OpenSearch with an outbox table drained by the existing worker and a nightly full rebuild |

If a trigger fires, keep PostgreSQL as the only source of truth (ADR-0007's original "derived index" rule). Re-read displayed rows from PostgreSQL. Budget for the sync pipeline, monitoring and about 4 GB of RAM per search node.

## Sources consulted

All were accessed 2026-09-27 unless a date says otherwise. "Fork A/B/C" means the source was read by that parallel research pass and cross-checked here; its findings came back with quotes and URLs.

| # | Author or organisation | Title | URL | Date | Used for | Notes |
|---|---|---|---|---|---|---|
| 1 | PostgreSQL Global Development Group (PGDG) | 12.2 Tables and Indexes | https://www.postgresql.org/docs/17/textsearch-tables.html | undated | Generated tsvector column, configuration rule | Fetched with curl |
| 2 | PGDG | 5.4 Generated Columns | https://www.postgresql.org/docs/17/ddl-generated-columns.html | undated | IMMUTABLE requirement | curl |
| 3 | PGDG | 12.3 Controlling Text Search | https://www.postgresql.org/docs/17/textsearch-controls.html | undated | websearch_to_tsquery, prefix, ranking | curl; Context7 |
| 4 | PGDG | 12.4 Additional Features | https://www.postgresql.org/docs/17/textsearch-features.html | undated | ts_rewrite without reindexing | curl |
| 5 | PGDG | 12.5 Parsers | https://www.postgresql.org/docs/17/textsearch-parsers.html | undated | lc_ctype defines letters | curl; fork C |
| 6 | PGDG | 12.6 Dictionaries | https://www.postgresql.org/docs/17/textsearch-dictionaries.html | undated | Synonym files, thesaurus reindexing, simple template | WebFetch |
| 7 | PGDG | F.33 pg_trgm | https://www.postgresql.org/docs/17/pgtrgm.html | undated | word_similarity, thresholds, words table, GiST vs GIN | WebFetch; Context7 |
| 8 | PGDG | F.17 fuzzystrmatch; Appendix F contrib | https://www.postgresql.org/docs/17/fuzzystrmatch.html | undated | Levenshtein on UTF-8; contrib packaging | Fork C |
| 9 | PGDG | 7.2.4 GROUPING SETS | https://www.postgresql.org/docs/17/queries-table-expressions.html | undated | One-scan facets | curl |
| 10 | PGDG | runtime-config-query (jit_above_cost) | https://www.postgresql.org/docs/17/runtime-config-query.html | undated | JIT behaviour | curl |
| 11 | PGDG | PostgreSQL 18 release notes | https://www.postgresql.org/docs/18/release-18.html | 2025-09-25 | SQL function plan caching, skip scan | WebFetch |
| 12 | PGDG | pg_trgm, unaccent, logical decoding (v18) | https://www.postgresql.org/docs/current/pgtrgm.html | undated | Trusted modules, replication slots | Fork A |
| 13 | PostgreSQL wiki | Count estimate | https://wiki.postgresql.org/wiki/Count_estimate | last edited 2024-11-17 | count(*) cost and estimates | WebFetch |
| 14 | Markus Winand | We need tool support for keyset pagination | https://use-the-index-luke.com/no-offset | 2014-08-06, updated 2023-09-08 | OFFSET versus keyset | WebFetch |
| 15 | Richard Ishida (ed.), W3C | Arabic & Persian Layout Requirements | https://www.w3.org/TR/alreq/ | 2025-10-02 | ZWNJ, Persian letters and digits | WebFetch |
| 16 | Apache Lucene | ArabicNormalizer (9.12) | https://lucene.apache.org/core/9_12_0/analysis/common/org/apache/lucene/analysis/ar/ArabicNormalizer.html | undated | Normalisation rules | WebFetch |
| 17 | Apache Lucene | PersianNormalizer (9.12) | https://lucene.apache.org/core/9_12_0/analysis/common/org/apache/lucene/analysis/fa/PersianNormalizer.html | undated | Folds to Arabic letters | Fork B |
| 18 | Elastic | Language analyzers (persian) | https://www.elastic.co/docs/reference/text-analysis/analysis-lang-analyzer | undated | Persian analyser contents | Fork A/B; Context7 |
| 19 | rezatorabi; cbuescher (Elastic) | PR #99106 (persian_stem); PR #113482 | https://github.com/elastic/elasticsearch/pull/99106 | 2023-09-05; 2024-10-02 | Stemmer history | Fork A |
| 20 | Elastic | ICU transform token filter | https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-icu-transform | undated | No custom transliteration rules | Fork A |
| 21 | Elastic | Search with synonyms | https://www.elastic.co/docs/solutions/search/full-text/search-with-synonyms | undated | Search-time synonyms | Fork B |
| 22 | Elastic | JVM settings; MachineDependentHeap.java; Docker production; Disable swapping; Bootstrap checks | https://www.elastic.co/docs/reference/elasticsearch/jvm-settings | undated / main | Heap sizing, host requirements | Fork A; Context7 |
| 23 | Elastic | Resilience in small clusters; Size your shards | https://www.elastic.co/docs/deploy-manage/production-guidance/availability-and-resilience/resilience-in-small-clusters | undated | Single-node advice, shard size | Fork A |
| 24 | Elastic | Refresh parameter; update mappings; aliases | https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter | undated | Near-real-time, reindexing | Fork A |
| 25 | Shay Banon, Elastic | Elasticsearch is Open Source, Again | https://www.elastic.co/blog/elasticsearch-is-open-source-again | 2024-08-29 | AGPL option | Fork A |
| 26 | Elastic | Licensing FAQ; Elastic License 2.0 | https://www.elastic.co/pricing/faq/licensing | undated | Binaries under ELv2 | Fork A |
| 27 | Elastic | Downloads (export-control section); Trade compliance | https://www.elastic.co/downloads | page updated 2026-01-05 | Iran listed as prohibited | Fork A |
| 28 | Luca Belluccini, Elastic | Apt repository 451 thread | https://discuss.elastic.co/t/232494 | 2020-05-13 | CDN geo-filtering | Fork A |
| 29 | OpenSearch Project | Installing OpenSearch; Docker; Persian analyser | https://docs.opensearch.org/latest/install-and-configure/install-opensearch/ | undated | Heap, admin password, analyser | Fork A (curl) |
| 30 | Linux Foundation | OpenSearch Software Foundation press release | https://www.linuxfoundation.org/press/linux-foundation-announces-opensearch-software-foundation-to-foster-open-collaboration-in-search-and-analytics | 2024-09-16 | Governance, Apache 2.0 | Fork A |
| 31 | Liara | Cloud database; PostgreSQL and Elasticsearch docs | https://liara.ir/products/cloud-database/ | undated | Engines, versions, prices in toman | Fork A |
| 32 | Hamravesh | Managed database docs | https://docs.hamravesh.com/products/dbaas/managed-database | ©2026 | Managed PostgreSQL | Fork A |
| 33 | ArvanCloud; Internet Archive copy | Database docs | https://web.archive.org/web/20240926032459/https://docs.arvancloud.ir/fa/databases/ | 2024-09-26 | MySQL only then | Live pages blocked by a JavaScript challenge |
| 34 | Pancake; Runflare | DBaaS pages | https://getpancake.com/fa/dbaas/elasticsearch/ | modified 2024-09-01 | Engines and prices | Fork A; likely stale |
| 35 | Martin Fowler | PolyglotPersistence | https://martinfowler.com/bliki/PolyglotPersistence.html | 2011-11-16 | Cost of more stores | Fork A |
| 36 | Martin Kleppmann | Using logs to build a solid data infrastructure (or: why dual writes are a bad idea) | https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html | 2015-05-27 | Dual writes | Fork A |
| 37 | Gunnar Morling, Debezium | Reliable Microservices Data Exchange With the Outbox Pattern | https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/ | 2019-02-19 | Outbox | Fork A |
| 38 | Jiri Pechanec, Debezium | Streaming data changes to Elasticsearch | https://debezium.io/blog/2018/01/17/streaming-to-elasticsearch/ | 2018-01-17 | CDC moving parts | Fork A |
| 39 | Rachid Belaid | Postgres full-text search is Good Enough! | http://rachbelaid.com/postgres-full-text-search-is-good-enough/ | 2015-07-13 | Practitioner case, limits, RDS | Fork B (curl) |
| 40 | Ankit Mittal et al., Instacart | How Instacart Built a Modern Search Infrastructure on Postgres | https://tech.instacart.com/how-instacart-built-a-modern-search-infrastructure-on-postgres-c528fa601d54 | 2025-05-28 | Migration from Elasticsearch | Page returned 403; read through the publisher's Medium feed |
| 41 | Leela Kumili, InfoQ | Instacart consolidates search infrastructure on PostgreSQL | https://www.infoq.com/news/2025/08/instacart-elasticsearch-postgres/ | 2025-08-25 | Secondary report | Fork B |
| 42 | Discourse | lib/search.rb, search_indexer.rb, post_search_data.rb | https://github.com/discourse/discourse | main at bf55a44 | How Discourse searches | Fork B |
| 43 | Sam Saffron and others, Discourse Meta | Refinements to search being tested on meta | https://meta.discourse.org/t/refinements-to-search-being-tested-on-meta/254158 | 2023-02-06 to 2023-03-20 | Why not an external engine | Fork B |
| 44 | Kat Batuigas, Crunchy Data | Postgres Full-Text Search: A Search Engine in a Database | https://www.crunchydata.com/blog/postgres-full-text-search-a-search-engine-in-a-database | 2021-07-27 | Vendor view | Fork B |
| 45 | Victor (guest), Supabase | Postgres Full Text Search vs the rest | https://supabase.com/blog/postgres-full-text-search-vs-the-rest | 2022-10-14 | Typo comparison | Fork B |
| 46 | Neon; Ben Hagan | pg_search docs; Comparing Native Postgres, ElasticSearch, and pg_search | https://neon.com/docs/extensions/pg_search | undated; 2025-06-13 | Extension withdrawn | Fork B |
| 47 | Tudor Golubenco, Xata | Full-text search engine with PostgreSQL (part 2) | https://xata.io/blog/postgres-full-text-search-postgres-vs-elasticsearch | 2023-07-19 | Scale thresholds, ranking cost | Fork B |
| 48 | Ming Ying; James Blackwood-Sewell, ParadeDB | Elasticsearch vs Postgres; Teaching Postgres to Facet Like Elasticsearch | https://www.paradedb.com/blog/elasticsearch-vs-postgres | 2024-07-31; 2025-12-10 | Vendor thresholds, faceting | Fork B |
| 49 | Ants Aasma, Cybertec | Faceting large result sets in PostgreSQL | https://www.cybertec-postgresql.com/en/faceting-large-result-sets/ | 2022-12 | Facet thresholds, pgfaceting | Fork B |
| 50 | GitLab | Search docs; Elasticsearch docs; global search blog (Mario de la Ossa) | https://docs.gitlab.com/integration/advanced_search/elasticsearch/ | undated; 2019-03-20 | Real split, sync pain | Fork B |
| 51 | Mattermost | Enterprise search | https://docs.mattermost.com/administration-guide/scale/enterprise-search.html | undated | 2 million post threshold | Read from the docs source on GitHub |
| 52 | Zulip | Full-text search | https://zulip.readthedocs.io/en/latest/subsystems/full-text-search.html | undated | One-language limit, PGroonga | Fork B |
| 53 | Meilisearch | Meilisearch vs PostgreSQL | https://www.meilisearch.com/docs/resources/comparisons/postgresql | undated | Counter-argument | Vendor |
| 54 | Rocky Warren | Full-Text Search Battle: PostgreSQL vs Elasticsearch | https://www.rocky.dev/blog/full-text-search | 2020-09-02 | Benchmark reversal | Fork B |
| 55 | Nick Craver | Stack Overflow: The Architecture – 2016 Edition | https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/ | 2016-02-17 | Licensing-cost argument | Fork B |
| 56 | ParadeDB | LICENSE; Guarantees; Extension install; Stemmer; Limitations | https://www.paradedb.com/docs/concepts/guarantees | undated | pg_search facts | Fork C; Context7 |
| 57 | PGroonga Project; Groonga Project | PGroonga docs; NormalizerAuto; NormalizerTable | https://pgroonga.github.io/ | undated (4.0.9 on 2026-09-23) | PGroonga facts | Fork C; Context7 |
| 58 | pgbigm | pg_bigm README | https://github.com/pgbigm/pg_bigm | release 2025-09-02 | pg_bigm facts | Fork C |
| 59 | Postgres Professional | RUM README | https://github.com/postgrespro/rum | release 2025-10-23 | RUM facts | Fork C |
| 60 | Ubuntu, Debian, PGDG | Package indexes (postgresql-16, rum, pgvector, noble-pgdg Packages.gz) | https://packages.ubuntu.com/noble/postgresql-16 | live | Installability | Fork C |
| 61 | Iranian mirrors (IranServer, IUT, MobinHost, Pardisco, Liara and others) | Mirror index pages | https://mirror.iranserver.com | live | No PGDG mirror found; registry mirrors exist | Fork C; ArvanCloud blocked by a challenge |
| 62 | Docker Inc.; ilya-lesikov (werf) | Docker Terms of Use; werf discussion #6166 | https://github.com/werf/werf/discussions/6166 | effective 2026-08-26; 2024-05-30 | Docker Hub blocks Iran | Fork C |
| 63 | Nat Friedman, GitHub | Advancing developer freedom: GitHub is fully available in Iran | https://github.blog/2021-01-05-advancing-developer-freedom-github-is-fully-available-in-iran/ | 2021-01-05 | GitHub access | Fork C |
| 64 | This lab | Docker lab, PostgreSQL 17.11 | `lab/search/` | 2026-09-27 | All measured numbers | Scripts kept; logs not kept |
