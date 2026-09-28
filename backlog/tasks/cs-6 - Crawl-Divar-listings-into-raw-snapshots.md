---
id: CS-6
title: Crawl Divar listings into raw snapshots
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-28 07:26'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-4
  - CS-5
  - CS-30
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0008-crawl-only-what-sources-allow.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Divar is the largest used-car source, and the owner decided on 2026-09-27 to crawl it first, before Bama, through its public web API: the JSON its own website calls (POST https://api.divar.ir/v8/postlist/w/search; the owner's example used the apartment-rent category, so the car category and the post detail endpoint are confirmed in CS-5). This goes against Divar's terms, a risk the owner accepted (ADR-0008 point 3); every other rule of ADR-0008 applies in full. Everything later (extraction, duplicates, valuation) is derived from raw snapshots, so snapshots must be complete, dated and immutable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A crawl of Tehran listings for the ten most-listed models stores one immutable snapshot per listing with URL, fetch time, content hash and raw data
- [ ] #2 The crawler enforces ADR-0008 in code: one request at a time per host with a configurable delay, a descriptive User-Agent, and a stop on any 403, 429 or challenge page, proven by tests against a local stub
- [ ] #3 Re-running the crawl stores a new snapshot only when the content changed and records price changes
- [ ] #4 Each crawl run reports counts, errors and duration
- [ ] #5 A health check proves the worker reaches PostgreSQL through its own pool and role (carried over from CS-4, whose original criterion covered the web app and the worker)
- [ ] #6 Divar is read only through the JSON its public web API serves; no contact or phone endpoint is ever requested
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27; ADR-0010): where a source's robots.txt and recorded terms allow it, the crawler also downloads the listing's photos, within the same politeness limits (one request at a time per host, the configured delay, a stop on 403, 429 or a challenge), and hands them to the ArvanCloud store that CS-29 builds. Record the photo URLs in the snapshot either way.

CS-4 (2026-09-27) prepared the tables: source, source_policy_check and the source_current_policy view, crawl_run, fetch_log, snapshot and the listing identity (db/migrations 20260927060001 to 04; docs/design/data-model.md). CS-6 adds: (1) the worker process and pg-boss 12 (ADR-0011): one crawl queue with localGroupConcurrency per source, follow-up jobs enqueued in the same transaction through Kysely, dead letters, schedules in Asia/Tehran, a short backstop poll with notify, a typed send helper, and no reliance on singletonKey outside singleton or throttled queues; (2) the carshenas_worker role with its own timeouts and table grants; (3) the cross-row backstop triggers from the research lab: a crawl run must cite its source's newest policy check, no older than policy_max_age_days and not not_allowed, on an enabled source; a fetch with outcome blocked, rate_limited or challenge stops the source (stopped_at, stop_reason) and the run in the same transaction (ADR-0008 point 6); no fetch is logged for a source that is not enabled; (4) upserts on listing_source_key_unique with a change guard, and snapshots deduplicated by (listing_id, content_sha256) with personal data removed before storage; (5) a fetch_log retention or partitioning decision before it grows; (6) moving src/server/db to packages/db when the worker imports it (ADR-0003 trigger); (7) a health check for the worker.

CS-4 review (2026-09-27): the worker role (carshenas_worker) needs SELECT on listing_status_transition, because listing_status_guard runs with the caller's rights, and it gets no TEMPORARY privilege (only carshenas_migrate may create temporary tables). The lifecycle guard checks inserts AFTER INSERT, so an upsert that finds a known listing sold (INSERT … ON CONFLICT ON CONSTRAINT listing_source_key_unique DO UPDATE SET status = excluded.status, delisted_at = excluded.delisted_at) works; fetch_log rows reference their listing as (listing_id, source_id), so a fetch of one source cannot point at another source's listing.

