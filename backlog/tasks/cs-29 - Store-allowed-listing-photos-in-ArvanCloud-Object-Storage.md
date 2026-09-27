---
id: CS-29
title: Store allowed listing photos in ArvanCloud Object Storage
status: To Do
assignee: []
created_date: '2026-09-26 20:55'
updated_date: '2026-09-27 22:28'
labels:
  - crawler
  - infra
milestone: m-2
dependencies:
  - CS-5
  - CS-6
references:
  - docs/decisions/0010-store-listing-photos-in-arvancloud.md
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner decided on 2026-09-27 (ADR-0010) that listing photos the crawler downloads, where a source allows it, are stored in ArvanCloud Object Storage and the pages show those copies (the results page in CS-16 and the listing page in CS-17). The same photos feed duplicate detection (CS-11, image embeddings in ADR-0007) and extraction (CS-8). ArvanCloud Object Storage speaks the S3 API; rclone lists the endpoints s3.ir-thr-at1.arvanstorage.ir (Tehran, Simin) and s3.ir-tbz-sh1.arvanstorage.ir (Tabriz, Shahriar); confirm them in the ArvanCloud panel, since docs.arvancloud.ir could not be fetched when ADR-0010 was written. Photos can show a seller's phone number or a licence plate, which ADR-0008 does not allow the product to republish.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Photos are downloaded only for sources whose recorded robots.txt and terms allow it (CS-5), within ADR-0008 politeness limits, and none are downloaded for a source that forbids it
- [ ] #2 Each stored photo is an object in an ArvanCloud bucket keyed by source and listing, with its source URL, fetch time and content hash recorded, and the credentials read only from the environment
- [ ] #3 A source's removal request deletes its stored photos along with its listings
- [ ] #4 Each stored photo can be served at the sizes the results and listing pages need, from a URL the web app builds from the listing record, and how photos are resized is decided and recorded
- [ ] #5 A photo that shows a seller's phone number or a licence plate is neither shown nor kept as downloaded: the stored copy is masked or the photo is dropped, and a model that detects them has a labelled evaluation set with a reported accuracy
- [ ] #6 What happens to the photos of an ad its source has removed is decided with the owner, recorded, and followed by the pipeline
- [ ] #7 Development and tests use a local S3-compatible store, never the real bucket or its credentials
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CS-4 (2026-09-27): the photo tables are planned in docs/design/data-model.md (photo with its storage key, content hash and a 64-bit perceptual hash as bigint, plus a storage deletion outbox that a removal request fills); snapshots keep photo URLs inside their payload, not in a column.

From CS-5 (2026-09-28): none of the five sources' terms grants reuse of its photos. Divar: advertisers give Divar an exclusive three-year licence to their ads, and article 7 forbids republishing content. Bama: copying another advertiser's photos is forbidden. Karnameh and Khodro45: all their content, images included, is theirs. Sheypoor: no terms, all rights reserved. Karnameh's robots.txt disallows /pictures/car-posts. The owner's decision of 2026-09-28 to ignore sources' terms was about crawling; ADR-0008 point 4 (accepted) leaves photos to this task, per source, with the owner, so policy checks start with photos_allowed false. Divar's photos are on s100.divarcdn.com (static/photo/...); read that host's robots.txt before downloading.
<!-- SECTION:NOTES:END -->
