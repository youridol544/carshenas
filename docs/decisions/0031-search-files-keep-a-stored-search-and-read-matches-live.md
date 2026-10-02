# ADR-0031: Search files keep one stored search and read their matches live, with a state, a last look and a limit

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-70 lane)
- Related: CS-70, CS-71, CS-72, CS-76; ADR-0020, ADR-0026, ADR-0027, ADR-0028; docs/specs/S02-filters-and-catalogues.md

## Context

«بسپارش به کارشناس» hands the current search to Karshenas as a search file (owner's plan of 2026-09-29). The file must find exactly what the search page shows, survive later changes to a catalogue, tell a buyer what is new since they last looked, and give CS-71 (crawl requests) and CS-72 (the matching job) something to build on. Layer 8 of the data model had planned `saved_search` for Telegram chats; accounts now exist (ADR-0020).

## Decision

1. **One table, `search_file`, owned by an account**: `name`, `search` (jsonb, the `StoredSearch` of `@carshenas/search`: versioned, canonical, a catalogue expanded to its filters), `status` (`watching`, `paused`, `closed`), `created_at`, `status_changed_at`, `viewed_at`. It takes over `saved_search` for accounts; a Telegram chat (CS-76) will refer to a file.
2. **The same search is one file.** `UNIQUE (account_id, search)` over canonical jsonb; saving again finds the file. The app inserts and maps the violation, never checks first.
3. **Matches are never stored.** They are read from `search_document` with `searchableWhere()` (the function the page, the API and CS-72 share), so a file cannot drift from the search page. A listing is new to a buyer when Carshenas first saw it (`listing.created_at`) after `viewed_at`; the file's page records the look two seconds after it is on screen and keeps showing what was new when it opened.
4. **The search is fixed once written** (the web role has no UPDATE on `search` or `account_id`): a changed search is a new file. Name, state and look are the buyer's.
5. **At most 30 files an account**, stated by a trigger (`search_file_per_account_limit`) under a per-account advisory lock, because the matching job reads every watching file and the crawl budget is shared.
6. **A stored search this build can no longer read is shown as such**: listed, deletable, its cars not guessed.
7. **Entry points**: the save button beside the count and a banner after the fourth card on the search page (teardown pattern 24), a button on every home catalogue row; a visitor is told to sign in or sign up and returns to the same search with the dialog open (`?save=1`, consumed with the browser's own `replaceState` so Next.js does not re-read the page).
8. **Crawl requests (CS-71) join later**: they add their own table and a link to a file; CS-70 never adds crawling. Notifications for new matches (CS-72) add a kind, a producer and the file's mute column as ADR-0026 describes.

## Alternatives considered

- **Store the match ids or a snapshot per file**: fast to count, but a second source of truth that goes stale and must be rebuilt on every change to the search table.
- **Indexable columns (make_id, max_price…) beside the jsonb, as the plan said**: duplicates what the filters define; CS-71 reads `filters.make/model/trim` from the jsonb, and an index is added when a measured query needs it.
- **A matcher watermark column now**: CS-72 owns it; adding an unused column now would be a guess.
- **A unique hash column**: jsonb equality is exact and the 2 KiB size limit keeps the index row under PostgreSQL's limit.

## Consequences

- A file's counts cost one capped read of `search_document` each (plans in the task notes); a list of 30 files is 30 small reads.
- A filter removed from the definitions makes files that use it unreadable until the buyer deletes them; the definitions' tests catch the removal, the page says so.
- `viewed_at` has no check against `created_at`, so tests and operators can move a look back.
