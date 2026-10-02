---
id: CS-85
title: Teach the Divar parser the condition wordings and rows real posts use
status: In Review
assignee: []
created_date: '2026-09-30 11:05'
updated_date: '2026-10-02 19:31'
labels:
  - backend
milestone: m-3
dependencies:
  - CS-34
references:
  - apps/worker/src/sources/divar/attributes.ts
  - docs/design/data-model.md
priority: high
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-34's parser took its condition vocabulary from Divar's own filter lists and from a survey of 4,720 listings whose seller condition scores were all of sound cars. Its first run over real posts, the 120 listings in the main database on 2026-09-30, read the model year, mileage, fuel, price and seller type of all of them, but kept 32 condition values unparsed in listing_unparsed_value (body_condition: رنگ‌شدگی در ۱ ناحیه: 11; chassis_condition: تعیین‌نشده: 9; engine_condition: تعیین‌نشده: 7; body_condition: رنگ‌شدگی در ۳ ناحیه: 2; body_condition: رنگ‌شدگی در ۲ ناحیه: 1; chassis_condition: ضربه‌خورده: 1; gearbox_condition: تعمیر شده: 1) and reported three rows it does not know (ارزیابی فروشنده: شاسی جلو: 6; ارزیابی فروشنده: شاسی عقب: 6; تخفیف بیمهٔ ثالث: 6). Until the parser reads them, those listings have no body, engine, gearbox or chassis condition, which comparables (CS-51) and the condition filters (CS-58) read. The raw texts are stored, so no new crawl is needed: pnpm derive:listings applies a parser change to every stored listing. The run is logged outside the repository, in ~/Dev/carshenas-lane-archive/2026-09-30/lane-e/cs34-measurements/derive-main-2.log.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each seller condition wording the parser left unread on 2026-09-30 («تعمیر شده», «تعیین‌نشده», «رنگ‌شدگی در ۱ ناحیه», «رنگ‌شدگی در ۲ ناحیه», «رنگ‌شدگی در ۳ ناحیه», «ضربه‌خورده») is read into its attribute or counted as a form meaning unknown, with the reading of each recorded in docs/design/data-model.md
- [x] #2 A wording that fits none of an attribute's values is given a new value by a migration or stays unparsed, as decided and recorded; it is never read as the nearest existing value
- [x] #3 The rows «ارزیابی فروشنده: شاسی جلو», «ارزیابی فروشنده: شاسی عقب», «تخفیف بیمهٔ ثالث» are read into attributes or listed as rows the parser leaves out on purpose, so the derive command no longer reports them as unknown
- [ ] #4 The parser's version is raised, and pnpm derive:listings on the main database reports none of these texts or rows, with its counts before and after recorded on the task
- [x] #5 Tests cover each new wording and row with fixtures made from real snapshots with personal data removed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Read the stored snapshots (every distinct score wording over all 6,169), decide each reading (data-model.md, Added by CS-85), migrate for the one new value, fix the parser, real redacted fixtures, derive and valuation before and after on the lane copy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Raised to High on 2026-10-02 (coordinator, from the CS-86 lane and its review): on the copy of main of that day 1,005 of 6,088 derived listings have no body condition because Divar writes «رنگ‌شدگی در N ناحیه» without the comma the parser expects (areas 1 to 3 were the only ones surveyed; the data also has 4 areas (46 listings) and 5 areas (8)), 359 have no chassis and 269 no engine condition («تعیین‌نشده»), 54 gearbox «تعمیر شده» and 26 «نیاز به تعمیر جزئی/اساسی». Valuation treats an unread body as intact, so a partly repainted car is valued as an intact one and rates too cheap; the 32-of-120 figures above are out of date. Pulled forward into the CS-58 to CS-72 run because it changes ratings across a sixth of the index.

