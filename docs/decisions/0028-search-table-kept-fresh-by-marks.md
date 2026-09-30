# ADR-0028: Serve search from a table the worker keeps fresh by marking changed listings, with keyset pages and counted facets

- Status: accepted by delegation (2026-10-01; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-01
- Deciders: Pedrum (delegated to the CS-59 lane)
- Related: CS-59, CS-61, CS-62, CS-63, CS-70, CS-72; ADR-0011, ADR-0017, ADR-0027; `docs/design/data-model.md` ("Added by CS-59"); the database skill's `references/search.md`; `docs/evidence/search-api/2026-10-01/`

## Context

CS-58 defined every filter over the view `listing_filter_row`, which computes a listing's row from six tables, the latest valuation run and the current extraction on every read: 2 to 55 ms per catalogue today, about 0.9 s once most listings are extracted, and the filter options are a full scan. Pages need results in the order a buyer chose, the next page without OFFSET, a total and facet counts, Persian words typed in any script, and only listings that are for sale now (ADR-0017: active, of tracked models, seen within 48 hours). The rows change all day: crawls, derivations, the catalogue's matching, extractions and the nightly valuation run.

## Decision

Search reads `search_document`, one row per searchable listing with the view's columns under the same names, so CS-58's predicates run on it unchanged. Statement-level triggers on `listing`, `listing_photo`, `extraction_field` and `valuation_run` mark the listings whose rows may change in `search_document_stale`; the worker's `search.refresh` rebuilds the marked listings' rows every minute, and `search.rebuild` rebuilds every row nightly at 04:30 and on `pnpm search:rebuild`. One statement builds a set of rows: it writes only rows that are new or changed and removes rows that stopped being searchable, so readers never wait and a rebuild that changes nothing writes nothing. Every build recounts `search_facet_count` (the total, each catalogue, each option of the row-backed filters) in its transaction and rebuilds the typo vocabulary when rows changed. Text is normalised by one immutable function for documents and queries (`search_normalize`), indexed as a generated `tsvector` in our own configuration `fa_search`, and queried through `search_tsquery`, which requires every word, matches prefixes except numbers and tries an unknown word with its closest vocabulary word; Latin names and aliases are part of each document. The API is `features/search/server/search-queries.ts` for Server Components (`searchListings`, `readSearchFacets`, `readFilterOptionCounts`, `readCatalogueCounts`) and `GET /api/search` with the page's own URL parameters plus `cursor`, `limit` and `facets` for what a page asks after rendering; both return DTOs. Pages continue by an opaque keyset cursor over the order's columns and the listing id; totals are read from the counts when the search is everything or an unchanged catalogue, and otherwise counted exactly up to 50,000 («بیش از …» above); facets for a filtered search are counted live, each without its own filter.

## Alternatives considered

- **Refresh after each writer** (the crawl, the derivation, the matcher, the extraction and the valuation each call a refresh): no triggers, but every future writer must remember it, and a missed one leaves stale rows silently. Triggers mark by construction and cost 27 µs a changed row (0.63 s on an update of all 23,360 listings).
- **A materialized view with REFRESH CONCURRENTLY**: one statement, but it recomputes every row every time (the view's full cost each minute) and cannot remove a row as it ages past 48 hours without a full refresh.
- **A shadow table swapped in by rename for the full rebuild** (the plan in the data model): fastest for hundreds of thousands of rows, but the worker does not own the table and cannot rename it; at 23,360 rows the one-statement build takes 0.6 s when nothing changed and 4.5 s from empty.
- **Reading the view directly with a short cache**: simplest, but its cost grows with the extractions, and facets would scan it.
- **`ts_rewrite` with an alias table at query time** (the research's design): kept for later; putting the catalogue's names and aliases into each document matched every Latin-typed model name on the lane without it.
- **OFFSET pagination and exact counts everywhere**: simpler, but OFFSET degrades with depth and a count of every match of a broad search costs more than it tells.

## Consequences

- Positive: every search query measured under 9 ms on 23,360 listings (`plans.txt`); the API's p95 was 34 ms with one client and 224 ms with eight on a production build (`load-results.md`); a stored search, the URL and the API run the same SQL; counts on the home page cost one small read.
- Negative / risks: a change reaches search within about a minute of its commit; model popularity ranks and catalogue names refresh only with the nightly rebuild (or `pnpm search:rebuild`); the tracked-model list is still code (CS-53 moves it to the superadmin section, and then untracking a model needs a rebuild, which the section should enqueue). A new table the search row reads needs its own trigger. Deep keyset pages walk the order's index with a filter (under 1 ms at 5,000 rows deep today).
- Follow-ups: CS-61 and CS-63 consume the API; CS-72 matches search files on `search_document` as the worker; the model and make composites return when a searchable model has few listings; a labelled query set measures typo and alias recall (the research's trigger 6) with CS-62.
