---
id: CS-61
title: >-
  Search page: every searchable listing, curated filters and catalogues, best
  deals first
status: Done
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 20:56'
labels:
  - frontend
  - design
milestone: m-5
dependencies:
  - CS-3
  - CS-59
  - CS-56
  - CS-58
references:
  - .claude/skills/ui-design/references/listing-patterns.md
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The search page: every listing Carshenas has crawled, with curated filters and the premade catalogues as one-tap filter collections, cloned from CarGurus's results page with the Iran-specific details in the listing-patterns reference.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each result shows the title, asking price, deal badge with the gap to market value, mileage, city, condition summary, days on market and its source with a click-out to the original ad
- [x] #2 Filters work as a batch sheet on phones (a sticky apply bar with the live count) and as a rail on desktop, applied filters show as removable chips, and the filter state lives in the URL
- [x] #3 Loading, empty, no-results and error states exist, and Playwright tests on phone and desktop pass the RTL, overflow and axe checks
- [x] #4 The page is added to e2e/fixtures/app-pages.ts so the stress matrix and the gorilla cover it
- [x] #5 Photos come from the source's own https addresses (ADR-0025, listing_photo): never stored, lazy, in a fixed frame with no referrer, and every listing without one, or whose photo does not load, shows the same-size placeholder
- [x] #6 The premade catalogues appear as one-tap filter collections with their counts and body type is a filter; the source filter shows only while more than one source has listings; all from the shared definitions (CS-58)
- [x] #7 Every catalogue and every filter has an info control beside its title (a button with a Farsi name that opens a popover on tap, hover or Enter and closes with Escape) explaining in Farsi what it measures, the text taken from the shared definitions (CS-58) and never written twice (owner, 2026-10-01)
- [x] #8 Results come best deals first with a sort control; the count reads «بیش از …» when it is capped; more results load by keyset paging with a «نمایش بیشتر» button; parameters that fail the shared schema are dropped and shown as ignored
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure view models first, each with unit tests: the card (title from the catalogue name and model year, price block with its five states, deal gap sentence, facts, condition summary from the shared definitions' labels, days on market on Tehran days), listingLink (where a card leads: the ad's own address in a new tab until CS-64), the zod schema of the API response (checked at compile time against the DTO), the filter panel model (featured filters, groups, applied counts, option merging) and the Farsi copy.
2. The card as UI: ListingCardFrame shared by ListingCard and ListingCardSkeleton (container-query layout: a row with the photo at the inline start on phones, three columns when the column is wide), ListingPhoto (lazy, fixed 4:3 frame, no referrer, placeholder when absent or failing), DealBadge on the deal ramp, skeleton utilities in globals.css.
3. The page: app/(site)/search with the heading in the static shell and everything that reads searchParams streamed under Suspense; SearchScreen (server) reads results, facets, catalogue counts and option labels in parallel; a client navigation provider owns the URL (router.push in a transition, optimistic search, pending data attribute that dims the old results after the stale delay); search box with a slot for CS-62's understanding, sort select, catalogue strip (one Tab stop with arrows) with an info popover per catalogue, applied chips, ignored-parameter notice, results list with keyset paging (a button, focus moved to the first new card, polite announcement), loading skeleton, empty index, no-results with removable-filter suggestions counted from the database, and an error state with retry.
4. Filters: one FilterPanel (featured make, model, price, year and deal, then collapsible groups) used as a rail on desktop (applies at once) and inside a Base UI Drawer on phones (draft, live count and facets from GET /api/search, sticky apply bar); native selects for ranges and limits (steps from the definitions), checkbox lists with counts and inline search for database options, an info popover beside every filter title.
5. Tests: component tests (info popover, roving strip, filter panel, results list paging), an e2e fixture that seeds tagged listings and search rows and stubs the source photo host so no request leaves the machine, e2e/tests/app/search.spec.ts on phone and desktop (RTL, overflow, axe, filter flow, URL state, paging, info controls, states), the page in fixtures/app-pages.ts, then the layout stress matrix and the gorilla on it.
6. Evidence and docs: verify-ui craft checks and screenshots at 412 and 1440 px that I open and describe, spec S03 for the page, learnings, notes with the decisions and the integration slot for CS-62.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decisions (CS-27 on 2026-09-26, revised in CS-28 on 2026-09-27) that shape this page:
- Photos are our copies in ArvanCloud Object Storage (ADR-0010; stored by CS-60), in a fixed 4:3 frame; a listing without a usable photo shows the same-size placeholder (ListingPhoto in react-patterns ui-craft.md). Until CS-60 lands, listings have no photos.
- Per-link prefetching (Partial Prefetching is off): the first screen's cards pass prefetch={true}, a full prefetch of the listing page, so a tap opens it at once and the photo morph plays (ListingCard aboveTheFold); the other links keep the default.
- Pending indicators hold for a minimum time with the spin-delay package, approved by the owner; add it here with the first real indicator.
- Staggers, if any, follow reading order grouped by importance; buttons get the hand cursor from globals.css.

