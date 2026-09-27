---
id: CS-2
title: 'Decide money, currency and calendar handling'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 13:10'
labels:
  - i18n
  - backend
  - frontend
milestone: m-1
dependencies: []
references:
  - docs/decisions/0014-money-in-toman-and-jalali-in-the-interface.md
  - docs/research/2026-09-27-money-and-jalali-calendar.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Car prices run to billions of toman and move weekly, and model years appear in two calendars (۱۴۰۰ and 2021). Rial versus Toman, integer storage, readable large amounts and Jalali dates touch every listing, valuation and chart, and are expensive to change later.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An ADR records the storage unit (Rial or Toman), the integer type and its safe range for the largest plausible car price, and the display rules
- [x] #2 The ADR states how large amounts are shown (for example «۱٫۲ میلیارد تومان») and when full digits are shown instead
- [x] #3 The ADR records Jalali display with ISO/UTC storage and how model years are stored in both calendars
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research note docs/research/2026-09-27-money-and-jalali-calendar.md with a reproducible lab. Jalali: seven libraries, Intl and native Temporal, in both directions, against the Calendar Center's published leap list (1206-1498 SH) and its true-noon rule after it, on Node 22 and 26, plus Chromium day by day. Also Intl output for amounts and dates in Node and Chromium, PostgreSQL time-zone data and aggregate types, and sourced evidence on how Divar and other car sites show prices, the rial redenomination law, and the largest plausible car price.
2. ADR-0014: toman as bigint with a per-column range CHECK (low 1, 0 or -999,999,999,999,999; high 999,999,999,999,999); exact arithmetic rules; display rules (every price and value in full digits, words only inside sentences and on scales); Jalali display through Intl with ISO/UTC storage; @internationalized/date for arithmetic and inputs; model years in both calendars with one conversion rule and a complete CHECK; booking slots as wall-clock times; holidays as data.
3. Enforce the money rule in schema-catalog.test.ts, with planted violations and mutations that prove each clause.
4. Update the documents that deferred to CS-2: data-model.md, glossary, AGENTS.md conventions, the database skill, the persian-type-formatting reference, the server-actions-data rule, vision.md.
5. Hand the decisions to the tasks that implement them (CS-3, CS-6, CS-8, CS-12) as notes.
6. Verify with pnpm check and the lab runs, ask task-reviewer and database-reviewer, fix their findings, then finalize at In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): whatever unit is chosen, money is a bigint column with the unit in its name and a range CHECK (ADR-0013 point 6). The lab model stores model years in both calendars with a CHECK that they agree (AD minus SH is 621 or 622) and records which calendar the ad used; the DDL is in docs/research/2026-09-27-database-research/lab/.

Owner direction (2026-09-27): store toman; make big numbers fit the database decisions; show amounts the way Divar users expect; pick a production-grade Jalali calendar (package or API), offloaded, valid enough for future visit-slot booking; decide without asking.

Calendar lab (final): against the Calendar Center's published leap list (1206-1498, CC0 copy in the lab) and its true-noon rule at 52.5 E after it, jalaali-js, @internationalized/date, date-fns-jalali, Intl (ICU 76.1 on Node 22, ICU 78.3 on Node 26), temporal-polyfill, @js-temporal/polyfill and native Temporal (Node 26) match every Nowruz and all 108,111 days from 1206 to 1501, and agree up to 2124-03-19. dayjs+jalaliday 3.1.1 converts Jalali to Gregorian correctly but Gregorian to Jalali wrongly on 4,320 days (every 1 Jan-29 Feb of a Gregorian leap year a day ahead). The first split is 2124-03-20: the 33-year rule and jalaali-js make 1502 leap, while ICU 77+ and Temporal make 1503 leap. Chromium 153 matches Node on all 108,111 days.

Price display: Divar, Bama, Sheypoor and Hamrah Mechanic print prices in full digits, Hamrah Mechanic's estimate and range included. Words appear in news and prose. Separators vary: Divar uses the ASCII comma, Torob U+066B, the standard U+066C.

Money check: schema-catalog.test.ts flags a column whose name holds a currency word, or a numeric or float column naming a price, amount, cost, fee or value, unless it ends in _toman, is bigint, and has a single-column CHECK named <table>_<column>_range, written BETWEEN 1|0|-999999999999999 AND 999999999999999. Seventeen planted columns cover it: thirteen broken, each reported for the clause it was planted for (asking_price and fee_amount break three clauses and report the first), and four valid controls. Nine mutations, one per clause, each fail the planted test; the second review ran fifteen and all failed for the intended reason. (Commit 7db2fb6's message says eighteen; seventeen is right.)

PGlite (PostgreSQL 18.3): adding a column of a constrained domain rewrote the table (file node 16388 to 16397). A nullable bigint column with a CHECK did not, so amounts use per-column CHECKs. The database review measured that an inline CHECK still scans under ACCESS EXCLUSIVE (202 ms per million rows), so tables with rows get NOT VALID then VALIDATE.

Review fixes: the full model-year CHECK and the price-type/amount CHECK were tested on 13 rows each, all correct, and written into data-model.md layer 3. Placeholders carry no amount; installments carry down_payment_toman. Booking slots are a Tehran date plus time. Aggregates use round(...)::bigint, and sums of many amounts stay numeric. Overclaims were corrected (Chromium is now checked day by day; only ICU 76.1 and 78.3 were measured).

Incident: one research subagent's request to crates.io carried the owner's email in its User-Agent header (reported by the agent). Nothing else was sent.

Second reviews (2026-09-27): the task-reviewer verified criteria #1-#3 and the Definition of Done. It asked for wording fixes (integer columns with no currency word are not seen; native Temporal only on Node 26; the planted counts), all applied. The database-reviewer verified every first-round fix on a 300,000-row listing and found a gap: an event had to be a change, but no constraint enforced it once placeholders carry no amount. Fixed with previous_price_type, previous_price_toman and last_asking_price_toman, plus a row-wise IS DISTINCT FROM CHECK, tested on 8 steps. A drop compares with the last asking price.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decided money and calendar handling in ADR-0014 (proposed: the owner chose the toman and delegated the rest on 2026-09-27).

Amounts are whole tomans in bigint _toman columns. Each has a CHECK <table>_<column>_range written BETWEEN 1, 0 or -999999999999999 AND 999999999999999. That bound is 2,500 times the 400-billion ad and nine times below 2^53-1, so parseInt8 never throws on money. A new schema-catalog check enforces it on every migration. Placeholders carry no amount and installments carry down_payment_toman.

Display: every price and value is shown in full digits, as Divar, Bama, Sheypoor and Hamrah Mechanic print them, with estimates rounded to three significant digits. Mixed words appear only inside sentences; compact forms only on axes, chips and gauge edges.

Dates are UTC instants and become Jalali only on screen: Intl in Asia/Tehran for display, @internationalized/date for arithmetic and inputs. Model years are stored as the ad wrote them; model_year_sh is always set (AD minus 621 for a Gregorian-only ad) under a complete CHECK. Visit slots will be stored as a Tehran date and time, and holidays as a curated yearly import.

Verified with:
- the research note's lab: every implementation except jalaliday matches the Calendar Center's published leap list on all 108,111 days from 1206 to 1501 on Node 22 and 26, and Chromium 153 matches Node on every day;
- nine mutations, each of which fails the planted catalog test;
- the model-year, price-type and price-event constraints tested in PGlite;
- pnpm check (39 tests) and pnpm db:check (9 integration tests);
- task-reviewer and database-reviewer passes, with every finding fixed.
<!-- SECTION:FINAL_SUMMARY:END -->
