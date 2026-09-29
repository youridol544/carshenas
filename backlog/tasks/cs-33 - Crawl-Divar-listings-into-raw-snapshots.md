---
id: CS-33
title: Crawl Divar listings into raw snapshots
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-29 11:13'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-4
  - CS-5
  - CS-30
  - CS-32
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/runbooks/logs-and-errors.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-listing-data-and-freshness.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Divar is the largest used-car source, and the owner decided on 2026-09-27 to crawl it first, before Bama, through its public web API: the JSON its own website calls (search: POST https://api.divar.ir/v8/postlist/w/search; post: GET https://api.divar.ir/v8/posts-v2/web/{token}; both confirmed in CS-5). This goes against Divar's terms, a risk the owner accepted (ADR-0008 point 3); every other rule of ADR-0008 applies in full.

The crawl reads Tehran's car category `light` («خودرو سواری و وانت», the page divar.ir/s/tehran/car), not the wider divar.ir/s/tehran/auto, which adds heavy, rental and classic vehicles that would distort market values. ADR-0017 (2026-09-28) makes the index live and bounded: this task discovers new listings newest first and stores their snapshots; CS-35 keeps the index fresh, and CS-53 lets the superadmin choose the tracked models. Everything later (parsing, extraction, duplicates, valuation) is derived from raw snapshots, so snapshots must be complete, dated and immutable. The worker is TypeScript on pg-boss (ADR-0011 point 5), built on CS-32.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Discovery reads Divar's Tehran car category (`light`) newest first, often enough that a new listing of a tracked model is stored within an hour of being posted, stops once it reaches listings it already knows (allowing for bumped listings), and stores one immutable snapshot per new listing of a tracked model, with URL, fetch time, content hash and raw data
- [ ] #2 The crawler reads Divar through the worker's lane (CS-32, ADR-0018): one request at a time with the source's configured interval, a descriptive User-Agent, a stop on any 403, challenge page or empty answer where listings were expected, and on a 429 the lane's cool-down with a stop on the second within a day, proven by tests against a local stub
- [ ] #3 Re-running the crawl stores a new snapshot only when the content changed and records price changes
- [ ] #4 Each crawl run reports counts, errors and duration
- [ ] #5 Tehran's active car listings, new listings per hour and how deep the list pages can be followed are measured and recorded, with the daily request budget they imply (ADR-0017 point 5)
- [ ] #6 Divar is read only through the JSON its public web API serves; no contact or phone endpoint is ever requested
- [ ] #7 Until the superadmin section manages them (CS-53), the tracked models are a configured list of Divar make and model filters, seeded with the ten models that have the most Tehran listings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Research done 2026-09-29 (a few polite requests: the agent's browser on divar.ir/s/tehran/car and /peugeot/206, then six curl calls at least 3 s apart; raw answers kept in the scratchpad only):
- Make and model filters are `brand_model` values («Peugeot 206», «Pride», trims «Peugeot 206 5»), confirmed in the web client's own request; one search accepts several values, so one feed covers every tracked model. The first page's SEO links list the child values (brands, then models, then trims).
- Rows carry token, sort time (action_log sort_date), «نردبان شده» for bumps, «پله شده» for promoted rows put on top of page 1 with old dates; only page 1 has schema.org data.
- A post states «انتشار آگهی», «آخرین نردبان», «آخرین به‌روز‌رسانی» (Jalali, Tehran time); seo.unavailable_after is a naive Tehran time about 31 days after posting; a missing post answers 404 {code 5}. Photos: IMAGE_CAROUSEL items with a full-size webp_post URL and a webp_thumbnail URL, static paths without expiry parameters. Dealer posts carry a hashed owner id in BUSINESS_SECTION; MAP holds a fuzzy point.

Plan:
1. Migrations (one concern each, with schema tests and docs/design/data-model.md):
   a. Divar as a source (crawl, public, paused until a person enables it, 3,000 ms) and its policy check of 2026-09-28 from CS-5 (allowed_with_conditions, photos_allowed false, robots.txt kept); restate the min_request_interval_ms comment without Crawl-delay.
   b. The ADR-0008 backstops: a crawl run may start only for an enabled crawl source citing its newest policy check, not not_allowed and no older than policy_max_age_days; a fetch is logged only while its run is running and its source enabled, or when it is the request that stopped the source (requested_at = stopped_at); a blocked or challenge fetch stops the source through stop_source() and its run in the same transaction; rate_limited stops nothing (ADR-0018).
   c. crawl_run.kind (discovery, detail, measure) and counts (jsonb, written once when the run closes); fetch_log.method gains http_post (the search is a POST).
   d. listing_price_event as CS-2 designed it (types, amounts only for asking, previous and last-asking filled by a locking BEFORE INSERT trigger, every event a change, late events refused, append-only).
   e. crawl_feed: a discovery feed's high-water mark (the newest sort time read through) and when its round started.
   f. model_volume (planned for CS-35, created now for the measurement): active listings per Divar brand_model value per sweep, and whether the walk was complete.
2. Runtime (CS-32 code): answers and source errors carry the request's start and duration, so a blocked request's fetch_log row matches stopped_at; the stub source routes by path.
3. Divar adapter (apps/worker/src/sources, pure, unit-tested on synthetic fixtures shaped like the real answers): request bodies; search and post schemas (zod); block detection (HTML is a challenge, an answer without its lists or an empty page where rows were expected is a block, 404 is not_found); price parsing by CS-2's rules (U+200F, three digit scripts, ASCII and Arabic separators; «توافقی» negotiable; below 10 million tomans a placeholder, a code constant); «انتشار آگهی» to an instant through @internationalized/date (new worker dependency); the canonical snapshot.
4. Canonical snapshot (canonical_version 1): the post JSON minus contact, MAP, NOTE, STATIC, the fraud-alert and service-provider rows, BUSINESS_SECTION's hashed owner id, analytics, action logs, webengage (except brand_model, business_type) and the relative «۵ روز پیش» title; phone numbers in text redacted; the category checked as light before storing; every photo URL kept, full size and thumbnail in Divar's order, with photoUrlsOf() reading them, so CS-60 can hotlink them without a new crawl.
5. Jobs, each lane job one crawl run (it cites the policy before its request, logs every request whatever its outcome, closes with its counts):
   - crawl.discover (priority 60, every 15 min in Tehran time): claims the round (skips if one started under 10 min ago), reads the combined tracked-models feed newest first down to the previous round's high-water mark (first round: one hour back; at most 20 pages), so bumped and promoted rows never stop it early; enqueues a detail for a row with no snapshot yet or whose row price differs from its last price event; refreshes last_seen_at of known ones; next page and details enqueued in the same transaction.
   - crawl.fetch-listing (priority 40): upserts the listing (listed_at from «انتشار آگهی», least of old and new), stores the snapshot once per content, logs the fetch, records a price event only on a change; 404 marks a known listing gone.
   - crawl.measure (priority 5): walks brands, then the models of multi-page brands (trims if a search is capped), and the whole feed for depth and hourly flow; writes model_volume.
6. Tracked models: a configured list of brand_model values in the worker (CS-53 replaces it), seeded with the ten most listed from the measurement.
7. Tests: unit tests for the adapter; db tests against a local stub proving the User-Agent, spacing, stops on 403, challenge and empty answers, the 429 cool-down and stop on the second, only the two endpoints ever requested, discovery's stop rule, snapshot dedup and price events, and runs with counts.
8. Live (from an Iranian network, CRAWLER_USER_AGENT set, Divar enabled by a person): the measurement, then discovery for a few hours; record Tehran's active listings, new listings per hour, list depth and the budget they imply in the freshness research note; evidence for criterion 1 from posting-to-snapshot times.
9. Docs and review: data-model.md, the worker runbook, fetch_log retention decided from the measured growth, learnings; database-reviewer, task-reviewer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): where a source's robots.txt and recorded terms allow it, the crawler also downloads the listing's photos, within the same politeness limits (one request at a time per host, the configured delay, a stop on 403, 429 or a challenge), and hands them to the ArvanCloud store that CS-60 builds. Record the photo URLs in the snapshot either way.