CS-4 (2026-09-27): results come from the PostgreSQL search of CS-59 (ADR-0011): keyset pagination, never OFFSET; the default sort by deal score on an indexed column; facets from the precomputed or cached counts; every page query measured with EXPLAIN (ANALYZE, BUFFERS) (database skill).

2026-09-28: no longer waits for CS-60, which is off the demo's critical path. Criterion 5 was reworded so that it holds whichever way CS-60 decides; the placeholder is the default. The results show only listings seen within the freshness window (CS-59), so a card does not need its own "last checked" line.

Renumbered on 2026-09-29: this task was CS-16 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-16; the archived CS-16 points here.

2026-09-30 (ADR-0025, which supersedes ADR-0010): criterion 5 predates it. Photos come from listing_photo (CS-34): the source's own thumbnail address, loaded with referrerPolicy no-referrer and never through the optimizer; this task's migration grants the web role SELECT on listing_photo; a listing without a photo, or a photo that does not load, shows the same-size placeholder. Reword criterion 5 when the task starts.

Owner, 2026-10-01: every catalogue, and every filter whose meaning is a rule (low mileage for its age, popular model, clean and trouble-free, best deal, and so on), shows a small info control beside its title: tapped on a phone, hovered or focused on desktop, it explains in Farsi exactly what it measures, with the numbers (for example «کم‌کارکرد: حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو»). The text comes from the definition in @carshenas/search (CS-58), never written twice; accessible (a button with a Farsi name, a popover or toggletip, Escape closes, not a hover-only title attribute).

2026-10-02 (lane cs-61-search-page, the owner is away; decisions by the coordinator and this lane): CS-60 is skipped and ADR-0010 is superseded by ADR-0025, so criterion 5 no longer speaks of stored copies: photos are never stored and pages show the source's own https addresses from listing_photo (CS-59 already carries the first one in search_document.cover_photo_url), with the same-size placeholder for a listing without one or whose photo fails. No migration is needed here: the search table's cover photo address is all a card shows. Criterion 1 now says what 'sources' means (the source name with a click-out; the 'also listed on' list needs CS-55). Criterion 6 says the source filter appears only while more than one source has listings (Divar is the only source today); the filter options are data-driven. Criteria 7 and 8 were added for the owner's info-control request of 2026-10-01 and for the results behaviour (sort, count form, keyset paging, ignored parameters).

2026-10-02 (coordinator, CS-59 lane decision): search_document will hold only listings whose details were read (price_type is not null); on main 74 percent of active listings are bare list rows (no title, year, price, mileage, city or photo) and are not searchable, so the title says every searchable listing and every card has a price type, a year and a mileage. A card keeps its states for a negotiable, instalment or placeholder price, no rating, and no photo; the bare-row card (no details, a hint to read them on the source) stays in the code as a defensive state. The API gains count-only requests (limit=0), corrections applied to typo words with the list of unknown words, q reported in ignored when it has no searchable word, exact counts capped at 1,001 (shown as «بیش از ۱٬۰۰۰»), no count on cursor pages and invalid cursors answered as invalid_cursor; this page stays behind the DTO types and adapts when the cs-59-search-api branch changes.

