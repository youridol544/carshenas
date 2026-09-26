# Anti-slop review: tells, rubric and evidence bundle

Sources: Anthropic, "Improving frontend design through Skills" (2025-11-12: "Safe design choices–those that work universally and offend no one–dominate web training data. Without direction, Claude samples from this high-probability center") and the Claude Opus 4.8 prompting guide (generic negatives "shift the model to a different fixed palette"); Anthropic on agent harnesses (2026-03-24: a standalone skeptical evaluator is "far more tractable than making a generator critical of its own work", and "A reviewer prompted to find gaps will usually report some, even when the work is sound"); Adam Wathan on indigo defaults; Impeccable reference notes ("nested cards are always wrong"; scanability and consistency outrank expression in product UI); RubSE, arXiv 2608.24138 (fixing one visual mismatch can degrade "regions that were previously faithful"; one repair target per round); Claude Code best practices ("take a screenshot of the result and compare it to the original"); Anthropic, "Out of the box, Claude is a poor QA agent"; three studies cited in the research note finding LLM-generated UI violates WCAG. Hands-on vision limits: 2026-09-18, a 2 px shift of a 160 × 60 box changed 0.07 % of pixels and was invisible to the model reading the image.

## Twelve tells of generated UI (each is a defect here)

1. **Card kit**: everything in a rounded, shadowed card; cards inside cards. Use spacing and dividers; a card is for a thing that is picked up or moved.
2. **Indigo/purple gradient defaults**, or any colour not in the tokens.
3. **Emoji as icons** or mixed icon sets with different stroke widths.
4. **Hero-page layout on product screens**: centred headline, three feature columns, giant padding. Product UI is dense, aligned to a grid, scannable.
5. **All-caps, letter-spaced eyebrows and Title Case**: meaningless for Persian and wrong for it.
6. **Physical direction leaks**: `left`/`right` classes, arrows pointing the wrong way, thumbnails on the left, steppers with `+` on the right, a progress bar filling left to right.
7. **Latin digits or Gregorian dates** in UI text; «NaN», «ناعدد», `undefined`, «Invalid Date» anywhere.
8. **Missing states**: only the happy path exists; empty and error states are an afterthought or a browser default.
9. **Magic numbers**: `text-[13px]`, `p-[18px]`, `#6366f1`, `duration-[180ms]`.
10. **Flat hierarchy**: five font sizes and four weights, or one size for everything; multiple solid buttons per screen.
11. **Placeholder-as-label** fields, `div` buttons, hover-only actions, `outline: none`.
12. **Copy that nobody would say**: transliterated English, «کلیک کنید اینجا», mixed formality, English product terms where the glossary has a word.

## Rubric (the reviewer scores each; the author self-checks first)

| # | Check | Evidence that counts |
|---|---|---|
| A | Direction: `dir="rtl"` inherited, mirroring per `rtl-bidi.md`, no physical utilities | lint clean; screenshot at 412 px shows thumbnails right, chevrons pointing left for "next" |
| B | Bidi: every phone, VIN, URL, price with Latin parts is isolated | `find` in the snapshot shows the string in the right order; a test asserts the rendered text |
| C | Persian digits and Jalali dates everywhere in UI text; data stays Latin | `rtl.expectPersianDigits()` passes; no «ناعدد» |
| D | Type: no letter-spacing/uppercase/italic; line height ≥ 1.7 body; nothing clipped | computed styles read from the page, element crop of a button and a badge |
| E | Targets ≥ 44 px, primary 48 px, 8 px gaps; inputs ≥ 16 px; zoom enabled | bounding boxes measured with `getBoundingClientRect` for every interactive element |
| F | Contrast 4.5:1 text, 3:1 controls; focus visible | axe `wcag22aa` clean; computed ratio for the pairs that matter; keyboard walk screenshot with a ring |
| G | States: loading, empty, error, long content built and looked at | one screenshot per state, or the story file listing them |
| H | Tokens only; hierarchy: one primary action, ≤ 3 text colours, 2 weights | lint clean for arbitrary values; count of solid buttons per screen |
| I | Motion: transform/opacity, < 300 ms, reduced-motion variant, none on high-frequency actions | code read; forced reduced-motion run |
| J | Semantics: native elements, headings in order, landmarks, labels outside fields | ARIA snapshot from `find`/`snapshot`; axe |
| K | No overflow at 320 and 412 px; nothing hidden under sticky bars | `rtl.expectNoHorizontalOverflow()`; scroll to the last focusable element |
| L | Reuse: nothing duplicated that `src/components/ui/` already has | grep for a second button/field/sheet implementation |

Scores: **pass**, **fix** (with the file and line, the measured value and the expected value), or **cannot judge** (taste, copy tone, brand feel, whether an illustration fits). "Cannot judge" items go to the human as "left for you to check" and are never silently passed. A review that finds nothing says so; padding a report with nitpicks to look thorough is itself a failure mode (Anthropic, 2026-03-24).

## What model vision can and cannot do

- Images are read in coarse patches; a 2 px shift is invisible, a wrong colour or a missing element is visible. So: **measure** spacing, sizes, contrast and overflow from the DOM; **look** for gross problems (wrong direction, missing states, clipped text, generic look).
- Keep every image at or below about 2000 px on the long side and prefer viewport-sized (412 × 915) or element crops; a tall full-page screenshot is downscaled until nothing is legible.
- To compare with a reference, put reference and actual side by side in one image at the same width, list the differences in words, and fix **one** thing per round (RubSE). Stop after about three rounds and hand the rest to the human; endless polish loops drift.
- The authoring model does not sign off its own aesthetics. The `design-reviewer` agent runs in a fresh context with only the rubric and the screen; the human judges taste.

## Evidence bundle (recorded on the task with `--append-notes`)

For each of 412 px and 1440 px: the screenshot filename and what was seen in one sentence; the measured numbers (overflow width, smallest target, lowest contrast pair, longest-title behaviour); axe result (violations and incompletes); the states covered; deliberate deviations from any reference (RTL mirroring, Persian type, digits, dates); the exact commands to reproduce. A screenshot nobody described is not evidence.
