# ADR-0033: Search files are matched by a watermark after each search refresh, and the buyer gets one digest per file per run

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-72 lane)
- Related: CS-72, CS-70, CS-68, CS-59, CS-71, CS-76; ADR-0026, ADR-0028, ADR-0031; `docs/runbooks/notifications.md`; `docs/design/data-model.md` ("Added by CS-72")

## Context

The owner's plan: after each pipeline run Karshenas goes through every watching search file and tells the buyer what is new, without the buyer searching again. ADR-0031 settled that matches are never stored (they are read live with `searchableWhere()`, so a file cannot drift from the search page) and left the matcher's watermark and the file's mute to this task. Three forces shape the job: the buyer must not be spammed (one notification per file per run, not one per listing, and a ceiling over a day); the job must be safe to run twice (pg-boss runs at least once); and it must stay cheap with many files, because every watching file of every account is read.

## Decision

1. **A job, `search.match`, every five minutes**, after `search.refresh` has indexed what the pipeline found. It reads only stored data and sends no request to any source.
2. **«New» is when a listing first became searchable**: `search_document.indexed_at`, set by the insert and never by the build's update. The job, the file page and the list card all measure «new» on it (a listing whose details are read hours after it was first seen is new to the buyer when it appears in search, not when the crawler first saw its list row). Rows that existed before the migration got their listing's `created_at`.
3. **A watermark per file, `search_file.matched_through`** (default: the file's creation). Everything indexed up to it has been matched for that file. The job advances it in the transaction that creates the notification, so both commit or neither does. Paused, closed and muted files advance it without a word, so resuming does not flood the buyer.
4. **One digest per file per run**, kind `search_file_matches`: how many listings are new, how many of those are rated good or great, and how many already-searchable matches dropped their price since the watermark. Its event key is `search_file:<file>:<watermark in microseconds>`: a watermark only moves forward, so a run repeated from the same watermark (a crash after the notification, before the settle) finds the same key and notifies nobody twice. The text is built from the stored facts; the link opens `/account/searches/<id>`, whose cards already mark what is new.
5. **Spacing and a cap**: at least two hours between two digests about one file, and at most eight digests an account a Tehran day. A file held back keeps its watermark, so its next digest tells everything since in one. The numbers live in `@carshenas/notifications/search-file-alerts`, which the job enforces and the file page's info control explains.
6. **Cheap with many files**: one range read of `search_document_indexed_at_idx` (and one of `listing_price_event_recorded_at_idx`) finds the few listings that are news; each file is ruled out in memory by its make, model and trim keys and by its own watermark; files nothing can match advance together in one statement; the rest are matched against only the candidates' primary keys with `searchableWhere()`, one transaction per file (`FOR UPDATE SKIP LOCKED` on its row). A run's end is the clock less a minute, so a transaction that commits late is still seen by the next run.
7. **The file's mute is a column, `search_file.muted_at`**, not a row of `notification_mute` (ADR-0026 point 4 left the form open): one file, one flag, nothing to join, gone with the file. `create_notification()` gains a sixth argument, the file, and creates nothing for a muted one, whoever calls. The buyer's kind-level mute («آگهی‌های تازه‌ی پرونده‌ها») still works through `notification_mute`.
8. **Nothing is stored about the matches** beyond the watermark, `last_alert_at` (shown on the card) and the notification itself.

## Alternatives considered

- **Store matches per file** (a join table, the task's first draft: "stored with the time they were found"): a second source of truth to rebuild whenever the search table changes; ADR-0031 already rejected it. The notification and the page's live read give the buyer the same information.
- **`listing.created_at` as «new»**: simplest, but a listing whose details are read a day later never counts as new for a buyer who looked in between, and the job would have to re-read old listings forever.
- **Match inside `search.refresh`**: couples a buyer-facing job to the search build's lock and lets a slow match delay the table's freshness. A separate job reads what the build committed.
- **One notification per match**: spam; the owner asked for a summary per run.
- **The mute in `notification_mute` with a nullable `search_file_id`**: a unique key over a nullable column, and a row to clean when the file goes.

## Consequences

- A listing that expires from the search table (48 hours) and returns is indexed again and can be told again; acceptable, since it is back on the market.
- A buyer at the daily cap hears of new listings at the next day's first digest, up to 48 hours stale at worst; the file page always shows them at once.
- Matching time is recorded on the job's completion line and stored output (`milliseconds`, `files`, `notified`, `deferred`, `skippedByKeys`), where the superadmin's job list shows it.
- Follow-ups: CS-76 delivers the same notification to a chat; CS-71's crawl requests may raise a file's freshness without changing this job.
