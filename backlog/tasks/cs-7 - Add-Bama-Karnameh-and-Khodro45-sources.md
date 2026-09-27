---
id: CS-7
title: 'Add Bama, Karnameh and Khodro45 sources'
status: To Do
assignee: []
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 22:57'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From CS-5 (2026-09-28): the terms of Bama and Karnameh forbid automated access and copying; the owner decided to crawl them anyway, like Divar (ADR-0008 point 3, accepted 2026-09-28). Khodro45's terms say nothing on automated access but claim all its content. Sheypoor publishes no terms and is marked allowed with conditions (category paths with page_num only), so criterion 5 adds it. robots.txt still decides the URLs (Karnameh never /pictures/car-posts; Khodro45 sitemap URLs only). Policy-check rows for all four: verdict allowed_with_conditions with the conditions in docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md (Verdicts), robots_txt from its robots-2026-09-28 folder, photos_allowed false until CS-29 (Karnameh never). The description line saying Bama allows crawling reflects robots.txt only.

Correction from CS-5 (2026-09-28, later the same day): the owner then chose to follow neither the sources' terms nor their robots.txt (ADR-0008 point 3, accepted), so robots.txt no longer decides the URLs; the note above saying it does is out of date. Criterion 2 (nothing under /pictures/car-posts) still holds through ADR-0010, which allows photos only where robots.txt and terms allow them. Criterion 3's "no filter or _rsc URL" came from robots.txt: keep it as a design choice or drop it, with the owner, when CS-7 starts.

From the CS-5 review (2026-09-28): criterion 2 (nothing under /pictures/car-posts) now rests on ADR-0010 alone, so it depends on the photo question CS-29 puts to the owner. If the owner supersedes ADR-0010's condition, revisit criterion 2.
<!-- SECTION:NOTES:END -->
