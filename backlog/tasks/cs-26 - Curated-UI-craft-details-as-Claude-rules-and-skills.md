---
id: CS-26
title: Curated UI craft details as Claude rules and skills
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 10:56'
updated_date: '2026-09-26 19:47'
labels:
  - design
  - research
  - dx
milestone: m-1
dependencies: []
references:
  - docs/research/2026-09-26-ui-craft-details.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants the small details that together make a product feel good, gathered from practitioners with real industry standing and turned into rules Claude follows: interruptible motion, no layout shift, icons whose stroke matches the text, empty states with an action, Persian line heights per text role, touch targets, optimistic updates, restrained colour, skeletons, staggers ordered by importance, reduced motion for weak devices, tooltip delay groups, tabular numbers, scroll fades, safe hover areas for menus, morphs, shared-element transitions for galleries, origin-aware popovers, rubber-banding and icon cross-fades, plus more of the same calibre from the people who state these. The ui-design skill and its vendored guidance already hold parts of this, but as long reading that is rarely opened, not adapted to Farsi right-to-left, and partly unverified (the existing body line height of 1.7 disagrees with the owner's 1.4 to 1.6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A research note in docs/research gives every detail with its source (author, title, link, date) and a short quote or a stated reason, covers every example the owner gave, and records which sources independently state the owner's examples
- [x] #2 The ui-design skill has a craft reference organised by topic, each rule with its reason, exact values or APIs and source, adapted to right-to-left Persian
- [x] #3 .claude/rules/ui.md states the craft rules every UI file must follow in short form, and AGENTS.md points Claude to them
- [x] #4 The react-patterns skill shows reusable skeleton, optimistic update, tooltip delay group and transition patterns for the React and Next.js versions installed here
- [x] #5 The design-reviewer rubric checks every craft detail that can be measured, naming the evidence each needs
- [x] #6 Where sources disagree with the existing rules or the owner's examples, such as Persian line height, the note records the disagreement and the rules follow the evidence
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Map what the ui-design skill, its vendored sources and react-patterns already say about each of the owner's examples.
2. Research in parallel passes by topic: motion; layout stability, loading and optimistic updates; pointer, touch and keyboard; visual craft; Persian typography. Each pass gives sources, short verbatim quotes and which sources independently state the owner's examples. A separate pass finds the practitioners whose published guidance matches most of the owner's list and harvests their other details.
3. Fact-check: re-open a sample of the cited sources to confirm quotes, values and API names; check library APIs against the installed React 19.2 and Next.js 16.3.5.
4. Write docs/research/2026-09-26-ui-craft-details.md (questions, sources, taste-match table, findings by topic, disagreements, recommendation) and index it.
5. Write the craft reference in the ui-design skill; correct motion, states and Persian type references and the skill's non-negotiables where the evidence changes them.
6. Add React and Next.js patterns to react-patterns: skeletons, optimistic updates, tooltip delay groups, transitions, reduced motion.
7. Put the must-follow short rules in .claude/rules/ui.md, point AGENTS.md to them, and extend the review rubric and the design-reviewer agent with the measurable checks.
8. Verify with pnpm check and a task-reviewer pass, then finish at In Review.

9. Added during the work, disclosed for review: enforce what code can check (globals.css hover variant and scrollbar gutter; four lint class restrictions proven in the lint self-test; the layout stress test measuring hit areas, with negative controls; verify-ui/craft-checks.js), prove the React patterns in the dev server, and fix every task-reviewer finding.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research (2026-09-26): six parallel passes (motion; layout stability, loading and optimistic updates; pointer, touch and keyboard; visual craft; Persian typography with hands-on font measurements; taste match). Every source fetched, quotes verbatim and at most 25 words. Kept unedited apart from local paths in docs/research/2026-09-26-ui-craft-details/ (M-, L-, I-, V-, T-, H- IDs), summarised in docs/research/2026-09-26-ui-craft-details.md and indexed.

Taste match: Vercel Web Interface Guidelines 10.5, Apple 10, Jakub Krehel 8.5, Emil Kowalski 8, then Adam Argyle and Rauno Freiberg 6. No source states owner example 9 (most valuable first); IBM Carbon says the opposite. Rule: reading order grouped by importance; the choice for choreographed sequences is left to the owner.

Persian line height, measured in Chromium 153 with Vazirmatn 33.003 and Estedad 8.5 and checked against Material 3's Arabic tokens: reading text 16 px at 1.7 (floor 1.6; Estedad 1.75), secondary 14 px at 1.65, controls, meta and clamped titles 1.5 (never below 1.3), headings 1.5 at 20 px down to 1.3 from 36 px. The owner's 1.4 to 1.6 is right for UI text and headings and is Vazirmatn's body floor; the old "body line height at least 1.7 everywhere" is replaced in ui.md, the ui-design non-negotiables, persian-type-formatting.md and tokens.md.

Built: ui-design references/craft.md (seven sections, sourced); react-patterns references/ui-craft.md; verify-ui craft-checks.js; rubric rows M to S and three tells; design-reviewer and /verify-ui craft measurement steps; ui.md craft invariants; AGENTS.md and CLAUDE.md pointers; corrections in motion.md (14), states-a11y.md, rtl-bidi.md, mobile-forms.md, data-and-actions.md §4 and §5, server-actions-data.md, next-app-router.md, VENDORED.md.

Enforced in code: globals.css limits Tailwind's hover: to (hover: hover) and (pointer: fine) and sets scrollbar-gutter: stable. The lint now rejects physical mask edges, leading-none and leading-tight, any text-*/* slash (an alpha text colour or a per-use line height) and transition-all; each is proven in the lint self-test sample. e2e/gorilla/layout.ts: a control whose box is under the minimum passes only if its hit area answers at the edges (WCAG 2.5.8 measures the target), with a new harness negative control; the existing positive control (a 16 px button) still fails as before.

Verified in the browser (next dev, headless Chromium; the probe files were removed afterwards and archived outside the repo). Skeleton pattern: the first run showed real rows 145 px against skeleton rows 125 px (the facts line wrapped) and 4:3 thumbnails stretched to the row height. After fixing the frame (fixed line count per slot, self-start on the photo frame), skeleton rows and real rows were both 145 px, frames 112 x 84 px, layout shift 0, the skeleton invisible when mounted and faded in after the delay, and the console clean. Optimistic save: flipped 25 ms after the tap and held with updateTag; with revalidateTag(tag, 'max') it flipped at 20 ms and jumped back at 451 ms, and a reload still served the stale value. A failed save rolled back within 200 ms and showed «این آگهی دیگر در دسترس نیست» with «تلاش دوباره». Tooltip group: closed at 300 ms, open at 750 ms, neighbour instant, delayed again after the 400 ms window; hoverable onto the bubble; Escape closed it without moving focus; keyboard focus opened it at once and a click did not; no tooltip on a touch tap. craft-checks.js on a page with planted defects reported each one (24 px button, line heights 1.2 and normal, paragraph at 1.4, layout shift 0.0229, an off-budget indigo, a shimmer still moving under reduced motion). The documented test snippets were type-checked in e2e/ and run in Chromium: layout shift 0.0229 caught, the shimmer caught under reduced motion, an image with width/height kept its box (285 px) while one without collapsed to 0.

task-reviewer pass (2026-09-26): AC1, AC2, AC3 and AC6 met; AC4 and AC5 partly met, with eight findings. All were fixed and verified:
- Rubric gaps: new rows T (tooltip delay group) and U (safe-triangle submenus, popover origin); row D now names alpha text colours (craft-checks.js reports them, verified on a planted rgba(0,0,0,.5) paragraph) and link underline offset; row I names the 500 ms drag settle. The matching craft.md rules carry **Measure**.
- Image-hold snippet: with the default load wait, goto timed out on an eager image (reproduced); with waitUntil 'domcontentloaded' it returned the reserved 300 px box.
- Duration tokens: Tailwind 4.3.3 builds duration-press only from --transition-duration-press (compiled both ways: --duration-press gives no class). Tokens renamed to --transition-duration-* in motion.md, tokens.md, craft.md and ui-craft.md; tokens.md explains the namespaces.
- Thrown actions: the optimistic toggle and the undo list now catch a rejected action. Reproduced first: without the catch, a server error flipped the bookmark back with no toast and only an uncaught page error; with it, the toast shows «نشان نشد…» with a retry.
- Focus: pressing «حذف» moves focus to the next row's button before the row leaves (verified by keyboard; it stayed there after the row left); the toast returns focus to where it came from after its own button disappears (verified: back on the previous row's button, and the row restored).
- FilterChip check icon stroke 2 on the 24 grid (1.33 px at 16 px, the label's stem), was 1.0 px.
- Negative control: a hit area placed beside the control (inset-inline-start: 50% plus a translate, the RTL bug) is still reported too small; harness 24 passed.
- Wording: craft.md probes 21 px from the centre (was 22); the tooltip text is hidden from screen readers when it repeats the name, and wired with aria-describedby only when it adds information; ui.md and rubric row I include the 500 ms drag settle.

Final checks after the review fixes: pnpm check passed (lint, lint self-test with 8 samples, typecheck for app and e2e, unit tests, formatting); pnpm e2e 54 passed with the 4 intentional self-check skips (mobile and desktop app tests including the layout stress matrix, both fixture projects, 12 layout self-checks each). Before the fixes, which touched neither: pnpm gorilla --selfcheck 12 passed, pnpm capture:test 17 passed. No UI screen changed, so no design-reviewer pass applies; the owner decisions are listed in the research note.

Moved to Done on the owner's explicit instruction (2026-09-26).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gathered the small interface details that make a product feel good from six cited research passes. The practitioners whose published work independently states most of the owner's seventeen examples score highest: Vercel's Web Interface Guidelines 10.5, Apple 10, Jakub Krehel 8.5, Emil Kowalski 8. Their details were adapted to a Farsi, right-to-left, phone-first app.

- ui-design references/craft.md: the sourced checklist in seven sections (motion, layout stability, waiting, optimistic updates and undo, touch and keyboard, visual restraint, Persian type).
- ui.md, AGENTS.md and CLAUDE.md point to it; the skill's non-negotiables, motion, states, type, token and form references are corrected where the evidence disagreed.
- Persian line height is now set per role and measured: reading text 1.7, controls and clamped titles 1.5, headings from 1.5 down to 1.3. It replaces "at least 1.7 everywhere".
- react-patterns references/ui-craft.md: skeleton frame, pending chip, optimistic save with updateTag, undo, tooltip delay group, photo morph and motion hooks.
- The review rubric has rows M to U, with verify-ui/craft-checks.js as its measurement script.
- Enforced in code: the hover variant and scrollbar gutter in globals.css; four lint restrictions; the layout stress test now measures hit areas.

Verified with pnpm check, pnpm e2e (54 passed), the gorilla self-check (12) and browser probes of every React pattern: skeleton and real rows 145 px with layout shift 0; the bookmark held with updateTag but jumped back at 451 ms with revalidateTag(tag, 'max'); tooltip timings as specified. The task-reviewer's eight findings were fixed and verified. Ten decisions are left to the owner in the research note, including the React 19.3 pin, stagger order and how source photos are served under ADR-0008.
<!-- SECTION:FINAL_SUMMARY:END -->
