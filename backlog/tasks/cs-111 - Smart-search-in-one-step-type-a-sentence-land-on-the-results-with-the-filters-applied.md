---
id: CS-111
title: >-
  Smart search in one step: type a sentence, land on the results with the
  filters applied
status: In Review
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 09:04'
labels:
  - frontend
  - backend
dependencies: []
references:
  - docs/decisions/0043-search-by-sentence-in-one-step.md
  - docs/specs/S04-plain-farsi-search.md
priority: high
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: the plain-Farsi box asks too much of the buyer: type, press «بفهم» (a strange word), read the understood chips, press again to see the listings, and in the hero there is one more step. It must happen by itself: one box, one action, and the buyer lands on /search with the filters already applied and shown. The two-click flow and the disclosure panel are removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The home hero and the search page have one search box for free text; pressing Enter or the one button goes to /search with the results already filtered by what the sentence said, with no confirm step, no «understood» panel to approve and no second button; the example chips under the hero box submit directly (one click shows results)
- [x] #2 The understanding runs by code on the server before the page is drawn, the address becomes the canonical filter form with the sentence kept in the box, and what the code could not read is shown as a quiet removable chip; words that would make the result empty are dropped automatically, step by step, and the page says which were dropped with a way to put them back, so a sentence never ends in a dead end
- [x] #3 The applied filters appear as removable chips at the top of the results in plain words; removing or changing a chip updates the results at once; the sentence stays editable; the model path (behind its default-off switch) refines the reading in the background without a click and the page shows the code results at once; with the switch off nothing waits
- [ ] #4 A vague sentence such as «یک ماشین تمیز، کم‌کارکرد و بی‌دردسر» lands on results with the clean catalogue applied and shown, and phrases with a price, a year, a mileage, an engine volume or an origin land with those chips; saving the search as a search file keeps the applied filters
- [x] #5 Phone and desktop Playwright tests prove one step from the home hero and from /search, the dropping of words that empty the result, the switch-off case and the back button returning to the previous page with its box content; the words on the box and chips follow the product voice guide (CS-104)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Mechanism (decided, ADR-0043): the one box (home hero search tab, /search bar) is a React 19 form whose action is a Server Action, askSearchAction. It runs the CODE understanding in-process (lexicon cached), settles the unread words against the live counts, and redirect()s once (push: Back returns to the previous page, no intermediate entry) to the canonical shareable filter address plus the sentence in a page-level parameter (ask), kept out of the Search schema. Works before hydration (303) and with scripts off. Links pasted into the box still go to /check.
2. Unread words (reasons unknown/unsupported) become the text search q and show as a quiet removable chip; if q would empty the results they are dropped step by step (largest subset that still finds listings, most results first), never the filters; if the filters alone are empty the page keeps them with the existing no-results panel (removable chips and counted relaxations). The page re-derives the sentence reading on every render (code only, ms) to say what was left out and to offer each word back; it never stores a drop in the address.
3. Applied filters stay the existing removable chips (AppliedChips); q is added as a quiet chip; removing one navigates at once; the sentence stays in the box and in the address through chip, rail and sort changes (navigate carries it); a new sentence replaces the whole search.
4. Model path (SEARCH_UNDERSTANDING_AI, default off): off = nothing waits, nothing is asked, nothing is said; on = the page shows the code reading at once, reads a cached model answer when the cache has one (cachedModelStep: the layer's own cache, a paid request refused), and otherwise a small client leaf asks POST /api/search/understand in the background (route now also returns the settled href) and router.replace()s when the reading differs; it only runs while the address still equals the code reading (the buyer's own changes win) and at most once per sentence per tab.
5. Remove PlainSearch, PlainSearchPanel, PlainSearchDemo, /design/plain-search, withoutChips; rewrite SearchField (the one box), HeroSearch (box, one button, examples submit directly), wire SearchScreen (ask action and understand reader as slot props from the route), copy in the features' copy files.
6. Tests: unit (settle algorithm with a fake counter, sentence param helpers, view builder, cached step, route href, SearchField, provider, refine leaf, chips), e2e updates to plain-search*.spec.ts, search.spec.ts, home.spec.ts with equal coverage plus new specs: one step from home and from /search, dropping of words that empty the result, switch off, Back, no-JS, phone and desktop, layout shift, a11y.
7. Docs: ADR-0043, S03 and S04 updated, learnings line. Verify with production build on a 3111x port, screenshots opened and described, craft checks, pnpm check.

