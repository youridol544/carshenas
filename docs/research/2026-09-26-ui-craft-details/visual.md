# Visual craft and anti-slop: research pass for CS-26

Written 2026-09-26. Topic: icons, colour restraint, empty states, scroll fades, surfaces, spacing and defensive layout for Carshenas (Farsi, right-to-left, phone-first; Next.js 16.3.5, React 19.2, Tailwind 4.3.3). The palette is CS-3's decision, so the tips give rules and methods, not colours.

## Scope and method

- Read first, so the tips add precision instead of restating: `.claude/skills/ui-design/references/anti-slop-review.md`, `tokens.md`, `states-a11y.md`, `rtl-bidi.md`, `persian-type-formatting.md`, `listing-patterns.md`, `.claude/rules/ui.md`, the vendored `make-interfaces-feel-better/*.md` and `vercel-web-interface-guidelines.md`, and `apps/web/eslint.config.mjs`.
- Every cited page was fetched on 2026-09-26: WebFetch, curl of raw HTML or Markdown, Apple's HIG JSON, GitHub raw files and API, Wayback Machine snapshots where Medium returns 403, publish.twitter.com oEmbed for tweets, and Context7 (`/websites/m3_material_io`) for Material 3, whose site is JavaScript-only. Every verbatim quote below was re-checked by script against the raw page text (a throwaway script, not kept); quotes from Context7 are marked "via Context7".
- Hands-on checks ran in this repo's pinned Playwright 1.63.0 Chromium (153.0.8010.12), headless, with the system-installed Vazirmatn 33.003 for Persian measurements. The throwaway scripts named below as `visual-test/*.mjs` were not kept; the font-dependent measurements are repeatable with `lab/`, and the page checks with `.claude/skills/verify-ui/craft-checks.js`. The WebKit build for Playwright 1.63 is not installed and nothing was installed, so Safari and Firefox behaviour comes from MDN browser-compat-data only.
- No repository file was modified.

Owner examples in this topic: **#3** icons (search well; match stroke width and size to the adjacent text), **#4** empty states must have actions, **#7b** limit the colours in each section or page, **#12** use scroll fades properly.

Verdict in one line each:

- **#3** confirmed by Apple (Icons, SF Symbols), Material 3, Jakub Krehel and Vercel; sharpened: measure the font's stem, and Lucide v1 deprecates `absoluteStrokeWidth` (V-2, V-3).
- **#4** confirmed by NN/g, IBM Carbon, Vercel Geist, GitHub Primer, Atlassian, Rauno Freiberg and Vercel's guidelines; corrected: the rule is "no dead ends", and an all-clear state may have no action (V-11).
- **#7b** confirmed by NN/g, Refactoring UI, Apple and Linear; clarified: the limit is per view, while the palette itself needs many shades (V-15).
- **#12** confirmed by Chrome's guidance, Apple (scroll edge effects) and NN/g (overflow cues); sharpened: a fade appears only where content remains, never covers the last item, and needs an `@supports` guard (verified; V-21).

## Sources consulted

| # | Source (author; why credible) | URL | Date | Fetched | Owner examples it states independently |
|---|---|---|---|---|---|
| S1 | Adam Wathan & Steve Schoger, "7 Practical Tips for Cheating at Design" (Refactoring UI; creators of Tailwind CSS) | https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886 | 2018-02-20 | yes (Wayback snapshot 2026-09-07; Medium returns 403) | #7b (two or three text colours), #3 (icon size) |
| S2 | Refactoring UI, "Building Your Color Palette" (book preview) | https://refactoringui.com/previews/building-your-color-palette | undated | yes | none (palette context for #7b) |
| S3 | Refactoring UI, "Labels are a last resort" (book preview) | https://refactoringui.com/previews/labels-are-a-last-resort | undated | yes | none |
| S4 | Refactoring UI book, table of contents ("Don't overlook empty states", "Greys don't have to be grey", "Establish a spacing and sizing system") | https://refactoringui.com/ | n/a | contents list yes; chapter text no (UNVERIFIED) | none |
| S5 | Steve Schoger, tweets (Refactoring UI co-author): 2017-06-12 grey text on colour; 2017-06-20 shadow offset; 2018-11-02 blank states; 2018-11-19 image inner shadow | https://twitter.com/steveschoger/status/874333097168314370, …/877209916179709955, …/1058398981888376832, …/1064541476615593984 | as listed | yes (oEmbed) | #4 (partial: blank states as their own UI) |
| S6 | Jakub Krehel, "Details that make interfaces feel better" (design engineer; author of the make-interfaces-feel-better skill) | https://jakub.kr/writing/details-that-make-interfaces-feel-better | undated | yes | none |
| S7 | Jakub Krehel, make-interfaces-feel-better skill (vendored here at 35545ea) | https://github.com/jakubkrehel/make-interfaces-feel-better | 2026-08-29 (last commit) | yes (local vendored copy + GitHub API) | #3 |
| S8 | Vercel, Web Interface Guidelines: live page and `AGENTS.md` (vendored copy identical to HEAD e3d624b) | https://vercel.com/design/guidelines, https://github.com/vercel-labs/web-interface-guidelines | HEAD 2026-08-18 | yes | #3 ("Balance icon/text lockups (weight/size/spacing/color)"), #4 ("No dead ends") |
| S9 | Vercel Geist design system: Empty State, Colors, Materials | https://vercel.com/geist/empty-state, https://vercel.com/geist/colors, https://vercel.com/geist/materials | undated | yes | #4 |
| S10 | Rauno Freiberg, "Web Interface Guidelines" (Vercel design engineer; the origin of S8) | https://github.com/raunofreiberg/interfaces (interfaces.rauno.me) | 2023-05-24 to 2023-09-07 | yes (raw README) | #4 |
| S11 | Emil Kowalski, "Agents with Taste" (design engineer; author of the Sonner and Vaul libraries) | https://emilkowal.ski/ui/agents-with-taste | undated | yes | none |
| S12 | Karri Saarinen and 3 others (Linear), "How we redesigned the Linear UI (part Ⅱ)"; quoted passages are by Yann-Edern Gillet (Design) | https://linear.app/now/how-we-redesigned-the-linear-ui | 2024-03-28 | yes | #7b (partial: less chrome colour) |
| S13 | Charlie Aufmann & Maxime Heckel (Linear), "A calmer interface for a product in motion"; Linear changelog "UI refresh" | https://linear.app/now/behind-the-latest-design-refresh, https://linear.app/changelog/2026-03-12-ui-refresh | 2026-03-12 | yes | #7b, #3 (partial: fewer, smaller icons) |
| S14 | Apple Human Interface Guidelines: Icons (updated 2025-06-09), SF Symbols (2025-07-28), Color (2025-12-16), Scroll views (2026-06-08) | https://developer.apple.com/design/human-interface-guidelines/icons (and /sf-symbols, /color, /scroll-views) | as listed | yes (HIG JSON) | #3 (Icons, SF Symbols), #7b (Color), #12 (Scroll views) |
| S15 | Apple, SwiftUI `ConcentricRectangle` | https://developer.apple.com/documentation/swiftui/concentricrectangle | iOS 26.0 | yes (JSON) | none |
| S16 | Google Material Design 3: Color roles, Icons (designing, applying), Buttons, Chips, Menus and Lists specs, Spacing, Search guidelines, blog "Ten steps iOS to Android" | https://m3.material.io/styles/color/roles and related pages | undated | yes, via Context7 (site is JavaScript-only) | #3 (icon weight and grade match text), #7b (partial) |
| S17 | Material Design 2, "Empty states" | https://m2.material.io/design/communication/empty-states | n/a | no: JavaScript-only, Wayback copies too (UNVERIFIED) | none |
| S18 | Kate Kaplan (NN/g), "Designing Empty States in Complex Applications: 3 Guidelines" | https://www.nngroup.com/articles/empty-state-interface-design/ | 2021-09-19 | yes | #4 |
| S19 | Kathryn Whitenton (NN/g), "3 Guidelines for Search Engine 'No Results' Pages" | https://www.nngroup.com/articles/search-no-results-serp/ | 2014-01-05 | yes | #4 |
| S20 | Aurora Harley (NN/g), "Icon Usability" | https://www.nngroup.com/articles/icon-usability/ | 2014-07-27 (modified 2024-01-29) | yes | #3 (partial: pick recognisable icons, label them) |
| S21 | Kelley Gordon (NN/g), "Visual Hierarchy in UX: Definition" | https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ | 2021-01-17 | yes | #7b |
| S22 | Tim Neusesser & Evan Sunwall (NN/g), "Error-Message Guidelines" | https://www.nngroup.com/articles/error-message-guidelines/ | 2023-05-14 | yes | none (tone for #4) |
| S23 | Raluca Budiu (NN/g), "Carousels on Mobile Devices"; Katie Sherwin (NN/g), "Beware Horizontal Scrolling and Mimicking Swipe on Desktop" | https://www.nngroup.com/articles/mobile-carousels/, https://www.nngroup.com/articles/horizontal-scrolling/ | 2018-08-19; 2014-04-27 | yes | #12 (partial: overflow cues) |
| S24 | Aurora Harley (NN/g), "Proximity Principle in Visual Design"; Page Laubheimer (NN/g), "Cards: UI-Component Definition" | https://www.nngroup.com/articles/gestalt-proximity/, https://www.nngroup.com/articles/cards-component/ | 2020-08-02; 2016-11-06 | yes | none |
| S25 | IBM Carbon Design System, "Empty states" pattern | https://carbondesignsystem.com/patterns/empty-states-pattern/ (source: carbon-website `src/pages/patterns/empty-states-pattern/index.mdx`) | last commit 2025-03-12 | yes (GitHub source) | #4 |
| S26 | Atlassian Design System, "Empty state" usage | https://atlassian.design/components/empty-state/usage | undated | yes | #4 |
| S27 | GitHub Primer, "Blankslate" guidelines | https://primer.style/product/components/blankslate/guidelines | undated | yes | #4 |
| S28 | Josh W. Comeau, "Designing Beautiful Shadows in CSS" (CSS educator) | https://www.joshwcomeau.com/css/designing-shadows/ | 2021-09-13, updated 2026-04-27 | yes | none |
| S29 | Ahmad Shadeed, Defensive CSS tips and article (front-end engineer; author of RTL Styling 101) | https://defensivecss.dev/, https://ishadeed.com/article/defensive-css/ | article 2021-12-07; tips undated | yes | none |
| S30 | Lucide: docs (stroke width, sizing, global styling, filled icons, version 1, icon design guide) and source (`Icon.ts`, `context.ts`, `buildLucideIconNode.ts`, `types.ts`, `icons/*.json`) | https://lucide.dev/guide/react/basics/stroke-width, https://github.com/lucide-icons/lucide | lucide-react 1.0.0 published 2026-03-23; latest 1.48.0 | yes | #3 |
| S31 | Heroicons (Tailwind Labs): site, README, raw SVGs | https://heroicons.com/, https://github.com/tailwindlabs/heroicons | undated | yes | none |
| S32 | Phosphor Icons: React README, core raw SVGs | https://github.com/phosphor-icons/react, https://github.com/phosphor-icons/core | @phosphor-icons/react 2.1.10 | yes | none |
| S33 | Tabler Icons: site, React README, raw SVG metadata | https://tabler.io/icons, https://github.com/tabler/tabler-icons | undated | yes | none |
| S34 | Google Chrome team, `modern-web-guidance` agent skill: scrollability-affordance-hints, soft-edge-content-fade, improve-text-layout-and-legibility, precise-text-alignment | https://github.com/GoogleChrome/modern-web-guidance | repo created 2026-03-23, last push 2026-09-21 | yes (raw Markdown) | #12 |
| S35 | Adam Argyle (Chrome), "CSS scroll-state()"; Bramus Van Damme (Chrome), "Animate elements on scroll with Scroll-driven animations" | https://developer.chrome.com/blog/css-scroll-state-queries, https://developer.chrome.com/docs/css-ui/scroll-driven-animations | 2025-01-15; 2023-05-05 | yes | #12 (Argyle: scroll shadows only when scrollable) |
| S36 | Kevin Hamer (CSS-Tricks), "Modern Scroll Shadows Using Scroll-Driven Animations" | https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/ | 2025-05-05 | yes | #12 |
| S37 | Lea Verou, "Pure CSS scrolling shadows with background-attachment: local" (CSS WG member) | https://lea.verou.me/blog/2012/04/background-attachment-local/ | 2012-04-26 | yes | #12 |
| S38 | CSS WG editor's drafts: Scroll-driven Animations 1 (ED 2026-09-25), CSS Conditional 5 (scroll-state), CSS Values 4 (line-width snapping) | https://drafts.csswg.org/scroll-animations-1/, https://drafts.csswg.org/css-conditional-5/, https://drafts.csswg.org/css-values-4/ | EDs as of 2026-09-26 | yes | none |
| S39 | MDN browser-compat-data (main branch) | https://github.com/mdn/browser-compat-data | 2026-09-26 | yes | none |
| S40 | Radix Colors docs, "Understanding the scale", "Composing a palette" | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale, …/composing-a-palette | undated | yes | none |
| S41 | Nathan Curtis (EightShapes), "Space in Design Systems" (design-systems consultant) | https://medium.com/eightshapes-llc/space-in-design-systems-188bcbae0d62 | 2016-09-25 | yes (Wayback snapshot 2026-07-17) | none |
| S42 | Lisa Charlotte Muth (Datawrapper), "What to consider when visualizing data for colorblind readers" | https://www.datawrapper.de/blog/colorblindness-part2 | 2020-06-23 | yes | none |
| S43 | Tailwind CSS 4.3.3 as installed (`theme.css`, `dist/lib.js`) and the `mask-image` docs | `node_modules/.pnpm/tailwindcss@4.3.3`, https://tailwindcss.com/docs/mask-image | 4.3.3 | yes | none |
| S44 | Hands-on checks: Chromium 153.0.8010.12 (Playwright 1.63.0 bundle), Vazirmatn 33.003 | throwaway scripts (not kept) | 2026-09-26 | run | #3 and #12 (verification, not a source) |