CS-4 review round 2 (2026-09-27): an expired or gone listing seen again must return to active in the same write (listing_gone_not_seen_since; the upsert in the database skill's kysely.md does it). Open for this task: whether a listing first seen already sold may be recorded (new to sold is not an allowed transition yet; sold listings would be useful comparables). TRUNCATE is refused on the append-only tables outside a purge.

Reordered on 2026-09-27 (owner): this task crawls Divar first; Bama moved to CS-7 with Karnameh and Khodro45. The data model already stores every source's listings in the one listing table (checked on the dev database with Divar, Bama, Khodro45 and Karnameh rows); Divar becomes a source row with access_method crawl and listing_visibility public. Record Divar's policy check truthfully: terms_summary says the terms forbid automated copying, verdict allowed_with_conditions with the owner's decision and the ADR-0008 conditions as its conditions, so the crawl-policy backstop can let it run.

CS-2 (2026-09-27, ADR-0014, proposed): listing_price_event amounts are bigint _toman columns with CONSTRAINT <table>_<column>_range CHECK (<column> BETWEEN 1 AND 999999999999999); schema-catalog.test.ts enforces the form. Divar prices: parse the displayed string (search middle_description_text; the detail «قیمت پایه» widget value, which starts with U+200F and used ASCII commas in 2026-09 and U+060C in 2025-11). Never webengage.price (one crawler saw it rounded through a 32-bit float: 2,150,000,000 read as 2,150,000,128) and never schema.org price (rials on the search page, tomans labelled IRR on the detail page). Placeholder prices (1,000 or 10,000 tomans) occur. Evidence: docs/research/2026-09-27-money-and-jalali-calendar.md finding 3.5.

CS-2 review (2026-09-27): a price event carries asking_price_toman exactly when price_type is asking. A switch to a placeholder or an installment offer is a change of type with no amount, never a price drop, and alerts announce only drops between two asking prices (docs/design/data-model.md, layer 3).

CS-2 second review (2026-09-27): listing_price_event gets previous_price_type, previous_price_toman and last_asking_price_toman, filled by one BEFORE INSERT trigger from the listing's earlier events (inserted in observed order), and CHECK ((price_type, asking_price_toman) IS DISTINCT FROM (previous_price_type, previous_price_toman)), so every event is a change. A price drop is an asking event below last_asking_price_toman, so 1.25 billion, then negotiable, then 1.0 billion is a drop. Tested in PGlite: a repeated negotiable event and a repeated price are refused. See docs/design/data-model.md, layer 3.

CS-2 database review (2026-09-27): the price-event trigger must lock the listing row (FOR NO KEY UPDATE) before reading earlier events, and must refuse an event older than the listing's latest unless it is an exact re-insert of (listing_id, observed_at). Without that, a late event repeated a drop and would send two alerts (reproduced in PGlite). Unchanged prices are left out by the crawler's own INSERT ... SELECT, because ON CONFLICT DO NOTHING does not skip a CHECK violation (23514).

From CS-5 (2026-09-28): Divar's endpoints are confirmed. Search: POST https://api.divar.ir/v8/postlist/w/search with city_ids ["1"], category light and sort sort_date (the minimal body is in docs/research/2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md); page on by sending the response's pagination.data back as pagination_data while pagination.has_next_page is true; 24 to 26 POST_ROWs per page. Post: GET https://api.divar.ir/v8/posts-v2/web/{token}. Both answered a plain client with a descriptive User-Agent and no cookie (HTTP 200 JSON); no rate-limit headers. The post response's contact object holds tokens only; never call a contact or chat endpoint. Divar's policy-check row: verdict allowed_with_conditions, conditions and terms summary from the research note's verdict table, terms_url https://divar.ir/help/custom_articles/general_terms_and_conditions (the 2026-09-26 address answers 404), robots_txt from robots-2026-09-28/api.divar.ir.txt, photos_allowed false until CS-29. ADR-0008 is accepted (2026-09-28).

From CS-5 (2026-09-28): ADR-0008 point 5, as accepted, no longer lengthens the gap for a robots.txt Crawl-delay: robots.txt is recorded but not followed, and no source set one on 2026-09-28. The column comment on source.min_request_interval_ms still says "longer when robots.txt asks (Crawl-delay)" (db/migrations/20260927060002 line 59, echoed in db/schema.sql and the generated db-types.ts). CS-6's migration restates it with COMMENT ON COLUMN, because an applied migration is not edited.

From CS-30 (owner, 2026-09-28): the crawler logs through the shared observability package that CS-30 builds (structured JSON logs, error serialisation with redaction, trace correlation, process error handlers), not through console. CS-6 therefore depends on CS-30.
<!-- SECTION:NOTES:END -->
