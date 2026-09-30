---
id: CS-50
title: 'Canonical make, model and trim catalogue and name matching'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 13:20'
labels:
  - ai
  - backend
milestone: m-3
dependencies:
  - CS-34
references:
  - docs/product/glossary.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The same car is written «۲۰۶ تیپ ۲», «206 T2» and «پژو ۲۰۶ تیپ دو». Comparables, duplicate detection and model pages all need one canonical trim, which is Torob's own 'same product under different names' problem.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every extracted listing maps to a canonical trim or to an explicit 'unmatched' state that is reported, never guessed
- [ ] #2 The matched share is measured on the live index per tracked model and reported (accuracy on a labelled set waits for CS-48, postponed by the owner on 2026-09-30)
- [ ] #3 A catalogue of makes, models and trims, seeded from the sources' own make and model lists, covers every tracked model, with aliases in Persian, in Latin letters and with spelled-out numbers
- [ ] #4 Each model, or trim where it differs, carries a body type from one fixed list (hatchback, sedan, crossover, SUV, pickup, van and the others the market needs), so body type can be a filter and a catalogue (CS-58)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner decisions, 2026-09-30 (asked with recommendations, all recommended options chosen): a listing's match is one explicit state, trim, model (trim unknown) or unmatched, never guessed; every model with Tehran listings gets a curated body type (a trim where it differs), models without listings stay unclassified and are reported; makes and tracked models get curated Persian, Latin and spelled-out aliases, other models and trims take their Persian name from Divar's own 'brand and model' row, marked suggested.
1. Schema (layer 4 of data-model.md, lean): body_type and colour code tables; make, model, trim with name_fa, name_en and a normalised name; catalogue_source_key (a source's own model key to its make, model or trim); catalogue_alias (curated or suggested, per target, normalised); city with Divar's slug; listing columns make_id, model_id, trim_id, catalogue_match (trim, model, unmatched), colour, city_id, district; grants; tests.
2. Catalogue data: a committed data file seeded from Divar's own brand and model keys (the CS-33 measurement's 64 makes and 807 models) plus the trim keys seen in posts, with curated body types for every model with listings, curated names for makes and tracked models, Divar's 38 colours.
3. pnpm catalogue:sync: upserts the data file, learns trims from listing keys under known models and suggested Persian names from posts' brand-and-model rows; idempotent.
4. Matching: a worker job every 10 minutes (and part of catalogue:sync) sets each listing's make, model, trim and state from its source_model_key; a key the catalogue does not know stays unmatched and is reported.
5. Parser: colour, city and district from the post (seo.web_info), parser version bumped; pnpm derive:listings refills stored listings.
6. Report: a view of the matched share per source and tracked model; runbook; measured on the main database's live index.
7. Tests, EXPLAIN on the matching update, database-reviewer, task-reviewer, In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: the catalogue is seeded from Divar's make and model filters (the divar.ir/s/tehran/car/<make>/<model> pages) and Bama's lists, so the superadmin picks tracked models from it (CS-53) instead of typing names. Criterion 1 was reworded from "covers the models crawled in m-2" and is now listed last. It depends on the parser (CS-34), not on the LLM extraction.

2026-09-28, from the field survey: khodrobin resolved only 56 % of its unique listings to a spec (8,837 of 15,763, from 33,770 captures). Report the matched share per tracked model, and aim well above that on tracked models, where unmatched listings are the explicit state of criterion 1.

Renumbered on 2026-09-29: this task was CS-10 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-10; the archived CS-10 points here.

From CS-34 (owner, 2026-09-30): the listing's colour, city and district are this task's, with its code tables and geography. Divar writes 38 colours in its own filter list (plus «سایر» in posts), each post's «رنگ» row holds one, and seo.web_info holds the city and district; the parser (apps/worker/src/sources/divar/attributes.ts) already knows the colour row and leaves it. Add the columns with the tables, extend the parser, bump its version and run pnpm derive:listings to fill them from the stored snapshots. The listing's source_model_key (Divar's brand_model) is what the catalogue matches.

Owner, 2026-09-30: CS-48 and CS-49 are postponed to get the product ready for the demo video sooner; CS-50 no longer depends on CS-48, and criterion 2 measures the matched share on the live index instead of accuracy on CS-48's set.

Slice 1 (schema): migrations 20260930115630..115633: fa_normalize(); body_type and colour code tables; make, model, trim; catalogue_source_key (a source's own key to exactly one level, composite keys to parents); catalogue_alias (one target, generated alias_norm, curated/suggested/rejected, unique per spelling and source); city; listing make_id, model_id, trim_id, catalogue_match (trim, model, unmatched; consistent by CHECK and composite keys), colour, city_id, district_fa, added NOT VALID and validated. Grants: web reads, worker reads and writes the catalogue. A first fa_normalize shifted every digit by one (tatweel in the middle of translate's list); fixed and tested. Schema tests 92 pass; pnpm check passes.

2026-09-30, slices 2 to 5: the catalogue is curated in apps/worker/src/catalogue/ (codes.ts: 10 body types and 40 colours, lentil «عدسی» added after a real post used it; divar-catalogue.ts: 161 makes and 807 models, checked equal to the CS-33 list, with a body type for every model that had listings and none for the rest; 43 doubtful ones listed in CURATION_DOUBTS for the owner; Peugeot's SD trims are sedans). catalogue.refresh runs every ten minutes and pnpm catalogue:sync runs it now: upserts, learns trims and models from listing keys, names them in Persian from the posts' «برند و مدل» row (suggested aliases), matches every listing. Parser version 2 reads colour, city and district; a colour it does not know is kept as an unparsed value (migrations 20260930121256 and 20260930121257). First live run: 60 trims learned and named; 1,235 Divar listings all matched (420 to a trim, 815 to the model only: sweep rows name no trim), 0 unmatched; 417 of 417 derived listings have colour, city and district. The matching comparison measured 2.7 ms over 1,241 listings (two sequential scans and a hash join, fine for the bounded index). For CS-60: purging a source must also delete its catalogue_source_key rows and the aliases it suggested (the test cleanup now does).

2026-09-30, after review. Task review: the Corolla Cross, which Divar files as trims of the Corolla, is now a crossover (TRIM_BODY_TYPES); tracked models take their Persian name from tracked-models.ts; catalogue:sync lists the models with listings that have no body type (0 today). Database review: a make, model or trim is found by its source key and never by its slug, which is given once when the row is made; every catalogue write runs in one transaction under an advisory lock (the job and the command cannot race, and a crash leaves no model without its key); matchListings locks in id order with SKIP LOCKED, so it never deadlocks with a sweep; the naming query reads only unnamed keys' posts (216 buffers instead of 14,985); curated rows are upserted once per worker process; cities and aliases are looked up before insert (no identity values spent); the worker's UPDATE on catalogue_alias and city is revoked (migration 20260930131144). Live evidence after pnpm derive:listings (730 derived, colour read 730 of 730, 0 refused) and pnpm catalogue:sync: 6,390 Divar listings, 730 matched to a trim, 5,660 to the model only, 0 unmatched; 100 % matched for each tracked model, trim share 5 to 42 % where sweep rows dominate and 100 % for Pride 131, Quick manual, Samand LX and Toyota Corolla. Follow-ups: the owner reviews CURATION_DOUBTS (43 models); a sweep that changes a listing's key leaves its match up to 10 minutes old; aliases are for search (CS-62) and later sources (CS-54), since Divar is matched by its own key; CS-60's purge must delete a source's catalogue_source_key rows and suggested aliases.
<!-- SECTION:NOTES:END -->