## Tips

### Icons

### V-1: Choose one icon family for the whole product by testing domain coverage, filled variants, stroke control and mirroring, then never import a second
- Owner example: #3
- Why: Sets differ in grid, stroke, corner radius and level of detail, so mixing them is the most visible "assembled" tell (anti-slop tell 3). Apple states cross-icon consistency as a rule.
- How:
  - Before the first icon ships, list the concepts the product needs and check each exists in the candidate set in outline and filled form: car, gauge (mileage), fuel, gearbox, calendar (model year), map pin (city), bookmark (saved listing), bell (price alert), trending-down (price drop), sliders (filters), share, chevrons, close, search. Checked in the repositories on 2026-09-26: Tabler has `manual-gearbox` and `automatic-gearbox` in outline and filled; Lucide has `car`, `gauge`, `fuel`, `bookmark`, `bell`, `trending-down`; Phosphor has `car`, `gas-pump`, `gauge`, `engine`, `steering-wheel`.
  - Filled states: Lucide does not support fills; Phosphor has a `fill` weight; Heroicons ships solid sets; Tabler has a filled subset.
  - Stroke control: Lucide and Tabler expose stroke width; Phosphor exposes weights only (raw strokes thin 8, light 12, regular 16, bold 24 on a 256 grid) and its React icons are filled outlines, so the stroke can neither change nor stay constant across sizes; Heroicons outline ships at 1.5 on 24 (the React components let a `strokeWidth` prop override it) and its 20 and 16 px sets are separate solid drawings.
  - Register defaults once (Lucide CSS or `LucideProvider`, Phosphor `IconContext.Provider`) and restrict icon imports to that one package with the `no-restricted-imports` rule the repo already uses.
- RTL/Farsi: Phosphor has a `mirrored` prop; the others need the `scale: -1 1` wrapper from `rtl-bidi.md` on each directional glyph.
- Sources:
  - Apple — Icons (HIG) — https://developer.apple.com/design/human-interface-guidelines/icons — 2025-06-09 — "all interface icons in your app need to use a consistent size, level of detail, stroke thickness (or weight), and perspective"
  - Jakub Krehel — make-interfaces-feel-better, `overview.md` — https://github.com/jakubkrehel/make-interfaces-feel-better — 2026-08-29 — "One stroke weight per icon set; never mix libraries on one surface."
  - Lucide — Filled icons — https://lucide.dev/guide/react/advanced/filled-icons — undated — "Fills are officially not supported."
  - Phosphor — React README — https://github.com/phosphor-icons/react — 2.1.10 — "Flip the icon horizontally. Can be useful in RTL languages where normal icon orientation is not appropriate."
- Confidence: high (Apple and Jakub; library facts read from source files).
- Conflicts: None with the owner or our files; `anti-slop-review.md` tell 3 names the defect, this adds the selection test. The 2026-09-18 styling note already records that Phosphor has `mirrored` and Lucide and Tabler do not.

### V-2: Match the rendered icon stroke to the stem of the adjacent label, measured on the real font
- Owner example: #3
- Why: An icon beside a label carries the label's optical weight. Apple builds SF Symbols on one-to-one weight matching with its system font; Material lets symbol grade follow text grade.
- How:
  - Rendered stroke = stroke in viewBox units × rendered size ÷ grid size (unless the stroke is non-scaling, V-3). Defaults from the raw SVGs:

    | Set | Grid, stroke | at 24 px | at 20 px | at 16 px |
    |---|---|---|---|---|
    | Lucide, Tabler | 24, 2 | 2.0 | 1.67 | 1.33 |
    | Heroicons outline | 24, 1.5 | 1.5 | 1.25 | 1.0 (its 20 and 16 px sets are separate solid drawings) |
    | Phosphor regular / bold | 256, 16 / 24 | 1.5 / 2.25 | 1.25 / 1.88 | 1.0 / 1.5 |

  - Measured stems of Vazirmatn 33.003 (the alef «ا», a single vertical stroke) in Chromium 153, as a share of font size: 400 = 8.25 % (1.32 px at 16 px), 500 = 10.4 % (1.66 px), 600 = 11.3 % (1.81 px), 700 = 12.2 % (1.95 px). Beside 16 px regular Farsi, aim for 1.25 to 1.5 px; beside a 600 or 700 label, 1.75 to 2 px.
  - Review check: for each visible `svg`, compute the rendered stroke and compare it with the label's stem; one screen stays within ±0.25 px of its target (tolerance is inference).
- RTL/Farsi: Use the alef as the reference stem. Vazirmatn's Latin glyphs come from Roboto (`persian-type-formatting.md`), so a Latin "l" is the wrong reference.
- Sources:
  - Apple — SF Symbols (HIG) — https://developer.apple.com/design/human-interface-guidelines/sf-symbols — 2025-07-28 — "Each of the nine symbol weights — from ultralight to black — corresponds to a weight of the San Francisco system font"
  - Apple — Icons (HIG) — https://developer.apple.com/design/human-interface-guidelines/icons — 2025-06-09 — "In general, match the weights of interface icons and adjacent text."
  - Google — Material 3, applying icons (via Context7) — https://m3.material.io/styles/icons/applying-icons — undated — "Grade levels between text and symbols can be matched for a harmonious visual effect."
  - Jakub Krehel — `icons.md` (table: 1.5 px beside 400 text at 14 to 16 px, 2 px beside 500 to 600, 2.5 px beside 700) — https://github.com/jakubkrehel/make-interfaces-feel-better — 2026-08-29 — "An icon next to text should carry the same optical weight as the text."
  - Lucide — Icon design guide — https://lucide.dev/contribute/icon-design-guide — undated — "Strokes must be 2 pixels wide."
  - Raw SVGs read 2026-09-26: Heroicons `optimized/24/outline/bookmark.svg` (`stroke-width="1.5"`), Phosphor core `raw/{thin,light,regular,bold}/car*.svg` (8, 12, 16, 24 on 256), Tabler `icons/outline/car.svg` (24, 2). Hands-on: `visual-test/stem2.mjs`.
- Confidence: high for the rule (Apple, Material, Jakub); medium for the numbers (one font, one engine).
- Conflicts: Jakub's 2.5 px beside bold text is heavier than Vazirmatn 700's measured 1.95 px stem at 16 px; follow the measurement. Material recommends "2dp or the regular weight (400)" for a 24 dp symbol, which is heavier than a 16 px regular text stem; Material balances it with the grade axis, which SVG sets do not have.