2026-10-02 slice 1 (card, page, filters), lane cs-61-search-page. Built: the result card (one grid frame shared with its skeleton, container-query layout: photo, car, price, deal badge with the gap, condition summary, source, days on market), ListingPhoto with the same-size placeholder, listingLink (the ad on its source in a new tab until CS-64), the page at app/(site)/search with the heading in the static shell and everything that reads searchParams streamed under Suspense inside a catchError boundary, a client navigation provider (the URL is the state: router.push in a transition, optimistic search, data-pending dims the old results after the stale delay), search box with a slot for CS-62, sort select, catalogue strip (one Tab stop with arrow keys, an info popover per catalogue), applied chips, ignored-parameter notice, keyset results list with a «نمایش بیشتر» button, and one filter panel (five featured filters, then the CS-58 groups as closed sections) shown as a sticky rail on desktop (applies at once) and inside a Base UI drawer on phones (draft, live count and options from GET /api/search, sticky apply bar). Every filter and every catalogue has an info popover built from the shared definitions (filterInfo, catalogueInfo over explain.ts). Verified so far: pnpm typecheck, eslint on src, 141 web unit tests, and the page driven in the agent browser at 412 and 1440 px (sheet, live count, apply to /search?make=peugeot, info popover, Escape). Not yet: e2e tests, stress matrix and gorilla, craft measurements.

Title reworded on 2026-10-02 (coordinator, CS-59 review): the search page shows every searchable listing, which means a listing whose details have been read (about a quarter of the active listings on main). A bare list row has no title, price, year, mileage, city or photo, cannot be a card or be rated, and enters the results by itself when its details are read. CS-59's API says how many listings a crawl sees and how many are searchable (readSearchCoverage), for a line such as «۶٬۰۰۰ از ۲۳٬۷۵۲ آگهی دیده‌شده قابل جست‌وجوست».

Slice 2 (2026-10-02): decisions. Results stop at 120 cards per page view (then the page says to narrow the search) so the DOM and the accessibility scan stay bounded. A thin line over the old results replaces dimming (dimmed text fails 4.5:1; deviation from craft.md which dims after a delay). Range and limit filters are native selects with steps from the definitions; choice lists carry counts, an in-list search and show all. The catalogue strip is a roving-tabindex toolbar (one Tab stop). Focus lands on the results count when the control that changed the search is gone. Catalogue names are shown with Persian digits via nameOnScreen. Adapted to the revised CS-59 API: count-only limit=0, corrections and unknown words notice, q in ignored, refused cursor reopens the list. Harness changes: keyboardWalk skips tabindex -1, layout-stress waits for hydration. Follow-ups: min-block-2lh utility duplicates main min-h-2lh (reconcile on merge); relax queries add one count per applied filter on a no-results page. CS-62 plugs in through the understanding prop of SearchScreen (docs/specs/S03-search-page.md).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Search page at /search: result cards, catalogue strip with counts and info popovers, removable chips, rail (desktop) and batch sheet with live count (phone), URL state through the CS-58 codec, keyset paging, states for loading, empty, no results, error. Evidence: 81 feature unit tests and 204 web unit tests, eslint and tsc clean, search.spec.ts 59 passed on phone and desktop with 3 project-specific skips, layout-stress for /search 12 passed, gorilla ok on both projects (one run flaked under machine load 17), screenshots at 412 and 1440 read. Adapted to the revised CS-59 API after merging cs-59-search-api. Spec: docs/specs/S03-search-page.md.
<!-- SECTION:FINAL_SUMMARY:END -->
