---
id: CS-60
title: >-
  Honour a source's removal request by purging its listings and everything
  derived from them
status: To Do
assignee: []
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 20:09'
labels:
  - crawler
  - infra
milestone: m-5
dependencies:
  - CS-5
  - CS-33
references:
  - docs/decisions/0008-crawl-only-what-sources-allow.md
  - docs/decisions/0025-show-listing-photos-from-the-sources-addresses.md
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0008 point 8 honours a source's request to stop or to remove its data, and docs/design/data-model.md plans it as a purge (layer 0: removal_request and purge_listings()). Re-scoped by the owner on 2026-09-30: the photo question this task first carried is answered by ADR-0025, which keeps photos only as the source's own addresses and downloads none, so what is left is the removal request itself. A purge deletes listings in one transaction that sets carshenas.purge, and their snapshots, fetches, price events, photo addresses and unparsed values go with them; so do the AI answers only they used (ai_answer, linked through CS-52's extraction).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A removal request for one listing or for a whole source is recorded with who asked, when and its scope, and stays as the record after the purge
- [ ] #2 Completing a request deletes its listings in one transaction, with every snapshot, fetch, price event, photo address and unparsed value of theirs, and nothing of any other listing
- [ ] #3 The AI answers that only the purged listings used are deleted with them, and answers other listings still use are kept
- [ ] #4 A source whose data was removed as a whole is paused, and nothing is crawled from it again until a person resumes it
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

From CS-5 (2026-09-28): none of the five sources' terms grants reuse of its photos. Divar: sellers give Divar an exclusive three-year licence to their listings, and article 7 forbids republishing content. Bama: copying another seller's photos is forbidden. Karnameh and Khodro45: all their content, images included, is theirs. Sheypoor: no terms, all rights reserved. Karnameh's robots.txt disallows /pictures/car-posts. The owner's decision of 2026-09-28 to ignore sources' terms was about crawling; ADR-0008 point 4 (accepted) leaves photos to this task, per source, with the owner, so policy checks start with photos_allowed false. Divar's photos are on s100.divarcdn.com (static/photo/...); read that host's robots.txt before downloading.

Correction from the CS-5 review (2026-09-28): the note above called the owner's decision to ignore sources' terms "about crawling"; that was the agent's reading, not the owner's words. What binds today is ADR-0010 (accepted): photos are stored only where a source's robots.txt and recorded terms allow it. None of the five sources' terms does, so no source contributes photos. Storing any needs an ADR that supersedes ADR-0010's condition, decided with the owner here.

From CS-5 (2026-09-28): the option the owner chose for ADR-0008 ("Terms and robots.txt") read: "the crawler may fetch disallowed paths, such as Karnameh's photo folder". ADR-0010 is still accepted and needs a source's terms to allow photos, which none do. Put the question to the owner at the start of this task: supersede ADR-0010's condition, or keep every source without photos.

2026-09-28 (planning session): lowered to medium and taken off the demo's critical path. CS-55 and CS-61 no longer depend on it, and their photo criteria hold with the placeholder.

Recommendation for the question this task puts to the owner: keep ADR-0010 as accepted (no stored photos) for the demo. The cards and the listing page show a drawing of the car's body type in its listed colour, which is a structured field, plus the source's photo count («۱۲ عکس در دیوار») as a link out. Three reasons:
- Re-hosting photos is the plainest breach of every source's terms.
- Photos can show plates and phone numbers, which need a detector with its own labelled evaluation set before anything is shown.
- Nothing in the demo's story needs them.

If the owner wants real photos anyway, storing a masked main photo per active listing is the smallest version.

Renumbered on 2026-09-29: this task was CS-29 (created 2026-09-26). Commits, applied migrations, accepted ADRs, done tasks and earlier research notes still call it CS-29; the archived CS-29 points here.

2026-09-30 (the owner, ADR-0025, which supersedes ADR-0010): the question this task puts is answered. Photos are shown from the source's own addresses and are never downloaded or stored; CS-34 keeps each listing's photo addresses in listing_photo. None of criteria 1 to 7 applies as written (no download, bucket, masking model or deletion outbox), so archive this task or re-scope it: the owner's call.

If this task is archived, what docs/design/data-model.md still plans under it needs a new home: the removal_request table and purge_listings() of layer 0 (criterion 3), and the purge of ai_answer rows that only purged listings used (section 3, CS-45).

Re-scoped by the owner on 2026-09-30 (asked from CS-34, recommendation chosen): the title, description and criteria now cover the removal request only; the notes above are the photo question's history, answered by ADR-0025.

Owner, 2026-09-30: skipped for now in the CS-58 to CS-75 run (CS-60: no Arvan storage, pages use Divar image addresses directly; CS-74: no other sources than Divar; CS-75: no video or submission yet).
<!-- SECTION:NOTES:END -->