### V-3: With Lucide v1, hold the stroke constant with `nonScalingStroke` or `vector-effect: non-scaling-stroke`; `absoluteStrokeWidth` is deprecated and ignores CSS sizing
- Owner example: #3 (corrects the brief's `absoluteStrokeWidth`)
- Why: The em- and token-based sizing of V-4 happens in CSS. `absoluteStrokeWidth` computes `strokeWidth × 24 ÷ size` from the `size` prop only (`buildLucideIconNode.ts`), so an icon sized by a class gets no compensation; `nonScalingStroke` adds `vector-effect="non-scaling-stroke"`, which holds the stroke at N CSS pixels at any rendered size.
- How:
  - In Server Components, set it once in `globals.css`: `.lucide { stroke-width: 1.5; } .lucide * { vector-effect: non-scaling-stroke; }` (Lucide's documented global styling). Client trees can use `<LucideProvider strokeWidth={1.5} nonScalingStroke>`; the provider is a React context and lucide-react's `Icon` module starts with `'use client'`.
  - Keep non-scaling strokes at or below 1.5 px on 16 px icons: Lucide glyphs keep at least 2 px between elements at 24 px; at 16 px those gaps shrink to 1.33 px while a non-scaling 2 px stroke stays 2 px, so detailed glyphs clog (inference from the design guide).
  - Versions: lucide-react 1.0.0 was published 2026-03-23 and 1.48.0 is current (npm registry, 2026-09-26). `vector-effect: non-scaling-stroke` works in every engine (MDN BCD).
- Sources:
  - Lucide — `packages/shared/src/build/types.ts` and `packages/lucide-react/src/context.ts` — https://github.com/lucide-icons/lucide — main branch, 2026-09-26 — "@deprecated Use `nonScalingStroke` instead."
  - Lucide — Stroke width — https://lucide.dev/guide/react/basics/stroke-width — undated — "when nonScalingStroke is enabled and the size of the icons is set to 48px the strokeWidth will still be 2px on the screen"
  - Lucide — Global styling — https://lucide.dev/guide/react/advanced/global-styling — undated — code: `.lucide * { vector-effect: non-scaling-stroke; }`
  - Lucide — Icon design guide — https://lucide.dev/contribute/icon-design-guide — undated — "Distinct elements must have at least 2 pixels of visual spacing between them."
  - Google — Material 3, applying icons (via Context7) — https://m3.material.io/styles/icons/applying-icons — undated — "Traditionally, icons are resized from a 24dp source vector, resulting in a large scaled icon that's too heavy compared to the original."
- Confidence: high (source code and docs).
- Conflicts: The brief names `absoluteStrokeWidth`; Lucide v1 deprecates it in favour of `nonScalingStroke`.

### V-4: Size inline icons from the text in em and standalone icons at the set's native sizes; never scale a small icon up to fill space
- Owner example: #3
- Why: An em-sized icon follows its text role at every breakpoint. Glyphs drawn for 16 to 24 px look crude when blown up.
- How:
  - Inline: an `icon-inline` utility (a token, `1.25em` square to start) beside body text. Material pairs 18 dp icons with 14 sp chip labels (about 1.29 em), 20 dp icons with button labels and 24 dp icons with 16 sp list and menu text (1.5 em). Persian glyphs look smaller than Latin at the same size (`persian-type-formatting.md`), so compare on screen before fixing the ratio.
  - Standalone: 16, 20 or 24 px only, the grids the sets are drawn on. For a large decorative spot, such as a first-use empty state, enclose a 24 px icon in a tinted circle rather than scaling it to 64 px.
  - Do not size icons next to Persian text in the `cap` unit: it resolves to the font's Latin cap height (Vazirmatn's OS/2 capHeight is 0.80 em).
- Sources:
  - Lucide — Sizing — https://lucide.dev/guide/react/basics/sizing — undated — "It is possible to resize icons based on font size. This can be achieved using the em unit."
  - Apple — SF Symbols (HIG) — 2025-07-28 — "The scales are defined relative to the cap height of the San Francisco system font."
  - Jakub Krehel — `icons.md` — 2026-08-29 — "Size inline icons relative to the text's cap height, typically `1em`–`1.25em`."
  - Google — Material 3 Buttons (via Context7) — https://m3.material.io/components/buttons — undated — "Standard size for leading and trailing icons is now 20dp"; Chips specs (https://m3.material.io/components/chips/specs): icon size 18 dp.
  - Adam Wathan & Steve Schoger — 7 Practical Tips for Cheating at Design — https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886 — 2018-02-20 — "icons that were drawn at 16–24px are never going to look very professional when you blow them up to 3x or 4x their intended size"
- Confidence: high for em sizing and native sizes; medium for the 1.25 em starting ratio.
- Conflicts: Jakub's 1 to 1.25 em against Material's 1.29 to 1.5 em pairings; CS-3 decides per role by looking at real Farsi labels.

### V-5: Put 8 px between an icon and its label inside controls and 12 to 16 px in rows, with `gap`, and give the icon side 2 px less padding
- Owner example: new
- Why: A fixed lockup gap makes icon and label read as one unit; `gap` is direction-neutral, while margins on icons are easy to get wrong in right-to-left layouts.
- How: buttons and filter chips `inline-flex items-center gap-2`; menu items and fact rows on the listing page `gap-3`; list rows with a leading icon `gap-4`. The icon comes before the label (inline start, the right side). A trailing chevron in «همه‌ی آگهی‌ها» sits at the inline end, so the padding is `ps-4 pe-3.5`.
- RTL/Farsi: Jakub's example is written `pl-4 pr-3.5`; the lint rejects physical classes, so write the icon side as `pe-*` or `ps-*`.
- Sources:
  - Google — Material 3 Chips specs (via Context7) — https://m3.material.io/components/chips/specs — undated — table value "Padding between elements | 8dp"
  - Google — Material 3 Menus specs (via Context7) — https://m3.material.io/components/menus/specs — undated — "Padding between elements within a list item | 12dp"
  - Google — Material 3 Navigation drawer (via Context7) — https://m3.material.io/components/navigation-drawer/guidelines — undated — "When used, they should always be placed before text."
  - Jakub Krehel — `surfaces.md` — 2026-08-29 — "icon-side padding = text-side padding - 2px"
  - Vercel — Web Interface Guidelines (`AGENTS.md`) — https://github.com/vercel-labs/web-interface-guidelines — 2026-08-18 — "SHOULD: Balance icon/text lockups (weight/size/spacing/color)"
- Confidence: medium to high (Material specs and Jakub; the per-component mapping is ours).
- Conflicts: None found.

### V-6: Align an icon to the first line of a multi-line label with a `1lh` box, centre icons optically, and do not trim Persian text boxes to `cap alphabetic`
- Owner example: #3
- Why: `items-center` centres an icon on the whole paragraph, so a three-line risk flag has its icon floating mid-block. Asymmetric glyphs look off-centre when centred geometrically.
- How:
  - First-line alignment: `flex items-start gap-2` on the row and the icon inside `h-lh flex items-center` (Tailwind 4.3.3 ships `h-lh`, `height: 1lh`). Verified in Chromium 153: with 16 px / 1.75 Farsi text the box was 28 px tall and the icon's centre sat at 14 px, the first line's centre. The `lh` unit is in Chrome 109, Firefox 120 and Safari 16.4.
  - Optical centring: build the offset into the SVG's own padding, as Apple advises; if code must nudge it, use `ms-px` or `me-px` so the nudge mirrors with a mirrored glyph.
  - Persian labels keep the default text box. Measured on a Vazirmatn 16 px badge with 4 px vertical padding: untrimmed, 6.5 px above the ink and 9 px below (the text sits about 1 px high); with `text-box: trim-both cap alphabetic`, 4.5 px above and −0.2 px below, so descenders touch the edge. Correct the imbalance with a per-font padding token instead.
- RTL/Farsi: the third bullet.
- Sources:
  - Apple — Icons (HIG) — 2025-06-09 — "Adjustments for optical centering are typically very small, but they can have a big impact on your app's appearance."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — undated — "Adjust ±1px when perception beats geometry."
  - Google Chrome — `modern-web-guidance`, `precise-text-alignment.md` — https://github.com/GoogleChrome/modern-web-guidance — 2026 — "For most UI alignment, use `cap alphabetic`." (Latin-centred; see Conflicts)
  - MDN browser-compat-data — `lh` unit; `text-box` (Chrome 133, Firefox 154, Safari 18.2) — 2026-09-26.
  - Hands-on: `visual-test/lh.mjs`, `visual-test/textbox2.mjs`.
- Confidence: medium (standards-based, measured in one engine with one font).
- Conflicts: Chrome's guidance recommends `text-box: trim-both cap alphabetic` for badges and icon–text centring; with Persian in Vazirmatn it puts descenders on the badge edge (measured). For Farsi text the Farsi measurement wins.

### V-7: Use a visible word instead of an icon whenever the concept fails the five-second test; icons label, they rarely replace labels
- Owner example: #3
- Why: Only a handful of glyphs are universally understood; market concepts such as paint condition have no standard glyph, and a wrong guess costs trust.
- How: words only for body condition («بدون رنگ»، «یک لکه»), gearbox, fuel, insurance months, seller type and the deal-rating word; icon plus visible label for bottom navigation and primary actions; icon-only only for universal glyphs (search magnifier, close, back chevron, share), each with a Farsi `aria-label`; no labels revealed on hover, the product is phone-first.
- Sources:
  - Aurora Harley (NN/g) — Icon Usability — https://www.nngroup.com/articles/icon-usability/ — 2014-07-27 — "Icon labels should be visible at all times, without any interaction from the user."
  - Aurora Harley (NN/g) — Icon Usability — same — "it is unlikely that an icon can effectively communicate that meaning" (the five-second rule)
  - Aurora Harley (NN/g) — Icon Usability — same — "There are a few icons that enjoy mostly universal recognition from users."
  - Charlie Aufmann & Maxime Heckel (Linear) — A calmer interface for a product in motion — https://linear.app/now/behind-the-latest-design-refresh — 2026-03-12 — "The refresh reduces icon usage, scales their sizes down, and removes unnecessary visual treatments."
- Confidence: high.
- Conflicts: None.

