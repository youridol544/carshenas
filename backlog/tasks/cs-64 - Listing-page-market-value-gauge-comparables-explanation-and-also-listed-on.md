---
id: CS-64
title: 'Listing page: market-value gauge, comparables, explanation and also-listed-on'
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - frontend
  - ai
milestone: m-5
dependencies:
  - CS-55
  - CS-51
  - CS-61
  - CS-35
references:
  - .claude/skills/ui-design/references/listing-patterns.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
  - docs/research/2026-09-28-torob-challenge-expectations-and-field.md
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The page where the product earns trust: why this price is a good or a bad deal, based on which cars, and whether the same car is cheaper elsewhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The gauge shows the five bands, the market value and this listing's price, with the market value's date
- [ ] #2 The explanation is generated from stored facts only, and a test proves every number in it comes from the database
- [ ] #3 Comparables, price history, condition chips with their source sentence, risk flags and the duplicate group (cheapest first) are shown
- [ ] #4 The primary action clicks out to the source listing
- [ ] #5 Playwright tests cover the page on phone and desktop, and it is added to e2e/fixtures/app-pages.ts
- [ ] #6 The main photo comes from the stored copy where CS-60 provides one (ADR-0010); otherwise the same-size placeholder is shown
- [ ] #7 The page says when the listing was last checked; opening one whose last check is older than the freshness window requests a re-check (CS-35), and a listing found gone says so and offers similar listings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-28 (owner, 2026-09-27): Partial Prefetching is off so this page can answer a real 404. Read the id and the listing at the top of the page, with no loading.tsx and no Suspense around the page in any layout above it (either starts the stream), call notFound() before anything streams, and export instant = false: without it, next build fails with a blocking-prerender error (next-app-router.md; Next.js building guide). Keep the main photo and the title outside any Suspense boundary, so the photo morph from the results page forms in the navigation's commit; the results page prefetches its first screen of listings fully. Photos are our ArvanCloud copies (ADR-0010, CS-60).

From CS-30 (2026-09-28): /diagnostics/[failure], which reads params at the top with instant = false and no Suspense or loading.tsx above, was built as a partial prerender (◐) and answered 200 with noindex for notFound() and for a thrown error. The next-app-router rule's real-404 recipe did not give a 404 there; verify the listing page's 404 status in a browser test before relying on it (docs/learnings.md, 2026-09-28).

From CS-30 (2026-09-28): a malformed percent-escape in a dynamic segment (for example /listings/%E0%A4%A) fails inside Next.js 16.3.5 while it decodes the route params: a plain-text English 500, no onRequestError call, and only a warn request completed line in the log (measured on /diagnostics/[failure]). The listing page should answer such a path with a Farsi 400 or 404; the options are a proxy matched to the dynamic routes that refuses an undecodable path before routing, or a Next.js fix. docs/runbooks/logs-and-errors.md, Known limits.

2026-09-28 (ADR-0017 point 10): the page shows facts, our analysis and short quoted evidence for each condition fact, and clicks out to the source for the full listing. It never shows the seller's full description, contact details or photos beyond what CS-60 decides.

2026-09-28, from the field survey: two entries guard their explanations against invented numbers, and none reports how faithful the explanations are. Beyond criterion 2, report a faithfulness rate on a labelled sample: the share of explanation sentences whose every claim is supported by the stored facts.

Renumbered on 2026-09-29: this task was CS-17 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-17; the archived CS-17 points here.
<!-- SECTION:NOTES:END -->
