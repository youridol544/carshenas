---
id: CS-3
title: Define RTL and Farsi UI foundations and the design language
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-27 17:28'
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
- [x] #1 Font choice and loading strategy are decided and documented, and the font is self-hosted
- [x] #2 A number and date formatting utility renders Persian digits and Jalali dates in the UI and Latin digits in data, following CS-2
- [x] #3 docs/design/design-language.md defines the tokens the ui-design skill reads (colour pairs with recorded contrast ratios, type roles with Persian line heights, spacing, radii, motion durations and the five deal-rating colours), and the token lint is switched on with those names
- [x] #4 The not-found and error pages render Farsi copy with Persian digits in right-to-left layout and link back to the home page
- [x] #5 A sample page renders correctly right to left on a phone-sized viewport, with visual baselines regenerated in the official container
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Typeface (owner bought Yekan Bakh 4 Pro on 2026-09-27 after a survey of all 140 Fontiran fonts): self-host the variable woff2 through next/font/local from src/components/layout/app-font.ts, adjustFontFallback false, Persian-capable fallbacks, display chosen by measured layout shift. The file is licensed per site, fingerprinted to the buyer and never committed: gitignored, docs/runbooks/licensed-font.md, init.sh check. Research note for the survey and licence; ADR for the typeface and its handling.
2. Locale and formatting in src/lib (plain Intl instances created once, arguments required, unit tests under TZ=UTC): locale.ts (+ drift test against the runtime), toman.ts (ADR-0014 full digits, estimate, words, compact on scales), format-number.ts, format-date.ts (Jalali forms, time ago with an explicit now, Tehran ISO day) with the leap-list pin test, digits.ts (normalise typed digits to Latin), bidi.ts (isolate for plain-text contexts only).
3. Design language: docs/design/design-language.md and tokens in globals.css in three tiers (primitives on :root, roles through Tailwind namespaces so only role utilities exist): colour pairs with computed contrast, the five-level deal ramp (greyscale and deuteranopia checked), type roles with Persian line heights re-measured on Yekan Bakh with the lab, spacing steps, radii, elevations, motion durations and easings. Token lint on: better-tailwindcss/no-unknown-classes plus spacing-step restriction, with lint self-test samples.
4. Pages: root layout from locale constants and the font variable; Farsi not-found, error and global-error pages with Persian digits and a link home; a design-language sample page at phone width.
5. Evidence: unit tests, Playwright specs for the new pages (RTL, digits, link home, overflow, axe), layout-stress and gorilla coverage, visual baselines regenerated in the official container, /verify-ui screenshots, design-reviewer and task-reviewer passes.
6. Docs: ui-design references (fonts, tokens, rtl-bidi corrections from the RTL research, shadcn RTL caveats), next-app-router font rule, learnings.
Owner review: the palette and overall look are judged by the owner on the sample page (/design) as part of In Review; taste is never self-approved.
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

