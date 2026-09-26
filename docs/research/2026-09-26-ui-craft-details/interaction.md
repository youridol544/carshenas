# Pointer, touch and keyboard interaction: research pass for CS-26

- Date: 2026-09-26. Topic: targets, tooltips, menus, press feedback, gestures, focus, scroll, keyboard.
- Method: every cited page was fetched on 2026-09-26 (raw HTML or JSON with curl, library source through the GitHub API, Context7 as a cross-check for Base UI, Radix and Floating UI). Quotes are verbatim and at most 25 words. Numbers without a source are marked *inference*.
- Access notes: W3C pages (WCAG Understanding, APG) answered scripted requests with a JavaScript challenge after the first fetch; their wording was verified against the W3C's own sources on GitHub (`w3c/wcag`, `w3c/aria-practices`), not by working around the challenge. bjk5.com (Ben Kamens) returned a rate-limit page; its text was read from the Internet Archive copy. Material Design 3 pages are JavaScript-only and could not be read; Google's Android accessibility page (which restates Material's numbers) was used instead.
- Hands-on checks (nothing in the repository was changed): Chromium 153.0.8010.12 (Playwright 1.63.0 headless shell) for the scrollbar side in RTL, pseudo-element hit-area centring in RTL and Persian `Intl.Collator` matching; the installed Tailwind 4.3.3 compiled `hover:`, `pointer-fine:hover:`, `active:scale-97`, `select-none`, `touch-manipulation`, `overscroll-contain` and a `@custom-variant hover` override; Node 22.14 `Intl`; the Persian keyboard layout in xkb-data 2.41.
- Versions checked: `@base-ui/react` 1.8.0 (docs) and `main` source, `radix-ui` 1.6.7 (Tooltip docs 1.2.13), `@floating-ui/react` 0.27.20, `vaul` 1.1.2 (README: unmaintained), `sonner` 2.0.8, `cmdk` 1.1.1, Ariakit 0.4.40, Next.js 16.3.5 bundled docs, React 19.2, Tailwind 4.3.3.
- Current repository rules read first: `.claude/rules/ui.md`, `ui-design/references/mobile-forms.md`, `states-a11y.md`, `rtl-bidi.md`, `motion.md`, and the vendored Vercel, Emil Kowalski, Jakub Krehel and ibelick files. Tips below add precision to them; where a tip only restates an existing rule it says so.

## Sources consulted

| Source (author, why credible) | URL | Date | Fetched | Owner examples it states independently |
|---|---|---|---|---|
| W3C WAI, Understanding SC 2.5.8 Target Size (Minimum) (the standard) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (+ `w3c/wcag` source) | updated 2026-05-11 | yes | #6 in part (24 px AA floor, not 44) |
| W3C WAI, Understanding SC 2.5.5 Target Size (Enhanced) | https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html | updated 2026-05-11 | yes (GitHub source) | #6 (44 px, AAA) |
| W3C WAI, Understanding SC 1.4.13 Content on Hover or Focus | https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html | updated 2026-07-12 | yes (GitHub source) | — |
| W3C WAI, Understanding SC 2.5.2 Pointer Cancellation | https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html | updated 2025-09-17 | yes (GitHub source) | — |
| W3C WAI, Understanding SC 2.1.4 Character Key Shortcuts | https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html | updated 2026-02-23 | yes (GitHub source) | — |
| W3C APG task force, Menu and Menubar, Dialog (Modal), Tooltip, Combobox, Toolbar patterns | https://www.w3.org/WAI/ARIA/apg/patterns/ (source: github.com/w3c/aria-practices) | repo pushed 2026-09-24 | yes (GitHub source; site challenged) | #11 in part (tooltip "after a small delay") |
| W3C APG, Developing a Keyboard Interface | https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ | same | yes (GitHub source) | — |
| Apple, HIG Buttons (platform owner) | https://developer.apple.com/design/human-interface-guidelines/buttons | last change 2025-12-16 | yes (JSON) | #6 |
| Apple, HIG Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility | last change 2025-06-09 | yes | #6 (44 default, 28 minimum) |
| Apple, HIG Pointing devices | https://developer.apple.com/design/human-interface-guidelines/pointing-devices | 2023-06-21 | yes | — |
| Apple, HIG Gestures | https://developer.apple.com/design/human-interface-guidelines/gestures | 2024-09-09 | yes | — |
| Apple, Safari Web Content Guide: Handling Events (archived) | https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html | 2016-12-12 | yes | — |
| Google, Android Accessibility Help: Touch target size (restates Material) | https://support.google.com/accessibility/android/answer/7101858 | undated | yes | #6 (as 48 dp) |
| Google, Material Design 3 structure and accessibility | https://m3.material.io/foundations/designing/structure | — | no (JS-only) | — |
| Aurora Harley, NN/g, Touch Targets on Touchscreens (usability research firm) | https://www.nngroup.com/articles/touch-target-size/ | 2019-05-05 | yes | #6 (as 1 cm) |
| Aurora Harley, NN/g, Timing Guidelines for Exposing Hidden Content | https://www.nngroup.com/articles/timing-exposing-content/ | 2015-01-11 | yes | #13 (the delay approach) |
| Alita Kendrick, NN/g, Tooltip Guidelines | https://www.nngroup.com/articles/tooltip-guidelines/ | 2019-01-27 | yes | — |
| Raluca Budiu, NN/g, Fitts's Law and Its Applications in UX | https://www.nngroup.com/articles/fitts-law/ | 2022-07-31 | yes | — |
| Steven Hoober, UXmatters, Design for Fingers, Touch, and People, Part 1 (author of the n=1,333 grip study) | https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php | 2017-03-06 | yes | #6 (7 to 12 mm by position) |
| Ben Kamens, Breaking down Amazon's mega dropdown (origin of the safe triangle) | https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown (read via web.archive.org) | 2013-03-06 | yes (archive) | #13 |
| Ben Kamens, jQuery-menu-aim source | https://github.com/kamens/jQuery-menu-aim | last commit 2014-12-03 | yes | #13 |
| Floating UI team, useHover and safePolygon docs (+ upstream source) | https://floating-ui.com/docs/useHover | 0.27.20 | yes (+Context7) | #13 |
| Floating UI team, FloatingDelayGroup | https://floating-ui.com/docs/FloatingDelayGroup | 0.27.20 | yes | #11 |
| Floating UI team, useDismiss | https://floating-ui.com/docs/useDismiss | 0.27.20 | yes | — |
| Base UI team (MUI; also behind Radix and Floating UI), Tooltip docs + TooltipTrigger source | https://base-ui.com/react/components/tooltip | 1.8.0 | yes (+Context7) | #11 |
| Base UI, Menu docs + MenuTrigger, MenuSubmenuTrigger and safePolygon source | https://base-ui.com/react/components/menu | 1.8.0 / main | yes | #13 |
| Base UI, Popover, Navigation Menu, Button, Drawer, Autocomplete docs; DirectionProvider; useScrollLock, useSwipeDismiss, DrawerViewport, useAnchorPositioning, CompositeRoot source | https://base-ui.com/react/ | 1.8.0 / main | yes | — |
| Radix UI (WorkOS), Tooltip docs + tooltip.tsx source | https://www.radix-ui.com/primitives/docs/components/tooltip | radix-ui 1.6.7 | yes (+Context7) | #11 |
| Radix UI, Dropdown Menu, Navigation Menu, Direction Provider docs + menu.tsx, dropdown-menu.tsx source | https://www.radix-ui.com/primitives/docs/components/dropdown-menu | radix-ui 1.6.7 | yes | #13 (grace polygon in source) |
| Adobe, React Aria Tooltip docs | https://react-spectrum.adobe.com/react-aria/Tooltip.html | undated | yes | #11 |
| Diego Haz, Ariakit TooltipProvider reference | https://ariakit.org/reference/tooltip-provider | 0.4.40 | yes | #11 |
| Devon Govett (React Aria and Parcel author, Adobe), Building a Button Part 1: Press Events | https://react-spectrum.adobe.com/blog/building-a-button-part-1.html | 2020-08-12 | yes | — |
| Devon Govett, Building a Button Part 2: Hover Interactions | https://react-spectrum.adobe.com/blog/building-a-button-part-2.html | 2020-08-25 | yes | — |
| Emil Kowalski (design engineer; author of Vaul and Sonner), 7 Practical Animation Tips | https://emilkowal.ski/ui/7-practical-animation-tips | undated | yes | #11 |
| Emil Kowalski, Building a drawer component | https://emilkowal.ski/ui/building-a-drawer-component | undated | yes | — |
| Emil Kowalski, Vaul source (constants.ts, index.tsx, style.css, README) | https://github.com/emilkowalski/vaul | 1.1.2 (unmaintained) | yes | #6 (44 px handle hit area) |
| Emil Kowalski, Sonner source | https://github.com/emilkowalski/sonner | 2.0.8 | yes | — |
| Emil Kowalski, emil-design-eng skill (vendored) | https://github.com/emilkowalski/skills (commit 85e8e23) | 2026-09-15 | yes (local copy) | #11 |
| Rauno Freiberg (Vercel design engineer), Invisible Details of Interaction Design | https://rauno.me/craft/interaction-design | 2023-07 | yes | — |
| Vercel, Web Interface Guidelines (live page; vendored copy at e3d624b) | https://vercel.com/design/guidelines | fetched 2026-09-26 (vendored 2026-08-18) | yes | #6, #11, #13 ("prediction cones") |
| Jakub Krehel, make-interfaces-feel-better (vendored) | https://github.com/jakubkrehel/make-interfaces-feel-better (commit 35545ea) | 2026-08-29 | yes (local copy) | #6 |
| Ahmad Shadeed (design engineer, author of RTL Styling 101), Designing better target sizes | https://ishadeed.com/article/target-size/ | 2024-01-10 | yes | #6, #13 |
| Heydon Pickering, Inclusive Components: Tooltips & Toggletips | https://inclusive-components.design/tooltips-toggletips/ | 2017-07-25 | yes | — |
| Heydon Pickering, Inclusive Components: Cards | https://inclusive-components.design/cards/ | 2018-06-04 | yes | — |
| Hampus Sethfors, Axess Lab (accessibility consultancy), Disabled buttons suck | https://axesslab.com/disabled-buttons-suck/ | 2017-07-07 | yes | — |
| Adam Silver (form-design specialist), The problem with disabled buttons and what to do instead | https://adamsilver.io/blog/the-problem-with-disabled-buttons-and-what-to-do-instead/ | 2023-05-14 | yes | — |
| Adam Silver, Buttons shouldn't have a hand cursor | https://adamsilver.io/blog/buttons-shouldnt-have-a-hand-cursor/ | 2016-07-15 | yes | — |
| GOV.UK Design System, Button (+ govuk-frontend `button.mjs`) | https://design-system.service.gov.uk/components/button/ | undated | yes | — |
| Paco Coursey, cmdk README and source | https://github.com/pacocoursey/cmdk | 1.1.1 (2025-03-14) | yes | — |
| MDN contributors: touch-action, :active, hover media feature, -webkit-tap-highlight-color, user-select, overscroll-behavior, scrollbar-gutter, env(), viewport meta, dialog, enterkeyhint, autocorrect, KeyboardEvent.code, keydown, aria-keyshortcuts, AbortController | https://developer.mozilla.org/ | fetched 2026-09-26 | yes | — |
| MDN browser-compat-data (dialog `closedby`, `overscroll-behavior`) | https://github.com/mdn/browser-compat-data | fetched 2026-09-26 | yes | — |
| Wenson Hsieh, WebKit, More Responsive Tapping on iOS (engine team) | https://webkit.org/blog/5610/more-responsive-tapping-on-ios/ | 2015-12-15 | yes | — |
| Jake Archibald, Chrome for Developers, 300ms tap delay, gone away | https://developer.chrome.com/blog/300ms-tap-delay-gone-away | page says 2013-12-12 (text mentions 2016) | yes | — |
| Bramus Van Damme (Chrome DevRel), Use overscroll-behavior: contain to prevent a page from scrolling while a dialog is open | https://www.bram.us/2025/11/25/use-overscroll-behavior-contain-to-prevent-a-page-from-scrolling-while-a-dialog-is-open/ | 2025-11-25 | yes | — |
| Chris Coyier, CSS-Tricks, 16px or Larger Text Prevents iOS Form Zoom | https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/ | 2021-05-04 | yes | — |
| Algolia, Debounce sources (Autocomplete docs) | https://www.algolia.com/doc/ui-libraries/autocomplete/guides/debouncing-sources | undated | yes | — |
| React team, useDeferredValue, useFormStatus, You Might Not Need an Effect | https://react.dev/reference/react/useDeferredValue | undated | yes | — |
| Tailwind Labs, v4 upgrade guide; Hover, focus and other states; Adding custom styles | https://tailwindcss.com/docs/upgrade-guide | v4 (4.3.3 installed) | yes | — |
| Vercel, Next.js 16.3.5 bundled docs (metadata defaults, generateViewport, Form) | `apps/web/node_modules/next/dist/docs/` | 16.3.5 | yes (local) | — |
| shadcn, RTL docs | https://ui.shadcn.com/docs/rtl | undated | yes | — |
| xkeyboard-config (layout by Behnam Esfahbod), Persian ISIRI 9147 layout `symbols/ir` | `/usr/share/X11/xkb/symbols/ir` (xkb-data 2.41) | 2.41 | yes (local) | — |

Who independently states the owner's examples: **#6** Apple (Buttons, Accessibility), WCAG 2.5.5, Shadeed, Vercel, Krehel, Vaul (44 px); Google/Material (48 dp), WCAG 2.5.8 (24 px), NN/g (1 cm) and Hoober (7 to 12 mm) state different numbers. **#11** Vercel, Emil Kowalski, Radix, Base UI, React Aria, Ariakit, Floating UI. **#13** Kamens, jQuery-menu-aim, Floating UI, Base UI (source), Radix (source), Shadeed, Vercel; NN/g states the older delay approach instead.

## Tips

### I-1: Size every touch target at least 44 × 44 CSS px and the primary action 48 px; treat WCAG's 24 px as the legal floor, never the design target.
- Owner example: #6
- Why: 44 is not "the" standard. It is Apple's default hit region and WCAG's AAA level; Google asks for 48 dp, WCAG AA's floor is 24 px, and research gives physical sizes (1 cm; 7 mm at the centre to about 12 mm at the corners). Our users are mostly on mid-range Android phones, so the stricter numbers apply.
- How:

  | Source | Value | Status |
  |---|---|---|
  | Apple HIG Buttons | hit region ≥ 44 × 44 pt (visionOS 60 × 60) | "general rule" |
  | Apple HIG Accessibility (iOS, iPadOS) | default 44 × 44 pt, minimum 28 × 28 pt | table |
  | Google Android (Material) | ≥ 48 × 48 dp, ≥ 8 dp apart, about 9 mm | "consider" |
  | WCAG 2.2 SC 2.5.8 (AA) | ≥ 24 × 24 CSS px, or the spacing exception; also Equivalent, Inline, User agent control, Essential | normative |
  | WCAG 2.2 SC 2.5.5 (AAA) | ≥ 44 × 44 CSS px, no spacing exception | normative |
  | NN/g (after Parhi, Karlson, Bederson) | ≥ 1 cm × 1 cm | guidance |
  | Hoober | 7 mm at screen centre, about 12 mm at corners | field research |

  Keep the repo rule: `min-h-11 min-w-11` (2.75rem, 44 px at a 16 px root) for every control, `min-h-12` (48 px) for the primary action. Dense desktop-only surfaces may drop to 40 px (Krehel) only with `pointer-coarse:min-h-11` so touch laptops still get 44 px (Tailwind's documented use of `pointer-coarse`). Size in rem so targets grow with the reader's font size (Shadeed). Measure the hit area, not the glyph (probe with `document.elementFromPoint` 22 px from the centre). *Inference*: at 412 CSS px across a phone roughly 70 mm wide, 1 CSS px ≈ 0.17 mm, so 44 px ≈ 7.5 mm and 48 px ≈ 8 mm; this varies by device.
- Sources:
  - Apple — HIG Buttons — https://developer.apple.com/design/human-interface-guidelines/buttons — 2025-12-16 — "a button needs a hit region of at least 44x44 pt — in visionOS, 60x60 pt"
  - W3C — Understanding SC 2.5.8 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 2026-05-11 — "The size of the target for pointer inputs is at least 24 by 24 CSS pixels"
  - W3C — Understanding SC 2.5.5 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html — 2026-05-11 — "The size of the target for pointer inputs is at least 44 by 44 CSS pixels"
  - Google — Touch target size — https://support.google.com/accessibility/android/answer/7101858 — undated — "A touch target of 48x48dp results in a physical size of about 9mm, regardless of screen size."
  - Aurora Harley, NN/g — Touch Targets on Touchscreens — https://www.nngroup.com/articles/touch-target-size/ — 2019-05-05 — "Interactive elements must be at least 1cm × 1cm (0.4in × 0.4in) to support adequate selection time and prevent fat-finger errors."
  - Ahmad Shadeed — Designing better target sizes — https://ishadeed.com/article/target-size/ — 2024-01-10 — "My recommendation is to have a target with a minimum size of 44 by 44 pixels, at least."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "if the visual target is < 24px, expand its hit target to ≥ 24px. On mobile, the minimum size is 44px."
- Confidence: high
- Conflicts: the owner's "the standard is 44 px" is Apple's and WCAG AAA's number; Google says 48, WCAG AA 24, and Apple's own accessibility table lists 28 pt as the minimum. Krehel allows 40 px in dense desktop UI. The repo (44 px, 48 px primary) already takes the strict side; keep it.

### I-2: Grow the hit area, not the glyph: extend small controls invisibly with a symmetric pseudo-element (`::after { inset: -10px }`), never by enlarging the icon or the layout.
- Owner example: new (serves #6)
- Why: WCAG measures the region that accepts the pointer, so an invisible extension counts; the 20 to 24 px icon and the dense card stay as designed. Vaul gives its 32 × 5 px sheet handle a 44 px hit area this way; Google describes a 24 dp icon inside a 48 dp target.
- How: `.icon-button { position: relative } .icon-button::after { content: ""; position: absolute; inset: -10px; }` turns a 24 px button into a 44 px target; Tailwind `relative after:absolute after:-inset-2.5` (spacing token names follow CS-3). Alternative: `after:inset-0 after:scale-150` (Shadeed's `transform: scale(1.5)`). Shrink the extension where it would overlap a neighbour; overlapping area does not count (WCAG) and hit areas must never overlap (Krehel).
- RTL/Farsi: hands-on, Chromium 153: with `dir="rtl"`, a pseudo-element centred by `inset: 50%` plus `translate(-50%, -50%)` landed entirely beside the button (every probe at ±15 and ±21 px missed), because an over-constrained inset resolves from the right edge in RTL; `inset: -10px` hit in both directions. Krehel's snippet only works because it sets physical `left: 50%`, which our lint forbids, and its logical rewrite (`inset-s-1/2`) breaks.
- Sources:
  - W3C — Understanding SC 2.5.8 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 2026-05-11 — "region of the display that will accept a pointer action, such as the interactive area of a user interface component"
  - Google — Touch target size — https://support.google.com/accessibility/android/answer/7101858 — undated — "Touch targets extend beyond the visual bounds of an element"
  - Emil Kowalski — Vaul `src/style.css` — https://github.com/emilkowalski/vaul — 1.1.2 — code: `[data-vaul-handle-hitarea] { … width: max(100%, 2.75rem); /* 44px */ height: max(100%, 2.75rem); }`
  - Jakub Krehel — make-interfaces-feel-better, overview (vendored) — https://github.com/jakubkrehel/make-interfaces-feel-better — 2026-08-29 — "Extend with a pseudo-element if the visible element is smaller. Never let hit areas of two elements overlap."
  - Ahmad Shadeed — Designing better target sizes — https://ishadeed.com/article/target-size/ — 2024-01-10 — code: `.button:after { content: ""; position: absolute; inset: 0; z-index: -1; transform: scale(1.5); }`
- Confidence: high
- Conflicts: Krehel's Tailwind example (`after:left-1/2 … after:-translate-1/2`) uses a physical inset the repo lint rejects and must not be "fixed" with a logical inset; use a negative inset.

### I-3: Space adjacent targets so their hit areas never overlap: at least 8 px between 44 px targets, more around anything smaller or bezel-less.
- Owner example: new (companion to #6)
- Why: Size alone does not stop mis-taps when neighbours crowd each other; Apple weighs spacing as heavily as size, and WCAG's AA spacing exception is defined by it.
- How: Material: ≥ 8 dp between 48 dp targets. Apple: about 12 pt of padding around bezeled elements, about 24 pt around bezel-less ones (icon rows, text links). WCAG AA test for undersized targets: a 24 px circle centred on each must not intersect another target or another circle. Chip rows and card-header icon buttons: `gap-2` (8 px) plus hit areas that do not overlap. *Inference*: do not place a destructive action (such as «حذف جست‌وجو») next to a frequent one.
- Sources:
  - Apple — HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — 2025-06-09 — "Consider spacing between controls as important as size."
  - Apple — HIG Accessibility — same — "it works well to add about 12 points of padding around elements that include a bezel"
  - Google — Touch target size — https://support.google.com/accessibility/android/answer/7101858 — undated — "Consider making touch targets at least 48x48dp, separated by 8dp of space or more"
  - W3C — Understanding SC 2.5.8 — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — 2026-05-11 — "if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another target"
  - Aurora Harley, NN/g — Touch Targets on Touchscreens — https://www.nngroup.com/articles/touch-target-size/ — 2019-05-05 — "targets must first be big enough, and then also spaced well enough"
- Confidence: high
- Conflicts: Apple's padding (12 or 24 pt around each element) and NN/g's "about 2mm of spacing — the often-recommended minimum" (≈ 12 CSS px, *inference*) are more generous than Material's 8 dp; our 8 px is the floor for 44 px targets only.

### I-4: Make targets at the screen's edges and corners larger, not smaller: on touch, edges are the hardest place to hit.
- Owner example: new
- Why: Fitts's "infinite edge" advantage exists only for a mouse; on touchscreens edge targets take longer to hit and need more size. The bottom navigation, a sheet's close button and the header back button all live at edges.
- How: bottom navigation items fill their cell and are at least 48 px tall above the safe area (I-28); corner buttons get a 48 px hit area around a 20 to 24 px glyph (I-2); the most frequent actions sit away from the extreme corners. Rauno's "magic corners" are a pointer-only technique.
- RTL/Farsi: the geometry mirrors (back at the top right, the sheet's close button at the inline end) but the size rule does not change.
- Sources:
  - Raluca Budiu, NN/g — Fitts's Law and Its Applications in UX — https://www.nngroup.com/articles/fitts-law/ — 2022-07-31 — "while the edge placement offers an advantage in mouse- or trackball-driven UIs, it offers no advantage for touchscreens."
  - Steven Hoober — Design for Fingers, Touch, and People, Part 1 — https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php — 2017-03-06 — "touch targets there can be smaller—as small as 7 millimeters, while corner target sizes must be about 12 millimeters."
  - Rauno Freiberg — Invisible Details of Interaction Design — https://rauno.me/craft/interaction-design — 2023-07 — "Operating systems make use of "magic corners" on the edges of the screen because the target area is infinitely large."
- Confidence: high
- Conflicts: none (Rauno's corners apply to a mouse; NN/g and Hoober to touch).

### I-5: Make bars and lists one contiguous target: padding goes on the link or button itself, not as gap and padding on the container; a label and its control share one target.
- Owner example: new
- Why: Gaps between items in a bar are dead zones where a tap does nothing; a row where only the icon or the checkbox reacts feels broken.
- How: bottom navigation `grid grid-cols-5` with each `<a>` filling its cell (`flex min-h-12 flex-col items-center justify-center`), no gap between cells; filter checkbox rows are a `<label>` wrapping the input and the text with `min-h-11`; sort options are full-row radio labels; tabs fill the bar's height.
- Sources:
  - Apple — HIG Pointing devices — https://developer.apple.com/design/human-interface-guidelines/pointing-devices — 2023-06-21 — "Create contiguous hit regions for custom bar buttons."
  - Ahmad Shadeed — Designing better target sizes — https://ishadeed.com/article/target-size/ — 2024-01-10 — "That happened because that spacing is added to the outer container, not the link itself."
  - Raluca Budiu, NN/g — Fitts's Law — https://www.nngroup.com/articles/fitts-law/ — 2022-07-31 — "avoid the design mistake of only making the icon itself the active target"
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Checkboxes & radios avoid dead zones; the label & control share a single generous hit target."
- Confidence: high
- Conflicts: none.

### I-6: Make a listing card clickable as a whole by stretching its title link over the card, then raise the card's own buttons above it with their own 44 px targets.
- Owner example: new
- Why: A card whose only target is its title is hard to hit; stretching the one real link keeps one link per card for keyboard and screen-reader users. The cost is that text under the overlay is hard to select, and secondary controls need raising.
- How: `article { position: relative } h3 a::after { content: ""; position: absolute; inset: 0 }`. Secondary controls (save «نشان کردن», compare) get `position: relative`; no `z-index` is needed when they come after the link in source order (Pickering). Give them I-2 hit areas and 8 px from the card edge. Content people copy (a phone number, a VIN) either lives on the detail page or is raised too, accepting a gap in the card's target; the JavaScript alternative ignores clicks whose mousedown-to-mouseup exceeds 200 ms so text stays selectable (Pickering).
- Sources:
  - Heydon Pickering — Inclusive Components: Cards — https://inclusive-components.design/cards/ — 2018-06-04 — "it's now difficult to select the text within the card (the link acts as a mask over the top of it)"
  - Heydon Pickering — same — "I found that a 200 millisecond threshold was about right."
  - Ahmad Shadeed — Designing better target sizes — https://ishadeed.com/article/target-size/ — 2024-01-10 — "Using this solution will make the text hard to select. Use with caution and when necessary only."
- Confidence: high
- Conflicts: none; both sources warn about text selection.

### I-7: Show hover styles only where hover exists: redefine Tailwind's `hover` variant once to `(hover: hover) and (pointer: fine)`, and never make anything reachable only by hover.
- Owner example: new
- Why: On iOS an emulated hover sticks after a tap, so hover styling looks like a stuck state on phones. Tailwind v4's `hover:` already checks `(hover: hover)` but not `pointer: fine`, which the repo rule requires. Hybrid devices (touch laptops, iPad with trackpad) defeat media queries, so behaviour that depends on hover (tooltips, hover-opened menus) must check the pointer type in JavaScript.
- How: in `globals.css`: `@custom-variant hover { @media (hover: hover) and (pointer: fine) { &:hover { @slot; } } }`. Verified with the installed Tailwind 4.3.3: `hover:` and `group-hover:` then compile inside that media query. Per class, `pointer-fine:hover:` compiles to nested `@media (pointer: fine) { @media (hover: hover) { … } }`. For behaviour: Floating UI `useHover({ mouseOnly: true })`; Base UI tooltips pass `mouseOnly: true` (source); Radix tooltips return early on `pointerType === 'touch'` (source).
- Sources:
  - Tailwind Labs — Upgrade guide — https://tailwindcss.com/docs/upgrade-guide — v4 — "In v4 we've updated the hover variant to only apply when the primary input device supports hover"
  - MDN — hover media feature — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover — fetched 2026-09-26 — "many mobile devices emulate hovering when the user performs an inconvenient long tap"
  - Devon Govett — Building a Button Part 2 — https://react-spectrum.adobe.com/blog/building-a-button-part-2.html — 2020-08-25 — "On iOS for example, tapping once on an element shows the hover style, and tapping away from the element removes it."
  - Devon Govett — same — "These hybrid devices are incompatible with the hover media queries because the user can change interaction modes at any time."
  - Emil Kowalski — emil-design-eng (vendored) — https://github.com/emilkowalski/skills — 2026-09-15 — "Touch devices trigger hover on tap, causing false positives. Gate hover animations behind this media query."
- Confidence: high
- Conflicts: Tailwind's default `(hover: hover)` is weaker than the repo rule and Emil's `(hover: hover) and (pointer: fine)`; Devon shows both media queries fail on hybrid devices, so use them for decoration and pointer types for behaviour.

### I-8: Delay the first tooltip in a group, then open its neighbours instantly and without an entry animation while the pointer keeps exploring.
- Owner example: #11
- Why: A first hover may be accidental; once the user is scanning a row of icon buttons, repeating the delay makes the interface feel slow. Every major library ships this "delay group", with a skip window measured from when the previous tooltip closed.
- How:

  | Library | First delay | Close delay | Skip window | Instant-state hook |
  |---|---|---|---|---|
  | Radix Tooltip.Provider | `delayDuration` 700 | — | `skipDelayDuration` 300 | `data-state="instant-open"` |
  | Base UI Tooltip | Trigger `delay` 600 | Trigger `closeDelay` 0 | Provider `timeout` 400 | `data-instant` (`delay`, `dismiss`, `focus`) |
  | React Aria TooltipTrigger | `delay` 1500 | `closeDelay` 500 | warm-up/cool-down | — |
  | Ariakit TooltipProvider | `timeout` 500 | `hideTimeout` 0 | `skipTimeout` 300 | — |
  | Floating UI FloatingDelayGroup | `delay` (you set it) | — | `timeoutMs` 0 | `isInstantPhase` |

  For Carshenas (desktop only; see I-9): Base UI defaults, one `Tooltip.Provider` around each toolbar or at the root; the popup transitions `opacity` and `scale` over the `--duration-popover` token and sets `transition-duration: 0ms` under `[data-instant]` (Emil's published example uses 125 ms and Base UI's demo `data-instant:transition-none`). By hand without a library: a module-level `lastClosedAt`; on a mouse `pointerenter`, open after `performance.now() - lastClosedAt < 400 ? 0 : 600` ms and mark the popup instant when the delay was 0; on close, record `lastClosedAt`; cancel the pending timer on `pointerleave`.
- Sources:
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — undated — "Once a tooltip is open, hovering over other tooltips should open them with no delay and no animation."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Delay the first tooltip in a group; subsequent peers have no delay"
  - Radix — tooltip.tsx JSDoc — https://github.com/radix-ui/primitives — main, fetched 2026-09-26 — "How much time a user has to enter another trigger without incurring a delay again."
  - Base UI — Tooltip docs — https://base-ui.com/react/components/tooltip — 1.8.0 — "Another tooltip will open instantly if the previous tooltip is closed within this timeout."
  - React Aria — Tooltip — https://react-spectrum.adobe.com/react-aria/Tooltip.html — undated — "Once a tooltip is displayed, other tooltips display immediately."
  - Ariakit — TooltipProvider — https://ariakit.org/reference/tooltip-provider — 0.4.40 — "all tooltips on the page can be shown immediately, without waiting for the show timeout"
  - Floating UI — FloatingDelayGroup — https://floating-ui.com/docs/FloatingDelayGroup — 0.27.20 — "share a delay which temporarily becomes 1 ms after the first floating element of the group opens"
- Confidence: high
- Conflicts: first delays range 500 to 1500 ms and skip windows 300 to 400 ms; there is no single standard number. Context7's generated summary describes Radix `skipDelayDuration` as a delay "when the trigger is focused", which the source JSDoc contradicts; trust the source. Emil and Base UI also skip the animation; Radix exposes the state and leaves that to CSS.

### I-9: Treat tooltips as desktop hints: never show them on touch, never put anything a user needs only in a tooltip, and use a visible label or a tap-to-open infotip instead.
- Owner example: new (bounds #11)
- Why: A phone has no hover and long-press belongs to the browser's context menu; libraries switch tooltips off on touch. In a phone-first product most users would never see a tooltip.
- How: explanations such as what «ارزش بازار» means or why a listing is «گران» go inline or in a Base UI `Popover` opened by tapping an info button (`openOnHover` optional on desktop, `delay` 300). Toggletip pattern: the button shows the bubble on click, closes on blur, outside click or Escape, and announces through a live region. Bottom navigation keeps visible labels (existing repo rule).
- Sources:
  - Base UI — Tooltip docs — https://base-ui.com/react/components/tooltip — 1.8.0 — "A user should not miss critical information if they never see a tooltip."
  - Base UI — same — "For this reason, tooltips are disabled on touch devices."
  - React Aria — Tooltip — https://react-spectrum.adobe.com/react-aria/Tooltip.html — undated — "Tooltips are not shown on touch screen interactions."
  - Alita Kendrick, NN/g — Tooltip Guidelines — https://www.nngroup.com/articles/tooltip-guidelines/ — 2019-01-27 — "Don’t use tooltips for information that is vital to task completion."
  - Heydon Pickering — Tooltips & Toggletips — https://inclusive-components.design/tooltips-toggletips/ — 2017-07-25 — "In short: just provide a clearly worded, permanently visible label."
- Confidence: high
- Conflicts: Android shows native tooltips on long-press (Base UI notes it), and Material 3 describes long-press tooltips for native apps (not fetched: JS-only site); on the web the libraries and NN/g agree on no touch tooltips.

### I-10: Give every icon button its own accessible name; the tooltip repeats that name for sighted mouse users, it does not supply it.
- Owner example: new
- Why: A tooltip is visual; APG wires it as a description (`aria-describedby`), not a name. A tooltip that repeats a visible label is noise.
- How: `<button aria-label="نشان کردن آگهی">` with tooltip text «نشان کردن» that closely matches it; no tooltip on buttons that already show their label; for an unavailable action use I-37 rather than a tooltip on a disabled button (a disabled button cannot be focused, so keyboard users never see its tooltip).
- Sources:
  - Base UI — Tooltip docs — https://base-ui.com/react/components/tooltip — 1.8.0 — "The tooltip's trigger must have an `aria-label` attribute that closely matches the tooltip's content"
  - W3C APG — Tooltip pattern — https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ — source fetched 2026-09-26 — "The element that triggers the tooltip references the tooltip element with aria-describedby."
  - Alita Kendrick, NN/g — Tooltip Guidelines — https://www.nngroup.com/articles/tooltip-guidelines/ — 2019-01-27 — "This tooltip is repetitive and unnecessary."
- Confidence: high
- Conflicts: Pickering also allows the tooltip to be the primary label through `aria-labelledby`; Base UI asks for `aria-label` on the trigger. Either names the button; pick `aria-label` because it works with Base UI.

### I-11: Make tooltips hoverable, dismissible with Escape without moving focus, closed when the trigger is pressed, and opened at once on keyboard focus but not on focus caused by a click.
- Owner example: new
- Why: WCAG 1.4.13 requires dismissible, hoverable and persistent content; pressing the trigger performs its action, so the tooltip should get out of the way; focus that came from a mouse press should not pop a tooltip.
- How: Base UI keeps tooltips hoverable through `safePolygon()` (source) and `closeOnClick` defaults to true; Radix keeps content hoverable (`disableHoverableContent` defaults to false), closes an open tooltip on `pointerdown` and opens on focus only when no pointer press preceded it (source); React Aria opens instantly on focus. Inside a dialog, the first Escape closes the tooltip only (Floating UI `useDismiss` default, I-31).
- Sources:
  - W3C — Understanding SC 1.4.13 — https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html — 2026-07-12 — "the pointer can be moved over the additional content without the additional content disappearing"
  - W3C — same — "A mechanism is available to dismiss the additional content without moving pointer hover or keyboard focus"
  - Radix — Tooltip docs — https://www.radix-ui.com/primitives/docs/components/tooltip — 1.2.13 — "Opens when the trigger is focused or hovered. Closes when the trigger is activated or when pressing escape."
  - React Aria — Tooltip — https://react-spectrum.adobe.com/react-aria/Tooltip.html — undated — "Tooltips appear after a "warmup" delay when hovering, or instantly on focus."
- Confidence: high
- Conflicts: none.

### I-12: Place tooltips, popovers and submenus with logical sides, let them flip on collision, and scale them from their computed origin.
- Owner example: new
- Why: A physical `side="right"` points the wrong way in RTL; collision flipping keeps a popup on screen; a popup that grows from its trigger reads as caused by it (the motion pass owns the animation values).
- How: Base UI `Positioner side` accepts `top`, `bottom`, `left`, `right`, `inline-end`, `inline-start` (tooltips default `top` with `collisionPadding` 5; menus `bottom`; submenus `inline-end`). Style arrows from `data-side`, which can also be `inline-end`/`inline-start`. `transform-origin: var(--transform-origin)` (Base UI) or `var(--radix-tooltip-content-transform-origin)` (Radix).
- RTL/Farsi: Base UI turns `inline-end` into `left` only when its direction context says `rtl` (`useAnchorPositioning.ts`: `'inline-end': isRtl ? 'left' : 'right'`), so logical sides need I-19. Radix has physical sides only.
- Sources:
  - Base UI — Menu docs — https://base-ui.com/react/components/menu — 1.8.0 — "Submenus and vertical menubars default to `'inline-end'`."
  - Base UI — useAnchorPositioning.ts — https://github.com/mui/base-ui — main — code: `'inline-end': isRtl ? 'left' : 'right'`
  - Radix — Tooltip docs — https://www.radix-ui.com/primitives/docs/components/tooltip — 1.2.13 — "The transform-origin computed from the content and arrow positions/offsets"
  - Emil Kowalski — emil-design-eng (vendored) — https://github.com/emilkowalski/skills — 2026-09-15 — "Popovers should scale in from their trigger, not from center."
- Confidence: high
- Conflicts: none.

### I-13: Keep a submenu open while the pointer travels toward it by testing whether the pointer is inside a "safe triangle", not by lengthening hover delays.
- Owner example: #13
- Why: Moving diagonally from an item to its submenu crosses sibling items, which switch or close the submenu. Long delays fix that but slow every hover; the triangle from the pointer to the submenu's edge says "the user is heading there", and outside it the menu can switch instantly.
- How: Kamens's geometry: at each move, a triangle from the current pointer position to the two corners of the menu edge that touches the submenu. jQuery-menu-aim widens those corners by `tolerance: 75` px, waits `DELAY = 300` ms while the pointer is inside, and tracks the last 3 positions. Floating UI: a polygon from the exit point to the submenu's near edge plus a rectangular "trough" bridging any gap. Radix: a pentagon from the exit point (5 px bleed) over the submenu, valid for 300 ms. CSS-only (Shadeed): an element beside the submenu clipped with `clip-path: polygon(var(--safe-start), 100% 100%, 100% 0)`, whose first point follows the pointer through a custom property. Applies to desktop menus (header navigation by make and model, a sort menu with submenus); on phones menus open by tap.
- Sources:
  - Ben Kamens — Breaking down Amazon's mega dropdown — https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown — 2013-03-06 — "a triangle between the current mouse position and the upper and lower right corners of the dropdown menu"
  - Ben Kamens — same — "If the next mouse position is within that triangle, the user is probably moving their cursor into the currently displayed submenu."
  - Ben Kamens — jquery.menu-aim.js — https://github.com/kamens/jQuery-menu-aim — 2014-12-03 — code: `tolerance: 75,  // bigger = more forgivey when entering submenu`
  - Floating UI — useHover — https://floating-ui.com/docs/useHover — 0.27.20 — "a pointer is safe to traverse as it moves off the reference element and toward the floating element after hovering it"
  - Ahmad Shadeed — Designing better target sizes — https://ishadeed.com/article/target-size/ — 2024-01-10 — "Any area outside the triangle won’t receive pointer events due to its being clipped."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Controls minimize finickiness with generous hit targets, clear affordances, & predictable interactions, e.g., prediction cones"
- Confidence: high
- Conflicts: NN/g recommends the delay approach (open after 0.3 to 0.5 s, close after 0.5 s) that Kamens argues against; current libraries combine a short open delay with a polygon (I-14, I-16).

### I-14: Use the library's safe polygon with its defaults, and know what they do.
- Owner example: #13
- Why: The details that make it feel right (intent speed, "landing", blocking siblings while travelling) are subtle; Base UI already applies them to submenus, hover-opened menus, popovers, navigation menus and tooltips.
- How: Floating UI `useHover(context, { handleClose: safePolygon() })`: `buffer` 0.5 px; `requireIntent` true (upstream source closes when the pointer slows below 0.1 px/ms, and re-checks after 40 ms while it is inside the triangle but not yet on the submenu); `blockPointerEvents` false (true stops siblings from reacting during the trip but can fire a container's `mouseleave`); `buffer: -Infinity` keeps only the rectangular bridge. Base UI source: `Menu.SubmenuTrigger` uses `safePolygon({ blockPointerEvents: true })` with `restMs` and open delay 100 and close delay 0; `Menu.Trigger openOnHover` uses `safePolygon({ blockPointerEvents: !isInMenubar })`; tooltips use `safePolygon()`. Radix builds its own grace polygon for menus and tooltips. For a simple hand-built popover, a short close delay can replace the polygon.
- Sources:
  - Floating UI — useHover — https://floating-ui.com/docs/useHover — 0.27.20 — "Determines whether intent is required for the triangle polygon to be generated (that is, the cursor is moving quickly enough toward the floating element)."
  - Floating UI — same — "Whether CSS pointer-events behind the polygon, reference, and floating elements are blocked."
  - Floating UI — same — "For a simpler alternative, depending on the type of floating element, you can use a short close delay instead."
  - Base UI — MenuSubmenuTrigger.tsx — https://github.com/mui/base-ui — main — code: `handleClose: safePolygon({ blockPointerEvents: true }), restMs: delay, delay: { open: delay, close: closeDelay }`
- Confidence: high (official docs and source)
- Conflicts: none.

### I-15: In RTL the safe triangle points left: submenus open toward the inline end, so the triangle's far corners are the menu's left corners, and every hand-built version must mirror its geometry.
- Owner example: #13
- Why: Kamens describes the LTR case (right corners); in a right-to-left menu the submenu sits on the left and a triangle pointing right would close it as soon as the pointer moves toward it.
- How: libraries compute the polygon from the side the submenu actually rendered on: Radix places submenus `side={dir === 'rtl' ? 'left' : 'right'}` and builds the grace area from that side; Base UI's `safePolygon` reads the resolved placement, and `inline-end` resolves to `left` only with an RTL direction provider (I-19). jQuery-menu-aim needs `submenuDirection: "left"`. Shadeed's CSS version positions the clipped element with physical `right: 100%` and `left:`, so rewrite it with `inset-inline-*` and swap the polygon's x coordinates. Test by moving the pointer diagonally left-down from an item in a Playwright desktop test and asserting the submenu stays open.
- RTL/Farsi: this tip is the RTL rule.
- Sources:
  - Ben Kamens — jquery.menu-aim.js — https://github.com/kamens/jQuery-menu-aim — 2014-12-03 — code comment: `// left, right, above, or below. Defaults to "right".`
  - Radix — menu.tsx — https://github.com/radix-ui/primitives — main — code: `side={rootContext.dir === Direction.RTL ? 'left' : 'right'}`
  - Base UI — safePolygon.ts — https://github.com/mui/base-ui — main — code: `const side = placement?.split('-')[0]`
- Confidence: high (source code); the Shadeed rewrite is *inference*
- Conflicts: none.

### I-16: Time hover-opened menus deliberately: a short open delay with a safe triangle, 300 to 500 ms without one, a close grace of at most 500 ms, and no hover opening on touch.
- Owner example: #13
- Why: Without intent detection a longer rest proves intent; with a polygon, libraries open after about 100 ms. Either way the trigger should show feedback within 0.1 s.
- How: NN/g: feedback within 0.1 s, open after the cursor rests 0.3 to 0.5 s, keep open until the pointer has been away more than 0.5 s. Base UI: submenu `delay` 100 / `closeDelay` 0; `Menu.Trigger openOnHover` `delay` 100; `Popover.Trigger openOnHover` `delay` 300; `NavigationMenu` `delay` 50 / `closeDelay` 50. Radix: submenu opens 100 ms after pointer movement, grace polygon 300 ms (source); `NavigationMenu` `delayDuration` 200, `skipDelayDuration` 300. Floating UI: `restMs: 150` with a fallback `delay: { open: 1000 }`. Hover opening only for fine pointers (`mouseOnly`).
- Sources:
  - Aurora Harley, NN/g — Timing Guidelines for Exposing Hidden Content — https://www.nngroup.com/articles/timing-exposing-content/ — 2015-01-11 — "Wait 0.3–0.5 seconds. If cursor remains stopped within target area, display corresponding hidden content within 0.1 seconds."
  - Aurora Harley, NN/g — same — "Keep displaying the exposed content element until the cursor has left the triggering target area or the exposed content for longer than 0.5 seconds."
  - Floating UI — useHover — https://floating-ui.com/docs/useHover — 0.27.20 — "Waits until the user’s cursor is at “rest” over the reference element before changing the open state."
  - Base UI — Menu docs (SubmenuTrigger props) — https://base-ui.com/react/components/menu — 1.8.0 — table: `delay` 100, `closeDelay` 0
- Confidence: high
- Conflicts: NN/g's 300 to 500 ms versus Base UI's 50 to 100 ms; the short values depend on a safe polygon and on `restMs`. Use library defaults with the polygon; use NN/g's numbers only when hand-building without one.

### I-17: Open menus and popovers on mouse down (not pointer down), commit a choice on release, and never fire an action on the down event.
- Owner example: new
- Why: Opening on mousedown feels native on desktop and allows press-drag-release selection, while touch browsers emit `mousedown` only after a completed tap, so a scroll that starts on the sort button never opens the menu. Committing on the down event breaks WCAG 2.5.2 unless reversible.
- How: Base UI `Menu.Trigger` uses `useClick({ event: 'mousedown' })` and ignores a `mouseup` on an item within 200 ms of opening (source). Floating UI `useDismiss({ outsidePressEvent })`: `'pointerdown'` is eager everywhere, `'mousedown'` eager for a mouse and lazy for touch, `'click'` lazy everywhere. Items commit on `click`. Radix `DropdownMenu.Trigger` toggles on `pointerdown` for any pointer type (source), one more reason to prefer Base UI (ADR-0005).
- Sources:
  - Floating UI — useDismiss — https://floating-ui.com/docs/useDismiss — 0.27.20 — code comment: "Eager on mouse input; lazy on touch input."
  - Devon Govett — Building a Button Part 1 — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "when tapping a button on a touch device, mobile browsers fire the following events" (the list that follows puts `onTouchEnd` before `onMouseDown`, `onMouseUp` and `onClick`)
  - W3C — Understanding SC 2.5.2 — https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html — 2025-09-17 — "The down-event of the pointer is not used to execute any part of the function"
  - Base UI — MenuTrigger.tsx — https://github.com/mui/base-ui — main — "mousedown -> mouseup on menu item should not trigger it within 200ms."
- Confidence: high
- Conflicts: none; opening a menu on a down event is reversible, which SC 2.5.2 allows.

### I-18: Give menus the APG keyboard model: one Tab stop, arrows move, Enter and Space activate, typeahead, Home and End, Escape closes one level and returns focus, Tab leaves; left and right swap in RTL.
- Owner example: new
- Why: Menus are composite widgets; keyboard users expect platform behaviour, and in RTL "open submenu" is ArrowLeft.
- How: APG as quoted below. Base UI `Menu.Root` `loopFocus` defaults to true, `orientation` vertical, `highlightItemOnHover` true, and its list navigation receives `rtl: direction === 'rtl'` (source). Radix `DropdownMenu.Content` `loop` defaults to false; submenu open keys in RTL are Enter, Space and ArrowLeft, close key ArrowRight (source). Ignore auto-repeated keydown for open and toggle actions (React Aria found holding Enter opened a menu and selected its first item).
- RTL/Farsi: ArrowLeft opens a submenu and ArrowRight closes it; horizontal menubars move right to left; typeahead should match Persian letters (*inference*).
- Sources:
  - W3C APG — Menu and Menubar pattern — https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ — source fetched 2026-09-26 — "Tab and Shift + Tab do not move focus among the items in the menu."
  - W3C APG — same — "Close the menu that contains focus and return focus to the element or context"
  - Radix — Dropdown Menu docs — https://www.radix-ui.com/primitives/docs/components/dropdown-menu — radix-ui 1.6.7 — "opens or closes the submenu depending on reading direction."
  - Radix — menu.tsx — https://github.com/radix-ui/primitives — main — code: `rtl: [...SELECTION_KEYS, 'ArrowLeft']` (open), `rtl: ['ArrowRight']` (close)
  - Devon Govett — Building a Button Part 1 — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "React Aria is careful to ignore these repeating events so this does not happen."
- Confidence: high
- Conflicts: APG makes wrapping optional; Base UI loops by default, Radix does not. Pick looping (Base UI default) and keep it consistent.

### I-19: Wrap the app in the primitives' direction provider set to `rtl`; `<html dir="rtl">` alone does not flip their keyboard or positioning logic.
- Owner example: new
- Why: Base UI's `DirectionProvider` defaults to `ltr` and its components read direction from that context, not from the DOM; Radix assumes LTR without its provider. Without it, submenus open to the right, ArrowRight opens them, tabs, sliders and toolbars run left to right, and the safe triangle points the wrong way.
- How: a small client component in the root layout: `<DirectionProvider direction="rtl">{children}</DirectionProvider>` from `@base-ui/react/direction-provider`, keeping `<html lang="fa" dir="rtl">` because the provider "does not affect HTML and CSS". With shadcn, `rtl: true` in `components.json` only rewrites classes; also run `pnpm dlx shadcn@latest add direction` and mount the provider. Guard with a Playwright test: ArrowLeft on a submenu trigger opens the submenu, and the submenu's box is to the left of the trigger.
- RTL/Farsi: this tip is the RTL rule; Base UI's `CompositeRoot`, `MenuRoot`, `SliderControl`, `ScrollArea` and anchor positioning all call `useDirection()` (source search).
- Sources:
  - Base UI — Direction Provider — https://base-ui.com/react/utils/direction-provider — 1.8.0 — "does not affect HTML and CSS. The `dir="rtl"` HTML attribute or `direction: rtl` CSS style must be set additionally"
  - Base UI — same — table: `direction` default `'ltr'`
  - Radix — Direction Provider — https://www.radix-ui.com/primitives/docs/utilities/direction-provider — 1.1.2 — "you need to wrap your application with the Direction.Provider component to ensure all of the primitives adjust their behavior based on the dir prop."
  - shadcn — RTL — https://ui.shadcn.com/docs/rtl — undated — "Add the direction component to your project."
- Confidence: high
- Conflicts: shadcn's RTL transform flips icons with `rtl:rotate-180`, which ADR-0005 forbids (no `rtl:` variants); mirror icons with the repo's `scale: -1 1` wrapper instead.

### I-20: Make each group of related controls (filter chips, sort options, tabs, a card's action row) one Tab stop with arrow keys inside, mirrored in RTL.
- Owner example: new
- Why: A results page with twenty chips should not cost twenty Tab presses; APG's convention is Tab between components and arrows within them.
- How: Base UI `Toolbar`, `ToggleGroup`, `RadioGroup` and `Tabs` implement roving focus (through `CompositeRoot`, which reads the direction provider); native radio groups already behave this way. By hand: `tabindex="0"` on the current item, `-1` on the rest, arrows move and wrap, Home and End jump. A chip row that also scrolls horizontally keeps the focused chip in view (roving tabindex lets the browser scroll it, unlike `aria-activedescendant`).
- RTL/Farsi: the next control is to the left, so ArrowLeft means "next" (APG words the LTR case only); already stated generally in `rtl-bidi.md`.
- Sources:
  - W3C APG — Developing a Keyboard Interface — https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ — source fetched 2026-09-26 — "tab and shift + tab keys move focus from one UI component to another while other keys, primarily the arrow keys, move focus inside"
  - W3C APG — Toolbar pattern — https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ — same — "Grouping controls into toolbars can also be an effective way of reducing the number of tab stops in the keyboard interface."
  - W3C APG — Developing a Keyboard Interface — same — "the user agent will scroll the newly focused element into view"
- Confidence: high for the pattern; the RTL mapping is *inference* from the libraries' direction handling
- Conflicts: none.

### I-21: Give every custom pressable a press state: scale to about 0.97 on `:active`, return in 100 to 160 ms ease-out, and pair any removal of the tap highlight with it.
- Owner example: new
- Why: Without a press state a button feels unresponsive; the scale confirms the touch before the result arrives, inside NN/g's 0.1 s feedback window. Mobile browsers paint a tap highlight that looks foreign on custom controls, but removing it without a replacement leaves no feedback at all.
- How: `transition-[scale] duration-(--duration-press) ease-out active:scale-97` (Tailwind 4.3.3 compiles `active:scale-97` to the individual `scale` property, 97 %). Values: Emil 0.97 (range 0.95 to 0.98), Krehel 0.96 (never below 0.95), durations 100 to 160 ms (Emil), repo token `--duration-press` 120 ms. `-webkit-tap-highlight-color: transparent` only where an `active:` style exists (non-standard property). For large surfaces such as listing cards, change the background instead of scaling (*inference*: scaling a wide card moves its edges visibly). CSS `:active` stays on when the finger slides off (Devon), and Apple warned in 2016 that quick taps on iOS may never show it; check on a real iPhone, and use a JavaScript press state (`data-pressed`, React Aria's `usePress`) where it matters.
- Sources:
  - Apple — HIG Buttons — https://developer.apple.com/design/human-interface-guidelines/buttons — 2025-12-16 — "Always include a press state for a custom button. Without a press state, a button can feel unresponsive"
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — undated — "A scale of 0.97 on the :active pseudo-class should do the job"
  - Jakub Krehel — make-interfaces-feel-better (vendored) — https://github.com/jakubkrehel/make-interfaces-feel-better — 2026-08-29 — "Never use a value smaller than `0.95` — anything below feels exaggerated."
  - Aurora Harley, NN/g — Timing Guidelines — https://www.nngroup.com/articles/timing-exposing-content/ — 2015-01-11 — "On click or tap, display visual feedback and begin exposing hidden content within 0.1 seconds."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Tap highlight follows design. Set webkit-tap-highlight-color."
  - Apple — Safari Web Content Guide: Handling Events — https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html — 2016-12-12 — "On iOS, emulated mouse events are sent so quickly that the down or active pseudo state of buttons may never occur."
  - Devon Govett — Building a Button Part 1 — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "when tapping down on a button and dragging your finger off, the active state persists even when your finger is not over it"
- Confidence: high for having a press state; medium for the exact scale (0.96 vs 0.97)
- Conflicts: Krehel's "Always use `0.96`" versus Emil's 0.97 and the repo's `motion.md` (0.97); the iOS behaviour is from a 2016 archived document and was not re-tested on a device (UNVERIFIED for current iOS).

### I-22: Fire actions on release and let them cancel when the finger slides off or the page scrolls; never act on `pointerdown` or `touchstart`.
- Owner example: new
- Why: People abort a mistaken press by sliding away; a touch that turns into a scroll was not meant as a tap.
- How: native `<button>` and `<a>` with `onClick` (an up-event that browsers do not fire when a touch becomes a scroll). Custom gestures (swipe to reveal, drag) use pointer events with `setPointerCapture`, end on `pointercancel`, and are not treated as a gesture until they pass a slop (Base UI's sheet: 6 px, I-26). Do not navigate on `pointerdown` "for speed".
- Sources:
  - W3C — Understanding SC 2.5.2 — https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html — 2025-09-17 — "they can cancel the action by moving their pointer or finger away from the target before releasing"
  - W3C — same — "the click event in JavaScript triggers on release of the primary mouse button"
  - Devon Govett — Building a Button Part 1 — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "If you touch a button and then scroll the page, you likely did not intend to activate the button."
- Confidence: high
- Conflicts: none.

### I-23: Keep taps instant with `touch-action: manipulation` on controls and the viewport tag Next.js already emits; never add `maximum-scale` or `user-scalable=no`.
- Owner example: new
- Why: iOS used to wait 350 ms for a possible double tap; `width=device-width` removes that only at the initial zoom, so after someone pinch-zooms (which we never block) taps slow down again unless the control has `touch-action: manipulation`. *Inference*: it also stops two quick taps on a stepper's «+» from zooming the page.
- How: `html { touch-action: manipulation }` or `touch-manipulation` on buttons, chips and steppers (Tailwind 4.3.3 compiles it to `touch-action: manipulation`). Next.js 16.3.5 always adds `<meta name="viewport" content="width=device-width, initial-scale=1">`; do not export a `viewport` with `maximumScale` or `userScalable`, even though the Next.js `generateViewport` example shows both.
- Sources:
  - Wenson Hsieh, WebKit — More Responsive Tapping on iOS — https://webkit.org/blog/5610/more-responsive-tapping-on-ios/ — 2015-12-15 — "WebKit on iOS has a 350 millisecond delay before single taps activate links or buttons."
  - Wenson Hsieh, WebKit — same — "single taps on an element with touch-action: manipulation are fast for all zoom scales"
  - MDN — touch-action — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action — fetched 2026-09-26 — "Disabling double-tap to zoom removes the need for browsers to delay the generation of click events when the user taps the screen."
  - Jake Archibald — 300ms tap delay, gone away — https://developer.chrome.com/blog/300ms-tap-delay-gone-away — 2013-12-12 — "this delay is gone for mobile-optimized sites, without removing pinch-zooming!"
  - MDN — viewport meta — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport — fetched 2026-09-26 — "setting user-scalable to a value of no prevents people experiencing low vision conditions from being able to read and understand page content."
  - Vercel (Next.js 16.3.5 bundled docs) — Metadata, Default fields — `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` — 16.3.5 — code: `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- Confidence: high
- Conflicts: Vercel's live guidelines offer `maximum-scale=1` as an alternative to 16 px inputs while also saying "Never disable browser zoom"; MDN notes iOS 10+ ignores `maximum-scale` by default, but other browsers may honour it. Jake Archibald's page says `touch-action` is unsupported in Safari, which WebKit's 2015 post supersedes.

### I-24: Switch off text selection only on interface chrome and during drags, never on listing content people copy.
- Owner example: new
- Why: A long press on a button starts iOS text selection, and a drag selects text across the page, but prices, phone numbers, VINs, model names and addresses must stay copyable.
- How: `select-none` (Tailwind 4.3.3: `-webkit-user-select: none; user-select: none`) on buttons, chips, tabs, bottom navigation and drag handles. During a drag add it to the root and remove it on release (React Aria does this on touch start; Base UI's drawer example uses `data-swiping:select-none`); Vaul applies `user-select: none` to its drawer only under `(hover: hover) and (pointer: fine)`. Do not start a sheet drag while text is selected (I-26). Never on card bodies, listing detail or seller information.
- Sources:
  - Devon Govett — Building a Button Part 1 — https://react-spectrum.adobe.com/blog/building-a-button-part-1.html — 2020-08-12 — "adding user-select: none to the page on touch start on a pressable element, and removes it after a short delay on press up"
  - Devon Govett — same — "We wouldn't want to do this all the time though, because some elements should allow text selection to occur."
  - Vercel — Web Interface Guidelines (vendored) — https://github.com/vercel-labs/web-interface-guidelines — 2026-08-18 — "During drag, disable text selection and set `inert` on dragged elements"
  - Base UI — Drawer docs — https://base-ui.com/react/components/drawer — 1.8.0 — "`<Drawer.Content>` allows text selection of its children without swipe interference when using a mouse pointer."
- Confidence: high
- Conflicts: MDN lists `user-select` as limited availability; Safari needs the `-webkit-` prefix, which Tailwind adds.

### I-25: Dismiss a sheet on a flick or a long-enough drag using the library's thresholds, commit only on release, and let a reversal cancel the dismissal.
- Owner example: new
- Why: A required long drag feels heavy while a quick flick should close; committing mid-gesture removes the chance to change one's mind. Thresholds differ between libraries, so reuse one instead of inventing numbers.
- How:

  | Library | Distance | Velocity | Other |
  |---|---|---|---|
  | Base UI Drawer (main source) | ≥ 50 % of the drawer size (`max(size × 0.5, 10 px)`) | ≥ 0.5 px/ms toward the dismiss side | a reversal ≥ 10 px from the furthest point marks a change of mind; generic swipe threshold 40 px |
  | Vaul 1.1.2 (unmaintained) | ≥ 25 % of visible height (`closeThreshold`) | > 0.4 px/ms | upward drag damped by `8 × (ln(v + 1) − 2)` |
  | Sonner 2.0.8 (toasts) | ≥ 45 px | > 0.11 px/ms | wrong-direction drags damped by `1 / (1.5 + abs(Δ) / 20)` |

  Use Base UI's `Drawer` (ADR-0005). Every sheet also closes by its close button, Escape and Back, and snap points have buttons (WCAG 2.5.7, existing repo rule).
- Sources:
  - Base UI — DrawerViewport.tsx and useSwipeDismiss.ts — https://github.com/mui/base-ui — main — code: `const FAST_SWIPE_VELOCITY = 0.5;`, `Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD)`, `const REVERSE_CANCEL_THRESHOLD = 10;`
  - Emil Kowalski — Vaul `src/constants.ts` — https://github.com/emilkowalski/vaul — 1.1.2 — code: `VELOCITY_THRESHOLD = 0.4`, `CLOSE_THRESHOLD = 0.25`
  - Emil Kowalski — Vaul README — same — "This repo is unmaintained."
  - Emil Kowalski — Building a drawer component — https://emilkowal.ski/ui/building-a-drawer-component — undated — "That way you don’t need to drag until a certain point to close the drawer, you can just flick it."
  - Rauno Freiberg — Invisible Details of Interaction Design — https://rauno.me/craft/interaction-design — 2023-07 — "To make sure the interface responds to intent, triggering on gesture end, regardless of distance, feels right here."
- Confidence: high for the principle; medium for any single number
- Conflicts: 25 % (Vaul) versus 50 % (Base UI) and 0.4 versus 0.5 px/ms. The vendored `emil-design-eng.md` states "velocity exceeds ~0.11" generally, but that value is Sonner's toast threshold, not a sheet's.

### I-26: Do not start a sheet drag while its content is scrolled or being scrolled or has selected text; lock the gesture's axis after a few pixels; put `touch-action: none` only on the drag surface.
- Owner example: new
- Why: A fast scroll up a sheet's list would otherwise overshoot the top, grab the sheet and close it; a horizontal chip row inside a sheet must keep its own scroll; on iOS, cancelling the first `touchmove` cancels native scrolling for the whole gesture.
- How: Vaul drags only when every scrollable ancestor has `scrollTop === 0`, ignores drags for `scrollLockTimeout` 100 ms after a scroll and for 500 ms after opening, skips `<select>` and `[data-vaul-no-drag]`. Base UI attributes a gesture to an axis only after 6 px (`AXIS_LOCK_SLOP`, 2 px bias), ignores swipes that start on `button, a, input, select, textarea, label, [role="button"]`, and honours `data-base-ui-swipe-ignore`. CSS: Vaul sets `touch-action: none` on the drawer and `pan-y` on the handle; never on the page, because `touch-action: none` can block zoom.
- Sources:
  - Emil Kowalski — Building a drawer component — https://emilkowal.ski/ui/building-a-drawer-component — undated — "I added a timeout of 100ms, which prevents you from dragging in that time frame after you’ve reached the top again."
  - Emil Kowalski — Vaul `src/index.tsx` — https://github.com/emilkowalski/vaul — 1.1.2 — code comment: `// The element is scrollable and not scrolled to the top, so don't drag`
  - Base UI — DrawerViewport.tsx — https://github.com/mui/base-ui — main — "on iOS, `preventDefault()` on the first cancelable touchmove cancels native scrolling for the entire gesture"
  - MDN — touch-action — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action — fetched 2026-09-26 — "A declaration of touch-action: none; may inhibit operating a browser's zooming capabilities."
- Confidence: high
- Conflicts: none.

### I-27: Treat every horizontal swipe direction as physical: flip it for RTL, keep custom swipes away from the screen edges, and give each one a button.
- Owner example: new
- Why: Swipe APIs name physical directions (`swipeDirection`, Vaul `direction`, Sonner `swipeDirections`, `touch-action: pan-left`); in RTL "next" and "toward the near edge" reverse. Edge swipes collide with the system's back gestures.
- How: a side drawer at the inline end (the left in RTL) needs Base UI `swipeDirection="left"` with a comment saying why. Native scroll-snap photo rows in an RTL container scroll the right way by themselves (*inference*); gesture-driven carousels must flip their deltas. Start no custom horizontal gesture within about 20 px of either screen edge (*inference*). A swipe-to-delete saved search also shows a «حذف» button (existing repo rule).
- RTL/Farsi: this tip is the RTL rule; bottom sheets move on the block axis and need no flipping.
- Sources:
  - Base UI — Drawer docs — https://base-ui.com/react/components/drawer — 1.8.0 — "`swipeDirection` defaults to `"down"` for bottom sheets. Use `"up"`, `"left"`, or `"right"` for other drawer positions."
  - MDN — touch-action — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action — fetched 2026-09-26 — "pan-left means the user is dragging their finger to the right"
  - Apple — HIG Gestures — https://developer.apple.com/design/human-interface-guidelines/gestures — 2024-09-09 — "Avoid conflicting with gestures that access system UI."
- Confidence: medium (the APIs' physical naming is documented; the RTL consequences and the edge distance are *inference*)
- Conflicts: none.

### I-28: Keep the on-screen keyboard from covering a sheet's fields and the home indicator from covering the bottom bar.
- Owner example: new
- Why: By default the virtual keyboard shrinks only the visual viewport, so a price field in a filter sheet ends up under the keyboard; on phones with a home indicator a bottom bar sits under the system's gesture area.
- How: Base UI `<Drawer.VirtualKeyboardProvider>` around sheets that contain fields; or the viewport's `interactive-widget=resizes-content` (Next.js `Viewport` type accepts `interactiveWidget`; browser support not checked here). For bars: `viewportFit: 'cover'` in the Next.js viewport export plus `padding-block-end: calc(<space token> + env(safe-area-inset-bottom))` on the bottom navigation and the sticky «دیدن آگهی» bar. Do not autofocus a field in a sheet on phones.
- Sources:
  - MDN — viewport meta — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport — fetched 2026-09-26 — "By default, the virtual keyboard only resizes the visual viewport, which doesn't affect the layout of the page."
  - Base UI — Drawer docs — https://base-ui.com/react/components/drawer — 1.8.0 — "Use `<Drawer.VirtualKeyboardProvider>` when a bottom sheet contains form fields and you want Base UI to manage keyboard-aware focus and scroll handling"
  - MDN — env() — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env — fetched 2026-09-26 — code: `padding: 1em 1em calc(1em + env(safe-area-inset-bottom));`
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Rarely autofocus on mobile because the keyboard opening can cause layout shift."
- Confidence: medium (documented APIs; not tested on devices here)
- Conflicts: none.

### I-29: Lock page scroll under modal sheets and dialogs without a layout jump by reserving the scrollbar gutter (`scrollbar-gutter: stable`), never by adding `padding-right`.
- Owner example: new
- Why: Hiding the page scrollbar widens the layout and everything jumps sideways. Compensating with `padding-right` assumes the scrollbar is on the right, which is false for RTL scroll containers.
- How: Base UI's scroll lock feature-tests `scrollbar-gutter`, sets `html { scrollbar-gutter: stable }` with `overflow: hidden`, falls back otherwise, takes a separate path for iOS overlay scrollbars and skips locking in Safari while pinch-zoomed (source). By hand: `html { scrollbar-gutter: stable }` (Baseline 2024) and hide overflow on `html` while a modal is open. Chrome 144+ and Firefox 150+ also accept Bramus's CSS-only lock (`dialog { overscroll-behavior: contain } dialog::backdrop { overflow: hidden; overscroll-behavior: contain }`); Safari still applies `overscroll-behavior` only to overflowing containers (browser-compat-data), so keep the JavaScript lock for iOS. Base UI menus opened by hover are never modal, and on touch a modal menu leaves the page scrollable unless it spans nearly the full width.
- RTL/Farsi: hands-on, Chromium 153: the root scrollbar of an RTL page stayed on the right, but an RTL inner scroll container put its scrollbar on the left (content started 15 px in from the left edge). Physical `padding-right` compensation is therefore wrong inside RTL containers; `scrollbar-gutter` is side-agnostic. Firefox's root scrollbar side in RTL was not tested (UNVERIFIED).
- Sources:
  - MDN — scrollbar-gutter — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter — fetched 2026-09-26 — "When using classic scrollbars, the gutter will be present if overflow is auto, scroll, or hidden even if the box is not overflowing."
  - Base UI — useScrollLock.ts — https://github.com/mui/base-ui — main — "Pinch-zoom in Safari causes a shift. Just don't lock scroll if there's any pinch-zoom."
  - Bramus Van Damme — Use overscroll-behavior: contain… — https://www.bram.us/2025/11/25/use-overscroll-behavior-contain-to-prevent-a-page-from-scrolling-while-a-dialog-is-open/ — 2025-11-25 — "it now also works on non-scrollable scroll containers"
  - MDN browser-compat-data — css/properties/overscroll-behavior.json — https://github.com/mdn/browser-compat-data — fetched 2026-09-26 — data: Chrome 144, Firefox 150; Safari 16 "partial_implementation"
  - Base UI — Menu docs — https://base-ui.com/react/components/menu — 1.8.0 — "Nested menus ignore this prop, and menus opened by hover are never modal."
- Confidence: high
- Conflicts: Bramus's CSS-only method is Chromium and Firefox only; Safari needs the JavaScript lock.

### I-30: Contain scrolling inside overlays, lists and horizontal chip rows with `overscroll-behavior: contain`, but never on the page itself.
- Owner example: new
- Why: Scroll chaining makes the results page scroll behind a sheet once the sheet's list hits its end; `contain` also switches off pull-to-refresh and horizontal swipe navigation inside that element, which is right for a chip row and wrong for the page.
- How: `overscroll-contain` on sheet bodies, menus, the filter sheet and the suggestion list; `overscroll-x-contain` on horizontal chip and photo rows; nothing on `html` or `body`. Base UI's drawer examples set `overscroll-behavior: contain`.
- RTL/Farsi: *inference*: at the far (left) end of an RTL chip row, an extra swipe would otherwise reach the browser's horizontal swipe navigation.
- Sources:
  - MDN — overscroll-behavior — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior — fetched 2026-09-26 — "The contain value disables native browser navigation, including the vertical pull-to-refresh gesture and horizontal swipe navigation."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Set overscroll-behavior: contain intentionally e.g., in modals/drawers."
- Confidence: high
- Conflicts: none; the vendored Vercel file already says "MUST: `overscroll-behavior: contain` in modals/drawers", this adds where not to use it.

### I-31: Escape (and the mobile Back gesture) closes only the topmost layer, and focus returns to what opened it, or to the next logical place when that element is gone.
- Owner example: new
- Why: Nested layers (a tooltip in a dialog, a submenu in a menu, suggestions in a search sheet) must peel off one at a time; focus that falls to `<body>` strands keyboard and screen-reader users.
- How: APG dialog rules below; after deleting a saved search from a sheet, focus the next row or the list heading instead of the vanished row. Initial focus is the first focusable element, or the sheet's title with `tabindex="-1"` when the content is long (the filter sheet). Combobox: the first Escape closes the list, a second may clear the field. Floating UI `useDismiss` does not bubble Escape to parents by default. A native `<dialog>` opened with `showModal()` behaves as `closedby="closerequest"`: Esc and the mobile back gesture close it; `closedby="any"` adds light dismiss (Chrome 134, Firefox 141, Safari only in preview per browser-compat-data).
- Sources:
  - W3C APG — Dialog (Modal) — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — source fetched 2026-09-26 — "When a dialog closes, focus returns to the element that invoked the dialog unless either: The invoking element no longer exists."
  - W3C APG — same — "add tabindex="-1" to a static element at the top of the dialog, such as the dialog title or first paragraph, and initially focus that element"
  - W3C APG — Combobox — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ — same — "Dismisses the popup if it is visible. Optionally, if the popup is hidden before Escape is pressed, clears the combobox."
  - Floating UI — useDismiss — https://floating-ui.com/docs/useDismiss — 0.27.20 — "if you’re dismissing a tooltip inside a dialog using the esc key, you likely don’t want the dialog to dismiss as well"
  - MDN — dialog — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog — fetched 2026-09-26 — "such as pressing the Esc key on desktop platforms, or a "back" or "dismiss" gesture on mobile platforms"
- Confidence: high
- Conflicts: none; extends the existing "close on Back and Escape, return focus" rule with the vanished-trigger and nested-layer cases.

### I-32: Make keyboard shortcuts modifier-based or scoped to focus, never global single letters; match physical keys with `event.code` so they survive the Persian layout; skip IME composition and auto-repeat; show the shortcut on the control.
- Owner example: new
- Why: Speech-input users trigger single-letter shortcuts by dictating (WCAG 2.1.4). On the standard Persian layout the K key types «ن» and the digit row types Persian digits, so checks such as `event.key === 'k'` or `'1'` never match. Virtual keyboards report composition keydowns with keyCode 229.
- How: prefer Ctrl/⌘ combinations; a global `/` to focus search is a character-key shortcut, so it must be possible to turn it off or remap it, or it must work only while a given component has focus (WCAG 2.1.4). Match `event.code === 'KeyK'` or `event.key.toLowerCase() === 'k'` (*inference*: `code` follows the QWERTY position printed on Iranian keyboards). Return early on `event.isComposing || event.keyCode === 229` and on `event.repeat` for toggles. Avoid modifier + Tab, Enter, Space or Escape, and the browser's find, refresh, address-bar and history keys (APG). Reveal shortcuts on the element (tooltip text, `<kbd>`) and with `aria-keyshortcuts`.
- RTL/Farsi: xkb-data 2.41, Persian (ISIRI 9147) layout: `<AC08>` (K) is `Arabic_noon`, `<AB10>` (/) is `slash`, and the digit row is `Farsi_1`…`Farsi_0`, while the "Persian (Windows)" variant types Latin digits. So `/` survives a layout switch; letters and digits do not. APG lists localization among the factors for key assignment.
- Sources:
  - W3C — Understanding SC 2.1.4 — https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html — 2026-02-23 — "Inadvertent strings of characters from the speech application are not interpreted as shortcuts if a modifier key is required"
  - W3C — same — "The keyboard shortcut for a user interface component is only active when that component has focus"
  - W3C APG — Developing a Keyboard Interface — https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ — source fetched 2026-09-26 — "Localizing the interface, including for differences in which keys are available and how they behave and for language considerations that could impact mnemonics."
  - W3C APG — same — "The primary means of making functions and their shortcuts discoverable is by making the target elements focusable and revealing key assignments on the element itself."
  - MDN — KeyboardEvent.code — https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code — fetched 2026-09-26 — "returns a value that isn't altered by keyboard layout or the state of the modifier keys"
  - MDN — keydown event — https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event — fetched 2026-09-26 — "229 is a special value set for a keyCode relating to an event that has been processed by an IME"
  - xkeyboard-config — `symbols/ir` — `/usr/share/X11/xkb/symbols/ir` — 2.41 — code: `key <AC08> { [ Arabic_noon, …`, `key <AB10> { [ slash, Arabic_question_mark, …`
- Confidence: medium (standards and MDN are firm; how each OS reports `event.key` with Ctrl or ⌘ on a Persian layout was not measured)
- Conflicts: MDN marks `KeyboardEvent.code` as not Baseline, so keep the `event.key` fallback.

### I-33: Build quick search and command menus with ⌘K/Ctrl+K, arrows, Enter and Escape, keep the active option in view with `block: 'nearest'`, and match Persian text only after normalising Arabic ي and ك to Persian ی and ک.
- Owner example: new
- Why: cmdk made ⌘K the convention, and its small details (looping, an IME guard, nearest scrolling, keywords in filtering) are what make it feel right. Persian users type ی and ک, while text collected from other sites often contains Arabic ي and ك; `Intl.Collator` does not treat them as equal.
- How: cmdk: `if (e.key === 'k' && (e.metaKey || e.ctrlKey))` toggles `Command.Dialog`; `loop`; `vimBindings` defaults to true (Ctrl+N/J/P/K); `scrollIntoView({ block: 'nearest' })` plus `scroll-padding-block` 8 px; `filter(value, search, keywords)`; `aria-activedescendant` on the input. cmdk composes Radix Dialog, so under ADR-0005 build the same thing from Base UI `Autocomplete` in a `Dialog` ("Can be used for filterable command pickers"), with `Autocomplete.useFilter({ sensitivity: 'base' })` and `locale="fa"`. Normalise both query and items first: U+064A → U+06CC, U+0643 → U+06A9 (and U+0649 → U+06CC, *inference*, not tested). Apply the I-32 shortcut rules to the ⌘K binding.
- RTL/Farsi: hands-on, Node 22.14 and Chromium 153, `new Intl.Collator('fa', { sensitivity: 'base', usage: 'search' })`: «پژو ۲۰۶» equals «پژو 206» and «می‌خواهم» equals «میخواهم» (digits and ZWNJ handled), but ي ≠ ی and ك ≠ ک.
- Sources:
  - Paco Coursey — cmdk README — https://github.com/pacocoursey/cmdk — 1.1.1 — "⌘K is a command menu React component that can also be used as an accessible combobox."
  - Paco Coursey — same — "To scroll item into view earlier near the edges of the viewport, use scroll-padding:"
  - Paco Coursey — same — "Composes Radix UI's Dialog component."
  - Paco Coursey — cmdk `src/index.tsx` — same — code: `item.scrollIntoView({ block: 'nearest' })`, `const isComposing = e.nativeEvent.isComposing || e.keyCode === 229`
  - Base UI — Autocomplete docs — https://base-ui.com/react/components/autocomplete — 1.8.0 — "Matches items against a query using `Intl.Collator` for robust string matching."
- Confidence: medium (library facts are firm; the Persian result comes from one hands-on test on two runtimes)
- Conflicts: cmdk depends on Radix Dialog, while ADR-0005 chose Base UI.

### I-34: Debounce search-as-you-type requests by about 200 ms (never over 300 ms), drop stale responses, defer rendering with `useDeferredValue`, and show a spinner only after debounce + 300 ms.
- Owner example: new
- Why: A request per keystroke floods the API and flashes results; long debounces feel laggy; responses that arrive out of order show results for an older query.
- How: Algolia: 200 ms preferred, over 300 ms degrades; `stallThreshold` = debounce + 300 ms (500 ms) before any loading indicator. React: `useDeferredValue` for rendering the suggestion list (no fixed delay, interruptible) and a debounce for network requests; ignore stale responses with an effect-cleanup flag or cancel them with `AbortController`. Submitting (Enter or the keyboard's search key) goes to the full results page (I-35).
- Sources:
  - Algolia — Debounce sources — https://www.algolia.com/doc/ui-libraries/autocomplete/guides/debouncing-sources — undated — "200 ms is the preferred debounce delay. Delays of over 300 ms will start degrading the user experience."
  - Algolia — same — "Set it to your debounce delay plus 300 ms."
  - React — useDeferredValue — https://react.dev/reference/react/useDeferredValue — undated — "Unlike debouncing or throttling, it doesn’t require choosing any fixed delay."
  - React — same — "useDeferredValue does not by itself prevent extra network requests."
  - React — You Might Not Need an Effect — https://react.dev/learn/you-might-not-need-an-effect — undated — "two different requests “raced” against each other and came in a different order than you expected."
  - MDN — AbortController — https://developer.mozilla.org/en-US/docs/Web/API/AbortController — fetched 2026-09-26 — "allows you to abort one or more Web requests as and when desired"
- Confidence: high
- Conflicts: none; Vercel's live guidelines give a similar spinner rule ("a short show-delay (~150–300 ms) & a minimum visible time (~300–500 ms)"), which the loading pass covers.

### I-35: Make the search box a real search form: `type="search"` in a `role="search"` form (Next.js `<Form>`), `enterkeyhint="search"`, text at least 16 px, and autocorrect off.
- Owner example: new
- Why: The keyboard's action key then reads "search" and submits; iOS Safari zooms into any input under 16 px; autocorrect rewrites Latin model names and codes.
- How: `<Form action="/search" role="search"><input type="search" name="q" enterKeyHint="search" autoCorrect="off" spellCheck={false} autoCapitalize="off" dir="auto" className="text-base" /></Form>`. In multi-field forms, `enterkeyhint="next"` between fields and `"done"` on the last. `inputmode`, `autocomplete` and digit normalisation stay as in `mobile-forms.md`. *Inference*: `autocomplete="off"` only on fields that show our own suggestion list, so the browser's history dropdown does not cover it.
- Sources:
  - MDN — enterkeyhint — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint — fetched 2026-09-26 (Baseline widely available since November 2021) — "defining what action label (or icon) to present for the enter key on virtual keyboards"
  - Chris Coyier — 16px or Larger Text Prevents iOS Form Zoom — https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/ — 2021-05-04 — "as soon as the font-size is 15px or less, the viewport will zoom into that input."
  - MDN — autocorrect — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect — fetched 2026-09-26 (Baseline 2026, newly available since September 2026) — "controls whether autocorrection of editable text is enabled for spelling and/or punctuation errors"
  - Vercel (Next.js 16.3.5 bundled docs) — Form Component — `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md` — 16.3.5 — "It's useful for forms that update URL search params"
- Confidence: high
- Conflicts: Vercel's `maximum-scale=1` alternative to 16 px inputs (see I-23).

### I-36: Prevent double submission: keep submit enabled until the request starts, then mark it busy while it stays focusable and keeps its label, ignore repeat presses, and make the server idempotent.
- Owner example: new
- Why: Double clicks come from habit, slow connections and tremors; disabling before the request starts blocks validation; a natively `disabled` button drops keyboard focus.
- How: React 19 `useFormStatus().pending` inside the submit button; `aria-disabled="true"` with the label «در حال ارسال…» (existing repo rule); with Base UI, `<Button disabled={pending} focusableWhenDisabled>` and `aria-labelledby` on the changing text; return early from the handler while pending. GOV.UK ignores a second click within 1 s. Server: an idempotency key per submission (*inference*: a hidden input holding a UUID generated when the form renders).
- Sources:
  - GOV.UK Design System — Button — https://design-system.service.gov.uk/components/button/ — undated — "Prevent accidental double clicks on submit buttons from submitting forms multiple times."
  - GOV.UK Frontend — button.mjs — https://github.com/alphagov/govuk-frontend — main — code: `const DEBOUNCE_TIMEOUT_IN_SECONDS = 1`
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Keep submit enabled until submission starts; then disable during the in-flight request, show a spinner, & include an idempotency key."
  - React — useFormStatus — https://react.dev/reference/react-dom/hooks/useFormStatus — undated — "If true, this means the parent <form> is pending submission."
  - Base UI — Button docs — https://base-ui.com/react/components/button — 1.8.0 — "specify `focusableWhenDisabled` so focus remains on the button while it is disabled"
- Confidence: high
- Conflicts: Vercel says "disable"; the repo says `aria-disabled`, not `disabled`. They agree if "disable" means `aria-disabled` plus a guard in the handler.

### I-37: Do not disable buttons silently: keep them enabled and explain on press, or show the reason next to them and use `aria-disabled` so they stay focusable.
- Owner example: new
- Why: Disabled buttons give no feedback, cannot be focused, have low contrast, and people do not notice when they become enabled.
- How: «ذخیرهٔ جست‌وجو» with no filter chosen stays enabled; pressing it shows «دست‌کم یک فیلتر انتخاب کنید» inline and moves focus there. Where disabling is truly needed: `aria-disabled="true"` (stays focusable) and a visible reason under the button, not in a tooltip (I-10); the text stays readable (existing contrast rule).
- Sources:
  - Hampus Sethfors, Axess Lab — Disabled buttons suck — https://axesslab.com/disabled-buttons-suck/ — 2017-07-07 — "Just don’t disable buttons! Have them enabled and then show an error message when the user clicks them."
  - Adam Silver — The problem with disabled buttons and what to do instead — https://adamsilver.io/blog/the-problem-with-disabled-buttons-and-what-to-do-instead/ — 2023-05-14 — "This means keyboard users won’t be able to tab to the button."
  - GOV.UK Design System — Button — https://design-system.service.gov.uk/components/button/ — undated — "Disabled buttons have poor contrast and can confuse some users, so avoid them if possible."
  - W3C APG — Developing a Keyboard Interface — https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ — source fetched 2026-09-26 — "When a disabled element does need to remain discoverable, aria-disabled="true" is applied so that it will remain focusable."
  - Vercel — Web Interface Guidelines — https://vercel.com/design/guidelines — fetched 2026-09-26 — "Don’t pre-disable submit. Allow submitting incomplete forms to surface validation feedback."
- Confidence: high
- Conflicts: none; sharpens `states-a11y.md` ("disabled (rare; prefer enabled with an explanation)").

### I-38: Decide the button cursor once: Tailwind v4 leaves buttons with the default arrow; if the hand is wanted, add it in one base rule for enabled buttons only.
- Owner example: new
- Why: Tailwind v4's preflight dropped `cursor: pointer` on buttons to match browsers, and Adam Silver argues the hand means "link"; many products show it on every clickable thing. Mixing both across screens is the real defect.
- How: either keep the default (links get the hand from the browser; stretched card links show it automatically, I-6) or add `@layer base { button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; } }` (Tailwind's documented snippet). Never show the hand on an `aria-disabled` control.
- Sources:
  - Tailwind Labs — Upgrade guide — https://tailwindcss.com/docs/upgrade-guide — v4 — "Buttons now use cursor: default instead of cursor: pointer to match the default browser behavior."
  - Adam Silver — Buttons shouldn't have a hand cursor — https://adamsilver.io/blog/buttons-shouldnt-have-a-hand-cursor/ — 2016-07-15 — "Many designers and developers believe that the hand (or pointer) cursor signifies clickable elements. But it’s only meant to signify links."
  - Heydon Pickering — Cards — https://inclusive-components.design/cards/ — 2018-06-04 — "the entire card already takes the pointer cursor style, because the card has the link stretched over it."
- Confidence: medium
- Conflicts: this is a taste decision with credible sources on one side and common practice on the other; the repo has no rule yet, so it is left for the owner.

## Conflicts at a glance

- **Owner #6 ("the standard is 44 px")**: 44 is Apple's default and WCAG AAA; Google/Material says 48 dp, WCAG AA 24 px (with a spacing exception), Apple's accessibility table lists 28 pt as the minimum, NN/g 1 cm, Hoober 7 to 12 mm by screen position. Spacing matters as much as size (Apple). The repo's 44/48 px stands.
- **Owner #11 (delay group)**: confirmed by seven independent sources; sharpened: the skip window is counted from when the previous tooltip closed (300 to 400 ms), instant tooltips also skip their animation, and tooltips are off on touch, so on a phone-first product this matters only on desktop. Library first delays disagree (500 to 1500 ms).
- **Owner #13 (safe triangle)**: confirmed; NN/g's older timing article prefers delays (0.3 to 0.5 s open, 0.5 s close); modern libraries pair a 50 to 100 ms open delay with a polygon. In RTL the triangle must point left, which depends on the direction provider.
- **Repo `ui.md` and `motion.md`**: the hover rule `(hover: hover) and (pointer: fine)` is stricter than Tailwind v4's built-in `hover:`; enforce it with the `@custom-variant hover` override (verified on 4.3.3). Press scale 0.97 (repo, Emil) versus 0.96 (vendored Krehel).
- **Vendored `emil-design-eng.md`**: its general "velocity exceeds ~0.11" dismissal threshold is Sonner's toast value; sheets use 0.4 (Vaul) or 0.5 px/ms (Base UI).
- **Vendored Krehel hit-area snippet**: uses physical `left`, and its logical rewrite mis-centres in RTL; use a negative inset (measured).
- **Vercel live guidelines**: offer `maximum-scale=1` as an alternative to 16 px inputs, contradicting the repo's zoom rule and Vercel's own "Never disable browser zoom"; the Next.js `generateViewport` example also disables zoom.
- **ADR-0005**: shadcn's RTL transform uses `rtl:rotate-180` (banned variant); cmdk depends on Radix Dialog; Vaul is unmaintained, so sheets should use Base UI `Drawer`.
- **Evidence quality**: Context7's generated description of Radix `skipDelayDuration` is wrong; the source JSDoc is authoritative.
