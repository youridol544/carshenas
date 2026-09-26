---
id: CS-7
title: Add Karnameh and Khodro45 sources
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
labels:
  - crawler
  - backend
milestone: m-2
dependencies:
  - CS-6
references:
  - docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
More sources mean better coverage and the cross-site duplicates behind the 'listed cheaper elsewhere' feature. Both sites have narrower robots.txt rules than Bama.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Karnameh listing pages are crawled without requesting any path under /pictures/car-posts
- [ ] #2 Khodro45 listings are discovered from its sitemap, and no filter or _rsc URL is ever requested
- [ ] #3 Both sources write snapshots in the same format as Bama and follow the CS-6 politeness rules
- [ ] #4 Sheypoor is added the same way only if CS-5 marked it allowed; otherwise the task notes say why not
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
