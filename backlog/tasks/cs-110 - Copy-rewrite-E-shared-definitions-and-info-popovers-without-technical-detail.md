---
id: CS-110
title: 'Copy rewrite E: shared definitions and info popovers without technical detail'
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 10:25'
labels:
  - frontend
  - docs
dependencies:
  - CS-104
  - CS-105
priority: high
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: there is too much technical information in the copy. Area E covers the shared texts in packages and libs that feed many screens: the filter and catalogue definitions in @carshenas/search (labels, descriptions, rule texts, option names, explanation text for info controls), the info popover content builders (mileage reading, deal rating bands, market value, valuation segments, crawl rules), notification kind settings, and the locale-derived phrases. An info control should answer one question in one or two plain sentences, with numbers only when they help a buyer decide, never thresholds of the model, error margins, version names or internal vocabulary. Keep ids, keys and stored forms unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every string in the area’s files is reviewed against the product voice guide (CS-104) and either rewritten or kept with a recorded reason; a before and after table with the counts (reviewed, changed, kept) is written to docs/evidence/copy/ for the area
- [x] #2 No technical or internal detail is left in buyer-facing text (thresholds of the model, parser or version names, internal ids, English technical terms, how the data is stored); where a rule has to be explained, its info control says it in one or two plain sentences, and the rest is removed
- [x] #3 No repetition: the same fact is not said twice on one screen (title, lead, hint, button and notice are audited together), and one idea uses one word everywhere (the glossary); no filler, no marketing adjectives, no exclamation marks, no sentence that is not native Farsi
- [ ] #4 The copy lint (CS-105) passes with no new allowlist entry, a pass of the copy-reviewer agent leaves no blocking finding, and screenshots of the changed screens at 412 and 1440 are looked at and described
- [ ] #5 Tests that match text use the central copy constants or are updated without weakening an assertion; pnpm check and the affected Playwright specs pass on phone and desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the guide, the copy-fa skill, the rule, the glossary and the plan's area E; take `pnpm copy:inventory --strings E` as the worklist (287 strings, 14 files) and render every definition text (filters, catalogues, sorts, origins, mileage) to JSON before the first edit, so the evidence shows real numbers.
2. For each definition write the one question its info control answers and answer it in one or two plain sentences: drop thresholds, windows, methods and internal words; keep the figure a buyer can check, computed from the definition's own constant. Names (labels, titles, options, chips within budget) are kept unless the lint or the guide says otherwise.
3. Apply the edits through a script that keeps the half-spaces exact (a marker for U+200C, checked by the lint and by a reveal script), file by file: filters, specs, catalogues, sorts, explain, mileage-reading, then the web files (model-info, mileage-info, info-content).
4. Update the tests that matched the old text by switching them to the definitions' constants or the new wording, never weaker; add tests for the new contract (no headings, no model threshold in a popover).
5. Verify cheaply: copy lint with warnings on the 14 files, the unit tests of packages/search (src), the web unit tests that touch these modules, prettier, tsc for packages/search and apps/web once. No Playwright, no build, no dev server (owner, 2026-10-04).
6. Write docs/evidence/copy/area-e.md (counts, every change old to new with why, kept with reason, tests, follow-ups) and update spec S02; finalize the task at In Review; commit; merge main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (made by me, the owner is away):
- Popover pattern from the guide: title = the control's name, no headings, plain sentences, a number only when a buyer can check it. The headings «معیار دقیق / شرط‌ها / گزینه‌ها / ترتیب نمایش / از بهترین به بدترین» lived in SEARCH_COPY.info (area B's file) and were passed by info-content.ts and model-info.ts (area E's builders): I removed the use, so the keys are dead for B to delete. Section ids, rows and exports are unchanged.
- Catalogue and limit popovers stay lists: info-content.test.ts, explain.test.ts and spec S02 pin one line per condition and per value. The lines are short now (109 words for the largest catalogue, from 158) but the guide's one or two sentences is not reached there; recorded in the evidence as the owner's decision.
- The market's norm (20 000 km a year), the half-year edge, the model's thresholds (15 % band, 40 000 km a year), the share of prices a range keeps and the points of a trend are no longer quoted: guide section 5 and the owner's feedback. The numbers a buyer can use stay, computed from the same constants as the SQL: the rating bands, 12 000 km a year, 15 popular models, the budget, the ages and months.
- Names are kept (filter labels, option names, catalogue titles, sort labels): ids, URLs, search files, e2e and the buyer's own words depend on them. Exceptions with a reason: the lint's label budget (no-ride-hailing filter, the body-condition chips, half-spaces in «خط‌وخش»), the ezafe of «منطقه‌ی آزاد» (guide appendix A.9), and the catalogue «دنده‌اتوماتیک» became «گیربکس اتوماتیک» (the glossary word; the joined spelling is not Farsi).
- One verb for a listing a filter leaves out («نشان داده نمی‌شوند»), «به گفته‌ی …» for a seller's claim, «چیزی نیامده است» for not stated.
- The origin filter's description is built from the three origin definitions in specs.ts (written once); the sort sentence both price orders share is a constant (the lint refuses a repeated sentence); the great-deals catalogue quotes the rating's band from DEAL_GAP_PCT.
- definitions.test.ts now allows the right-to-left mark only before «٪» (formatPercent writes it); a stray mark is still refused.
- Not touched, by the plan: packages/notifications/src/kinds.ts (area C), gauge-view.ts (B), search-copy.ts (B). Their follow-ups are in the evidence file under «For other areas».
Verification (2026-10-04, machine loaded, targeted only): copy lint on the 14 files 0 violations and 0 warnings (was 10 and 39); whole repository nothing new or worse; packages/search unit tests 132 of 132; apps/web unit tests that touch these modules 72 of 72; tsc clean for packages/search and apps/web; prettier clean. Not run, by the rule of 2026-10-04: Playwright (four specs edited as code), pnpm check, builds, screenshots, the copy-reviewer pass (no sub-agent from a lane). The lint baseline file was not changed (the coordinator regenerates it).
Evidence: docs/evidence/copy/area-e.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the shared definitions and info popovers of area E to the voice guide without touching an id, key, URL parameter, stored form or option value. Of 287 strings, 85 were changed, 17 removed (the model page's threshold rows and a few units), 1 added (one shared sentence) and 185 kept with a recorded reason; the copy lint in the 14 files went from 10 violations and 39 warnings to 0 and 0. Popovers lost their headings, the market norm, the model's thresholds and the method's windows; they keep the figure a buyer can check, computed from the SQL's own constants (12 000 km a year, the rating bands, 15 popular models, the budget). The owner's example reads «حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو.» alone. Verified with the copy lint (0 and 0, nothing new in the whole repository), packages/search unit tests (132 of 132), the web unit tests that touch these modules (72 of 72), tsc for both packages and prettier. The before and after table, the kept reasons, the tests changed and the follow-ups for areas A, B and C are in docs/evidence/copy/area-e.md. Not done, by the 2026-10-04 rule: Playwright (four specs were edited as code), pnpm check, screenshots at 412 and 1440 and the copy-reviewer pass, so criteria 4 and 5 stay unchecked; catalogue and limit popovers are still lists (a spec and test decision for the owner).
<!-- SECTION:FINAL_SUMMARY:END -->