Slice 5 (review fixes, 2026-09-27). The design review (design-reviewer) and the task review (task-reviewer, at 0c9d30d) found these; each is fixed and re-verified:
- «تومان» split mid-word at 320 px, because wrap-anywhere sat on whole Persian strings. NumericText (src/components/ui/numeric-text.tsx) marks only digit runs. The display sample is a short figure: a full-digit price measured 293.7 px at 36 px against the 288 px of a 320 px phone, so design-language.md section 2 now sets the price hero at text-title and at text-display only from a 24rem container. inspectLayout reports brokenWords (a Persian word whose letters sit on two lines). The stress matrix checks it at every width and at double text size, and the harness self-check plants a split word, a whole word and a long number. As a mutation check, restoring the old display sample made the width sweep fail at 320 px on «تومان».
- The tabular column aligned the wrong edge: text-start now lines up the units digit, and the table keeps its own width (self-start in the flex column).
- Four weights on the sample card: now 400 and 600, and the badge is its own component (DealBadge, which also replaces two copies of the badge classes).
- Button drift: ActionLink and actionClasses (src/components/ui/action-link.tsx) hold the three levels; primary and secondary are 48 px on every page.
- Spelling against the glossary: «ه‌ی» for the ezafe and «جست‌وجو» in copy and tests. Intl's own «هفتهٔ گذشته» stays as the runtime prints it.
- Literal invisible characters in source: written as escapes, and a lint rule with the bad-invisible sample rejects them. The rule's own pattern had been saved with literal characters, which is how the new AGENTS.md gotcha was found.
- Unequal ramp bands: five equal bands from an 18rem container (the widest word, «خیلی گران», is 50.2 px), stacked below it.
- Stale baselines (task review): a bare --update-snapshots keeps any image within the 1% tolerance, so the committed /design images still showed «٪» on the wrong side. Regenerated with --update-snapshots=all in mcr.microsoft.com/playwright:v1.63.0-noble; test:visual:update and the docs now use =all.
- Compact range with a Latin tilde («~۱٫۲ میلیارد») when both ends round alike: both range formatters print one value, and a backwards range throws. Tests added.
- Lint gaps: every leading-* class and durations or delays by number are rejected; a CSS percentage built inside a style attribute passes (clean-percent-style sample).
- The craft check flagged the display role's 1.3: its unconditional floor is now 1.3, and clipped text is still held to 1.5.
- global-error.tsx had no link home: it has ActionLink secondary, and its test checks the link.
- CI cannot build without the licensed font: CS-22 and CS-23 now say so and point to docs/runbooks/licensed-font.md. No GitHub repository exists yet (CS-21), so no workflow has run.
Found while verifying:
- NumericText puts the digits of «۸٪» in their own span, and the percent-order check only paired a sign with a digit in the same text node, so the /design format row had dropped out of the guard. The check now pairs a sign with the character before it across text nodes. The harness self-check plants a split typed and a split formatted «۸٪». As a mutation check, removing the right-to-left mark from formatPercent made the width sweep report all three percentages on /design, the format row included.
- The first seeded gorilla run (seed 20260921, as in CI) failed once, and the replay passed: focus lost on «جست‌وجوی خودرو» after a double-tap navigated home. A timing race in the navigation exemption: Next.js hides the page it leaves in an Activity, and the browser moves focus off it only at its next rendering step, so the next action could record the hidden link with the new address. The oracle now records the address at the latest focusin, so a navigation since the element was focused is never reported. A real focus loss on the same page is still caught (gorilla self-check).
Checked and left alone: the middle dot «·» in meta lines against the Persian zero (in Yekan Bakh «۰» is a hollow oval and «·» a solid dot; the confusion came from a downscaled screenshot), and «٫» against «٬» (a slanted stroke against a curled comma).
Evidence:
- pnpm check exit 0: lint, lint self-test with 15 samples, migration lint, hook tests, typecheck, 107 unit tests, Prettier.
- E2E_WEBKIT=1 pnpm e2e: 104 passed, 6 skipped. The skips are the double-text test on WebKit (it needs a Chromium DevTools call) and four self-checks that fail on purpose.
- pnpm e2e:visual --update-snapshots=all, then a clean pnpm e2e:visual: 6 of 6 passed. All four new baselines were opened and read.
- The route error page in a browser, through a temporary throwing route that was then deleted: lang fa, dir rtl, «۵۰۰» and no Latin digits; retry and the home link are both 48 px; no sideways scroll; the link leads home.
- pnpm gorilla --selfcheck: 12 of 12, every planted defect caught. pnpm gorilla --seed 20260921 --runs 40 --budget 300 --project both, as in CI: 160 runs on home and /design, phone and desktop, no findings, after the oracle fix.
- Browser suite again after the inspector and oracle fixes: E2E_WEBKIT=1 pnpm e2e, 104 passed, 6 skipped.
- No font, PDF or env file is tracked or added on the branch; the font file is ignored (.gitignore line 27), and a scan of the branch diff finds no credentials.