### V-8: Find an icon through the concept and its synonyms in the set's tag metadata, reject culturally wrong metaphors, and check every state, size and direction before it ships
- Owner example: #3
- Why: The first glyph that matches an English word often carries the wrong metaphor for an Iranian car buyer, and a glyph that means two things on two screens teaches people to ignore it.
- How:
  1. Start from the glossary word, not English: «نشان کردن» (save a listing) → bookmark, since the word says "mark"; «کارکرد» → gauge; «هشدار قیمت» → bell; «کاهش قیمت» → trending-down.
  2. Search the set's tags: Lucide's `icons/<name>.json` carries tags (gauge: dashboard, dial, meter, speed, pressure, measure, level; bookmark: save, favorite, mark, label …); Tabler SVGs carry a `tags:` comment (car: vehicle, drive, driver, engine, motor, journey, trip …).
  3. Reject currency glyphs (`$`, `€`) for toman prices; write the number and «تومان».
  4. Check the outline default, the filled selected state (a saved listing's bookmark), disabled, the 16 px render, dark theme, whether it mirrors (arrows yes; trending and chart glyphs no, charts stay left to right per `rtl-bidi.md`), and that the glyph means the same thing on every screen.
  5. If nothing survives five seconds, use the word (V-7).
- RTL/Farsi: step 4's mirroring check.
- Sources:
  - Apple — Icons (HIG) — 2025-06-09 — "icons work best when they use familiar visual metaphors that are directly related to the actions they initiate or content they represent"
  - Apple — Icons (HIG) — 2025-06-09 — "avoid images that might be hard to recognize across different cultures or languages"
  - Aurora Harley (NN/g) — Icon Usability — 2014-07-27 — "absence of a standard hurts the adoption of an icon over time"
  - Jakub Krehel — `icons.md` — 2026-08-29 — "Test every icon at the smallest size it will render, often `16px`."
  - Lucide `icons/gauge.json`, `icons/bookmark.json`, `icons/car.json`; Tabler `icons/outline/car.svg` — read 2026-09-26.
- Confidence: medium (each step is sourced; the procedure is ours).
- Conflicts: None.

### V-9: Draw icons with `currentColor`, outline by default and filled only for the selected state, in the same colour as their label
- Owner example: #3
- Why: One glyph recoloured by CSS keeps states consistent across themes, and the outline-to-fill swap is a state cue that does not depend on colour alone.
- How: strip hard-coded `fill` and `stroke` on import; icon colour equals label colour; a saved listing turns the bookmark from outline to filled and the label to «نشان شد»; a meaningful icon standing alone meets 3:1 (`states-a11y.md`). This needs a family with filled variants (V-1).
- Sources:
  - Jakub Krehel — `icons.md` — 2026-08-29 — "Use one SVG drawn with `currentColor`; let CSS drive hover, selected, and disabled states."
  - Apple — SF Symbols (HIG) — 2025-07-28 — "The outline variant works well in toolbars, lists, and other places where you display a symbol alongside text." and "use the fill variant to indicate selection"
  - Google — Material 3 Buttons (via Context7) — https://m3.material.io/components/buttons — undated — "Icons and labels now share the same color."
- Confidence: high.
- Conflicts: Jakub disables icon buttons with `opacity: 0.4`. Acceptable for a bare icon, never for a Persian label beside it (`persian-type-formatting.md` bans text opacity).

### Empty states

### V-10: Classify every empty state before designing it (first use, no results, cleared, error-caused, all-clear), because each needs its own words and way out
- Owner example: #4
- Why: A generic "nothing here" fails every case; four independent design systems split empty states by cause.
- How:

  | Type | Carshenas case | Must contain |
  |---|---|---|
  | First use | No saved searches yet | What will appear here; one action to the search |
  | No results | The filters empty the results | The query and filter chips kept; which filter emptied it; one action that widens it (V-12) |
  | Cleared | The person removed every saved listing | A neutral confirmation; a link back to results |
  | Error-caused | Price history failed to load | What failed; retry; nothing the person typed is lost |
  | All-clear | A saved search has no new matching listing since the last visit | Say so, with the Jalali date of the last check; an action is optional |

- Sources:
  - Vercel — Geist Empty State — https://vercel.com/geist/empty-state — undated — "no-results for a filtered list that returned zero rows, blank slate or informational for a resource the user hasn't created, cleared for completed work"
  - Atlassian — Empty state usage — https://atlassian.design/components/empty-state/usage — undated — "Empty states show when there is nothing to display in a view"
  - IBM Carbon — Empty states pattern — https://carbondesignsystem.com/patterns/empty-states-pattern/ — last commit 2025-03-12 — types table: no data, user action, error management (no quote needed)
  - Kate Kaplan (NN/g) — Designing Empty States in Complex Applications: 3 Guidelines — https://www.nngroup.com/articles/empty-state-interface-design/ — 2021-09-19 — "Empty states provide opportunities for designers to communicate system status, increase learnability of the system, and deliver direct pathways for key tasks."
- Confidence: high.
- Conflicts: Terminology only: Carbon's "user action" type covers what Geist and Atlassian call "cleared".

### V-11: Give each empty state one primary action and at most one secondary link; the rule is "no dead ends", and an all-clear state may have no action
- Owner example: #4
- Why: The action is the way out. Two primaries split attention, and several empty modules each with a primary make a wall of buttons.
- How: one primary as a real `<a>` or `<button>`; a secondary as a text link below it; when several empty modules can show together (on the listing page, «همین خودرو در منابع دیگر» and price history both empty), each gets a tertiary link, not a primary; an all-clear state («آگهی تازه‌ای نیست») may offer only a quiet link to edit the alert, or nothing.
- Sources:
  - Vercel — Geist Empty State — undated — "Cap at one primary CTA, plus one secondary when the first action could legitimately be one of two paths" and "Three CTAs is a smell."
  - IBM Carbon — Empty states pattern — 2025-03-12 — "If there are multiple things a user can do, pick the most important and keep the focus on that action."
  - IBM Carbon — same — "we recommend using a tertiary button for the call to action. This avoids scenarios with multiple primary action buttons in the UI."
  - IBM Carbon — same — "There may be situations where next steps are not possible or supplementary text is not required"
  - GitHub Primer — Blankslate — https://primer.style/product/components/blankslate/guidelines — undated — "Blankslates can and are encouraged to use one primary action."
  - Rauno Freiberg — Web Interface Guidelines — https://github.com/raunofreiberg/interfaces — 2023 — "Empty states should prompt to create a new item, with optional templates"
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — undated — "No dead ends. Every screen offers a next step or recovery path."
  - Kate Kaplan (NN/g) — 2021-09-19 — "Provide direct pathways (i.e., links) to getting started with key tasks related to populating the empty state"
- Confidence: high (seven independent sources).
- Conflicts: The owner's "empty states must have actions" holds for first-use, no-results and error states. Carbon gives an all-clear example (alerts configured, nothing triggered) where no next step is needed, so the rule is "no dead ends", not "always a button". `states-a11y.md` ("offer one next action") should add this exception.

### V-12: In a no-results state keep the query and the filter chips, replace only the list, name the filter to relax with its count, and announce the change
- Owner example: #4
- Why: The filters are the way out; hiding them, which is advice meant for first-use states, traps the person.
- How: keep the search field with the query and the applied-filter chips (each removable); replace the results list itself with the message, so a screen reader does not walk an empty list; hide the sort control; the primary action removes or widens the most restrictive filter and shows its count from the database («بدون فیلتر بدون رنگ: ۴۲ آگهی»), never a model's number; after an asynchronous filter change the region is `aria-live="polite"`.
- RTL/Farsi: counts in Persian digits.
- Sources:
  - Kathryn Whitenton (NN/g) — 3 Guidelines for Search Engine "No Results" Pages — https://www.nngroup.com/articles/search-no-results-serp/ — 2014-01-05 — "Clearly explain that there are no matching results" and "Offer starting points for moving forward"
  - IBM Carbon — Empty states pattern — 2025-03-12 — "Empty states should replace the element that would ordinarily show."
  - IBM Carbon — same — "if there are no search results suggest adjusting the search or filters."
  - Vercel — Geist Empty State — undated — "After an async filter change, wrap the region in aria-live="polite" so screen readers announce the new state."
  - Refactoring UI — book chapter "Don't overlook empty states" — https://refactoringui.com/ — UNVERIFIED (chapter text not fetchable; secondary summaries say it advises hiding filters and tabs in empty states).
- Confidence: high.
- Conflicts: The unverified Refactoring UI advice to hide supporting controls suits first-use states only; for no-results, NN/g and Carbon win. `listing-patterns.md` already says to keep the query and name the filter; this adds replace-the-list, hide-the-sort and the live region.

### V-13: Write empty and error states in plain, neutral Farsi that describes what will appear, never what the person failed to do; no jokes
- Owner example: #4
- Why: The person is often already frustrated; blame and humour read as mockery, and a system fault is the system's.
- How: a short title and a one-sentence body; positive framing such as «جست‌وجوهای ذخیره‌شده اینجا می‌آیند» rather than an accusation; for no results «با این فیلترها آگهی‌ای پیدا نشد», never a sentence saying the filters are wrong; no «نامعتبر» or «اشتباه»; no emoji or humour, including in all-clear states, where «آگهی تازه‌ای نیست» is enough.
- Sources:
  - Tim Neusesser & Evan Sunwall (NN/g) — Error-Message Guidelines — https://www.nngroup.com/articles/error-message-guidelines/ — 2023-05-14 — "Don't use phrasing that blames users or implies they are doing something wrong, such as invalid, illegal, or incorrect."
  - Tim Neusesser & Evan Sunwall (NN/g) — same — "Avoid humor since it can become stale if users encounter the error frequently."
  - Kathryn Whitenton (NN/g) — 2014-01-05 — "Don't mock the user"
  - IBM Carbon — 2025-03-12 — "Be respectful of the user and don't joke or use flippant language." and "Where possible, write this as a positive statement."
  - Atlassian — Empty state usage — undated — "A general no-result state (such as no search results) might be more neutral, but still motivate by showing next steps."
- Confidence: high.
- Conflicts: Atlassian allows a "celebratory tone" for completed work and "Choose an image that has a neutral or humorous tone (never negative)"; NN/g and Carbon advise no humour. For Carshenas the stricter rule applies. The example in `states-a11y.md` («هنوز جست‌وجویی ذخیره نکرده‌اید») is neutral, but Carbon's positive framing reads better; copy tone is the owner's call.

### V-14: Lay out each empty state for its container: text only in small modules, one start-aligned block on full pages, decorative images only when CS-3 supplies them
- Owner example: #4
- Why: An empty state is its own small layout, not the filled layout minus its content.
- How: a small module (the price-history card) gets one sentence and a link, no image; a full page gets title, sentence and action as one block whose text is start-aligned (the block itself may sit in the centre of the page); illustrations carry `alt=""`; nothing that must stay visible, such as a warning, lives inside an empty state.
- RTL/Farsi: Carbon's "left-aligned" means start-aligned, the right edge, here.
- Sources:
  - Steve Schoger — tweet — https://twitter.com/steveschoger/status/1058398981888376832 — 2018-11-02 — "Blank states don't just have to be the empty version of the regular filled state."
  - IBM Carbon — Empty states pattern — 2025-03-12 — "If space is limited, use just text." and "Block center the left-aligned group in the empty space"
  - IBM Carbon — same — "As most empty state illustrations are considered decorative, they should be skipped by screen readers."
  - Vercel — Geist Empty State — undated — "Empty states vanish when the list populates"
- Confidence: high.
- Conflicts: None; consistent with `states-a11y.md` ("No decorative illustration until CS-3 provides one") and with anti-slop tell 4 (no hero layout on product screens).

### Colour and hierarchy

### V-15: Budget hue per view: tinted neutrals everywhere, one action hue, and semantic hues only where they carry a state; the action hue is never a deal-rating hue
- Owner example: #7b
- Why: A results page already shows up to five deal-rating hues. Decorative colour competes with them and blurs what colour means.
- How:
  - Per view: tinted neutrals (V-17), the action hue (primary button, links, focus ring, selected state), deal-rating hues on badges, and error or success colours only while that state exists. No coloured backgrounds on several controls, no decorative gradients.
  - Choose the action hue off the deal-rating ramp: a green «جست‌وجو» button beside a green «معامله‌ی عالی» badge makes one colour mean two things.
  - Measure (prototyped in Chromium 153, `visual-test/hues.mjs`): collect the computed `color`, `background-color` and `border-color` of visible elements, convert each through a 1×1 canvas to sRGB and then OKLCH, keep chroma above 0.04 and bucket hue by 30°. Expected buckets are the action hue plus the states on screen; any other bucket is a finding. On a test page it separated the action blue, two deal hues and a stray `#6366f1`, and ignored neutrals of chroma 0.03.
- Sources:
  - Kelley Gordon (NN/g) — Visual Hierarchy in UX: Definition — https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ — 2021-01-17 — "In common, uncomplicated designs, limit your color use to 2 primary and 2 secondary colors."
  - Kelley Gordon (NN/g) — same — "When too many colors of similar value or saturation are used, people's perception of hierarchy among elements is often reduced."
  - Apple — Color (HIG) — https://developer.apple.com/design/human-interface-guidelines/color — 2025-12-16 — "Avoid using the same color to mean different things." and, in the Liquid Glass section, "Refrain from adding color to the background of multiple controls."
  - Refactoring UI — Building Your Color Palette — https://refactoringui.com/previews/building-your-color-palette — undated — "Most sites need one, maybe two colors that are used for primary actions, emphasizing navigation elements, etc."
  - Google — Material 3 Color roles (via Context7) — https://m3.material.io/styles/color/roles — undated — "Use caution when changing color roles for visual effect."
  - Yann-Edern Gillet (Linear) — How we redesigned the Linear UI (part Ⅱ) — https://linear.app/now/how-we-redesigned-the-linear-ui — 2024-03-28 — "limiting how much chrome (blue in our case) was used in the calculations applied to our color system"
- Confidence: high for the rule; medium for the measurement thresholds (ours).
- Conflicts: Refactoring UI says "it's not uncommon to need as many as ten different colors with 5-10 shades each for a complex UI"; that is the palette, not one view, so it agrees with the owner's per-view limit. Anti-slop tell 2 already bans indigo defaults; this makes the check countable.

### V-16: Encode the five deal ratings as one ordinal ramp whose lightness changes steadily, so it still reads in greyscale; badge text uses the paired on-colour
- Owner example: #7b
- Why: Five unrelated hues read as confetti and fail red-green colour-blind buyers; a ramp reads as one scale.
- How: hues from good to bad along one path with lightness changing in one direction; check a greyscale screenshot (all five levels distinct) and a deuteranopia simulation; badge fill = the container role, text = its on-container partner at 4.5:1 (`tokens.md` pairs); «بدون ارزیابی» uses the neutral, not a sixth hue; the word is always present (`listing-patterns.md`).
- Sources:
  - Lisa Charlotte Muth (Datawrapper) — What to consider when visualizing data for colorblind readers — https://www.datawrapper.de/blog/colorblindness-part2 — 2020-06-23 — "You can use any colors you like as long as they vary by lightness." and "Get it right in black & white"
  - Google — Material 3 Color roles (via Context7) — undated — "Container – Roles used as a fill color for foreground elements like buttons. They should not be used for text or icons."
  - Apple — Color (HIG) — 2025-12-16 — "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information."
  - Vercel — Web Interface Guidelines (`AGENTS.md`) — 2026-08-18 — "MUST: Accessible charts (color-blind-friendly palettes)"
- Confidence: medium (a data-visualisation rule applied to badges is our inference).
- Conflicts: None with our files.

### V-17: Tint the neutrals toward the action hue with low chroma, and give each step of a scale a fixed role
- Owner example: #7b
- Why: Pure greys look dead beside a coloured accent; slightly tinted greys make one palette, and role-assigned steps stop components picking shades by eye.
- How: OKLCH neutrals share the action hue's `h`, with chroma about 0.003 to 0.01 at the lightest and darkest steps and 0.015 to 0.045 in the middle (Tailwind 4.3.3's own tinted greys: slate-500 `oklch(55.4% 0.046 257.417)`, gray-500 chroma 0.027, zinc-500 0.016, warm stone-500 0.013 at hue 58). Assign roles to steps as Radix and Geist do (backgrounds, component fills, borders, solid fills, text) inside the tiers of `tokens.md`.
- Sources:
  - Radix Colors — Composing a palette — https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette — undated — "choose the gray scale which is saturated with the hue closest to your accent hue"
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — undated — "On non-neutral backgrounds, tint borders/shadows/text toward the same hue."
  - Charlie Aufmann & Maxime Heckel (Linear) — A calmer interface for a product in motion — 2026-03-12 — "The old palette was a cool, blue-ish hue, and the aim was to inch toward a warmer gray that still feels crisp, but less saturated."
  - Vercel — Geist Colors — https://vercel.com/geist/colors — undated — "These three colors are designed for UI component borders." (steps 4 to 6)
  - Radix Colors — Understanding the scale — https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale — undated — "Step 11 is designed for low-contrast text."
  - Refactoring UI — Building Your Color Palette — undated — "Text, backgrounds, panels, form controls — almost everything in an interface is grey."
