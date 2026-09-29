---
id: CS-34
title: >-
  Parse the sources' structured fields into listing attributes by code, without
  a model
status: To Do
assignee: []
created_date: '2026-09-28 22:11'
labels:
  - backend
milestone: m-3
dependencies:
  - CS-33
references:
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28, from the field survey (other entrants' documented traps; turn each into a test):
- Divar writes 1,000,000 km to mean an unknown mileage.
- Divar's schema.org prices are in rials, and Bama labels its prices IRR while publishing tomans (CS-2 found the same on Divar's detail page); read the displayed string only.
- Jalali and Gregorian years mix within one feed.
- About 11.5 % of listings are «توافقی».
- Down payments are posted as full prices.

The migration that adds the attribute columns also restates the six stored comments on `listing` that still say "ad" (written by `20260927060003_create_listings.sql`). `pnpm db:migrate` then regenerates `db/schema.sql` and `db-types.ts`.
<!-- SECTION:NOTES:END -->
