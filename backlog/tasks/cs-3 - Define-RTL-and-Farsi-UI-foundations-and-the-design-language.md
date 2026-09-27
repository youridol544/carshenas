---
id: CS-3
title: Define RTL and Farsi UI foundations and the design language
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 14:59'
labels:
  - design
  - i18n
  - frontend
milestone: m-1
dependencies:
  - CS-2
references:
  - docs/decisions/0005-styling-and-component-primitives.md
  - .claude/skills/ui-design/SKILL.md
  - docs/decisions/0015-yekan-bakh-self-hosted-never-committed.md
  - docs/design/design-language.md
  - docs/research/2026-09-27-persian-typeface.md
  - docs/research/2026-09-27-rtl-and-locale-architecture.md
  - docs/runbooks/licensed-font.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every screen is Farsi and right-to-left. Font, digit and date rendering, logical CSS, bidi handling of mixed content (VINs, URLs, Latin model names) and a base layout must be settled once so feature tasks do not each reinvent them. The ui-design skill refuses to invent a palette until docs/design/design-language.md exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Font choice and loading strategy are decided and documented, and the font is self-hosted
- [ ] #2 A number and date formatting utility renders Persian digits and Jalali dates in the UI and Latin digits in data, following CS-2
- [ ] #3 docs/design/design-language.md defines the tokens the ui-design skill reads (colour pairs with recorded contrast ratios, type roles with Persian line heights, spacing, radii, motion durations and the five deal-rating colours), and the token lint is switched on with those names
- [ ] #4 The not-found and error pages render Farsi copy with Persian digits in right-to-left layout and link back to the home page
- [ ] #5 A sample page renders correctly right to left on a phone-sized viewport, with visual baselines regenerated in the official container
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Typeface (owner bought Yekan Bakh 4 Pro on 2026-09-27 after a survey of all 140 Fontiran fonts): self-host the variable woff2 through next/font/local from src/components/layout/app-font.ts, adjustFontFallback false, Persian-capable fallbacks, display chosen by measured layout shift. The file is licensed per site, fingerprinted to the buyer and never committed: gitignored, docs/runbooks/licensed-font.md, init.sh check. Research note for the survey and licence; ADR for the typeface and its handling.
2. Locale and formatting in src/lib (plain Intl instances created once, arguments required, unit tests under TZ=UTC): locale.ts (+ drift test against the runtime), toman.ts (ADR-0014 full digits, estimate, words, compact on scales), format-number.ts, format-date.ts (Jalali forms, time ago with an explicit now, Tehran ISO day) with the leap-list pin test, digits.ts (normalise typed digits to Latin), bidi.ts (isolate for plain-text contexts only).
3. Design language: docs/design/design-language.md and tokens in globals.css in three tiers (primitives on :root, roles through Tailwind namespaces so only role utilities exist): colour pairs with computed contrast, the five-level deal ramp (greyscale and deuteranopia checked), type roles with Persian line heights re-measured on Yekan Bakh with the lab, spacing steps, radii, elevations, motion durations and easings. Token lint on: better-tailwindcss/no-unknown-classes plus spacing-step restriction, with lint self-test samples.
4. Pages: root layout from locale constants and the font variable; Farsi not-found, error and global-error pages with Persian digits and a link home; a design-language sample page at phone width.
5. Evidence: unit tests, Playwright specs for the new pages (RTL, digits, link home, overflow, axe), layout-stress and gorilla coverage, visual baselines regenerated in the official container, /verify-ui screenshots, design-reviewer and task-reviewer passes.
6. Docs: ui-design references (fonts, tokens, rtl-bidi corrections from the RTL research, shadcn RTL caveats), next-app-router font rule, learnings.
Owner review: the palette and overall look are shown on the sample page for approval before In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner decisions of 2026-09-26 (applied in CS-27; docs/research/2026-09-26-ui-craft-details.md, "Decisions taken by the owner"):
- Font: the owner will buy a commercial Persian font instead of Vazirmatn and choose it with Claude from options the owner brings. Check that its licence allows self-hosting on the web, and whether it allows modifying the font (patching vertical metrics needs that). The loading strategy (swap with preload, or optional) is decided together with the font, by measuring layout shift; Next.js's automatic fallback is Latin-only, so name Persian-capable fallbacks (globals.css already uses system-ui, Segoe UI, Tahoma, Geeza Pro, Noto Naskh Arabic).
- Weight 500 is allowed for 12 to 13 px labels if the font has it; Latin trim codes are judged on real listing titles with the bought font before adding any size-adjust face.

Findings from CS-26 and CS-27 to follow here (not owner decisions):
- Re-measure for the bought font with docs/research/2026-09-26-ui-craft-details/lab/: line heights per role (lab-equiv.js, lab-clip.js), label centring (lab-button.js), text-box trimming (lab-trim.js), stems for icon strokes (lab-stem.js) and vertical metrics (metrics.py). The ui-design craft.md section 7 values were measured on Vazirmatn and Estedad.
- Duration tokens use Tailwind's namespace (--transition-duration-*), or duration-* classes are not generated (ui-design motion.md).

CS-2 (2026-09-27, ADR-0014, proposed): the formatting utility of #2 has three amount forms. Full digits for every price and value («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان»; stated amounts exact, estimates rounded to three significant digits); mixed words inside sentences («۱ میلیارد و ۲۵۰ میلیون تومان»); compact only on scales (notation compact, compactDisplay long, maximumSignificantDigits 3; ranges with «تا»; stop at «میلیارد»). Dates follow ADR-0014 point 5, always with timeZone Asia/Tehran; weekday and month-year forms are built from parts. Add a unit test that pins the runtime Intl persian calendar to the official leap list in docs/research/2026-09-27-money-and-jalali-calendar/lab/kabise-1206-1498.txt (CC0), so an ICU upgrade that moves a date fails CI. Recheck that the thousands mark U+066C looks like a comma in the purchased font. If this task adds React Aria date components, supply Persian strings: react-aria-components 1.21.1 has none.