- Confidence: high.
- Conflicts: Jakub requires pure black or white alpha for image outlines, never a tinted neutral (V-25); that is a different job. Linear moved to less saturated neutrals in both 2024 and 2026: keep the tint subtle.

### V-18: Never put grey text on a coloured surface; use a darker or lighter step of that surface's hue that still meets 4.5:1, never opacity
- Owner example: #7b
- Why: Grey on colour looks dirty because hierarchy comes from lower contrast with that background, not from greyness.
- How: secondary text inside a coloured badge or banner, such as «۱۲٪ زیر ارزش بازار» inside a green «معامله‌ی خوب» pill, uses the badge hue's on-container step, with the contrast computed, not eyeballed. Not `text-white/70`: text opacity is banned for Persian and derived text colours dodge the contrast check (`tokens.md`).
- Sources:
  - Steve Schoger — tweet — https://twitter.com/steveschoger/status/874333097168314370 — 2017-06-12 — "Pure grey text always looks "off" on a colored background. A quick fix is to saturate your text with a bit of the background hue."
  - Adam Wathan & Steve Schoger — 7 Practical Tips for Cheating at Design — 2018-02-20 — "Making the text closer to the background color is what actually helps create hierarchy, not making it light grey."
  - Adam Wathan & Steve Schoger — same — "Choose a color that's the same hue as the background, adjusting saturation and lightness until it looks right to you."
  - Vercel — Web Interface Guidelines — undated — "On non-neutral backgrounds, tint borders/shadows/text toward the same hue."
- Confidence: high.
- Conflicts: The same Refactoring UI article's first method, "Use white text and lower the opacity.", conflicts with our Persian no-opacity rule; readers' replies under the article note that its grey examples fail WCAG AA. `states-a11y.md` already bans grey on colour; this adds the no-opacity rule and the badge case.

### V-19: Build hierarchy with weight and colour before size: at most three text colours and two weights per component, never below 400
- Owner example: #7b
- Why: Size-only hierarchy multiplies sizes; weight and a muted text colour do the same job with fewer variables.
- How: listing card: title in the primary text colour at 600, price in the primary text colour and larger, metadata in the muted text colour at 400, the deal badge in its semantic pair. Measured Vazirmatn stems (V-2): 400 = 8.25 %, 500 = 10.4 %, 600 = 11.3 %, 700 = 12.2 % of font size, so pair 400 with 600 or 700 (inference from the measurement).
- Sources:
  - Adam Wathan & Steve Schoger — 7 Practical Tips for Cheating at Design — 2018-02-20 — "Try and stick to two or three colors", "two font weights is usually enough for UI work" and "Stay away from font weights under 400 for UI work"
  - Rauno Freiberg — Web Interface Guidelines — 2023 — "Font weights below 400 should not be used"
  - Emil Kowalski — Agents with Taste — https://emilkowal.ski/ui/agents-with-taste — undated — "Reserve underlines for links; emphasize non-link text with weight or color"
  - Charlie Aufmann & Maxime Heckel (Linear) — 2026-03-12 — "not every element of the interface should carry equal visual weight"
- Confidence: high for the rule; low for the choice of second weight (one measurement).
- Conflicts: Rauno also says "Medium sized headings generally look best with a font weight between 500-600", a third weight; `persian-type-formatting.md` keeps two. The Persian typography pass decides.