Decisions (recorded in docs/design/data-model.md, Added by CS-85): (1) «رنگ‌شدگی در N ناحیه» (comma-less; 1 to 8 areas in the data) is partly_repainted for every N: the seller chose «رنگ‌شدگی», not «دوررنگ» or «تمام رنگ» (values of their own on Divar's list); no source gives the area count at which a car becomes one of those (research note row 4a), and fully_repainted would remove the listing from comparables and rating. The count stays in the snapshot. (2) «تعیین‌نشده» (engine 269, chassis 359) is stated unknown. (3) gearbox «تعمیر شده» (54) is a new value `repaired` (migrations allow_repaired_part_condition and validate_repaired_part_condition, Squawk wants validation apart); it is not needs_repair, replaced or sound. (4) «نیاز به تعمیر جزئی» (19) and «اساسی» (7) are needs_repair (same value, size of repair kept in snapshot). (5) Chassis rows «شاسی جلو»/«شاسی عقب» (385 snapshots) are read per side. (6) Whole-chassis «ضربه‌خورده» (94) and «رنگ‌شده» (2) stay UNPARSED: the word names no side and of the 385 per-side posts 299 have exactly one side damaged or repainted, so both-sides would be a guess; valuation reads these 96 as sound (CS-92). (7) «تخفیف بیمهٔ ثالث» (220 listings, no-claims years) is a known row left out on purpose. Parser version 3 to 4.
Before/after on the lane copy of main (23,752 listings, 6,088 derived, run 44 before, run 45 after, same day): derive: body_condition unread 1,005 to 0; front chassis null 835 to 492 (unknown 359+, bare 96); engine null 269 (all unknown, unchanged by design); gearbox null 722 to 642, 54 repaired; unread texts left: chassis ضربه‌خورده 94, رنگ‌شده 2, colour 4, mileage (CS-86); no unknown row reported. Valuation: comparables 4,307 to 4,049, valued 5,511 to 5,251, rated 4,000 to 3,744, «عالی» 440 to 304. Rated in both 3,740: 953 changed bucket (high to fair 210, fair to good 190, good to fair 146, overpriced to high 113, great to good 92, fair to high 90, good to great 63, high to overpriced 48, good to high 1); 260 rated became unrated (232 excluded_condition: a damaged chassis or a part needing repair, now read; 28 price_outlier: the fit moved), 4 unrated became rated. Median price gap to the fit of rated partly_repainted listings by area count: 1 area +1.0 % (350), 2 -1.4 % (246), 3 -4.5 % (116), 4 -1.2 % (30), 5+ about -8 % (9): one bucket averages them (CS-92). Fixtures: 8 real snapshots from 2026-10-02, redacted (token, photo paths, description, district); the first redaction missed UUID photo filenames, caught by the task-reviewer and redone. Review follow-ups: CS-92.

AC 1 and 4 are left unchecked on purpose: the whole-chassis wordings «ضربه‌خورده» (94) and «رنگ‌شده» (2) are neither read nor unknown (decision 6) and the derive report still lists them. Everything else in both criteria is met. Owner decision wanted: accept as is (CS-92 stores the fact) or read them as both sides.

Coordinator decision (2026-10-02): whole-chassis «ضربه‌خورده» (94) and «رنگ‌شده» (2) are read as both sides (damaged or repainted), a conservative superset: valuation excludes any damaged side and the chassis-intact filter needs both sides intact; no consumer uses the side; CS-92 stores the unsided fact and the reading can then be narrowed. «تعیین‌نشده» stays unknown. Parser version 5. Lane copy: derive 6,088, chassis read 5,649, unknown 439, unparsed 0, 96 unparsed rows gone; valuation run 45 to 46: comparables 4,049 to 3,987, valued 5,251 to 5,190 (61 more excluded_condition), rated 3,744 to 3,686, great 304 to 292. Expected on main after merge, restart, derive and valuation run: the same, if main index equals the copy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Divar parser (version 4) reads the condition wordings real posts use: «رنگ‌شدگی در N ناحیه» as partly_repainted for every N, «تعیین‌نشده» as unknown, gearbox «تعمیر شده» as a new value repaired (migration), «نیاز به تعمیر جزئی/اساسی» as needs_repair, the per-side chassis rows «شاسی جلو/عقب», and leaves «تخفیف بیمهٔ ثالث» out on purpose. Whole-chassis «ضربه‌خورده» (94) and «رنگ‌شده» (2) stay unparsed (no side named; CS-92). Lane copy: body unread 1,005 to 0; rated 4,000 to 3,744, «عالی» 440 to 304, 953 of 3,740 ratings changed bucket. Eight redacted real fixtures, 5 new tests, db:check green, worker 117 and search 37 tests green; the two web PGlite suites time out only inside the parallel pnpm check and pass alone (115 tests). After merge in main: pnpm db:migrate, restart the worker, pnpm derive:listings, pnpm valuation:run.
<!-- SECTION:FINAL_SUMMARY:END -->
