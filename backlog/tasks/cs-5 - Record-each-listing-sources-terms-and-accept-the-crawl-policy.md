---
id: CS-5
title: Record each listing source's terms and accept the crawl policy
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 20:40'
labels:
  - crawler
  - research
  - docs
milestone: m-1
dependencies: []
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
robots.txt was read for every candidate source on 2026-09-26, but robots.txt is not permission: Divar's terms forbid copying ads while its robots.txt looks permissive. ADR-0008 proposes the crawl policy; it becomes binding only after each source's terms are read.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The terms of use of Bama, Karnameh, Khodro45 and Sheypoor are read and summarised with dates and links in the sources research note
- [ ] #2 Each source is marked allowed, allowed with conditions, or not allowed, with the reason
- [ ] #3 ADR-0008 is accepted or amended by the owner in line with those findings
- [ ] #4 The robots.txt rules are re-checked on the same day and any change is recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decision of 2026-09-26 (CS-27): listing photos are hotlinked, never stored. The app serves each source's own image URL (images.unoptimized in next.config.ts, so nothing is downloaded or cached by our server; ADR-0008 point 4). When recording each source's terms, also record whether they allow showing their photos by hotlinking; a source that forbids it, or whose server refuses hotlinked requests, gets a same-size placeholder and a link out.

Open for the owner when accepting ADR-0008 (raised by the CS-27 review): the display decision "hotlink, never store" does not say whether the crawler may download photos transiently, never storing or serving them, for example to detect duplicates across sites (CS-11) or to help extraction (CS-8). Point 4 today only forbids downloads where robots.txt disallows them.
<!-- SECTION:NOTES:END -->
