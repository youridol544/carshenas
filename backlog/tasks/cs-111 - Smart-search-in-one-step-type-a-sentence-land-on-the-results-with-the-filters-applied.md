---
id: CS-111
title: >-
  Smart search in one step: type a sentence, land on the results with the
  filters applied
status: In Progress
assignee:
  - '@claude'
created_date: '2026-10-04 07:04'
updated_date: '2026-10-04 07:24'
labels:
  - frontend
  - backend
dependencies: []
priority: high
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Owner feedback 2026-10-04: the plain-Farsi box asks too much of the buyer: type, press «بفهم» (a strange word), read the understood chips, press again to see the listings, and in the hero there is one more step. It must happen by itself: one box, one action, and the buyer lands on /search with the filters already applied and shown. The two-click flow and the disclosure panel are removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The home hero and the search page have one search box for free text; pressing Enter or the one button goes to /search with the results already filtered by what the sentence said, with no confirm step, no «understood» panel to approve and no second button; the example chips under the hero box submit directly (one click shows results)
- [ ] #2 The understanding runs by code on the server before the page is drawn, the address becomes the canonical filter form with the sentence kept in the box, and what the code could not read is shown as a quiet removable chip; words that would make the result empty are dropped automatically, step by step, and the page says which were dropped with a way to put them back, so a sentence never ends in a dead end
- [ ] #3 The applied filters appear as removable chips at the top of the results in plain words; removing or changing a chip updates the results at once; the sentence stays editable; the model path (behind its default-off switch) refines the reading in the background without a click and the page shows the code results at once; with the switch off nothing waits
- [ ] #4 A vague sentence such as «یک ماشین تمیز، کم‌کارکرد و بی‌دردسر» lands on results with the clean catalogue applied and shown, and phrases with a price, a year, a mileage, an engine volume or an origin land with those chips; saving the search as a search file keeps the applied filters
- [ ] #5 Phone and desktop Playwright tests prove one step from the home hero and from /search, the dropping of words that empty the result, the switch-off case and the back button returning to the previous page with its box content; the words on the box and chips follow the product voice guide (CS-104)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
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
<!-- SECTION:PLAN:END -->