Slice 6 (second review round, 2026-09-27). The design re-review and the task re-review confirmed every earlier finding fixed and all criteria met, and found these; each is fixed and re-verified:
- NumericText let «تومان» fall to a line of its own at larger text (412 px at 200 %, 320 px at 150 %) and broke digits inside a group («۶۸۰٬۰۰۰٬۰۰» then «۰ تومان»): its wrap-anywhere span ended just before the no-break space. It now keeps each digit group on one line and the last group with its unit, inside a wrap-anywhere unit, so the only emergency break is after a thousands mark («۶۸۰٬۰۰۰٬» then «۰۰۰ تومان»). inspectLayout reports brokenNumbers: two Persian digits of one group, or the two sides of a no-break space, on different lines. The stress matrix checks it at every width and at double text size; the harness self-check plants a split group, a unit split at its no-break space, and the NumericText shape, which must pass. With the old NumericText restored, the double-text test reported both card prices and two rows of the digit column. A one-off run at 320 px with 150 % and 200 % text found no sideways scroll, clipping, split word, split number or misplaced sign on / and /design. The text inflater leaves NumericText alone, because a formatted number grows by digits.
- The gorilla's focus-lost check ignored any address change, query and hash included: the probe since d24de05 and the run loop since CS-1 both compared whole addresses, so a focus loss that also rewrote the query (a filter kept in the address, as in CS-16) went unseen in 60 runs. Both compare paths now. The lab page gains the planted focus-query defect, and the self-check catches it.
- «۱ هزارمیلیارد» for 999.5 billion tomans: the «میلیارد» path is chosen on the value rounded to three significant digits, in the label and the range.
- The important modifier (!leading-4, duration-300!) got past every class rule; it is rejected on its own.
- Doc drift: design-language.md gave a card's price weight 700; it is 600, so a card keeps to two weights.
- Numbers stay with their words (craft.md V-30): the samples tie «تیپ ۲», «مدل ۱۴۰۰», «۴۲ آگهی» and the phone groups with no-break spaces, formatMileage writes «۱۲۰٬۰۰۰ کیلومتر», and formatTimeAgo holds its number to its unit («۳ ساعت پیش», which the design re-check saw split at 320 px with 150 % text). Dates keep the spaces Intl writes.
- Three colour tokens were outside sRGB (--blue-3, --red-3, --deal-5). Browsers clip each channel, so «خیلی گران» painted #ffcec8 while the contrast test computed the chroma-reduced #ffd1cd. The tokens now carry their in-gamut chroma, which paints exactly the recorded hex values, so every recorded ratio stands (the palette lab reproduces them). The contrast library and the palette lab refuse an out-of-gamut colour, and a test holds every token in globals.css to sRGB; with the old --deal-5 restored, it names the token.
- The route error page names itself in the document title on a fresh load. After a client-side navigation Next.js inserts the failing page's metadata title first, and it still wins (checked in Chromium).
Evidence:
- pnpm check exit 0: 110 unit tests, lint self-test with 15 samples, typecheck, Prettier.
- E2E_WEBKIT=1 pnpm e2e: 106 passed, 6 skipped.
- pnpm e2e:visual --update-snapshots=all, then a clean pnpm e2e:visual: 6 passed. Only the /design images changed, in three places compared old against new: the «خیلی گران» badge and ramp band, and the «کنش ملایم» surface.
- pnpm gorilla --selfcheck: 13 of 13. Seeds 20260921 (as in CI) and 20260927: 160 runs each, no findings.
Round three (verification of these fixes):
- Design reviewer: /design, / and the 404 at 320, 412 and 1440 px, each at 100, 150 and 200 % root size, 27 combinations. Numbers break only after «٬», «تومان» never leaves its last group, nothing scrolls sideways, and the in-gamut fills paint within one 8-bit step of the recorded values. Its mutation check caught the old markup. Verdict: ready for evidence.
- Task reviewer: its planted focus losses with a query rewrite and with a hash change are both caught. It found no «هزارمیلیارد» in 84,864 compact outputs, all 11 important-modifier forms are rejected, and baselines regenerated from HEAD are byte-identical. Verdict: ready for In Review.
- Known limit: the focus-lost exemption compares the path before and after one action, so a path that changes and comes back within a single action (a double tap through /lab/index.html and back to /lab/) is reported. That errs towards a false alarm, which the gorilla's replay marks as flaky.
Final runs at 1434154: pnpm check exit 0 (110 tests). E2E_WEBKIT=1 pnpm e2e: 106 passed, 6 skipped. pnpm e2e:visual --update-snapshots=all changed no baseline, then pnpm e2e:visual passed 6 of 6. Gorilla with seed 20260921: 160 runs, no findings.
Left for the owner:
- the palette, the ramp's direction and the overall look on /design;
- «خیلی گران» shares the error red's hue;
- the «۴۰۴» and «۵۰۰» presentation and the status copy (the 404 asks people to search from a home page that has no search yet);
- the Latin in «BMW X3 xDrive30i», and «٪» on the left;
- whether VoiceOver on a real iPhone reads a card price split into digit groups as one number;
- registering the web licence before any deploy (CS-23).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Settled the Farsi, right-to-left foundations every screen builds on.
- Typeface: Yekan Bakh 4, bought by the owner (ADR-0015), self-hosted through next/font/local with swap and preload, a choice made by measured layout shift. The licensed file stays out of git (docs/runbooks/licensed-font.md).
- Formatters in apps/web/src/lib: locale constants checked against the runtime; the three amount forms of ADR-0014; counts, mileage and percentages (formatPercent keeps «٪» to the left of its number); Jalali dates pinned to the official leap list; digit normalisation; bidi isolates.
- Design language: docs/design/design-language.md and globals.css define the tokens:
  - colour pairs, their contrast held by a test and every token inside sRGB;
  - type roles with line heights measured on Yekan Bakh;
  - spacing, radii and motion;
  - the five-level deal ramp.
  Lint rejects Tailwind's own scales, raw values, hand-set line heights and durations, the important modifier, typed percentages and literal invisible characters.
- Pages and primitives: Farsi 404, route error and global error pages, with Persian digits and a way home; /design as the living sample; NumericText (a long number breaks only after a thousands mark, never away from its unit) and ActionLink.
- Guards: the layout inspector fails a split Persian word, a split digit group, a break at a no-break space and a percent sign on the wrong side. Planted defects and mutation checks prove each one.
Verified at 1434154:
- pnpm check: 110 unit tests and 15 lint samples.
- E2E_WEBKIT=1 pnpm e2e: 106 passed; the 6 skips are expected.
- Baselines regenerated in the official Playwright container and compared clean, 6 of 6.
- Gorilla self-check 13 of 13; seeds 20260921 and 20260927, 160 runs each, no findings.
Two rounds of design and task review: every finding is fixed, and the reviewers re-verified the fixes. Left for the owner: the palette and overall look, the status copy, VoiceOver on a real iPhone, and registering the web licence before any deploy.
<!-- SECTION:FINAL_SUMMARY:END -->
