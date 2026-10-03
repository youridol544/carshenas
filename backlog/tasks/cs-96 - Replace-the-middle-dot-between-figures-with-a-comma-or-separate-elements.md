---
id: CS-96
title: Replace the middle dot between figures with a comma or separate elements
status: To Do
assignee: []
created_date: '2026-10-03 03:15'
updated_date: '2026-10-03 05:29'
labels:
  - frontend
dependencies: []
priority: low
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The middle dot next to Persian digits reads as a zero (design review of CS-71: «۳ خریدار · ۱ درخواست» looks like ۱۰). CS-71 fixed its own screens and the file page heading. Still joined with a dot next to digits: listing summaryLine (listing-screen.tsx, listing-view.ts), comparables-section.tsx, search no-results.tsx, search-files-card.tsx (account card), admin search-files-screen.tsx shownLatest, listing-card.tsx (facts, seller, days), marked-list.tsx facts, model-copy.ts, catalogue-row.tsx, status-overview.tsx, admin jobs-section, crawl-section, problems-section, source-card, listings-section, hero-photos credit, search-files-copy saved/savedBefore. Fix with the Persian comma or separate elements, keep each screen readable; add a lint or test that finds the pattern.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-53/97 (2026-10-03): middle dots next to digits remain in apps/web/src/features/home/components/catalogue-row.tsx (line 52) and hero-photos.tsx (line 191, credit line); the models index count line in model-copy.ts was fixed in CS-53.
<!-- SECTION:NOTES:END -->
