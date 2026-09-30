---
id: CS-57
title: Body-type selector photographs of cars Iranian buyers recognise
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 16:25'
labels:
  - design
  - frontend
milestone: m-5
dependencies:
  - CS-3
  - CS-50
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner's product plan of 2026-09-29: the home page has a clickable body-type selector (sedan, hatchback, crossover, SUV, pickup ...) whose images are real cars Iranians recognise as that type, not generic shapes. The same images can stand in for a missing photo on listing cards, as CS-60 recommends. Changed by the owner on 2026-09-30: the selector uses real, high-quality photographs instead of drawn icons, taken from Unsplash or a similar free-licence site (Pexels, or Wikimedia Commons under a licence that allows commercial use), one per body type in the catalogue's list (body_type table, apps/worker/src/catalogue/codes.ts). Each photo shows a car Iranian buyers recognise as that type (for example a Peugeot 206 or 207 hatchback, a Peugeot 405, Pars, Samand or Dena sedan, a crossover, an SUV, a pickup such as the Arisun or Nissan Zamyad); where no good free photo of an Iranian model exists, a clearly representative car of the type is used and the credits say so. Photos are optimised and served from the app itself (Iranian users must be able to load them; never hotlinked).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 There is one photograph for each body type in the catalogue's list, each of a well-known car of that type in a clean, high-quality photo that matches the rest of the set (owner, 2026-09-30), and the credits name the car
- [ ] #2 Each photo's source page, photographer, licence and download date are recorded in a credits file committed beside the images, and every licence allows commercial use without a fee
- [ ] #3 The photos are served self-hosted in AVIF and WebP at widths matching the selector's phone and desktop sizes at 1x and 2x, with metadata stripped, a fixed aspect ratio and no layout shift, and they read well in light and dark themes
- [ ] #4 Each body type is a component with a Farsi accessible name, and the /design page shows the set
- [ ] #5 The selector shows only the body types it is given as having listings, in catalogue order, and nothing when there are none (owner, 2026-09-30)
- [ ] #6 The design reviewer passes the set, and no prominent brand logo or readable licence plate is shown
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Source one free-licence photo per body type (10, from apps/worker/src/catalogue/codes.ts): Unsplash first (Unsplash License), Wikimedia Commons where an Iranian model has no Unsplash photo (CC BY-SA, attribution and share-alike noted); three-quarter or side views on plain backgrounds; licence checked on each photo page.
2. A manifest beside the images (apps/web/public/body-types/credits.json): code, car, why it was chosen, source page, download URL, photographer, licence, download date, crop box and the regions blurred (plates, a phone number).
3. A build script (apps/web/scripts/body-type-photos.mjs, sharp as a dev dependency): downloads each source into a gitignored cache, blurs the listed regions, crops to 4:3, strips metadata, writes AVIF and WebP at 160, 240, 320, 480 and 640 px into apps/web/public/body-types/; prints the byte sizes.
4. Components in features/body-types: the list of body types with Farsi labels and photo data, BodyTypePhoto (picture with AVIF and WebP, fixed 4:3 frame, Farsi alt, inset photo outline token) and BodyTypeSelector (a native radio group of photo tiles: 44 px+ targets, focus ring, checked state with a check mark and the action-subtle fill, no weight change); composed into /design through a slot so features stay independent; credits shown under the set.
5. Tests: unit test (every body type has a photo, credits and a Farsi label; manifest codes match), e2e for the /design section (ten tiles with Farsi names, AVIF or WebP loaded from our own origin, 4:3 boxes reserved before images arrive, keyboard selection, no overflow at 320 and 412, axe); phone and desktop screenshots viewed.
6. Docs: design-language.md (the photo outline token), note the licence duties; then hand to the coordinator for design and task review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner change, 2026-09-30, in the owner's words: "for cs-57, use images that are high quality, optimize them for web use, beautiful images preferrably from unsplash or websites like this." Drawn icons are replaced by photographs; description and criteria rewritten to match.

Owner, 2026-09-30, on the first set: "sedan, hatchback and pickup images are iranian cars that dont match the aesthehics of other cars. they are not as beautiful, use images for well known cars with aestehthics and cleanness of other cars." Replaced the Samand LX, Peugeot 206 and Zamyad Z24 with a Toyota Camry, a Volkswagen Golf R and a Toyota Hilux from Unsplash; every photo is now under the Unsplash License, so no CC BY-SA duties remain.
Owner, 2026-09-30: "we only show the card in homepage or anywhere else if we have data for that type." BodyTypeSelector takes the codes that have listings (available) and shows only those, in catalogue order, and nothing when none; the home page (CS-63) supplies the codes from its data. /design passes all ten as the sample.

Built: apps/web/public/body-types/credits.json (source page, download URL, photographer, licence, download date 2026-09-30, crop, blurred regions per photo); apps/web/scripts/body-type-photos.mjs (pnpm --filter @carshenas/web photos:body-types; sharp 0.35.4 added as a web dev dependency, the version Next.js already installs) writing AVIF (q55) and WebP (q74) at 160/240/320/480/640 px, 4:3, no EXIF/ICC/XMP (checked with sharp metadata); 100 files, 469 KB AVIF and 572 KB WebP in all, the largest 35.7 KB AVIF and 48.8 KB WebP (minivan-640), a phone tile loads the 480 w AVIF of 7 to 22 KB. features/body-types: body-types.ts, BodyTypePhoto (picture, AVIF then WebP, fixed 4:3 frame, Farsi alt), BodyTypeSelector (native radio group, radio covers its tile, check mark and action-subtle fill when chosen, available prop), BodyTypeCredits; composed into /design through a slot. New token --outline-color-photo (black 10 %) for the inset photo edge; the contrast test now reads a translucent token's colour for its gamut check. The keyboard walk in e2e/gorilla/layout.ts now counts a radio group as one Tab stop and skips links inside a closed details, as browsers do.
Evidence: pnpm check exit 0; vitest body-types 8 passed; E2E_BASE_URL (production build on 3117) pnpm e2e tests/app/body-types.spec.ts, design-language, layout-stress: all passed on mobile and desktop (includes CLS 0 while photos load, boxes reserved with images held, own-origin AVIF sharp enough at DPR, arrow keys, axe, no overflow at 320 and 412). Full pnpm e2e: 148 passed, 26 failed, all in accounts.spec and admin-sources sign-up flows, blocked by the lane database's sign-up limit per network («ثبت‌نام‌های زیادی از این شبکه انجام شده است») after repeated runs; unrelated to this change. Visual baselines regenerated in the container (pnpm e2e:visual --update-snapshots=all, 6 passed). Viewed .playwright-cli/body-types-mobile.png, -mobile-checked.png and -desktop.png: two tiles a row on a phone, five on desktop, sedan first at the right, chosen tile filled with the check at its start corner and a visible focus ring.
<!-- SECTION:NOTES:END -->
