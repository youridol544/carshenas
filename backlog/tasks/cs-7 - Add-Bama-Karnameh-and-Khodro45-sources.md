---
id: CS-7
title: 'Add Bama, Karnameh and Khodro45 sources'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 09:23'
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
After Divar (CS-6), more sources mean better coverage and the cross-site duplicates behind the "listed cheaper elsewhere" feature. Bama allows crawling of its car pages and embeds listing data in them; Karnameh and Khodro45 have narrower robots.txt rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bama listing pages are crawled for the same Tehran models as Divar, reading the listing data embedded in each page
- [ ] #2 Karnameh listing pages are crawled without requesting any path under /pictures/car-posts
- [ ] #3 Khodro45 listings are discovered from its sitemap, and no filter or _rsc URL is ever requested
- [ ] #4 All three sources write snapshots in the same format as Divar and follow the CS-6 politeness rules
- [ ] #5 Sheypoor is added the same way only if CS-5 marked it allowed; otherwise the task notes say why not
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->
