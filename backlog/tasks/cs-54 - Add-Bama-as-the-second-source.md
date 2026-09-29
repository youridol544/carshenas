---
id: CS-54
title: Add Bama as the second source
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-33
  - CS-48
  - CS-35
  - CS-34
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
  - docs/decisions/0017-live-bounded-replayable-listing-index.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A second source is what cross-site duplicates and «همین خودرو در ... ارزان‌تر» need (CS-55), and that is the moment in the demo that is most like Torob. Bama is Iran's second-largest used-car site and strong among Tehran dealers, who often post the same car on Divar too, so it is the second source. Karnameh, Khodro45 and Sheypoor moved to CS-77 on 2026-09-28 (ADR-0017). Bama's terms forbid automated copying; the owner decided to crawl it anyway, like Divar (ADR-0008 point 3, accepted on 2026-09-28).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bama's Tehran car listings of the tracked models are discovered newest first and stored as snapshots in the same format as Divar's, from the listing data embedded in its pages
- [ ] #2 Bama follows the same politeness, stop on block, sweep, lifecycle and daily budget as Divar (CS-33, CS-35)
- [ ] #3 Bama's structured fields are parsed by code into the same listing attributes as Divar's (CS-34)
- [ ] #4 At least 50 Bama listings are added to the labelled set of CS-48, and the parser's accuracy on them is reported
- [ ] #5 Bama's policy check is recorded before its first crawl (ADR-0008 point 1)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-5 (2026-09-28): the terms of Bama and Karnameh forbid automated access and copying; the owner decided to crawl them anyway, like Divar (ADR-0008 point 3, accepted 2026-09-28). Khodro45's terms say nothing on automated access but claim all its content. Sheypoor publishes no terms and is marked allowed with conditions (category paths with page_num only), so criterion 5 adds it. robots.txt still decides the URLs (Karnameh never /pictures/car-posts; Khodro45 sitemap URLs only). Policy-check rows for all four: verdict allowed_with_conditions with the conditions in docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md (Verdicts), robots_txt from its robots-2026-09-28 folder, photos_allowed false until CS-60 (Karnameh never). The description line saying Bama allows crawling reflects robots.txt only.

Correction from CS-5 (2026-09-28, later the same day): the owner then chose to follow neither the sources' terms nor their robots.txt (ADR-0008 point 3, accepted), so robots.txt no longer decides the URLs; the note above saying it does is out of date. Criterion 2 (nothing under /pictures/car-posts) still holds through ADR-0010, which allows photos only where robots.txt and terms allow them. Criterion 3's "no filter or _rsc URL" came from robots.txt: keep it as a design choice or drop it, with the owner, when CS-54 starts.

From the CS-5 review (2026-09-28): criterion 2 (nothing under /pictures/car-posts) now rests on ADR-0010 alone, so it depends on the photo question CS-60 puts to the owner. If the owner supersedes ADR-0010's condition, revisit criterion 2.

2026-09-28: narrowed to Bama and raised to high (ADR-0017). The notes above about Karnameh, Khodro45 and Sheypoor now belong to CS-77.

Renumbered on 2026-09-29: this task was CS-7 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-7; the archived CS-7 points here.
<!-- SECTION:NOTES:END -->
