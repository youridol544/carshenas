---
id: CS-34
title: >-
  Parse the sources' structured fields into listing attributes by code, without
  a model
status: Done
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-30 10:57'
labels:
  - backend
milestone: m-3
dependencies:
  - CS-33
references:
  - docs/decisions/0025-show-listing-photos-from-the-sources-addresses.md
  - docs/decisions/0014-money-in-toman-and-jalali-in-the-interface.md
  - docs/design/data-model.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Much of a listing arrives structured. Divar's listing detail carries the make and model with its trim, the model year in both calendars, mileage, colour, gearbox, fuel, months of third-party insurance left, the seller's own condition scores and the price row, and its list rows carry mileage and price (`docs/research/2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md`). Torob's job record asks for someone who knows when to use AI and when another method serves better: these fields are parsed by code, exactly and at no cost per listing, and the model (CS-52) reads only the free text. The parsing rules for prices and model years were settled in CS-2 (ADR-0014) and are recorded in the notes of CS-33 and CS-52. Split from CS-52 on 2026-09-28.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The listing's attribute columns exist with the constraints ADR-0014 and `docs/design/data-model.md` (layer 3) specify, added the way the data-model rules require for a table that has rows
- [x] #2 Divar's structured fields are parsed into those columns by code only, covering every format CS-2 recorded: a leading U+200F, ASCII and Arabic separators, three digit scripts, placeholder prices, and model years in one or both calendars
- [x] #3 A value the parser cannot read is kept as unparsed with its raw text and counted, never guessed
- [x] #4 One command re-derives the attributes of every stored snapshot, so a parser change never needs a new crawl
- [x] #5 Tests run the parser on fixtures made from real snapshots with personal data removed
- [x] #6 The comments the database stores on `listing` (the table, `source_listing_key`, `url`, `listed_at`, `delisted_at` and `last_seen_at`) say listing, never ad: this task's migration restates them, because an applied migration is never edited
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decided on the recommendation, 2026-09-30, by the owner's standing instruction (the owner can overturn any of it).

1. Photos (owner, 2026-09-30: persist the image URLs a source provides, never the images; the app opens them from the source's URL). ADR-0025 (lane E's reserved number) supersedes ADR-0010: the crawler never downloads a photo; each listing's photo URLs (full size and thumbnail, in the source's order) are derived from its latest snapshot into listing_photo, https and the source's own photo host only (Divar: divarcdn.com); pages load them from that URL, never through Next.js's optimizer. Status notes on ADR-0010, ADR-0008 point 4 and ADR-0017 point 10; README index, AGENTS.md, the next.config.ts comment; notes on CS-60 (question answered), CS-55 (photo hashes would need downloads) and CS-61/CS-64 (grant SELECT, no-referrer, placeholder on error).

