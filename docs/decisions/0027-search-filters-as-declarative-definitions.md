# ADR-0027: Define search filters and catalogues once, as data, over one row contract

- Status: accepted by delegation (2026-10-01; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-01
- Deciders: Pedrum (delegated to the CS-58 lane)
- Related: CS-58, CS-59, CS-61, CS-62, CS-63, CS-70, CS-72; docs/specs/S02-filters-and-catalogues.md; ADR-0011, ADR-0012, ADR-0014

## Context

Five features read the same filters: the search API (CS-59), the search page (CS-61), the home page's catalogues (CS-63), search files that keep watching (CS-70, CS-72) and plain-Farsi search (CS-62). The owner's plan of 2026-09-29 asks that adding or removing a filter or a catalogue take one definition, not changes across pages. The facts a filter reads are spread over the listing, the catalogue, the latest valuation run, the photos and the accepted fields of the current extraction, and CS-59 will denormalise them into a search table. Without one home, each feature would re-implement the parameter names, the validation, the Farsi and the SQL, and a stored search would drift from what the page shows.

## Decision

A workspace package, `@carshenas/search`, holds every filter, order and catalogue as data. A filter is one object: id, URL parameter, Farsi label, description and buyer words, a kind (choice, ranked, range, limit, on/off) that gives it a zod value schema, a URL encoding and chip text, and a declarative predicate that names one column. The definitions run in the browser; `sql.ts` turns each kind of predicate into SQL through one named helper, and `options-queries.ts` reads the options that are rows (makes, models, trims, body types, cities, districts, sources). The columns are a contract: the view `listing_filter_row` gives one row per listing with every column a predicate names, merging declared condition with the text's accepted facts; CS-59 materialises it into `search_document` with the same names, so the predicates run on either unchanged. A search is `{ q, filters, sort, catalogue }` under one schema, with one URL form and one stored form (`{ v: 1, … }`, catalogues expanded), used by the URL, the API body, search files and the model's output alike. Catalogues are filter values plus an order, with a Farsi title, a description, buyer words and the reason they exist. Relative values («حداکثر ۱۰ سال عمر») keep catalogues correct across years.

## Alternatives considered

- **Filters as React components with their own query code**: fastest for one page, but CS-59, CS-70 and CS-72 run without React, and three copies of the SQL would drift.
- **SQL predicates written as functions inside each definition**: one file per filter, but it ships Kysely to the browser and lets a definition write any SQL; a closed set of predicate kinds keeps every SQL fragment named and tested (the database skill's rule).
- **Text-fact columns on `listing`, written by the derivation**: fast to filter, but a second place where the text's reading meets the listing's columns (the owner kept that to the price, 2026-09-30) and a migration on the hot table; the view reads the facts where they are, and CS-59's table makes them fast.
- **Numeric ids in URLs and stored searches**: exact, but unreadable and tied to one database's sequences; slugs are given once and never re-minted, so `make.model.trim` keys survive a copy between databases.

## Consequences

- Positive: a new filter or catalogue is one definition and its test cases; the type system fails the build when a filter lacks cases, and a test fails when a label, description or word is missing. A new source or body type is a row. Plain-Farsi search gets its vocabulary (`searchVocabulary()`) and validates its answer with the page's schema.
- Negative / risks: `listing_filter_row` is computed on every read: 2 to 55 ms per catalogue over the 23,364 active listings of 2026-10-01, growing with the listings; pages must read CS-59's table, not the view, once it exists. The predicate kinds are closed: a filter needing a new kind adds a helper to `sql.ts` and its test.
- Follow-ups: CS-59 builds `search_document` from the view and adds `q`; CS-61, CS-63, CS-70 and CS-62 consume the package.
