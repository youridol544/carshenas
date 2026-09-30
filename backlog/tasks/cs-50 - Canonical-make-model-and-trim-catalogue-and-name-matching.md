---
id: CS-50
title: 'Canonical make, model and trim catalogue and name matching'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 11:51'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-28: the catalogue is seeded from Divar's make and model filters (the divar.ir/s/tehran/car/<make>/<model> pages) and Bama's lists, so the superadmin picks tracked models from it (CS-53) instead of typing names. Criterion 1 was reworded from "covers the models crawled in m-2" and is now listed last. It depends on the parser (CS-34), not on the LLM extraction.

2026-09-28, from the field survey: khodrobin resolved only 56 % of its unique listings to a spec (8,837 of 15,763, from 33,770 captures). Report the matched share per tracked model, and aim well above that on tracked models, where unmatched listings are the explicit state of criterion 1.

Renumbered on 2026-09-29: this task was CS-10 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-10; the archived CS-10 points here.

From CS-34 (owner, 2026-09-30): the listing's colour, city and district are this task's, with its code tables and geography. Divar writes 38 colours in its own filter list (plus «سایر» in posts), each post's «رنگ» row holds one, and seo.web_info holds the city and district; the parser (apps/worker/src/sources/divar/attributes.ts) already knows the colour row and leaves it. Add the columns with the tables, extend the parser, bump its version and run pnpm derive:listings to fill them from the stored snapshots. The listing's source_model_key (Divar's brand_model) is what the catalogue matches.

Owner, 2026-09-30: CS-48 and CS-49 are postponed to get the product ready for the demo video sooner; CS-50 no longer depends on CS-48, and criterion 2 measures the matched share on the live index instead of accuracy on CS-48's set.
<!-- SECTION:NOTES:END -->