2. Migration add_listing_attributes, on a table with rows: columns bare and nullable, CHECKs NOT VALID, comments, and the six stored comments restated to say listing (criterion 6). Columns: title; source_model_key (Divar's brand_model, as model_volume keys it); model_year_written, model_year_sh and model_year_ad with ADR-0014's CHECK word for word; mileage_km; fuel; gearbox; insurance_months_left; price_type with asking_price_toman and down_payment_toman (layer 3's CHECKs word for word); accepts_swap; accepts_installments; seller_type; the seller's condition scores body_condition, engine_condition, gearbox_condition, front_chassis_condition and rear_chassis_condition (CS-51 asks for them); parser_version. Left to their tasks: colour and city (CS-50's code tables and geography), make, model and trim ids (CS-50), vehicle_id (CS-55), description_redacted (CS-52), source_dealer_key (canonical snapshot v1 drops the dealer id).

3. Migrations create_listing_photo (listing_id, position, url, thumbnail_url; key listing and position; CASCADE; worker writes, web none until CS-61/CS-64) and create_listing_unparsed_value (listing_id, field, raw_text; key listing and field; CASCADE; worker writes). 4. Migration validate_listing_attributes: VALIDATE every constraint in a later file. 5. pnpm db:migrate, codegen overrides, schema tests for every new constraint and grant.

6. Parser, pure (apps/worker/src/sources/divar/attributes.ts), on the canonical snapshot: title, brand_model, LIST_DATA labelled, modal and score rows, webengage.business_type, photos.

Vocabularies from Divar's own filter lists (2026-09-19) and 4,720 real car listings (2026-09-17): model years in both calendars or the Gregorian one only, and Divar's open-ended oldest year; mileage as numerals with 1,000,000 as unknown; prices through parseShownPrice (U+200F, ASCII and Arabic separators, three numeral scripts, placeholder, negotiable); insurance in months.

Also gearbox, seven fuels, the swap and installment toggles, the seller's scores for body (8 values), engine (3), gearbox (3) and chassis (9 front and rear combinations), and seller type. Anything else is unparsed with its raw text and counted; unknown labels are counted. PARSER_VERSION 1.

7. Writes (apps/worker/src/db/attribute-store.ts) with change guards; the Divar listing job derives from the snapshot it stored or found, in the same transaction, and counts.

8. Command pnpm derive:listings: listings in batches by id, each batch locked, latest snapshots through fetch_log, derived and written, with a report per field (parsed, unparsed, absent), unknown labels and photos; EXPLAIN (ANALYZE, BUFFERS) of its batch query on a seeded database of about 50,000 listings.

9. Fixtures (criterion 5): CS-33's three real post answers of 2026-09-29 through readPost, with token, photo ids, description and address details replaced, plus variants built from them with real values from the survey, covering every CS-2 format. Unit tests for the parser, db tests for the job and the command, and a local coverage run over the 4,720 real values (not committed) as evidence.

10. Docs: data-model.md (section 3, layer 3, privacy, grants, diagram, open questions 8 and 9), worker runbook, learnings.

11. Verify: pnpm check, pnpm db:check, database-reviewer, task-reviewer. Once lane A's first live discovery (CS-35) has stored snapshots, copy them with pg_dump data-only and re-derive them with the command, reporting the unparsed counts.

Owner's answers of 2026-09-30 confirm the decisions above: photos shown as Divar shows them, colour and city with CS-50, the seller's ratings and the installment flag kept, CS-60 re-scoped to removal requests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28, from the field survey (other entrants' documented traps; turn each into a test):
- Divar writes 1,000,000 km to mean an unknown mileage.
- Divar's schema.org prices are in rials, and Bama labels its prices IRR while publishing tomans (CS-2 found the same on Divar's detail page); read the displayed string only.
- Jalali and Gregorian years mix within one feed.
- About 11.5 % of listings are «توافقی».
- Down payments are posted as full prices.

The migration that adds the attribute columns also restates the six stored comments on `listing` that still say "ad" (written by `20260927060003_create_listings.sql`). `pnpm db:migrate` then regenerates `db/schema.sql` and `db-types.ts`.

Slice 1 (2026-09-30): ADR-0025 (accepted; the owner's decision, details on the recommendation) supersedes ADR-0010: photos are kept as the source's own https addresses and shown from there, never downloaded or stored. Status lines of ADR-0008, ADR-0010 and ADR-0017, the ADR index, AGENTS.md, the Next.js rule pack, the UI skills and the next.config.ts comment updated; notes on CS-37, CS-54, CS-55, CS-60, CS-61 and CS-64.

Slice 2 (2026-09-30): four migrations, 20260930075957 to 20260930080115. add_listing_attributes (21 columns bare, 21 CHECKs NOT VALID, comments, the six listing comments restated to say listing), create_listing_photo (key listing and position, https only, CASCADE, worker DML; photos_allowed comment restated), create_listing_unparsed_value (key listing and field, 13 fields, CASCADE, worker DML), validate_listing_attributes. Codegen overrides for the 11 value lists. Evidence: pnpm db:lint 0 issues; schema tests 81 pass (6 new: price amounts and ranges, model-year calendars, the other attributes, photos, unparsed values, grants); pnpm db:check exit 0 (replay up, down, up, no drift, 38 integration tests); pnpm check green after formatting. data-model.md: section 3 Added by CS-34, layer 3, privacy, grants, diagrams, open questions 8 and 9.

Owner's answers, 2026-09-30 (asked with recommendations, after the owner's instruction of that morning replaced deciding on the recommendation): photos are shown as Divar shows them, plates and numbers included, for the demo (ADR-0025 point 5); colour and city are parsed with CS-50's code tables and geography, not here; the seller's condition ratings and the installment flag stay as columns; CS-60 is re-scoped to removal requests.

Slice 3 (2026-09-30): the parser, pure. apps/worker/src/sources/attributes.ts (the shape every source's parser returns, with the value lists from the generated types and ADR-0014's model-year rules), apps/worker/src/sources/divar/attributes.ts (readers per field and deriveDivarListing: title, brand_model, LIST_DATA labelled, modal and score rows, seller type, photos on Divar's own https host), readWholeNumber in packages/locale (toman.ts now shares its grouping). Fixtures: three canonical snapshots made with readPost() from real posts of 2026-09-29, redacted (token, photo ids, description, district), in src/test-support/divar-snapshots with a README. Evidence: 14 parser tests pass (real snapshots read in full with nothing unparsed; every CS-2 price format; both calendars and the Gregorian year alone; Divar's lists; unknown values kept as unparsed with raw text; unknown rows counted; photos only on Divar's own host); locale 44 tests pass. Coverage over 4,720 real car listings of 2026-09-17 (a survey file, not committed): 0 unparsed in mileage, model year, insurance, gearbox, fuel, price, installments, swap and seller type; 17 mileages and 6 years stated as unknown; 206 placeholder prices.

Slice 4 (2026-09-30): apps/worker/src/db/attribute-store.ts writes a derivation with change guards (attribute columns WHERE the tuple IS DISTINCT FROM the new values; photos past the new count deleted, the rest upserted on listing_photo_pkey where changed; unparsed rows likewise). The Divar listing job derives in the transaction that stores the snapshot, from the page it read, and counts attributesChanged, photosChanged, unparsedValues, photosSkipped and unknownLabels. Evidence: pnpm db:check exit 0 (36 worker and 3 web integration tests); a new test serves a real snapshot through the stub: the listing gets its 21 attributes and 7 photo addresses; a page with an unreadable mileage and a photo fewer keeps «زیر صد هزار» as unparsed with mileage_km null and 6 photos; the first page again, whose snapshot was stored before, derives the listing back; an unchanged page rewrites nothing. The two earlier tests that assert run counts now include the new counts.

Slice 5 (2026-09-30): pnpm derive:listings (apps/worker/src/derive-listings.ts over listing-derivation.ts; parsers per source in src/sources/parsers.ts) re-derives every stored listing from its latest snapshot and logs, per field, read, stated unknown, unparsed and absent, then each unread text and unknown row, then the totals. It holds each batch of 200 listings (FOR NO KEY UPDATE, id order) before reading their snapshots in a separate statement: with the lock in the reading statement, a listing the crawler was writing was derived from the page it had just replaced (the new test failed that way: expected 120000, got 91000; passes with two statements). Evidence: pnpm db:check exit 0 (39 worker and 3 web integration tests; 3 new: a full re-derivation with a page that changed back, a listing without snapshot, a snapshot that is not a post, a second run writing nothing and a repair; a value kept as unparsed, then filled by a parser that learns it, without a crawl; the lock race); pnpm check exit 0; the command run on lane E's database (0 listings) logs its report. Plans on 50,000 listings, 65,000 snapshots, 170,000 fetches (seeded in a transaction rolled back): batch lock 0.4 to 0.6 ms (listing_pkey); snapshots of 200 listings 2 to 3 ms, 1,427 buffers (fetch_log_listing_requested_idx, snapshot_id_listing_unique); count without snapshot 92 to 104 ms (hash anti-join, once per run); the crawler's update 13 buffers writing, 3 unchanged; photo and unparsed writes on their keys under 1 ms.

Reviews, 2026-09-30. Task reviewer: all six criteria verified; blocking were two UI references still saying ArvanCloud (ui-design craft.md and react-patterns ui-craft.md, fixed) and the database review (done). Also fixed: a seller type that is not a string no longer throws (webengage values of any type; a non-string is kept as unparsed, with a unit test through readPost); thumbnails left out are counted; ADR-0011's status and index row point to ADR-0025; a CS-52 note on who owns the three price columns. Database reviewer (Squawk 0, schema tests 85, db:check 0, plans with real 4.5 kB payloads): blocking was data loss, a parsed value the database refuses rolling back the crawler's snapshot and stopping derive:listings. Fixed: every derivation is written inside a savepoint (writeDerivedListingOrRefusal; the crawler counts derivationsRefused and keeps the snapshot, the command reports refused listings and goes on); photo addresses are kept as the URL standard writes them (url.href, no user name); mileage above 9,999,999 km is unparsed, and listing_mileage_km_range pins the same bound (migrations not on main, edited after db:rollback). Also fixed, from both reviews: a possible deadlock with discovery, which holds a page of listings in key order: the command now takes each batch with SKIP LOCKED and derives the skipped listings one at a time afterwards. Evidence: db:check exit 0 (41 worker integration tests: the stale read, the deadlock and a refusal each tested; with the replaced locking the stale-read test fails, expected 120000 got 91000, and the deadlock test fails with 40P01 deadlock detected); pnpm check exit 0; parser tests 15.

Database re-review of e84baa9 (2026-09-30): ready, no blocking findings; the savepoint handling, the two-pass locking (no deadlock with the listing job, recordSightings or the price-event trigger, no stale read) and the edited migration verified by the reviewer, who measured nextListings 10 buffers, holdFreeListings 207 buffers and 0.5 ms, holdListing 4 buffers. Fixed from it: a batch is 50 listings (each written inside a savepoint; PostgreSQL keeps 64 subtransactions in memory, and 100 savepoints overflowed it in the reviewer's run); a listing still held when the worker role's 5 s lock timeout ends the wait is reported as stillHeld and the run keeps its report (new test); the tests count waiting locks in their own scratch database only. Evidence: pnpm db:check exit 0 (42 worker and 3 web integration tests); pnpm check exit 0.

After the merge (2026-09-30), at the owner's request to keep what later tasks need in the main database: CS-34's four migrations were applied to the main checkout database (carshenas, 5418), after a backup (~/Dev/carshenas-db-backups/2026-09-30-main-before-cs-34.dump, with its row counts beside it). pnpm derive:listings then derived none of its 120 listings and still reported withoutSnapshot 0: their snapshots were copied from lane F without their fetch_log rows (CS-46), and latestSnapshots found snapshots only through fetches. Fixed on main: a listing whose snapshots no fetch records is derived from the one first fetched last and counted as withoutFetch. The new integration test fails with the fetch-only lookup (derived 0, as on the main database) and passes with the fix; pnpm check and pnpm db:check pass. Measured on 57,000 listings, 75,000 snapshots and 167,500 fetches: a batch of 50 crawled listings 377 buffers instead of 362, a batch of 50 copied listings 554 buffers, about 4 ms.

The rerun on the main database: derived 120, withoutFetch 120, refused 0, unreadable 0; 523 photo addresses kept and 2 skipped (video thumbnails under /static/videos/, not photos). Model year, mileage, fuel, price and seller type were read on all 120. Values not read, all from the seller's condition scores: body_condition: رنگ‌شدگی در ۱ ناحیه (11); chassis_condition: تعیین‌نشده (9); engine_condition: تعیین‌نشده (7); body_condition: رنگ‌شدگی در ۳ ناحیه (2); body_condition: رنگ‌شدگی در ۲ ناحیه (1); chassis_condition: ضربه‌خورده (1); gearbox_condition: تعمیر شده (1). Rows not known: ارزیابی فروشنده: شاسی جلو (6); ارزیابی فروشنده: شاسی عقب (6); تخفیف بیمهٔ ثالث (6). The parser keeps them as unparsed until it learns them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A listing now says what its source structures, read by code from its latest snapshot, and its photos are kept as the source's own addresses (ADR-0025: the owner's decision of 2026-09-30, superseding ADR-0010). Four migrations add 21 attribute columns to listing the lock-safe way (bare, CHECKs NOT VALID, then validated; ADR-0014's price and model-year CHECKs word for word; mileage 0 to 9,999,999; the six comments now say listing), listing_photo (https only) and listing_unparsed_value. The Divar parser reads the title, brand_model, the car's rows and the seller's scores in Divar's own words; a value it cannot read is kept with its raw text and counted. The crawler derives in the transaction that stores a snapshot, through a savepoint, so a refused value never costs the snapshot; pnpm derive:listings re-derives every stored listing without a crawl, in batches of 50 taken with SKIP LOCKED and a one-at-a-time pass, so it neither reads stale pages nor deadlocks. Verified: pnpm check exit 0 (worker 81, web 183 with 6 new schema tests, locale 44); pnpm db:check exit 0 (migrations up, down, up; 42 worker integration tests, among them a real snapshot crawled through the stub, re-derivation, a parser change applied without a crawl, the stale read and the deadlock, each failing with the locking it replaced, a lock timeout and refusals); 15 parser tests on three redacted real posts and variants covering every CS-2 format; nothing unparsed over 4,720 real Divar car listings; plans on 50,000 listings. Reviews: task-reviewer (criteria verified, findings fixed) and database-reviewer (data loss and deadlock fixed, re-review ready). Owner answers of 2026-09-30 recorded: photos as Divar shows them, colour and city with CS-50, seller ratings and installment flag kept, CS-60 re-scoped to removal requests. Left: run the command on lane A's first live snapshots (note on CS-35); drop the reviewer's scratch database carshenas_cs34_review_check.
<!-- SECTION:FINAL_SUMMARY:END -->
