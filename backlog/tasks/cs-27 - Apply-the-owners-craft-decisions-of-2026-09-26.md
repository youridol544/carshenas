---
id: CS-27
title: Apply the owner's craft decisions of 2026-09-26
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 20:01'
updated_date: '2026-09-26 21:33'
labels:
  - design
  - dx
milestone: m-1
dependencies: []
references:
  - docs/research/2026-09-26-ui-craft-details.md
  - docs/decisions/0009-react-19-3.md
priority: medium
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CS-26 left ten decisions to the owner (listed in docs/research/2026-09-26-ui-craft-details.md). The owner answered them on 2026-09-26: move React to 19.3.0; stagger in reading order grouped by importance; hotlink listing photos and never store them; turn on Partial Prefetching now; defer the web font, because a commercial font will be bought instead of Vazirmatn; allow weight 500 for 12 to 13 px labels; judge Latin trim codes with the bought font; the hand cursor on enabled buttons; the spin-delay package for the minimum time an indicator stays; keep measuring tap targets by hit area. Until the rules, ADRs and code say so, agents would still treat these as open or follow the old defaults.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The research note, the ui-design craft and type references, the Next.js prefetch rule and ADR-0008 state each of the ten decisions, and none of them still calls it an open owner decision
- [x] #2 The app and its unit tests run React 19.3.0 (react and react-dom), and pnpm check and pnpm e2e pass on it
- [x] #3 Partial Prefetching is enabled in next.config.ts, and the production build and browser tests pass with it
- [x] #4 On desktop, enabled buttons show the hand cursor and aria-disabled buttons do not, from one rule in globals.css
- [x] #5 CS-3, CS-5 and CS-16 carry the decisions that shape them: the bought font and its re-measurement, hotlinked photos that are never stored, spin-delay for indicator minimums and prefetch={true} for above-the-fold cards
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Record the ten decisions: the research note's decision list becomes "Decisions taken on 2026-09-26"; craft.md, persian-type-formatting.md, motion.md and next-app-router.md state them; ADR-0008 point 4 says how photos are shown (hotlinked through next/image with unoptimized, never fetched or cached by our server, placeholder and link out where refused). spin-delay is recorded as approved, to arrive with CS-16 (ADR-0003 is accepted, and its rule is that each dependency comes with the task that needs it).
2. Bump react and react-dom to 19.3.0 and the lint settings' React version; confirm Vitest now resolves 19.3.0 with ViewTransition; update the rules, skills and learnings that describe the 19.2.8 test gap.
3. Enable partialPrefetching in next.config.ts; update the prefetch rule (shared App Shell per route; prefetch={true} only for above-the-fold cards whose content must be ready).
4. Add the hand-cursor base rule for enabled buttons to globals.css; check computed cursors in the browser.
5. Append the decisions to CS-3 (bought font, re-measurement, loading strategy, trim codes, weight 500), CS-5 (record each source's stance on hotlinking) and CS-16 (hotlinked photos, spin-delay, prefetch={true}).
6. Verify with pnpm check, pnpm e2e and browser checks; run the task-reviewer and fix its findings; finish at In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied the owner's ten decisions of 2026-09-26.

Code:
- React: react and react-dom 19.3.0 (apps/web/package.json, pnpm-lock.yaml; scheduler 0.27 to 0.28), lint settings React 19.3. Vitest now resolves 19.3.0 with ViewTransition (a symbol) and addTransitionType; a throwaway Vitest test rendered children inside <ViewTransition share="morph" default="none"> and asserted version 19.3.0 (1 passed), then was removed. ADR-0003's "react-dom 19.2.8" describes what was scaffolded and was not edited (accepted ADR).
- next.config.ts: partialPrefetching: true; images: { unoptimized: true } as the mechanism for "hotlink, never store". next build prints "Cache Components enabled" and "Partial Prefetching enabled" and compiles. In the dev server a listing card with a remote photo (answered by Playwright, no real network) kept the source URL as its src, with no srcset and no /_next/image request, in its 112 x 84 frame; remotePatterns was not needed.
- globals.css: the placeholder font stack drops Vazirmatn (the owner does not want it) for Persian-capable system fonts; a base-layer rule gives enabled buttons and role="button" elements cursor: pointer and disabled or aria-disabled ones the arrow. Computed in the dev server: pointer (button, role=button, link), default (disabled, aria-disabled, aria-disabled role=button).

Rules and docs: craft.md (stagger, photos, font loading, spinner minimum, Partial Prefetching, cursor, weight 500, trim codes, section 7 intro, hierarchy weights, ViewTransition tests), persian-type-formatting.md, motion.md, next-app-router.md (prefetch and next/image), react-patterns ui-craft.md (ListingCard aboveTheFold prefetch and hotlink comment, list passes it; re-linted and type-checked in place, then the probe files were removed), data-and-actions.md heading, ADR-0008 point 4 (proposed, so edited), the research note's "Decisions taken by the owner on 2026-09-26", docs/learnings.md. Notes appended to CS-3 (bought font, re-measurement with lab/, loading strategy, weight 500, trim codes, duration token namespace), CS-5 (record each source's stance on hotlinked photos) and CS-16 (hotlinked photos, prefetch={true} for the first screen's cards, spin-delay, stagger, cursor).

Checks: pnpm check passed (lint, lint self-test 8 samples, typecheck app and e2e, unit tests, formatting); pnpm e2e 54 passed with the 4 intentional self-check skips (the app is built with next build and started for the app projects).

task-reviewer pass (2026-09-27): AC2, AC3 and AC5 met; AC1 and AC4 partly met; one correctness clash and three convention points. All fixed:
- AC1: the research note no longer calls the stagger order open (table row 9, disagreements); decision 1 says unit tests run the stable release of the 19.3 line whose canary the pages run (not "the same React").
- Partial Prefetching against the photo morph: craft.md, ui-craft.md §6, the note's row 15 and next-app-router.md now say params sit behind Suspense and prefetch={true} brings only 'use cache'd content, so the listing read is cached and the first screen's cards prefetch it. The notFound rule notes that a missing listing read behind Suspense gets HTTP 200 plus noindex; CS-17 carries that decision.
- AC4: e2e/tests/app/base-styles.spec.ts asserts the hand on an enabled button, an input submit and a role=button, and the arrow on aria-disabled, disabled and aria-disabled role=button (2 passed on the production build; with the rule removed it failed: expected pointer, received default). input buttons were added to the rule, and a lint restriction rejects cursor-* classes (proven in the lint self-test).
- ADR-0003 fixes exact versions, so ADR-0009 (accepted, the owner's decision) supersedes its React pin; ADR-0003's status and the index say so.
- Stale font text: craft.md no longer says "use standard Vazirmatn" (any font's standard build over a "UI" build; patching metrics only if the licence allows modifying the font); craft-checks.js reports the body's first family instead of Vazirmatn.
- CS-3's notes now separate the owner's decisions from CS-26 findings.
- A hotlinked photo that fails to load now shows the same-size placeholder: ListingPhoto (client, onError) in the react-patterns card pattern; in the dev server a 404 photo showed «بدون عکس» in the 112 x 84 frame and a 200 photo the image (lint and typecheck clean in place, probe removed).
- Open question recorded on CS-5: whether the crawler may download photos transiently (for duplicate detection or extraction) is not settled by the display decision.

Final checks: pnpm check passed (lint, lint self-test 8 samples, typecheck app and e2e, unit tests, formatting); pnpm e2e 56 passed with the 4 intentional self-check skips.

Owner revision of 2026-09-27: decisions 3 (hotlink, never store) and 4 (Partial Prefetching on) were replaced by storing downloaded photos in ArvanCloud Object Storage (ADR-0010) and turning Partial Prefetching off; applied in CS-28.

Moved to Done on the owner's explicit instruction (2026-09-27).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Applied the owner's ten decisions of 2026-09-26 to the rules, the ADRs and the code.

- React 19.3.0 for the app and its unit tests; ADR-0009 supersedes ADR-0003's pin. A Vitest render of <ViewTransition> passed.
- Partial Prefetching is on in next.config.ts. The prefetch rules say params sit behind Suspense, and that the first screen's cards prefetch cached listing content so the photo morph still forms.
- Listing photos are hotlinked and never stored: images.unoptimized in next.config.ts, recorded in ADR-0008 point 4. The card pattern's ListingPhoto shows the same-size placeholder when a source photo fails.
- The hand cursor on enabled buttons comes from one globals.css rule, guarded by a new e2e test and a lint ban on cursor-* classes.
- The placeholder font stack no longer names Vazirmatn; the font the owner will buy is left to CS-3.
- Weight 500 for small labels, stagger order, trim codes, spin-delay and hit-area measuring are stated in the craft, type and motion rules. CS-3, CS-5, CS-16 and CS-17 carry the decisions and open points they need.

Verified with pnpm check, pnpm e2e (56 passed), next build ("Partial Prefetching enabled"), and browser checks of the cursor, the hotlinked photo and its fallback. The task-reviewer's findings were fixed.
<!-- SECTION:FINAL_SUMMARY:END -->