Slice 1 (formatting, 2026-09-27): src/lib/locale.ts (language, direction, locale, calendar, numbering system, first day of week, time zone; a drift test derives each from the runtime Intl), toman.ts (Toman brand with the ADR-0014 bound; full digits, estimate and estimate range to three significant digits, words in sentences stopping at میلیارد, compact scale labels and chip ranges with تا and no-break spaces), format-number.ts (counts, whole percent), format-date.ts (Jalali forms from ADR-0014 with calendar, digits and Tehran zone explicit; weekday and month-year built from parts; time ago against an explicit now counting Tehran calendar days; Tehran ISO day in Latin digits for data), digits.ts (typed digits to Latin), bidi.ts (FSI/LRI isolates, only where markup is impossible). Formatters are Intl instances created once at module scope (new DateTimeFormat per call measured at 134 µs against 1 µs reused). vitest now runs in TZ=UTC like production. The leap-list test pins the runtime Persian calendar to all 293 official years (1206 to 1498). 67 unit tests pass; lint and typecheck clean.

Slice 2 (typeface, tokens, pages, lint): Yekan Bakh 4 variable woff2 (69,304 bytes, wght 100 to 950) served byte-identical through next/font/local in src/components/layout/app-font.ts with adjustFontFallback false and Persian-capable fallbacks; preloaded on every route. Licence read in the package (no copying, distribution or modification; web use needs a per-site licence); the files carry no readable buyer data (name table, WOFF metadata and private blocks checked) but the package is prepared for the buyer, so every font binary is gitignored. Measured with the lab (LAB_FONTS=yekanBakh): hhea = typo = win (1000/-550/0, line-height normal 1.55); alef stems 8.23 % at 400, 9.42 % at 500, 10.64 % at 600, 12.62 % at 700; Latin-equivalent line heights 1.55 (12 px), 1.59 (14), 1.73 (16), 1.60 (20), 1.49 (24 and 28), 1.45 (32); no ink clipped from line height 1.4 (1.2 clips 1 px at the top); labels centre within about 2 px at every line height; trim-both cap alphabetic pushes up to 10 px of ink outside a 28 px heading. U+066C renders as a comma. globals.css: primitives on :root, roles through Tailwind namespaces, Tailwind palette, sizes, radii, shadows, easings reset; lint no-unknown-classes on plus a spacing-rhythm restriction, with a bad-tokens self-test sample. Pages: not-found (404, noindex, Farsi title), error and global-error on a shared StatusScreen, /design sample page (noindex). 70 unit tests, lint, self-test and typecheck green.

Slice 3 (browser evidence, reflow, percent order): e2e specs for /design (typeface loaded and rendering, Persian digits in every format, LTR runs keep their order, 320 and 412 px without sideways scroll, axe) and for the 404 page (HTTP 404, Farsi title, Persian digits, link home navigates, axe); /design joins APP_PAGES so the stress matrix and gorilla cover it. The stress matrix found reflow failures at double text size and with long Farsi (an auto grid column swallowing free space; 13-digit prices wider than a 320 px phone at 200 %): fixed with proportional columns, a rem container query on the sample card, and wrap-anywhere on numbers so they break only instead of scrolling the page (WCAG 1.4.10). Percent sign (owner, 2026-09-27): Persian digits are bidi EN and U+066A is ET, so rule W5 pulled «٪» into the number run and showed it on the right; formatPercent now puts U+200F before the sign (rendered left of the number, measured), a no-restricted-syntax rule rejects hand-typed percentages (JSX text, strings, templates, concatenation; tests exempt; bad-percent self-test sample), and inspectLayout reports any sign rendered on the wrong side of its number on every app page (self-checked on the fixture). ignoreBrowserErrors fixture docs fixed: an array option needs Playwright's [value, options] tuple. Loading strategy measured (docs/research/2026-09-27-persian-typeface/lab/font-display-cls.mjs): swap with preload CLS 0 at up to 300 ms font delay and at most 0.033 at 1.5 s; optional keeps the fallback for the whole session after a slow first load (197.4 px vs 213.0 px after client navigation), so swap stays. Visual baselines for /design and the 404 page regenerated in mcr.microsoft.com/playwright:v1.63.0-noble (visual-docker.sh now builds the app inside the container). pnpm check and pnpm e2e (82 passed) green.

Slice 4 (docs and the contrast guard): docs/design/design-language.md (typeface, type roles with the measured Persian line heights, colour tiers, primitives, every pair with its computed contrast, the deal ramp with greyscale and deuteranopia, spacing rhythm, radii, elevation, motion, formatters, the percent rule, bidi, and what is left for the owner); src/lib/color-contrast.ts with color-contrast.test.ts, which reads globals.css and holds 25 text pairs to 4.5:1, 4 non-text pairs to 3:1 and the ramp to rising lightness (a lightened --gray-10 fails it, checked); docs/design/palette-lab; ADR-0015 (proposed); research notes on the typeface survey and on RTL and locale architecture; the licensed-font runbook, with init.sh hard-linking the font into worktrees (tried on a throwaway worktree); ui-design references, ui.md, next-app-router.md and craft-checks.js updated to Yekan Bakh values and the new rules (unicode-bidi no longer recommended; shadcn RTL caveats; percent rule); AGENTS.md map and conventions; four learnings.
<!-- SECTION:NOTES:END -->
