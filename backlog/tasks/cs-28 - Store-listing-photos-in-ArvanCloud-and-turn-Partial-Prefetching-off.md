---
id: CS-28
title: Store listing photos in ArvanCloud and turn Partial Prefetching off
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 20:55'
updated_date: '2026-09-26 21:33'
labels:
  - design
  - dx
milestone: m-1
dependencies: []
references:
  - docs/research/2026-09-26-ui-craft-details.md
  - docs/decisions/0010-store-listing-photos-in-arvancloud.md
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-09-27 the owner revised two of the decisions CS-27 applied. The crawler already downloads photos where a source allows it (duplicate detection and extraction need them), so those photos are stored in ArvanCloud Object Storage and the pages show our copies instead of hotlinking the source. Partial Prefetching goes off again, so a listing page can read its id at the top and answer a real 404 for a missing listing instead of HTTP 200 with noindex.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An accepted ADR records ArvanCloud Object Storage as the store for listing photos, and ADR-0007, ADR-0008 and AGENTS.md no longer say photos are never re-hosted
- [x] #2 Partial Prefetching is off in next.config.ts, and the Next.js rules say how a listing page answers 404 for a missing listing and how the photo morph still forms
- [x] #3 The craft and Next.js rules, the React patterns and the research note describe stored photos and per-link prefetching, and none still tells an agent to hotlink photos or rely on Partial Prefetching
- [x] #4 A To Do task describes the photo pipeline into ArvanCloud, and CS-5, CS-6, CS-11, CS-16, CS-17 and CS-23 carry what the change means for them
- [x] #5 pnpm check and pnpm e2e pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ADR-0010 (accepted, the owner's decision): photos the crawler downloads where a source allows are stored in ArvanCloud Object Storage (S3 API, Tehran and Tabriz regions) and the pages show those copies; follow-ups in CS-29. ADR-0008 point 4 (proposed) and ADR-0007 (proposed) say so; AGENTS.md's data-sources line no longer says images are never re-hosted.
2. Turn Partial Prefetching off in next.config.ts; keep images.unoptimized until CS-29 decides how photos are resized; update the comments.
3. Rules: next-app-router.md (per-link prefetch, the listing page reads its id at the top and calls notFound() before streaming for a real 404, no loading.tsx above it, instant = false; next/image serves our stored copies), craft.md (photos, prefetch, morph), react-patterns ui-craft.md (card and photo comments, prefetch={true} as a full prefetch, morph bullet), the research note's decisions 3 and 4 marked as revised on 2026-09-27.
4. Tasks: CS-29 created for the pipeline; notes on CS-5, CS-6, CS-11, CS-16, CS-17, CS-23; a note on CS-27 that decisions 3 and 4 were revised here.
5. Verify with pnpm check and pnpm e2e; run the task-reviewer and fix its findings; In Review; commit on the owner's instruction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner, 2026-09-27: "about first question-> when we download it, so let's use it to store. i want to store in arvan storage. and then we might not need partial prefetching so 404 issue is solved. update all docs and any tasks needed and commit".

- Photos: ADR-0010 (accepted) stores the photos the crawler may download in ArvanCloud Object Storage and shows them from there. ADR-0007 (item 5) and ADR-0008 (point 4) were updated, both still proposed; the ADR index and AGENTS.md's data-sources line too. ArvanCloud facts: rclone's S3 provider page (https://rclone.org/s3/) lists "Arvan Cloud Object Storage (AOS)" with s3.ir-thr-at1.arvanstorage.ir (Tehran, Simin) and s3.ir-tbz-sh1.arvanstorage.ir (Tabriz, Shahriar). docs.arvancloud.ir answered with a redirect loop, so CS-29 confirms the details in the panel.
- Partial Prefetching removed from next.config.ts; next build now prints only "Cache Components enabled". images.unoptimized stays until CS-29 decides how photos are resized.
- Rules: next-app-router.md says how a page answers a real 404 (read params and the record at the top, no loading.tsx or Suspense above it, notFound() before streaming, export instant = false, without which next build fails). It also covers blocking routes, next/image for stored photos and per-link prefetch. craft.md covers photos, prefetch, the morph and the LCP line. react-patterns ui-craft.md updates the card and ListingPhoto comments (re-linted and type-checked in place, probe removed) and its prose. data-and-actions.md §2 carries the 404 trade-off. The research note marks decisions 3 and 4 as revised. docs/learnings.md has an entry on instant = false.
- Tasks: CS-29 created for the photo pipeline (m-2; depends on CS-5 and CS-6), with criteria for politeness, keys and metadata, sizes, masking phone numbers and plates (with an evaluation if a model detects them), removal requests, the removed-ad policy decided with the owner, and a local S3-compatible store for development and tests. CS-11 and CS-16 depend on CS-29. CS-16 and CS-17 gained a criterion to show the stored photos. Notes were replaced on CS-5, CS-16 and CS-17 and appended on CS-6, CS-11, CS-23 and CS-27.

task-reviewer pass (2026-09-27): all five criteria met. Findings fixed:
- CS-29's display criterion could not be met in m-2, so it moved to CS-16 and CS-17.
- CS-29 lacked criteria for unmasked originals and removed ads; added.
- The 404 rule also excludes a layout's Suspense.
- The instant = false requirement was verified in the Next.js building guide and added to data-and-actions.md §2.
- The craft.md static-shell line was fixed.
- ADR-0010's sourcing now names rclone and the unreachable ArvanCloud page, and its Related list includes CS-17 and CS-23.
The reviewer also noted that one route can opt out of Partial Prefetching with instant = false; reported to the owner.

Checks: pnpm check passed (after the last edits too); pnpm e2e 56 passed with the 4 intentional self-check skips.

Moved to Done on the owner's explicit instruction (2026-09-27).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied the owner's revision of 2026-09-27.

- ADR-0010 (accepted) stores the listing photos the crawler may download in ArvanCloud Object Storage and shows them from there; ADR-0007, ADR-0008 and AGENTS.md match.
- Partial Prefetching is off, so a listing page can read its id at the top and answer a real 404. It needs export const instant = false, without which next build fails.
- The Next.js and craft rules, the React patterns and the research note describe stored photos and per-link prefetching.
- CS-29 was created for the photo pipeline, with privacy, removal and local-store criteria; CS-16 and CS-17 now show the stored photos and depend on it; CS-5, CS-6, CS-11, CS-17 and CS-23 carry notes.

Verified with pnpm check, pnpm e2e (56 passed) and next build; the task-reviewer's findings were fixed.
<!-- SECTION:FINAL_SUMMARY:END -->
