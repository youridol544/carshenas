---
id: CS-34
title: >-
  Parse the sources' structured fields into listing attributes by code, without
  a model
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:11'
updated_date: '2026-09-30 08:40'
labels:
  - backend
milestone: m-3
dependencies:
  - CS-33
references:
  - docs/decisions/0025-show-listing-photos-from-the-sources-addresses.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Much of a listing arrives structured. Divar's listing detail carries the make and model with its trim, the model year in both calendars, mileage, colour, gearbox, fuel, months of third-party insurance left, the seller's own condition scores and the price row, and its list rows carry mileage and price (`docs/research/2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md`). Torob's job record asks for someone who knows when to use AI and when another method serves better: these fields are parsed by code, exactly and at no cost per listing, and the model (CS-52) reads only the free text. The parsing rules for prices and model years were settled in CS-2 (ADR-0014) and are recorded in the notes of CS-33 and CS-52. Split from CS-52 on 2026-09-28.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The listing's attribute columns exist with the constraints ADR-0014 and `docs/design/data-model.md` (layer 3) specify, added the way the data-model rules require for a table that has rows
- [ ] #2 Divar's structured fields are parsed into those columns by code only, covering every format CS-2 recorded: a leading U+200F, ASCII and Arabic separators, three digit scripts, placeholder prices, and model years in one or both calendars
- [ ] #3 A value the parser cannot read is kept as unparsed with its raw text and counted, never guessed
- [ ] #4 One command re-derives the attributes of every stored snapshot, so a parser change never needs a new crawl
- [ ] #5 Tests run the parser on fixtures made from real snapshots with personal data removed
- [ ] #6 The comments the database stores on `listing` (the table, `source_listing_key`, `url`, `listed_at`, `delisted_at` and `last_seen_at`) say listing, never ad: this task's migration restates them, because an applied migration is never edited
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:NOTES:END -->