### V-20: In listing facts, fold the label into the value; a value whose format explains itself needs no label
- Owner example: new
- Why: «کارکرد: ۱۲۰٬۰۰۰» repeated on every card reads as a generated table; «۱۲۰ هزار کیلومتر» says both at once in less space.
- How: card facts as combined values («۱۲۰ هزار کیلومتر»، «مدل ۱۴۰۰»، «دنده‌ای»); labels stay where values are compared side by side (the listing page's specification table, the valuation form); a label that remains is muted, the value is not.
- RTL/Farsi: keep «مدل» with the year: the glossary warns that a bare «۱۴۰۰» is ambiguous.
- Sources:
  - Refactoring UI — Labels are a last resort — https://refactoringui.com/previews/labels-are-a-last-resort — undated — "In a lot of situations, you can tell what a piece of data is just by looking at the format."
  - Refactoring UI — same — "When you're able to combine labels and values into a single unit"
- Confidence: medium (one credible source).
- Conflicts: None.

### Scroll fades

### V-21: Treat a scroll fade as a hint: show it only on the side where more content exists, and let it vanish at that end and when nothing overflows
- Owner example: #12
- Why: A permanent fade hides the last chip when the person reaches the end and decorates edges with nothing beyond them.
- How: behaviour verified in Chromium 153 on a right-to-left chip rail with the V-22 recipe: at the start only the inline-end (left) edge faded and the inline-start edge was fully opaque; at the end the reverse, with the last chip fully opaque; a rail whose chips fit had an inactive timeline and no fade. Where no technique is supported, show no fade; the cut-off chip remains the cue (V-23).
- RTL/Farsi: the "more content" fade of a rail at rest is on the left.
- Sources:
  - Google Chrome — `modern-web-guidance`, `scrollability-affordance-hints.md` — https://github.com/GoogleChrome/modern-web-guidance — 2026 — "Visual hints, like shadows or gradients, help users understand that they can scroll to see more content."
  - Google Chrome — same — "Since these are hints and not critical for functionality, it is acceptable to omit them in unsupported browsers."
  - Apple — Scroll views (HIG) — https://developer.apple.com/design/human-interface-guidelines/scroll-views — 2026-06-08 — "Scroll edge effects aren't decorative."
  - Kevin Hamer — Modern Scroll Shadows Using Scroll-Driven Animations — https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/ — 2025-05-05 — "works great for horizontally scrollable elements"
  - Hands-on: `visual-test/fade-test2.mjs`, `visual-test/fade-mask.mjs`.
- Confidence: high.
- Conflicts: Chrome's own `soft-edge-content-fade.md` shows an always-on `mask-image: linear-gradient(to bottom, black 80%, transparent 100%)` on a scroll container, which fades the last item at the end. Use that only on clipped, non-interactive text, or add end padding at least as long as the fade.

### V-22: Build edge fades with `mask-image` driven by a scroll timeline, inside `@supports (animation-timeline: scroll())`, with the gradient direction set for RTL on purpose
- Owner example: #12
- Why: The mask fades the content itself, so it works on any background without overlays; the timeline shows each side's fade only while content remains on that side.
- How (verified in Chromium 153, including `var()` inside the keyframes):

  ```css
  /* --fade-size is a token (CS-3); 2rem used in the tests */
  @property --fade-start { syntax: "<length>"; inherits: false; initial-value: 0px; }
  @property --fade-end { syntax: "<length>"; inherits: false; initial-value: 0px; }

  @keyframes inline-edge-fade {
    0% { --fade-start: 0px; }
    10%, 100% { --fade-start: var(--fade-size); }
    0%, 90% { --fade-end: var(--fade-size); }
    100% { --fade-end: 0px; }
  }

  @supports (animation-timeline: scroll()) {
    .chip-rail {
      /* RTL on purpose: the inline start is the right edge, so the gradient runs "to left" (start to end). */
      mask-image: linear-gradient(to left, transparent, #000 var(--fade-start), #000 calc(100% - var(--fade-end)), transparent);
      animation: inline-edge-fade linear; /* no fill mode */
      animation-timeline: scroll(self inline);
    }
  }
  ```

  - The rail itself must be the scroller (`overflow-x: auto`). Support (MDN BCD, 2026-09-26): `animation-timeline` Chrome 115, Safari 26, Firefox only in preview; unprefixed `mask-image` Chrome 120, Firefox 53, Safari 15.4.
  - The timeline follows the scroll origin, so in RTL 0 % is the right edge and `--fade-start` drives the right side; only the gradient keyword is physical.
  - Why the guard: an engine that ignores `animation-timeline` runs the animation as a 0 s time animation. With a `both` fill it froze on the 100 % keyframe and faded the first chip (verified by deleting the timeline line in Chromium 153); with no fill mode it showed no fade. The guard makes the fallback safe either way.
  - Tailwind 4.3.3's `mask-l-*` and `mask-r-*` are physical (`mask-x-*` fades both sides equally) and there is no `mask-s`/`mask-e`. The repo lint restricts `bg-gradient-to-l/r` but not `mask-(l|r)-*`; extending that pattern is a recommendation for CS-26's rules work.
- RTL/Farsi: the gradient keyword; everything else is logical.
- Sources:
  - CSS WG — Scroll-driven Animations Level 1, editor's draft 2026-09-25 — https://drafts.csswg.org/scroll-animations-1/ — "The startmost scroll position represents 0% progress and the endmost scroll position represents 100% progress."
  - CSS WG — same — "Progress is in reference to the scroll origin, which can flip depending on writing mode, even when x or y is specified."
  - Kevin Hamer — CSS-Tricks — 2025-05-05 — "this gracefully degrades to simply not fading the element at all" (true only without a forwards or both fill; see Conflicts)
  - Google Chrome — `soft-edge-content-fade.md` — 2026 — "it actually fades the content itself, allowing the background to show through naturally without interfering with text selection or pointer events"
  - MDN browser-compat-data — `animation-timeline`, `mask-image` — 2026-09-26.
  - Hands-on: `visual-test/fade-mask.mjs`, `fade-mask-var.mjs`, `fade-mask-nosupport.mjs`, `fade-mask-nofill*.mjs`.
- Confidence: high (spec and measurement).
- Conflicts: Hamer's graceful-degradation claim depends on the fill mode; the `@supports` guard makes it hold regardless. `rtl-bidi.md` already lists gradient directions as not flipping; this is that case.

### V-23: Size the fade to about one gap plus a sliver (24 to 32 px), leave a chip cut at the edge, reserve matching scroll padding, and give mouse users visible scroll buttons or wrap
- Owner example: #12
- Why: The cut-off chip is the strongest cue that more exists; the fade only reinforces it and must not swallow a whole chip.
- How:
  - `--fade-size: 2rem` (inference: Chrome's example indicator is 20 px, Hamer uses 3rem).
  - Chip widths and gaps so one chip is cut at the inline end at both 320 and 412 px.
  - `scroll-padding-inline: var(--fade-size)` on the rail: `scrollIntoView({ inline: 'nearest' })`, used to bring the active filter chip into view, then lands 32 px from the edge instead of 0 (verified). Chromium 153's keyboard focus ignored it (a tabbed chip landed 22 px from the edge, partly under a 32 px fade), so keep the fade short.
  - Under `(hover: hover) and (pointer: fine)` add previous and next buttons (mirrored chevrons) or let the chips wrap: mouse users rarely discover horizontal overflow.
- Sources:
  - Raluca Budiu (NN/g) — Carousels on Mobile Devices — https://www.nngroup.com/articles/mobile-carousels/ — 2018-08-19 — "half images or text that look like they are continued beyond the vertical edge of the screen, is a strong carousel cue"
  - Raluca Budiu (NN/g) — same — "Dots are generally weak signifiers"
  - Katie Sherwin (NN/g) — Beware Horizontal Scrolling and Mimicking Swipe on Desktop — https://www.nngroup.com/articles/horizontal-scrolling/ — 2014-04-27 — "If arrows are only visible on hover … people might not ever discover that there is more content" and "Let users advance through content on click and with the keyboard."
  - Hands-on: `visual-test/focuspad2.mjs`.
- Confidence: medium (the sizes are ours; the mechanisms are verified).
- Conflicts: None.

### V-24: Use a scroll edge effect only where content scrolls under a floating bar, one per view, and check fades into dark surfaces for banding
- Owner example: #12
- Why: Apple separates edge effects, which keep floating controls legible, from decoration; fades stacked everywhere are slop.
- How:
  - The filter sheet gets one block-end fade above the sticky «نمایش ۱۲۸ آگهی» bar (the V-22 recipe with `scroll(self block)`); a results page with a sticky filter bar gets one edge effect at the top only.
  - `scroll-state(scrollable: …)` container queries run in Chrome 133+ only (logical values such as `inline-end` worked in RTL in Chromium 153) and style descendants, not the scroller's own mask; use them for overlay indicators as a Chrome-only enhancement, not as the main path.
  - Cross-engine overlay fallback: Lea Verou's `background-attachment: local` shadows, which need an opaque, known background; any overlay gets `pointer-events: none`.
  - Dark theme: screenshot a mask fading into a dark surface on a phone and look for bands.
- Sources:
  - Apple — Scroll views (HIG) — 2026-06-08 — "Only use a scroll edge effect when a scroll view is behind floating interface elements." and "Apply one scroll edge effect per view."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — undated — "Fading content to dark colors using CSS masks can cause banding."
  - Adam Argyle (Chrome) — CSS scroll-state() — https://developer.chrome.com/blog/css-scroll-state-queries — 2025-01-15 — "Chrome 133 builds upon container queries by introducing scroll state container queries."
  - CSS WG — CSS Conditional 5, editor's draft — https://drafts.csswg.org/css-conditional-5/ — 2026-09-26 — "The logical values map to physical based on the direction and writing-mode of the query container."
  - Lea Verou — Pure CSS scrolling shadows with background-attachment: local — https://lea.verou.me/blog/2012/04/background-attachment-local/ — 2012-04-26 — "the background is positioned relative to the element's contents"
  - Rauno Freiberg — Web Interface Guidelines — 2023 — "Decorative elements (glows, gradients) should disable `pointer-events` to not hijack events"
  - MDN browser-compat-data — scroll-state queries: Chrome 133 (`scrolled` Chrome 144), not Firefox, not Safari — 2026-09-26.
- Confidence: high for Apple's rule and support data; medium for the application.
- Conflicts: Chrome's `modern-web-guidance` leads with scroll-state queries for scroll hints; they miss Safari on iOS, where scroll timelines have worked since Safari 26.

### Surfaces

### V-25: Outline every photo with a 1 px inset black-alpha outline (white-alpha in dark) and give the photo frame a neutral background
- Owner example: new
- Why: Listing photos are often shot against white walls or light showrooms; without an edge they bleed into a white card.
- How: `outline: 1px solid var(--color-image-outline); outline-offset: -1px;` with the token `light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.1))`. The outline follows `border-radius` in Chrome 94, Firefox 88 and Safari 16.4 (BCD). A neutral `background-color` on the frame covers slow or failed loads and sources whose terms forbid photos (ADR-0008); that placeholder keeps the same aspect ratio (V-35).
- Sources:
  - Jakub Krehel — Details that make interfaces feel better — https://jakub.kr/writing/details-that-make-interfaces-feel-better — undated — code: `outline: 1px solid rgba(0, 0, 0, 0.1); outline-offset: -1px`
  - Jakub Krehel — `overview.md` — 2026-08-29 — "A tinted outline picks up the surface color underneath it and reads as dirt on the image edge."
  - Steve Schoger — tweet — https://twitter.com/steveschoger/status/1064541476615593984 — 2018-11-19 — "If you're working with images that sometimes bleed into the background, try using a subtle inner shadow to create some distinction instead of a border."
  - Ahmad Shadeed — Image inner border — https://defensivecss.dev/tip/inner-shadow/ — undated — "We can prevent that in advance and add an inner border to the image."
  - MDN browser-compat-data — `outline` follows `border-radius` — 2026-09-26.
- Confidence: high (three independent sources).
- Conflicts: Jakub's Tailwind snippet uses `dark:outline-white/10`; our lint bans `dark:`, so use the token. Rauno's 2023 "Box shadow should be used for focus rings, not outline which won't respect radius" is outdated: every current engine draws outlines along the radius.

### V-26: Nest radii concentrically: inner radius = max(outer radius − padding, a minimum); past about 24 px of padding treat the layers as separate surfaces
- Owner example: new
- Why: Equal radii on nested surfaces pinch the inner corner; a zero result from the subtraction looks square and broken.
- How: a listing card with `--radius-card` 16 px and the photo inset 8 px gives the photo 8 px; a «کاهش قیمت» badge pinned 8 px inside the photo's corner gives max(8 − 8, 4) = 4 px. CSS: `border-radius: max(calc(var(--radius-card) - var(--space-card-inset)), var(--radius-min));`. Single-corner radii use the logical `rounded-ss/se/es/ee`.
- Sources:
  - Jakub Krehel — Details that make interfaces feel better — undated — "The outer radius equals the inner radius plus the padding."
  - Jakub Krehel — `surfaces.md` — 2026-08-29 — "If padding is larger than `24px`, treat the layers as separate surfaces"
  - Apple — `ConcentricRectangle` — https://developer.apple.com/documentation/swiftui/concentricrectangle — iOS 26 — "the corner radius the system calculates may be zero. When that happens, the corner is square." and "to specify a rounded corner with a minimum radius"
  - Vercel — Web Interface Guidelines — undated — "Child radius ≤ parent radius & concentric so curves align."
- Confidence: high.
- Conflicts: None.

### V-27: Separate with space, then a background step, then a divider; keep shadows for things that float, layered, vertical-only and from a closed set of elevation tokens
- Owner example: new
- Why: Borders everywhere look busy; a shadow signals that something floats above the page, not that it belongs to a group.
- How:
  - Sequence of tools: spacing, one background step, a 1 px divider (list rows; inputs keep real borders for 3:1), and a shadow only for elevated surfaces: the bottom sheet, a menu, a sticky bar with content under it.
  - Shadows: at least two layers (ambient and direct), zero horizontal offset, offset and blur growing and opacity falling with elevation, and on a coloured surface a shadow tinted toward its hue. Tailwind 4.3.3's default shadows already use x = 0.
  - A closed set of three or four elevations (Geist names four surfaces and four floating materials, radii 6, 12 and 16 px). Dark theme: a 1 px light ring replaces depth shadows (Jakub), at token level.
- RTL/Farsi: Comeau's light "above and slightly to the left" gives an x offset that does not mirror (`rtl-bidi.md`); x = 0 removes the question.
- Sources:
  - Adam Wathan & Steve Schoger — 7 Practical Tips for Cheating at Design — 2018-02-20 — on borders: "using too many of them can make your design feel busy and cluttered" (alternatives given: a box shadow, two background colours, extra spacing)
  - Steve Schoger — tweet — https://twitter.com/steveschoger/status/877209916179709955 — 2017-06-20 — "Giving your box shadows a slight, vertical offset helps to make them look more natural."
  - Josh W. Comeau — Designing Beautiful Shadows in CSS — https://www.joshwcomeau.com/css/designing-shadows/ — 2021-09-13, updated 2026-04-27 — "Every shadow on the page should share the same ratio."
  - Josh W. Comeau — same — "As an element gets closer to the user, the offset should increase, the blur radius should increase, and the shadow's opacity should decrease."
  - Josh W. Comeau — same — "When we layer black over our background color, it doesn't just make it darker; it also desaturates it quite a bit."
  - Vercel — Web Interface Guidelines — undated — "Mimic ambient + direct light with at least two layers."
  - Charlie Aufmann & Maxime Heckel (Linear) — 2026-03-12 — "Borders and separators help clarify the relationship between elements in the interface."
  - Vercel — Geist Materials — https://vercel.com/geist/materials — undated — `material-base` "Radius 6px" through `material-fullscreen` "Biggest lift. Radius 16px."
- Confidence: high.
- Conflicts: Jakub's shadow-as-border uses pure black alpha (`oklch(0 0 0 / 0.06)`), Comeau tints shadows toward the background's hue: black alpha is fine on white and neutral surfaces, tint on coloured ones. Jakub prefers shadows to card borders; input borders stay (WCAG 1.4.11).

### V-28: Never put a card inside a card; if a surface must sit on a surface, make them at least two surface steps apart and drop the inner shadow
- Owner example: new (anti-slop tell 1)
- Why: Nested cards add borders and radii without adding meaning, and adjacent container steps blur into each other.
- How: on the listing page the comparables behind «چرا این ارزیابی» are rows with dividers inside one section, not cards in a card; homogeneous listings are list rows (`listing-patterns.md`). If nesting is unavoidable, such as the valuation result inside the valuation form panel, the two surfaces differ by at least two steps, the inner one has no shadow, and radii are concentric (V-26).
- Sources:
  - Google — Material 3 Search guidelines (via Context7) — https://m3.material.io/components/search/guidelines — undated — "To ensure proper contrast, use surface container roles that are more than one step apart."
  - Page Laubheimer (NN/g) — Cards: UI-Component Definition — https://www.nngroup.com/articles/cards-component/ — 2016-11-06 — "Cards are better suited when users browse for information than when they search."
  - `anti-slop-review.md` (Impeccable: "nested cards are always wrong"); not re-fetched in this pass.
- Confidence: medium (Material's rule concerns contrast of nested containers; the "never nest" rule rests on our file's source).
- Conflicts: None.

### V-29: Draw hairlines with colour, not sub-pixel widths: Chromium paints `border: 0.5px` as a full CSS pixel
- Owner example: new
- Why: The CSS spec snaps borders thinner than one device pixel to one device pixel, but Chromium 153 painted a 0.5 px border as thick as a 1 px border at DPR 2 and 3, so "hairline" 0.5 px borders are ordinary lines on Android Chrome.
- How: 1 px borders in a low-contrast border step (Radix steps 6 and 7, Geist steps 4 to 6 are border roles); where a device-pixel line matters, `box-shadow: 0 0 0 0.5px var(--color-border)` rendered one device row at DPR 2 and one full plus one half row at DPR 3. Decorative dividers need no 3:1; input borders do (WCAG 1.4.11). Measured: `border-top: 0.5px` painted 2 device rows at DPR 2 and 3 at DPR 3, and `getComputedStyle` reported 1px at DPR 1, 2, 2.625 and 3.
- Sources:
  - CSS WG — CSS Values 4, "snap a length as a line width" — https://drafts.csswg.org/css-values-4/ — editor's draft, 2026-09-26 — "greater than zero, but less than 1 device pixel, round it away from zero to 1 or -1 device pixel"
  - Radix Colors — Understanding the scale — undated — "Step 6 is designed for subtle borders on components which are not interactive."
  - Hands-on: `visual-test/hairline.mjs`, `hairline2.mjs`, `hairline3.mjs`.
- Confidence: medium (one engine measured; the spec is clear).
- Conflicts: The spec's one device pixel versus Chromium's one CSS pixel.

### Typography (script-agnostic)

### V-30: `text-wrap: balance` on headings and titles without a visible box, `text-wrap: pretty` on multi-line body text; both verified with Persian
- Owner example: new
- Why: Balanced titles and paragraphs without a stranded last word are the cheapest visible polish, and both degrade to normal wrapping.
- How:
  - `text-balance` on h1 to h3 and on listing and model-page titles, never inside badges or chips with a background; `text-pretty` on descriptions, empty- and error-state bodies and the «چرا این ارزیابی» sentences; neither on one- or two-line labels.
  - Limits and support (MDN BCD, Chrome guide): balance up to 6 lines in Chromium and 10 in Firefox; balance in Chrome 114, Firefox 121, Safari 17.5; pretty in Chrome 117 and Safari 26, not Firefox.
  - Persian in Chromium 153: `pretty` moved the orphan «دارد» so the last line became «قرار دارد»; `balance` turned a title that left «در تهران» alone on line 2 into two even lines.
  - Keep a number with its word through a no-break space (U+00A0) so wrapping never splits «تیپ ۲» or «۶۸۰ میلیون».
- Sources:
  - Google Chrome — `improve-text-layout-and-legibility.md` — https://github.com/GoogleChrome/modern-web-guidance — 2026 — "Avoid elements that have visible boxes such as borders or backgrounds, as this can create unexpected visually empty areas in the layout."
  - Google Chrome — same — "It has little to no effect on short, single-line text."
  - Jakub Krehel — Details that make interfaces feel better — undated — "text-wrap: pretty prevents orphaned words at the end of a paragraph."
  - Vercel — Web Interface Guidelines (`AGENTS.md`) — 2026-08-18 — "MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names"
  - MDN browser-compat-data — `text-wrap` — 2026-09-26. Hands-on: `visual-test/wrap2.mjs`.
- Confidence: high.
- Conflicts: The vendored `typography.md` calls `pretty` the default for short-to-medium text; Chrome's guide says it barely affects single-line text. Apply it to multi-line text.

### V-31: Show hover and selected states without reflow: no weight change on chip labels; a check icon and the container fill carry the state
- Owner example: new
- Why: A label that turns bold when selected gets wider and shoves its neighbours in a chip row.
- How: a selected filter chip gets a check icon at the inline start, the container fill and `aria-pressed` or `aria-checked`. If a bolder label is required, reserve its width: `.chip-label { display: inline-flex; flex-direction: column; } .chip-label::after { content: attr(data-label); font-weight: 600; height: 0; overflow: hidden; visibility: hidden; }` (visibility-hidden content stays out of the accessibility tree; inference, standard CSS).
- Sources:
  - Rauno Freiberg — Web Interface Guidelines — https://github.com/raunofreiberg/interfaces — 2023 — "Font weight should not change on hover or selected state to prevent layout shift"
  - Apple — SF Symbols (HIG) — 2025-07-28 — "use the fill variant to indicate selection"
- Confidence: medium.
- Conflicts: `states-a11y.md` says "a selected chip also has a check or a weight change"; Rauno says drop the weight change, or reserve its width as above.

### Spacing and alignment

### V-32: Space on a 4 px base with a curated, non-linear set of steps, and group by proximity: more space between groups than inside them
- Owner example: new
- Why: A linear scale offers too many near-identical choices; proximity is what tells the eye which facts belong together.
- How: Tailwind v4's `--spacing: 0.25rem` makes every multiple of 4 px available, so expose only named steps (inference: 4, 8, 12, 16, 24, 32, 48, 64). In a listing row: title to price 4 px, facts 8 px, groups 12 to 16 px, rows 16 to 24 px (inference). Name tokens by concept (inset, stack, inline), as `tokens.md` does with `--space-field-stack`.
- Sources:
  - Google — Material 3 Spacing (via Context7) — https://m3.material.io/styles/spacing — undated — "The spacing system is measured on an 8dp scale, where space100 = 8dp"
  - Google — Material blog, "Ten steps" (via Context7) — https://m3.material.io/blog/ten-steps-ios-android-design — undated — "The baseline grid is based on an 8dp grid for components and 4dp for type and icons."
  - Nathan Curtis — Space in Design Systems — https://medium.com/eightshapes-llc/space-in-design-systems-188bcbae0d62 — 2016-09-25 — about linear scales: "offering too many choices too close together"
  - Aurora Harley (NN/g) — Proximity Principle in Visual Design — https://www.nngroup.com/articles/gestalt-proximity/ — 2020-08-02 — "Items close together are likely to be perceived as part of the same group"
  - Refactoring UI — chapter "Establish a spacing and sizing system" — https://refactoringui.com/ — UNVERIFIED (secondary summaries report a rule that no two steps be closer than about 25 %).
  - Tailwind 4.3.3 `theme.css`: `--spacing: 0.25rem`.
- Confidence: medium to high.
- Conflicts: Curtis prefers doubling steps (2, 4, 8, 16, 32, 64), Material an 8 dp scale with 4 dp for type and icons; the curated set is a compromise (ours).

### V-33: Align every element to a shared inline-start keyline, and start dividers where the text starts
- Owner example: new
- Why: Accidental alignment is the quiet tell of generated layouts; one keyline per list makes a column scannable.
- How: in a listing row with the thumbnail on the right, title, price, facts and badge share one keyline after the thumbnail and gap; inset dividers begin at that keyline or run full width, one choice per list. Review check: the `right` edges of those elements match within 1 px (RTL).
- Sources:
  - Vercel — Web Interface Guidelines — undated — "Every element aligns with something intentionally whether to a grid, baseline, edge, or optical center."
  - Yann-Edern Gillet (Linear) — How we redesigned the Linear UI (part Ⅱ) — https://linear.app/now/how-we-redesigned-the-linear-ui — 2024-03-28 — "I also spent time aligning labels, icons, and buttons, both vertically and horizontally in the sidebar and tabs."
  - Google — Material 3 Lists specs (via Context7) — https://m3.material.io/components/lists/specs — undated — table value "Divider inset left padding | 16dp"; Spacing page: "Leading and trailing edges swap sides in right-to-left (RTL) languages."
- Confidence: medium.
- Conflicts: None.

### Defensive layout

### V-34: Give every text-bearing flex or grid child `min-width: 0` (grid tracks `minmax(0, 1fr)`), then decide per string: wrap, clamp or truncate
- Owner example: new
- Why: A flex item's default `min-width: auto` refuses to shrink below its content, so one long title or URL pushes the row past the screen edge.
- How: `min-w-0` on the text column beside a listing thumbnail; `grid-template-columns: minmax(0, 1fr) auto` for title-and-price rows; titles wrap (clamped to two lines only where the full title is one tap away); seller names truncate; URLs, VINs and Latin model codes get `overflow-wrap: anywhere`, never `word-break: break-all` on Persian (`persian-type-formatting.md`).
- Sources:
  - Ahmad Shadeed — Minimum content size in CSS flexbox — https://defensivecss.dev/tip/flexbox-min-content-size/ — undated — "To change that default behavior, we need to set the min-width of the flex item to 0."
  - Ahmad Shadeed — Defensive CSS — https://ishadeed.com/article/defensive-css/ — 2021-12-07 — "As a defensive CSS mechanism, I would go for the first one which is using the minmax() function."
  - Vercel — Web Interface Guidelines (`AGENTS.md`) — 2026-08-18 — "MUST: Flex children need `min-w-0` to allow truncation"
- Confidence: high.
- Conflicts: None.

### V-35: Give every photo frame a fixed `aspect-ratio`, `object-fit: cover`, `max-width: 100%` and a neutral background, and keep the same frame when a source forbids photos
- Owner example: new
- Why: User photos arrive in every shape; a fixed frame stops stretching and layout shift, and rows align whether or not a photo exists.
- How: the frame has `aspect-ratio: 4 / 3` (a token); `img { max-width: 100%; object-fit: cover; }`; a neutral surface background; `alt` from the listing title; the no-photo placeholder required by ADR-0008 is the same frame with the neutral fill. `aspect-ratio` is in Chrome 88, Firefox 89 and Safari 15.
- Sources:
  - Ahmad Shadeed — Image distortion — https://defensivecss.dev/tip/image-compressed/ — undated — "The simplest fix for that is to use CSS object-fit."
  - Ahmad Shadeed — Image maximum width — https://defensivecss.dev/tip/img-max-width/ — undated — "don't forget to set max-width: 100% to all images"
  - Ahmad Shadeed — Text over image — https://defensivecss.dev/tip/text-over-image/ — undated — "We fix that easily by adding a background color to the <img> element."
  - Vercel — Web Interface Guidelines (`AGENTS.md`) — 2026-08-18 — "MUST: Prevent CLS (explicit image dimensions)"
- Confidence: high.
- Conflicts: None.

### V-36: Design for the longest and the shortest Farsi: space before trailing actions, a minimum width on buttons, `min-height` instead of `height`
- Owner example: new
- Why: A long title collides with the action beside it; a short Persian label shrinks a button until it stops looking or working like one.
- How: a section header's title and its «همه» link are separated by `gap-4` so a long title never touches the link; buttons carry a `min-inline-size` token so short labels («ثبت»، «باشه») stay large enough to hit; bars and banners use `min-height`.
- RTL/Farsi: Shadeed's own demo is the Arabic «تم»; his snippets use `margin-right`, so write `me-4` or use `gap`.
- Sources:
  - Ahmad Shadeed — Button minimum width — https://defensivecss.dev/tip/button-min-width/ — undated — "we can set a minimum width for the button in advance"
  - Ahmad Shadeed — Component spacing — https://defensivecss.dev/tip/spacing/ — undated — "the title should have 16px margin from the "more" button"
  - Ahmad Shadeed — Fixed sizes — https://defensivecss.dev/tip/fixed-sizes/ — undated — "we need to use min-height instead of height"
- Confidence: high.
- Conflicts: None.

### V-37: Let flex rows wrap unless they are deliberately a scroll rail; space with `gap`, not `space-between`; scroll with `overflow: auto`
- Owner example: new
- Why: An unintended rail hides content; `space-between` spreads a short row of chips across the whole width.
- How: applied-filter chips wrap; the quick filters above results are a deliberate rail with fades (V-21 to V-23); chip groups use `gap` instead of `justify-content: space-between`; scrollers use `overflow-x: auto`, never `scroll`.
- Sources:
  - Ahmad Shadeed — Defensive CSS — https://ishadeed.com/article/defensive-css/ — 2021-12-07 — "A general rule of thumb when using flexbox is to allow wrapping unless you want a scrolling wrapper."
  - Ahmad Shadeed — Scrollbars on demand — https://defensivecss.dev/tip/scrollbar/ — undated — "it's highly recommended to use auto as a value for overflow"
  - Ahmad Shadeed — Using space-between — https://defensivecss.dev/tip/space-between/ — undated — "For simplicity, I will use gap."
- Confidence: high.
- Conflicts: None.

### V-38: Reserve a stable scrollbar gutter on desktop scroll containers whose content length changes
- Owner example: new
- Why: A scrollbar that appears when more results load shifts the whole layout sideways.
- How: `scrollbar-gutter: stable` on `html` for pages that load more results or lock scroll under a dialog (Chrome 94, Firefox 97, Safari 18.2); phones use overlay scrollbars, so nothing changes there (inference).
- Sources:
  - Ahmad Shadeed — Scrollbar gutter — https://defensivecss.dev/tip/scrollbar-gutter/ — undated — "We can avoid that behavior by using the scrollbar-gutter property."
  - MDN browser-compat-data — `scrollbar-gutter` — 2026-09-26.
- Confidence: medium to high (one practitioner plus the support data).
- Conflicts: None.

## Conflicts with current repository files (for the rules work)

- `states-a11y.md`, empty states: add the all-clear exception (V-11) and replace-the-list, hide-sort and `aria-live` for no-results (V-12).
- `states-a11y.md`, "a selected chip also has a check or a weight change": a weight change reflows the row (Rauno); prefer the check and fill, or reserve the bold width (V-31).
- Vendored `make-interfaces-feel-better/icons.md`: 2.5 px beside bold text is heavier than Vazirmatn's measured bold stem (V-2); `surfaces.md` and `overview.md` show `pl-*/pr-*` and `dark:` classes that our lint rejects (V-5, V-25).
- Vendored Vercel and Rauno: "box shadow for focus rings because outline ignores radius" is outdated in every current engine (V-25).
- `apps/web/eslint.config.mjs`: restricts `bg-gradient-to-l/r` but not `mask-l-*`/`mask-r-*`, which are just as physical (V-22).
- Chrome's `modern-web-guidance` (not vendored here): `text-box: trim-both cap alphabetic` breaks Persian badges (V-6); scroll-state queries miss iOS Safari (V-24).
- Owner example #3 names Lucide's `absoluteStrokeWidth`, deprecated in Lucide v1 (V-3); #4 needs the all-clear exception (V-11); #7b is a per-view limit, not a palette size (V-15); #12 needs the `@supports` guard and the RTL gradient direction (V-22).

## Not verified

- Material Design 2 "Empty states" (JavaScript-only, including archived copies).
- Refactoring UI book chapters beyond the free previews: "Don't overlook empty states", "Greys don't have to be grey", "Establish a spacing and sizing system"; claims from them are marked UNVERIFIED above and not quoted.
- Safari and Firefox behaviour of the fade recipe, `text-box` and hairlines: from MDN compat data only; the Playwright 1.63 WebKit build is not installed and nothing was installed.
- Vazirmatn measurements apply to version 33.003 only; CS-3's chosen font must be re-measured with `lab/lab-stem.js` and `lab/lab-trim.js`.