CS-4 (2026-09-27) prepared the tables: source, source_policy_check and the source_current_policy view, crawl_run, fetch_log, snapshot and the listing identity (db/migrations 20260927060001 to 04; docs/design/data-model.md). CS-33 adds: (1) the worker process and pg-boss 12 (ADR-0011): one crawl queue with localGroupConcurrency per source, follow-up jobs enqueued in the same transaction through Kysely, dead letters, schedules in Asia/Tehran, a short backstop poll with notify, a typed send helper, and no reliance on singletonKey outside singleton or throttled queues; (2) the carshenas_worker role with its own timeouts and table grants; (3) the cross-row backstop triggers from the research lab: a crawl run must cite its source's newest policy check, no older than policy_max_age_days and not not_allowed, on an enabled source; a fetch with outcome blocked, rate_limited or challenge stops the source (stopped_at, stop_reason) and the run in the same transaction (ADR-0008 point 6); no fetch is logged for a source that is not enabled; (4) upserts on listing_source_key_unique with a change guard, and snapshots deduplicated by (listing_id, content_sha256) with personal data removed before storage; (5) a fetch_log retention or partitioning decision before it grows; (6) moving src/server/db to packages/db when the worker imports it (ADR-0003 trigger); (7) a health check for the worker.

CS-4 review (2026-09-27): the worker role (carshenas_worker) needs SELECT on listing_status_transition, because listing_status_guard runs with the caller's rights, and it gets no TEMPORARY privilege (only carshenas_migrate may create temporary tables). The lifecycle guard checks inserts AFTER INSERT, so an upsert that finds a known listing sold (INSERT … ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE SET status = excluded.status, delisted_at = excluded.delisted_at) works; fetch_log rows reference their listing as (listing_id, source_id), so a fetch of one source cannot point at another source's listing.

