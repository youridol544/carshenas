---
id: CS-57
title: Body-type selector photographs of cars Iranian buyers recognise
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 18:16'
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
- [ ] #3 The photos are served self-hosted in AVIF and WebP at widths matching the selector's phone and desktop sizes at 1x and 2x, with metadata stripped, a fixed aspect ratio and no layout shift, and they read well in the light theme
- [ ] #4 Each body type is a component with a Farsi accessible name, and the /design page shows the set
- [ ] #5 The selector shows only the body types it is given as having listings, in catalogue order, and nothing when there are none (owner, 2026-09-30)
- [ ] #6 The design reviewer passes the set; no logo is used as artwork and no licence plate is readable (a maker's badge on the photographed car is allowed, owner 2026-09-30)
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

Owner decisions, 2026-09-30: (1) dark theme: wait until the design language defines one; the photo edge flips to white at 10 % then. (2) Keep the photos' natural backgrounds, no cut-outs. (3) Keep the Aston Martin convertible and the Volvo wagon.
Lesson, 2026-09-30: early photo-search requests to Unsplash's image CDN and Wikimedia carried the owner's email in the User-Agent header. Never put the owner's email or any personal data in request headers to external services; the committed script names only the app.

Criterion 3: 'and dark themes' removed after the owner's decision of 2026-09-30 ("dark theme: wait until the design language has one; the photo edge flips to white then"). Criterion 6 reworded after the owner's decision of 2026-09-30: a maker's badge on the photographed car is allowed (the Tucson, Prado, V50 and Golf show theirs); the rule is against logos used as artwork.
Design review (coordinator, 2026-09-30, on b4d807a): all invariants pass; verdict 'not ready' only for the weak selected state (fill 1.19:1 against unselected, border unchanged, check disk 1.28 to 2.95:1 on some photos). Fixed: has-checked:border-action (5.5:1, colour only) and a 2 px border-canvas ring round the check disk; e2e asserts the chosen tile's edge colour differs. Also from the review: Latin credit links no longer wrap (whitespace-nowrap), site and licence stated once above the list (12 links instead of 30), a chevron cue on the credits toggle that turns when open, axe now scans the whole section with the credits open; pickup, van and convertible cropped tighter; the SUV's violet dusk cast reduced with a partial white balance (a fully neutral one turned the sky teal); inner photo radius 8 px (new token rounded-inner, 16 − 8). No photo is mirrored. The design review is to be re-run by the coordinator; criterion 6 stays unchecked.
Task-reviewer (coordinator, 2026-09-30): criteria 1, 2, 4, 5 met; follow-ups done: harness self-test for a radio group and a closed details in e2e/tests/harness/layout-selfcheck.spec.ts; the leftover phone-number mention removed from the script header (credits.json no longer had it). The task file name still says icons: renaming is not safe through the CLI, so it stays.
How each licence was confirmed, 2026-09-30: every photo page was read through the WebFetch tool (plain curl gets Unsplash's bot challenge, which was not worked around); each page stated 'Free to use under the Unsplash License' and none was marked Unsplash+; each file is served from images.unsplash.com, where Unsplash+ files come from plus.unsplash.com instead.

Evidence after the review fixes, 2026-09-30: pnpm check exit 0; production build on 3117, E2E_BASE_URL pnpm e2e body-types, design-language, layout-stress and harness layout-selfcheck --workers=2: 106 passed (a first run at full parallelism hit timeouts and ERR_NETWORK_IO_SUSPENDED under a load average of 15 from the three lanes, and lost the shared fixture server on 4173). Visual baselines regenerated in the container, 6 passed. Viewed .playwright-cli/review2-mobile.png (chosen van tile: blue edge, fill, ringed check mark clear on the photo), review2-desktop.png (five a row, chevron down when open, licence stated once) and review2-credits-mobile.png (Latin names whole on one line; a long line wraps before the name).
<!-- SECTION:NOTES:END -->