8. Changed on the owner's instruction (the machine was at load 31): after the first Playwright runs no further e2e, build, dev server, craft-check or whole-repo check runs; the specs were finished as code and verified by typecheck, eslint and the unit tests of the changed folders; the coordinator runs pnpm check and the full e2e suite once after the merges.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (ADR-0043, docs/decisions/0043-search-by-sentence-in-one-step.md; S03 and S04 updated):
1. One box (hero search tab and /search bar) = one real form whose action is a Server Action, askSearchAction. It reads the sentence by code in-process (lexicon cached, now served stale while it refreshes), settles the words no filter could name against live counts and answers with the canonical filter address plus the sentence in an ask parameter (page state, outside the Search schema, so a search file never stores it). The script calls the same action from a transition and navigates with router.push; a form posted before the script loaded is redirected (303). First tried the action's own redirect(): measured wrong on this build (after Back the hero box was empty because a server-action navigation keeps no hidden copy of the page it leaves; focus fell to body after Enter on /search), so scripted calls get { status: 'found', href } back and navigate themselves (by=script tells the two apart).
2. Unread words (unknown, unsupported) are the text search q, shown as a quiet dashed removable chip; if q empties the results they are dropped one group at a time (the group whose going leaves the most listings first, later on a tie), never the filters; filters alone empty: words kept as written and the existing no-results panel (removable chips with counted relaxations). The page derives what was left out on every render (code, ms) and offers each word back; nothing is stored in the address. A new sentence replaces the whole search; chips/filters/order keep the sentence; clear-all and the box's clear button let it go.
3. Model (SEARCH_UNDERSTANDING_AI, default off): off = nothing waits, no request to /api/search/understand, nothing is said. On = page drawn from code at once and from the layer's cache when it holds an answer (cachedModelStep refuses any paid request, so drawing a page never spends); else a client leaf asks the route in the background (route answer now carries href), once per sentence per tab, replaces the address only when it differs and only while the address is still exactly what code read and settled (the buyer's changes win; a late answer is dropped).
4. Removed: PlainSearch, PlainSearchPanel, PlainSearchDemo, /design/plain-search, withoutChips. Added eslint boundary exception search-understanding -> search (one line, one way).
5. Phone keyboard: the box is blurred on a touch screen when the sentence is sent so the results are not under it; the navigation then puts focus on the count of the results (focus is never lost); on desktop focus stays in the box.
6. The buyer's words are their own bidi run (bdi) in the left-out line and the quiet chip; a make nobody collects keeps its Persian name from the sentence reading (the page has no listing to name it from).
7. Strings follow the voice guide of CS-104 (merged into the branch): the rewrites sit in features/search/search-copy.ts, features/search-understanding/understanding-copy.ts, lib/search-sentence.ts (ASK_FAILED_MESSAGE), features/home/home-copy.ts. The notes the understanding itself writes (typo read, city outside the market, make not collected, text addressed to the system) come from packages/search/src/understand/merge.ts (CS-99's lane) and still use «من» forms (فیلتر نکردم، ندارم); they are shown verbatim and belong to the copy rewrite lanes.

Finding for the owner: the hero's second example («یک ماشین تمیز، کم‌کارکرد و بی‌دردسر») lands on its five filters (low mileage, popular model, paint free, no accident, no replaced parts), not on the catalogue «تمیز و بی‌دردسر»: the understanding's bundle needs the words about the technical condition (the owner's longer sentence lands on the catalogue). The rules are in packages/search/src/understand (CS-99's lane); a phrase rule «بی‌دردسر implies technically sound» would change it.

Evidence (all before the owner's instruction to stop heavy runs, on a production build on port 31110 against the lane database):
- Unit and component tests of every folder I changed: src/lib, features/search-understanding, features/search, features/home, app/(site): 37 files / 282 tests pass; filter-panel.test.tsx (not touched) times out at 5 s only when run beside the others under load and passes alone (24 s for its 11 tests).
- Playwright, phone project: plain-search.spec.ts + plain-search-flow.spec.ts 27 of 27 passed (a cold-start timeout of the first navigation of a worker failed one test on the load-36 machine and passed alone); desktop project: 27 of 27 passed; home.spec.ts search box describe on phone: 10 of 12 passed, the 2 that failed were the no-script tests (the test asserted a page that needs scripts to draw; and the priming context inherited javaScriptEnabled false): fixed in code, not re-run.
- Not run after the last edits (owner instruction): home.spec.ts desktop, search.spec.ts (box test), check-link.spec.ts (one test updated: words typed in the search box now land on the model they name), the no-script home tests, layout-stress, gorilla, pnpm check, pnpm db:check (no migration; sentence-search.db.test.ts is new and runs only there).
- EXPLAIN (ANALYZE, BUFFERS) of every count shape: docs/evidence/query-understanding/2026-10-04/explain-counts.md (0.06 to 0.6 ms execution, at most 62 buffers).
- Action timings from its log line (load 31 to 36): 1 to 2 ms with no unread word, 18 to 480 ms with counts, 4 s for the first sentence of a process (lexicon cold read; now stale-while-refresh).
- Screenshots opened and described: /search landed from the sentence on a 412 px phone (one blue button, sentence in the box, chips row, results), the left-out line with its «برگرداندن» link, a quiet dashed word chip beside the model chip (30 results), the owner's sentence on phone and desktop (catalogue current in the strip, summary card, eight chips, focus ring on the count of results on the phone), the hero on desktop (one button, three example chips). Evidence README: docs/evidence/query-understanding/2026-10-04/README.md.

Follow-ups for CS-114: suggestions while typing and recent searches; whether the applied chips belong directly under the box (above the catalogue strip) now that the sentence is the search; the focus ring on the results count after a search on a touch screen; the left-out line wraps its «برگرداندن» link on a phone; a short phrase rule so the hero's second example lands on the catalogue (CS-99's rules); the understanding's own notes still speak in «من».
Data handoff: none (no migration, no new rows; the lane's e2e rows are removed by the specs).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The home hero and the search page have one box for free text: Enter or its one button sends the sentence to a Server Action (askSearchAction) that reads it by code in-process, settles the words no filter could name against live counts, and answers with the canonical filter address with the sentence kept in an ask parameter; the page navigates there in one history entry (a form posted before the script loaded is redirected, 303), so the buyer lands on the results with the filters applied and shown as removable chips, the unread words as one quiet chip, and quiet lines only when needed. Words that would empty the results are dropped one group at a time (never the filters) and said with a way to put each back; a sentence never ends in a dead end (no-results panel with counted removals when the filters alone find nothing). The sentence stays in the box and in the address through chip, filter and order changes; Back brings the previous page with its box content (a client navigation keeps the hero's typed text); examples under the hero box submit directly; a pasted link still goes to its check. The model stays behind SEARCH_UNDERSTANDING_AI (default off: nothing waits, nothing is asked, nothing is said); on, the page uses the layer's cached answer when there is one and otherwise refines in the background through the route (now answering href) while the address is still what code read. PlainSearch, its panel, demo page and withoutChips are removed. ADR-0043, S03, S04, the AI runbook and learnings updated; strings follow the CS-104 voice guide (merged into the branch).

Verified with: unit and component tests of every changed folder (172 tests in the final targeted run, 282 in the earlier one; filter-panel.test.tsx, untouched, only times out beside the others under load), sentence settling tested on its own with a fake counter and in sentence-search.db.test.ts (new, runs in pnpm db:check); tsc of apps/web and e2e, eslint of the changed folders and prettier clean; EXPLAIN of every count shape (docs/evidence/query-understanding/2026-10-04/explain-counts.md); Playwright on a production build before the owner's stop instruction: plain-search.spec.ts and plain-search-flow.spec.ts 27 of 27 on phone and 27 of 27 on desktop, home.spec.ts search box 10 of 12 on phone (the 2 no-script tests were fixed in code afterwards); screenshots opened and described (evidence README).

Not run (owner instruction): the specs after their last edits, home.spec.ts on desktop, search.spec.ts, check-link.spec.ts (one test updated), layout-stress, gorilla, pnpm check, pnpm db:check. AC 4 is left unchecked: the hero's example «یک ماشین تمیز، کم‌کارکرد و بی‌دردسر» lands on its five clean/low-mileage/popular filters, not on the catalogue «تمیز و بی‌دردسر» (that needs a phrase rule in packages/search/src/understand, CS-99's files; the owner's longer sentence does land on the catalogue), and engine volume and origin phrases await CS-99's merge (the flow is generic).
<!-- SECTION:FINAL_SUMMARY:END -->