CS-4 review round 2 (2026-09-27): an expired or gone listing seen again must return to active in the same write (listing_gone_not_seen_since; the upsert in the database skill's kysely.md does it). Open for this task: whether a listing first seen already sold may be recorded (new to sold is not an allowed transition yet; sold listings would be useful comparables). TRUNCATE is refused on the append-only tables outside a purge.

Reordered on 2026-09-27 (owner): this task crawls Divar first; Bama moved to CS-54 with Karnameh and Khodro45. The data model already stores every source's listings in the one listing table (checked on the dev database with Divar, Bama, Khodro45 and Karnameh rows); Divar becomes a source row with access_method crawl and listing_visibility public. Record Divar's policy check truthfully: terms_summary says the terms forbid automated copying, verdict allowed_with_conditions with the owner's decision and the ADR-0008 conditions as its conditions, so the crawl-policy backstop can let it run.

CS-2 (2026-09-27, ADR-0014, proposed): listing_price_event amounts are bigint _toman columns with CONSTRAINT <table>_<column>_range CHECK (<column> BETWEEN 1 AND 999999999999999); schema-catalog.test.ts enforces the form. Divar prices: parse the displayed string (search middle_description_text; the detail «قیمت پایه» widget value, which starts with U+200F and used ASCII commas in 2026-09 and U+060C in 2025-11). Never webengage.price (one crawler saw it rounded through a 32-bit float: 2,150,000,000 read as 2,150,000,128) and never schema.org price (rials on the search page, tomans labelled IRR on the detail page). Placeholder prices (1,000 or 10,000 tomans) occur. Evidence: docs/research/2026-09-27-money-and-jalali-calendar.md finding 3.5.

CS-2 review (2026-09-27): a price event carries asking_price_toman exactly when price_type is asking. A switch to a placeholder or an installment offer is a change of type with no amount, never a price drop, and alerts announce only drops between two asking prices (docs/design/data-model.md, layer 3).

CS-2 second review (2026-09-27): listing_price_event gets previous_price_type, previous_price_toman and last_asking_price_toman, filled by one BEFORE INSERT trigger from the listing's earlier events (inserted in observed order), and CHECK ((price_type, asking_price_toman) IS DISTINCT FROM (previous_price_type, previous_price_toman)), so every event is a change. A price drop is an asking event below last_asking_price_toman, so 1.25 billion, then negotiable, then 1.0 billion is a drop. Tested in PGlite: a repeated negotiable event and a repeated price are refused. See docs/design/data-model.md, layer 3.

CS-2 database review (2026-09-27): the price-event trigger must lock the listing row (FOR NO KEY UPDATE) before reading earlier events, and must refuse an event older than the listing's latest unless it is an exact re-insert of (listing_id, observed_at). Without that, a late event repeated a drop and would send two alerts (reproduced in PGlite). Unchanged prices are left out by the crawler's own INSERT ... SELECT, because ON CONFLICT DO NOTHING does not skip a CHECK violation (23514).

From CS-5 (2026-09-28): Divar's endpoints are confirmed. Search: POST https://api.divar.ir/v8/postlist/w/search with city_ids ["1"], category light and sort sort_date (the minimal body is in docs/research/2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md); page on by sending the response's pagination.data back as pagination_data while pagination.has_next_page is true; 24 to 26 POST_ROWs per page. Post: GET https://api.divar.ir/v8/posts-v2/web/{token}. Both answered a plain client with a descriptive User-Agent and no cookie (HTTP 200 JSON); no rate-limit headers. The post response's contact object holds tokens only; never call a contact or chat endpoint. Divar's policy-check row: verdict allowed_with_conditions, conditions and terms summary from the research note's verdict table, terms_url https://divar.ir/help/custom_articles/general_terms_and_conditions (the 2026-09-26 address answers 404), robots_txt from robots-2026-09-28/api.divar.ir.txt, photos_allowed false until CS-60. ADR-0008 is accepted (2026-09-28).

From CS-5 (2026-09-28): ADR-0008 point 5, as accepted, no longer lengthens the gap for a robots.txt Crawl-delay: robots.txt is recorded but not followed, and no source set one on 2026-09-28. The column comment on source.min_request_interval_ms still says "longer when robots.txt asks (Crawl-delay)" (db/migrations/20260927060002 line 59, echoed in db/schema.sql and the generated db-types.ts). CS-33's migration restates it with COMMENT ON COLUMN, because an applied migration is not edited.

From CS-30 (owner, 2026-09-28): the crawler logs through the shared observability package that CS-30 builds (structured JSON logs, error serialisation with redaction, trace correlation, process error handlers), not through console. CS-33 therefore depends on CS-30.

From CS-30 (2026-09-28): the worker's setup is in docs/runbooks/logs-and-errors.md ("The crawler worker"): createLogger, installProcessHandlers (fatal line then exit 1; add drain-then-exit on SIGTERM here, as langfuse does), registerTracing with otlpExporter() when OTEL_EXPORTER_OTLP_ENDPOINT is set, withSpan per page and withLogContext({ runId, source }) per run, and node --enable-source-maps so stacks point at TypeScript. Log a source's 403, 429 or challenge as warn with the status and source, one completion line per run with counts; never log a seller's phone number or the listing's contact data.

Planning session of 2026-09-28 (ADR-0017):
- The worker's foundation moved to CS-32: items 1, 2, 6 and 7 of the CS-4 note above (the process with pg-boss 12, the `carshenas_worker` role and grants, the move of `src/server/db` to `packages/db`, the health check). This task keeps items 3 to 5: the backstop triggers, the upserts and snapshots, and the `fetch_log` retention decision.
- The old criterion 5 (the worker's health check, carried over from CS-4) moved to CS-32; criterion 5 now measures the volume that sets the budget. Record the measurements in docs/research/2026-09-28-listing-data-and-freshness.md too.
- Category `light` (divar.ir/s/tehran/car). divar.ir/s/tehran/auto covers heavy, passenger, rental and classic vehicles.
- Divar's own make and model filters (the divar.ir/s/tehran/car/<make>/<model> pages) give each tracked model its own list. Confirm their keys in the web client before relying on them, as the research note says.
- Bumped listings («نردبان شده» in `red_text`) come back to the top of the newest-first order, so discovery stops only after a run of already-known listings, not at the first one.
- Reported by other challenge entrants, not verified here (docs/research/2026-09-28-listing-data-and-freshness.md): one Divar search stops after about 1,200 results, so sweeps are sliced by make and model; the post endpoint answered 429 after a few hundred requests at eight a second; and Divar can block with an empty HTTP 200. Criterion 2 therefore treats an empty answer where listings were expected as a block.

2026-09-28, from the field survey: torob-car committed a snapshot that exposes the coordinates of 14,528 Divar listings. A private seller's map point can be their home, so the snapshot's canonical form drops the listing's `MAP` coordinates and keeps only the district, with the contact data already removed (ADR-0008 point 7). Other entrants read Divar at one request a second and hit 429 after about 30 fast requests; the three-second floor stays.

2026-09-28, from the field survey: a rival's snapshot of Divar "car" rows held 4,922 motorcycles among 14,652 rows. Keep to category `light` and check each listing's category in its breadcrumb before storing it.

Renumbered on 2026-09-29: this task was CS-6 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-6; the archived CS-6 points here.

From CS-32 (2026-09-29, ADR-0018 accepted by the owner): the worker is built. A Divar job is a defineLaneJob in apps/worker/src/jobs/ (registered in registry.ts) whose source() is divar; it runs in the lane crawl.divar, one job of the source at a time across processes, highest priority first (give discovery, re-checks, details and sweeps ADR-0017's order as priorities). Every request goes through context.fetch (User-Agent from CRAWLER_USER_AGENT, the lease and gap in crawl_lane, the answer read in full) or context.lane.request; never fetch directly and never retry in the job. Pass detectBlock to context.fetch for Divar's challenge pages and its empty 200 (criterion 2): it stops the source like a 403. The lane stops a source through stop_source() (the worker role's only change to source), recording the start of the blocked request as stopped_at: use context.fetch's startedAt (LaneRequest.startedAt) as fetch_log.requested_at so the evidence matches. ADR-0018 changes 429: a first one cools the lane down (Retry-After or 15 minutes, gap doubled for 24 hours), a second within 24 hours stops the source with reason rate_limited, so the planned fetch_log trigger must not stop the source on a rate_limited outcome (docs/design/data-model.md, section 3, updated). The carshenas_worker role and its grants on source, listing, crawl_run, fetch_log and snapshot exist (migration 20260929082446); the worker's rule pack is .claude/rules/worker.md and its runbook docs/runbooks/worker.md. Criterion 2 was reworded on 2026-09-29 to match ADR-0018 (it said a 429 stops the source).

Plan approved by the owner on 2026-09-29, as written: each worker job is one crawl run; discovery reads one combined tracked-models feed down to the previous round's high-water mark; new tables listing_price_event, crawl_feed and model_volume. Live measurement and discovery run from the owner's machine once CRAWLER_USER_AGENT is set and Divar enabled. Photo URLs stay in every snapshot (full size and thumbnail, in order) with a helper to read them; CS-34 or CS-60 projects them when the owner decides whether to hotlink Divar's photos.

Slice 1 (2026-09-29): eight migrations 20260929104900 to 20260929104911. crawl_run.kind and counts; fetch_log.method gains http_post (NOT VALID, then validated); the ADR-0008 backstops as two AFTER INSERT trigger functions run as their owner (crawl_run_policy_guard; fetch_log_crawl_rules, which accepts the request that stopped a source as its evidence and leaves 429 to the lane); Divar as a paused source with CS-5's policy check of 2026-09-28 (stale on 2026-10-28); listing_price_event as CS-2 designed it; crawl_feed; model_volume. Schema tests assert each rule by SQLSTATE and constraint name (54 pass); pnpm db:check replays up, down, up with no drift and the integration tests pass; pnpm check passes. docs/design/data-model.md updated.

Slice 2 (2026-09-29): answers from a source carry durationMs, and every source error the HTTP helper throws (blocked, throttled, unavailable, answer too large) carries the request's url, start (the lane's startedAt, the instant a stop records as stopped_at) and duration, so a job logs every request it sent, refused ones included. The stub source can route by request and records request bodies. Worker unit tests (46) and pnpm db:check (19 integration tests) pass.

Slice 3 (2026-09-29): the Divar adapter in apps/worker/src/sources (pure, unit-tested on fixtures built like Divar's real answers with invented values). api.ts builds only the search and post addresses and the search body with the brand_model filter; answers.ts recognises refusals (HTML is a challenge; an empty, unreadable or listless answer where rows were expected is a block; 404 is not); search.ts reads rows (token, sort time, bump and promotion labels, price text, first photo), the cursor and the next level's brand_model values; post.ts builds the canonical snapshot (version 1: contact, map, dealer owner id, note, report, fraud and service rows, analytics, action logs, the daily relative line and the dated page title left out; phone numbers in any text removed; every photo URL kept, full size and thumbnail, in order, readable with photoUrlsOf) and its facts (car or not, brand_model, posting time, price). Helpers: price.ts (CS-2 rules; below 10 million tomans a placeholder), jalali.ts (@internationalized/date 3.12.4, pinned), redact.ts, text.ts. 64 worker unit tests pass.
<!-- SECTION:NOTES:END -->
