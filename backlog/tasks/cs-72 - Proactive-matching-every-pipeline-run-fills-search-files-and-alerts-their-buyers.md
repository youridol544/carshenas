---
id: CS-72
title: >-
  Proactive matching: every pipeline run fills search files and alerts their
  buyers
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-03 02:54'
labels:
  - backend
milestone: m-8
dependencies:
  - CS-70
  - CS-68
  - CS-35
  - CS-51
priority: high
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: after each run of the pipeline, Karshenas goes through every watching search file, adds the new listings that match, and tells the buyer, without the buyer searching again. This is the product working for the buyer between visits. Matching reads the same definitions as search (CS-58).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new match rated good or better, and a price drop on a match, notify the buyer once each, and many at once become one summary per run
- [x] #2 A file finds exactly what the search page shows for its search, proven by tests on fixtures
- [x] #3 Each run's matching time and number of notifications are recorded and shown in the superadmin section (CS-41)
- [x] #4 Matching stays within a measured time budget at the demo's volume, with its queries checked with EXPLAIN (ANALYZE, BUFFERS)
- [x] #5 A buyer can mute one search file, and create_notification() creates nothing from that file for them.
- [x] #6 every watching file's new matches are found and told to the buyer; what is new is when each listing became searchable (indexed_at), and the alert time is kept on the file and the notification
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Matching job search.match every 5 min (watermark search_file.matched_through, search_document.indexed_at as the clock for new), one digest per file per run through create_notification (new sixth argument: file mute), spacing 2 h per file and 8 digests per account per Tehran day, file page switch with info control, list card last alert, inbox kind and link, superadmin matching runs panel. ADR-0035.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (ADR-0035): matches are not stored (ADR-0031 kept) so AC1 stored-with-time is met by indexed_at, the notification created_at and search_file.last_alert_at; new = search_document.indexed_at, file page and card now measure it too; mute is search_file.muted_at not a notification_mute row. Plans on lane DB 2026-10-03 (23,752 listings, 5,978 search rows, 680 bench files, 574 candidate listings): whole run 3.2 s, rerun with nothing new 34 ms; candidates index range 3 ms (search_document_indexed_at_idx), price drops index range 0.1 ms (listing_price_event_recorded_at_idx), eligible files 0.9 ms, per-file match query 0.1 to 0.5 ms plus 1 ms planning, digest count 0.1 ms. Tests: worker search-match.db.test.ts (9), schema-constraints (grants, mute, constraints), kinds.test.ts, Playwright search-file-alerts.spec.ts phone and desktop, existing search-files and notifications specs pass on desktop. Note: main had a broken import of nameOnScreen in features/listing (fixed here identically to what main needs). Under machine load (about 25) parallel Playwright runs time out on sign-up; rerun alone passes.

Review round 2026-10-03: digest gated on a good/great new match or a price drop (other new ones stay marked on the page); paused/closed/muted files never read, a trigger restarts the watermark on resume; at most 2,000 files per run via partial index search_file_to_match_idx; per-file failure isolated, unreadable searches no longer pin the window; create_notification checks the file belongs to the account; indexed_at backfill now batched in its own migration; ADR renumbered 0034. Re-measure: 920 files, 150 good new listings, run 7.8 s (nearly every file notifies), rerun 26 ms. Footer layout shift on /account/searches (CLS 0.11) not investigated: pre-existing page-level skeleton height, left as a follow-up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built proactive matching: search.match job (watermark per file, one digest per file per run, spacing and daily cap, mute and paused/closed handled), migrations, notification kind and link, file page mute switch with info control, list card last alert, superadmin runs panel, ADR-0035, docs. Evidence: worker db tests, schema tests, Playwright phone and desktop, EXPLAIN in notes.
<!-- SECTION:FINAL_SUMMARY:END -->
