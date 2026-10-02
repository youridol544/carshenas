---
id: CS-61
title: >-
  Search page: every searchable listing, curated filters and catalogues, best
  deals first
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-10-02 16:22'
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
- [ ] #1 Each result shows the title, asking price, deal badge with the gap to market value, mileage, city, condition summary, days on market and sources
- [ ] #2 Filters work as a batch sheet on phones with applied filters as chips, and the filter state lives in the URL
- [ ] #3 Loading, empty, no-results and error states exist, and Playwright tests on phone and desktop pass the RTL, overflow and axe checks
- [ ] #4 The page is added to e2e/fixtures/app-pages.ts so the stress matrix and the gorilla cover it
- [ ] #5 Photos come from the stored copies where CS-60 provides them (ADR-0010), and every listing without one shows the same-size placeholder
- [ ] #6 The premade catalogues appear as one-tap filter collections, and source (Divar, Bama …) and body type are filters, all from the shared definitions (CS-58)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

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

Title reworded on 2026-10-02 (coordinator, CS-59 review): the search page shows every searchable listing, which means a listing whose details have been read (about a quarter of the active listings on main). A bare list row has no title, price, year, mileage, city or photo, cannot be a card or be rated, and enters the results by itself when its details are read. CS-59's API says how many listings a crawl sees and how many are searchable (readSearchCoverage), for a line such as «۶٬۰۰۰ از ۲۳٬۷۵۲ آگهی دیده‌شده قابل جست‌وجوست».
<!-- SECTION:NOTES:END -->
