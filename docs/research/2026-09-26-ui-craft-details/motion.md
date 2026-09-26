# Motion and animation: craft details for Carshenas (CS-26 research pass)

Scope: motion and animation rules for a Farsi, right-to-left, phone-first used-car search app on Next.js 16.3.5 (App Router), React 19 and Tailwind CSS 4.3, with no animation library (ADR-0003). Pages were fetched on 2026-09-26 with `curl` or WebFetch. Library behaviour was checked in the installed packages under `apps/web/node_modules` (read-only). Every quote was copied from fetched text. Anything not fetched is marked UNVERIFIED, and every inferred value is labelled "inference". Examples use the product's own surfaces: listing cards, the filter sheet, filter chips, saved searches, deal badges and the photo gallery.

## Sources consulted

| Source (author, why credible) | URL | Date | Fetched | Owner examples it states independently |
|---|---|---|---|---|
| Emil Kowalski (web team at Linear, formerly Vercel's design team; author of Sonner, Vaul, animations.dev): "You Don't Need Animations" | https://emilkowal.ski/ui/you-dont-need-animations | n.d. | yes | #14 |
| Emil Kowalski: "Great Animations" | https://emilkowal.ski/ui/great-animations | n.d. | yes | #1, #10 |
| Emil Kowalski: "7 Practical Animation Tips" | https://emilkowal.ski/ui/7-practical-animation-tips | n.d. | yes | #16, #17 |
| Emil Kowalski: "Good vs Great Animations" | https://emilkowal.ski/ui/good-vs-great-animations | n.d. | yes | #16 |
| Emil Kowalski: "Building a Drawer Component" (Vaul) | https://emilkowal.ski/ui/building-a-drawer-component | n.d. | yes | #17 |
| Emil Kowalski: "Building a Toast Component" (Sonner) | https://emilkowal.ski/ui/building-a-toast-component | n.d. | yes | #1 |
| Vaul source (Emil Kowalski): `src/constants.ts`, `index.tsx`, `helpers.ts`, `use-snap-points.ts` at commit 3e97aac | https://github.com/emilkowalski/vaul/tree/3e97aac6a38e4481bade71d7233ed6002e80f9b0/src | 2025-10-03 | yes | #17 |
| Sonner source (Emil Kowalski): `src/index.tsx`, `src/styles.css` at commit 8e4662b | https://github.com/emilkowalski/sonner/tree/8e4662b39255120b62138312058f5d77c0139a5e/src | 2026-08-10 | yes | #1, #10, #17 |
| Apple, WWDC18 session 803 "Designing Fluid Interfaces" (Chan Karunamuni, Nathan de Vries, Marcos Alonso, the designers of the iPhone X gesture system), transcript | https://developer.apple.com/videos/play/wwdc2018/803/ | 2018-06 | yes | #1, #14, #17 |
| Apple, WWDC23 session 10158 "Animate with springs" (Jacob Xiao), transcript | https://developer.apple.com/videos/play/wwdc2023/10158/ | 2023-06 | yes | #1 |
| Apple Human Interface Guidelines: Motion (read through the DocC JSON endpoint) | https://developer.apple.com/design/human-interface-guidelines/motion | updated 2025-09-09 | yes | #1, #10 |
| Apple HIG: Accessibility, Motion section | https://developer.apple.com/design/human-interface-guidelines/accessibility | updated 2025-06-09 | yes | #10 |
| Apple HIG: Right to left | https://developer.apple.com/design/human-interface-guidelines/right-to-left | n.d. | yes | none |
| Apple HIG: Sheets | https://developer.apple.com/design/human-interface-guidelines/sheets | updated 2026-03-24 | yes | none |
| Apple HIG: Gestures | https://developer.apple.com/design/human-interface-guidelines/gestures | updated 2024-09-09 | yes | none |
| Apple UIKit documentation: `UIView.animate(withDuration:delay:usingSpringWithDamping:initialSpringVelocity:…)` | https://developer.apple.com/documentation/uikit/uiview/animate(withduration:delay:usingspringwithdamping:initialspringvelocity:options:animations:completion:) | n.d. | yes | #1 |
| Rauno Freiberg (design engineer, craft essays at rauno.me): "Invisible Details of Interaction Design" | https://rauno.me/craft/interaction-design | 2023-07 | yes | #1, #14 |
| Benji Taylor (designer of the Family wallet and of Honk): "Family Values" | https://benji.org/family-values | 2024-07-08 | yes | #14 |
| Jakub Krehel (design engineer at Interfere, formerly OpenSea; author of the vendored make-interfaces-feel-better): "Details that make interfaces feel better" | https://jakub.kr/writing/details-that-make-interfaces-feel-better | 2026-03-10 | yes | #1, #9, #17 |
| Jakub Krehel: "Drag gestures on the web" | https://jakub.kr/work/drag-gesture | 2026-01-27 | yes | #17 |
| Jakub Krehel: "How I use shared layout animations" | https://jakub.kr/work/shared-layout-animations | 2025-11-24 | yes | #14, #15 |
| Josh W. Comeau (CSS and animation educator): "Springs and Bounces in Native CSS" | https://www.joshwcomeau.com/animation/linear-timing-function/ | 2025-10-28, updated 2026-05-05 | yes | #1 |
| Josh W. Comeau: "Accessible Animations in React with 'prefers-reduced-motion'" | https://www.joshwcomeau.com/react/prefers-reduced-motion/ | 2020-05-04, updated 2026-04-29 | yes | #10 |
| Josh W. Comeau: "An Interactive Guide to CSS Transitions" | https://www.joshwcomeau.com/animation/css-transitions/ | 2021-02-09, updated 2026-05-05 | yes | #10 |
| Josh W. Comeau: "A Friendly Introduction to Spring Physics" | https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/ | 2020-09-21, updated 2025-11-03 | yes | none |
| Matt Perry (author of Motion, formerly Framer Motion): "The Web Animation Performance Tier List" | https://motion.dev/magazine/web-animation-performance-tier-list | 2025-11-05 | yes | #1, #10, #14 |
| Matt Perry: "When browsers throttle requestAnimationFrame" | https://motion.dev/magazine/when-browsers-throttle-requestanimationframe | 2020-10-01 | yes | #10 |
| Motion documentation (read through Context7 `/websites/motion_dev`): react-transitions, react-accessibility, react-motion-config, react-drag, animate | https://motion.dev/docs/react-transitions | fetched 2026-09-26 | yes | #1, #10, #14, #15 |
| Motion source: `PanSession.ts` at commit b16457c | https://github.com/motiondivision/motion/blob/b16457cec3ceae60506b972d7557477a5f372c72/packages/framer-motion/src/gestures/pan/PanSession.ts | 2026-09-25 | yes | none |
| Google, Material Design 1: Motion, Choreography (Wayback snapshot) | https://web.archive.org/web/20170522114928/https://material.io/guidelines/motion/choreography.html | snapshot 2017-05-22 | yes | #9, #14, #16 |
| Material Design 2: Motion, Speed (Wayback snapshot) | https://web.archive.org/web/20181031201120/https://material.io/design/motion/speed.html | snapshot 2018-10-31 | yes | none |
| Material Design 2: Motion, Choreography (Wayback snapshot) | https://web.archive.org/web/20190508011629/https://material.io/design/motion/choreography.html | snapshot 2019-05-08 | yes | #9, #14 |
| Material Design 2: Bidirectionality (Wayback snapshot) | https://web.archive.org/web/20180528164348/https://material.io/design/usability/bidirectionality.html | snapshot 2018-05-28 | yes | none |
| Material 3 motion tokens and `MotionScheme` in Jetpack Compose (Google's official implementation), androidx at commit 1608250 | https://github.com/androidx/androidx/tree/160825094a81825468a95b115bfb1b541e549856/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3 | 2026-08-05 | yes | none |
| Material 3 website, motion pages | https://m3.material.io/styles/motion/overview/how-it-works | none | no: the page renders only with JavaScript | none |
| Una Kravets and Joey Arhar (Chrome): "Four new CSS features for smooth entry and exit animations" | https://developer.chrome.com/blog/entry-exit-animations | 2023-08-16 (correction note 2024-09-13) | yes | #16 |
| Jake Archibald and Bramus (Chrome): "Same-document view transitions for single-page applications" | https://developer.chrome.com/docs/web-platform/view-transitions/same-document | 2021-08-17, updated 2024-09-25 | yes | #1, #10, #15 |
| Bramus (Chrome): "What's new in view transitions (2025 update)" | https://developer.chrome.com/blog/view-transitions-in-2025 | 2025-10-08 | yes | none |
| Bramus: "What's new in view transitions (2024 update)" | https://developer.chrome.com/blog/view-transitions-update-io24 | 2024-05-16 | yes | none |
| Bramus: "Misconceptions about view transitions" | https://developer.chrome.com/blog/view-transitions-misconceptions | 2024-07-11 | yes | #1 |
| Philip Walton (Chrome): "Memory and Energy Saver modes" | https://developer.chrome.com/blog/memory-and-energy-saver-mode | 2022-12-08 | yes | #10 |
| Jake Archibald: "View transitions: Handling aspect ratio changes" | https://jakearchibald.com/2024/view-transitions-handling-aspect-ratio-changes/ | 2024-02-21 | yes | #15 |
| Milica Mihajlija (web.dev), reporting Addy Osmani and Nate Schloss's Chrome Dev Summit 2019 talk: "Adaptive loading" | https://web.dev/articles/adaptive-loading-cds-2019 | 2019-12-16 | yes | #10 |
| GoogleChromeLabs: react-adaptive-hooks README at commit baad292 | https://github.com/GoogleChromeLabs/react-adaptive-hooks | 2022-02-24 | yes | #10 |
| MDN pages: prefers-reduced-motion, deviceMemory, hardwareConcurrency, Battery Status API, will-change, transform-origin, scrollLeft, @starting-style, translate, Compute Pressure API, saveData, requestAnimationFrame, overscroll-behavior, prefers-reduced-data | https://developer.mozilla.org/en-US/docs/Web/ | modified between 2024-04-01 and 2026-09-16 | yes | #10, #17 |
| MDN browser-compat-data (main branch; all version numbers below) | https://github.com/mdn/browser-compat-data | fetched 2026-09-26 | yes | none |
| CSS Working Group editor's drafts: CSS Transitions 1, CSS Transforms 1 and 2, CSS View Transitions 1, CSS Text 3 | https://drafts.csswg.org/ | fetched 2026-09-26 | yes | #1 |
| W3C Devices and Sensors WG: Battery Status API, editor's draft | https://w3c.github.io/battery/ | fetched 2026-09-26 | yes | #10 |
| W3C WAI: Understanding SC 2.3.3 "Animation from Interactions", and the term "motion animation" (w3c/wcag commit 342b58e) | https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html | updated 2025-09-16; term amended 2025-06-27 | yes (WebFetch and the GitHub source) | #10 |
| Val Head, A List Apart: "Designing Safer Web Animation For Motion Sensitivity" | https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/ | 2015-09-08 | yes | #10 |
| Page Laubheimer (Nielsen Norman Group): "Executing UX Animations: Duration and Motion Characteristics" | https://www.nngroup.com/articles/animation-duration/ | 2020-02-09 | yes | none |
| React team: `<ViewTransition>` reference (react.dev for 19.3) | https://react.dev/reference/react/ViewTransition | fetched 2026-09-26 | yes | #1, #10, #15 |
| React team: "React 19.3" | https://react.dev/blog/2026/09/09/react-19-3 | 2026-09-09 | yes | #15 |
| Vercel: Next.js 16.3.5 docs as installed: `guides/view-transitions.md`, `components/link.md`, `functions/use-router.md`, `functions/use-link-status.md`, `upgrading/version-16.md` | `apps/web/node_modules/next/dist/docs/01-app/` | 16.3.5 | yes (local) | #1, #10, #15 |
| Vercel Engineering: agent-skills `react-view-transitions` at commit 063bee9 (read as a source, not installed) | https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions | 2026-08-28 (skill dated March 2026) | yes | #1, #9, #15 |
| Base UI (the Radix, Floating UI and MUI team; our chosen primitives in ADR-0005): Animation handbook | https://base-ui.com/react/handbook/animation | fetched 2026-09-26 | yes | #1, #16 |
| WebKit Bugzilla 168837 and 169138 (Chris Dumez, Apple) | https://bugs.webkit.org/show_bug.cgi?id=168837 | 2017-02-24 and 2017-03-03 | yes | #10 |
| StatCounter Global Stats: Iran, mobile operating system and browser share (CSV exports of the OS and browser pages) | https://gs.statcounter.com/os-market-share/mobile/iran and https://gs.statcounter.com/browser-market-share/mobile/iran | August 2026 | yes (CSV export) | #10 |
| Chrome Platform Status: "Add Save Data Client Hint" | https://chromestatus.com/feature/5645928215085056 | Chrome 102 | yes | #10 |
| Installed code: `next/dist/compiled/react` (19.3.0-canary-cbb046ab-20260731) and react-dom timeouts; `@types/react` 19.3.0; workspace `react` 19.2.8; `tailwindcss` 4.3.3 | `apps/web/node_modules` | fetched 2026-09-26 | yes (local) | #15 |
| originell, gist "Analysis of Apple's rubber band scrolling" (a secondary source that quotes a tweet by @chpwn) | https://gist.github.com/originell/6961057 | 2013-10-13 | yes | #17 |
| Ilya Lobanov, "How UIScrollView works" (Medium) | https://medium.com/@esskeetit/how-uiscrollview-works-e418adc47060 | none | no (HTTP 403) | none |
| animations.dev landing page | https://animations.dev/ | none | yes; not cited because it is course marketing | none |
| Repo vendored copies: `emil-design-eng.md`, `make-interfaces-feel-better/animations.md`, `vercel-web-interface-guidelines.md` | `.claude/skills/ui-design/references/vendor/` | pinned 2026-09-18 | yes (local) | #1, #9, #16, #17 |

## Tips

### M-1: Make every interactive animation retargetable, and choose the mechanism by what it does when interrupted
- Owner example: #1
- Why: People change their minds mid-gesture. The web's four animation mechanisms behave differently when interrupted, and that decides whether the app feels alive or makes people wait.
- How:
  - CSS transition: retargets from the current value. A reversed transition gets a proportionally shorter duration but replays the whole timing curve from the start, so the velocity jumps. Use it for every toggle: filter sheet open and close, popovers, chip pressed state, accordions.
  - CSS `@keyframes` and one-shot WAAPI: restart from the first keyframe. Use them only for one-time entrances, such as a toast arriving or a first-view stagger.
  - Physics spring in JS (Motion's `type: "spring"` with stiffness and damping, or a hand-written integrator): keeps its velocity when retargeted. It is the only mechanism that turns around smoothly. It runs on the main thread and is not installed (ADR-0003), so treat it as an alternative only.
  - View transition, including React `<ViewTransition>`: cannot be interrupted (see M-3).
  - In code, never set a control to `disabled` or ignore taps "until the animation ends", and never wait for `transitionend` or `finished` before changing state.
- Sources:
  - Chan Karunamuni (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "Next, we want to allow for constant redirection and interruption."
  - Base UI — Animation handbook — https://base-ui.com/react/handbook/animation — fetched 2026-09-26 — "Transitions are recommended over CSS animations, because a transition can be smoothly cancelled midway."
  - CSSWG — CSS Transitions Level 1 (ED) — https://drafts.csswg.org/css-transitions-1/ — fetched 2026-09-26 — "these rules lead to the entire timing function of the new transition being used, rather than jumping into the middle of a timing function"
  - Josh W. Comeau — Springs and Bounces in Native CSS — https://www.joshwcomeau.com/animation/linear-timing-function/ — 2025-10-28 — "The CSS version, by contrast, turns around instantly, as though it hit a wall."
  - Jacob Xiao (Apple) — Animate with springs — https://developer.apple.com/videos/play/wwdc2023/10158/ — 2023-06 — "springs are the only type of animation that maintains continuity both for static cases and cases with an initial velocity."
  - Apple — HIG Motion — https://developer.apple.com/design/human-interface-guidelines/motion — 2025-09-09 — "As much as possible, don't make people wait for an animation to complete before they can do anything"
- Confidence: high
- Conflicts: #1 is right, but on the web "interruptible" means retargetable. Only a JS spring keeps momentum, and a reversed CSS transition changes speed abruptly. motion.md says "Interrupting an animation must not snap". That holds for transitions only; view transitions skip to their end.

### M-2: Decide by frequency before designing any motion
- Owner example: new
- Why: An animation seen dozens of times a day stops being delight and becomes delay. A search product is used in long, repetitive sessions.
- How (the Carshenas mapping is inference, applied from the sources):
  - Dozens of times a day: no motion, or at most a 100 to 150 ms colour or opacity change. This covers toggling a filter chip, changing sort, results refreshing after a filter change, "more results", switching tabs inside a listing, the highlight in search suggestions, and submitting with Enter.
  - Occasionally: standard motion. This covers opening the filter sheet, opening and closing the photo viewer, the share sheet, a «جستجو ذخیره شد» toast and dialogs.
  - Rarely: delight is allowed. This covers the first valuation explainer, onboarding and the first saved-search success.
  - The test: would this still feel fast the fiftieth time today?
- Sources:
  - Emil Kowalski — You Don't Need Animations — https://emilkowal.ski/ui/you-dont-need-animations — n.d. — "Used multiple times a day, this component would quickly become irritating."
  - Rauno Freiberg — Invisible Details of Interaction Design — https://rauno.me/craft/interaction-design — 2023-07 — "I removed motion from core interactions and suddenly felt like I was moving much faster"
  - Apple — HIG Motion — https://developer.apple.com/design/human-interface-guidelines/motion — 2025-09-09 — "In apps, generally avoid adding motion to UI interactions that occur frequently."
  - Benji Taylor — Family Values — https://benji.org/family-values — 2024-07-08 — "Delight tends to increase as the frequency of feature usage decreases."
- Confidence: high
- Conflicts: Family animates tab switches with "a flash of directional motion", but a wallet switches tabs rarely. For a listing's specs and history tabs, use no motion or a fade of 150 ms or less.

### M-3: Use view transitions only for navigations and rare reveals, never for controls people tap repeatedly
- Owner example: #1, #15
- Why: A view transition snapshots the page and cannot be retargeted. Starting a new one skips the running one to its end, and React queues and batches the updates in between. While the transition runs, the overlay swallows taps and named elements are skipped by hit-testing.
- How:
  - Use them for list-to-detail morphs, revealing a Suspense boundary and step changes inside a sheet.
  - Do not use them for filter chips, sort, the save heart or tabs, because each needs to respond to rapid repeated taps. Use CSS transitions there.
  - Add `::view-transition { pointer-events: none; }`, keep every view transition at 400 ms or less (inference, inside the sources' 300–500 ms range), and don't put `view-transition-name` on anything people tap rapidly.
  - If a transition has to wait for data, the page is frozen during the wait, so fetch before you start it. Next.js navigations already do this.
- Sources:
  - Bramus — Misconceptions about view transitions — https://developer.chrome.com/blog/view-transitions-misconceptions — 2024-07-11 — "You'll notice the ongoing transition skips to the end when a new one starts."
  - React team — `<ViewTransition>` — https://react.dev/reference/react/ViewTransition — fetched 2026-09-26 — "When the first A->B animation finishes the next one will animate from B->D."
  - Matt Perry — The Web Animation Performance Tier List — https://motion.dev/magazine/web-animation-performance-tier-list — 2025-11-05 — "You're forced to choose between waiting until the current animation has finished, or instantly finishing the current animation"
  - Jake Archibald and Bramus — Same-document view transitions — https://developer.chrome.com/docs/web-platform/view-transitions/same-document — 2024-09-25 — "During this time, the page is frozen, so delays here should be kept to a minimum."
  - Vercel — Next.js 16.3.5 guide "Designing view transitions" (installed docs) — `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` — 16.3.5 — "keep transitions short and avoid naming elements the user clicks rapidly."
- Confidence: high
- Conflicts: The Vercel skill tells agents to "Implement **all** applicable patterns", which is more aggressive than the frequency rule in M-2. Our rule narrows it.

### M-4: Show press feedback when the finger lands and act when it lifts; never make feedback wait for data
- Owner example: new
- Why: The interface has to show it heard the touch at once. The tap should commit on release, so a finger that slides off can cancel it.
- How:
  - CSS: `.btn { transition: scale 120ms var(--ease-out) } .btn:active { scale: .97 }`. The individual `scale` property composes with other transforms (M-19).
  - Tailwind 4.3: `active:scale-[0.97] transition-transform`. In v4, `scale-*` emits `scale:`, and `transition-transform` covers `transform, translate, scale, rotate` (verified in the installed Tailwind).
  - Filter chips that change the results: drive the chip's selected state from `useOptimistic` so it flips instantly while the results update inside a transition.
  - Desktop hover lift on listing cards: only under `(hover: hover) and (pointer: fine)`. Lift an inner element, not the hit target, so the card never slides out from under the pointer.
- Sources:
  - Marcos Alonso (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "the button should highlight immediately when I touch down on it. … But, we shouldn't confirm the tap until my touch goes up."
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — n.d. — "A scale of 0.97 on the :active pseudo-class should do the job"
  - Vercel — react-view-transitions skill, `references/patterns.md` — https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions — 2026-08-28 — "Give the controls an immediate value with `useOptimistic` (drive `aria-current` from it) so feedback is instant while the content streams."
  - Josh W. Comeau — An Interactive Guide to CSS Transitions — https://www.joshwcomeau.com/animation/css-transitions/ — 2021-02-09 — "The trick is to separate the trigger from the effect."
- Confidence: high
- Conflicts: Emil uses 0.97. Jakub (vendored) uses 0.96 and "never … smaller than 0.95". Both fit inside our 0.95 to 0.98 range.

### M-5: Default to motion that does not overshoot; allow a little only after a thrown gesture, and never on opacity or colour
- Owner example: new (springs compared with easing curves)
- Why: Bounce distracts in a tool. It is earned when the user's gesture carried momentum.
- How:
  - Tap-triggered motion, such as opening the filter sheet from «فیلترها»: damping ratio 1.0 (bounce 0).
  - After a flick, such as swipe-to-dismiss: damping ratio about 0.8 (Apple Music's Now Playing). Bounce 0.15 reads as "brisk", 0.3 as noticeably bouncy, and anything above 0.4 is too much for UI.
  - Split "spatial" motion (position and size) from "effects" (opacity and colour). Material 3 tokens: standard spatial springs use damping 0.9 at stiffness 700 (fast 1400, slow 300); expressive spatial use 0.8 at 380 (fast 0.6 at 800); every effects spring uses damping 1.0 (stiffness 1600, fast 3800, slow 800). So opacity and colour never overshoot.
  - Under Reduce Motion, set bounce to 0 (M-30).
- Sources:
  - Nathan de Vries (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "we recommend starting with 100% damping, or no overshoot when you're tuning elastic behaviors."
  - Nathan de Vries (Apple) — same — 2018-06 — "if the gesture that's driving the motion itself has momentum, then you should reward that momentum with a little bit of overshoot."
  - Jacob Xiao (Apple) — Animate with springs — https://developer.apple.com/videos/play/wwdc2023/10158/ — 2023-06 — "you should be cautious about using values higher than around 0.4, since they may feel too exaggerated for a UI element."
  - Google — Compose Material 3 `MotionScheme.kt` KDoc — https://github.com/androidx/androidx/blob/160825094a81825468a95b115bfb1b541e549856/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/MotionScheme.kt — 2026-08-05 — "For color or alpha animations use the `effects` equivalent which ensures a "non-spatial" motion."
  - Josh W. Comeau — A Friendly Introduction to Spring Physics — https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/ — 2020-09-21 — "Springs are most impactful when it comes to motion; I wouldn't use them for color or opacity changes."
- Confidence: high
- Conflicts: Motion's `animate()` defaults to `bounce: 0.25`, which is bouncier than Apple's recommended starting point of 0, so set bounce explicitly. Emil (vendored) says "Keep bounce subtle (0.1-0.3)", which agrees.

### M-6: For spring feel without a library, use generated `linear()` tokens, and remember they are still timed curves
- Owner example: #1 (partly)
- Why: `linear()` reproduces a spring's shape in pure CSS, runs off the main thread and is Baseline: Chrome 113, Firefox 112, Safari 17.2.
- How:
  - Generate the curves with Jake Archibald and Adam Argyle's Linear() Easing Generator. Store them as tokens, for example `--spring-smooth` and `--spring-smooth-time`, and write the stiffness and damping in a comment.
  - Override inside `@supports (animation-timing-function: linear(0, 1))`, with a `cubic-bezier` fallback outside it.
  - Use them for events that run one way, such as a sheet opening or a toast arriving, not for toggles likely to be reversed mid-flight.
  - A spring built from `linear()` has a fixed duration, cannot inherit velocity, and the reversing rule replays it faster.
- Sources:
  - Josh W. Comeau — Springs and Bounces in Native CSS — https://www.joshwcomeau.com/animation/linear-timing-function/ — 2025-10-28 — "a spring intended to take 1600ms might re-run at only 400ms."
  - Josh W. Comeau — same — "Both animations ran equally smoothly, even on low-end hardware." (the second test string had more than 100 points)
  - Motion docs — Transitions — https://motion.dev/docs/react-transitions — fetched 2026-09-26 — "Duration-based spring animations are set via a `duration` and `bounce`. These don't incorporate velocity but are easier to understand"
- Confidence: high
- Conflicts: motion.md has no spring tokens. Emil (vendored) points to Motion's `useSpring`, which is out of scope under ADR-0003.

### M-7: When a drag ends, continue the settle animation at the finger's speed
- Owner example: #1
- Why: A jump in speed at release reads as a glitch. Apple's APIs take the release velocity for exactly this reason.
- How:
  - JS spring: pass the release velocity in. Apple normalises it as velocity divided by distance, per second.
  - CSS curve (inference): a `cubic-bezier(x1, y1, …)` starts at (y1 / x1) × distance / duration. So choose duration ≈ (y1 / x1) × remaining distance / release speed, clamped to 150 to 500 ms.
  - Worked example (inference): Vaul's `cubic-bezier(0.32, 0.72, 0, 1)` has an initial slope of 2.25. Over 300 px in 500 ms it starts at 1.35 px/ms, close to a real flick, which is why its fixed 500 ms feels continuous.
  - motion.md's `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` has an initial slope of 6.25. With `--duration-sheet` (240 ms) it starts at about 7.8 px/ms over the same 300 px, a visible lurch after a slow release (inference).
- Sources:
  - Apple — UIKit `animate(withDuration:delay:usingSpringWithDamping:initialSpringVelocity:…)` — https://developer.apple.com/documentation/uikit/uiview/animate(withduration:delay:usingspringwithdamping:initialspringvelocity:options:animations:completion:) — n.d. — "For smooth start to the animation, match this value to the view's velocity as it was prior to attachment."
  - Jacob Xiao (Apple) — Animate with springs — https://developer.apple.com/videos/play/wwdc2023/10158/ — 2023-06 — "a spring animation uses the velocity it had when it was retargeted as the initial velocity"
  - Emil Kowalski — Building a Drawer Component — https://emilkowal.ski/ui/building-a-drawer-component — n.d. — "Duration of 500ms is also supposed to mimic iOS's Sheet."
  - Vaul source — `src/constants.ts` — https://github.com/emilkowalski/vaul/blob/3e97aac6a38e4481bade71d7233ed6002e80f9b0/src/constants.ts — 2025-10-03 — "DURATION: 0.5, EASE: [0.32, 0.72, 0, 1]"
- Confidence: medium (the principle is high; the curve-duration formula is inference)
- Conflicts: motion.md's 240 ms sheet token suits opening by tap, not settling after a drag. Material gives sheets 250 ms to expand and 200 ms to collapse; Vaul uses 500 ms for both.

### M-8: Measure release velocity over the last 100 ms of pointer samples, not over the whole drag
- Owner example: new (gesture physics)
- Why: An average over the whole drag misses a slow drag that ends in a flick, and overcounts a press that was held before the flick.
- How:
  - Keep a small buffer of `{x, y, t}` from `pointermove` (use `event.timeStamp`).
  - On `pointerup`, velocity = (last point − the sample at least 100 ms older) ÷ Δt, in px/ms.
  - Skip the pointer-down sample if it is older than 200 ms (Motion's guard).
  - Vaul and Sonner use the whole-drag average. That is acceptable for toasts and weaker for sheets.
- Sources:
  - Marcos Alonso (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "we don't use the last position. We use the history of the touch"
  - Motion source — `PanSession.ts` — https://github.com/motiondivision/motion/blob/b16457cec3ceae60506b972d7557477a5f372c72/packages/framer-motion/src/gestures/pan/PanSession.ts — 2026-09-25 — "velocity: getVelocity(history, 0.1)" and "This prevents stale pointer-down points from diluting velocity in hold-then-flick gestures."
  - Vaul source — `src/index.tsx` — https://github.com/emilkowalski/vaul/blob/3e97aac6a38e4481bade71d7233ed6002e80f9b0/src/index.tsx — 2025-10-03 — "const velocity = Math.abs(distMoved) / timeTaken;"
- Confidence: high
- Conflicts: Emil's libraries use the whole-drag average; Motion and Apple use recent touch history.

### M-9: Dismiss or snap a sheet on a flick or on distance, using values calibrated against iOS
- Owner example: new (the filter sheet), relates to #17
- How:
  - Recognise a drag only after about 10 px of movement, then lock the axis.
  - Track the finger one to one and keep its grab offset.
  - Set `transition: none` while dragging, and write `translate` or `transform` on the sheet element itself (M-21).
  - Close when velocity is above 0.4 px/ms, or when the sheet has been dragged 25% or more of its height (Vaul). Small surfaces like toasts close at 45 px or above 0.11 px/ms (Sonner).
  - Detents (snap points): medium, about half height, and large. With snap points, Vaul jumps to the first or last point above 2 px/ms. Otherwise it goes to the next point in the flick direction when velocity is above 0.4 px/ms and the drag covered less than 40% of the viewport, and to the nearest point in every other case.
  - Apple's alternative: project the release point with scroll-like deceleration, then choose the nearest detent. The projection formula shown on the WWDC slide is not in the transcript: UNVERIFIED.
  - Scrollable content inside the sheet: allow the drag only from `scrollTop` 0, and ignore drags for 100 ms after the content reaches its top.
  - Ignore extra pointers until release.
  - Put `overscroll-behavior: contain` on the sheet's scroller.
  - Always also provide a close button.
- RTL/Farsi: bottom sheets move vertically and need no mirroring. Side drawers flip.
- Sources:
  - Marcos Alonso (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "This distance is called hysteresis, and is usually 10 points in iOS."
  - Vaul source — `src/constants.ts` — https://github.com/emilkowalski/vaul/blob/3e97aac6a38e4481bade71d7233ed6002e80f9b0/src/constants.ts — 2025-10-03 — "VELOCITY_THRESHOLD = 0.4; … CLOSE_THRESHOLD = 0.25; … SCROLL_LOCK_TIMEOUT = 100;"
  - Emil Kowalski — Building a Drawer Component — https://emilkowal.ski/ui/building-a-drawer-component — n.d. — "We simply ignore all touches after the initial one until the user releases to prevent this."
  - Emil Kowalski — Building a Toast Component — https://emilkowal.ski/ui/building-a-toast-component — n.d. — "0.11 is just a number that I ended up on through trial and error"
  - Apple — HIG Sheets — https://developer.apple.com/design/human-interface-guidelines/sheets — 2026-03-24 — "large is the height of a fully expanded sheet and medium is about half of the fully expanded height."
  - Nathan de Vries (Apple) — Designing Fluid Interfaces — 2018-06 — "remember to project momentum."
  - Vercel (vendored Web Interface Guidelines) — `vendor/vercel-web-interface-guidelines.md` — pinned 2026-09-18 — "MUST: Drag/swipe/pinch/path gestures have a tap/click and keyboard alternative unless essential"
- Confidence: high for the values (primary code and Apple). The thresholds themselves are empirical.
- Conflicts: Vaul uses fixed velocity thresholds; Apple uses momentum projection.

### M-10: Rubber-band at boundaries with resistance that grows; keep the browser's own scroll bounce
- Owner example: #17
- Why: A soft edge tells people they have reached the end. A hard stop looks like a frozen phone.
- How:
  - Native scrolling: leave the iOS bounce alone, so do not set `overscroll-behavior: none` on the page. On sheet and modal scrollers use `overscroll-behavior: contain`, which keeps the bounce inside and stops scroll chaining.
  - Custom drags past a limit, such as the filter sheet pulled above fully open: damp the movement. Three curves:
    - Vaul: `8 * (Math.log(v + 1) - 2)`. From that formula (inference): no movement for the first ~6 px, 50 px of finger gives ~15 px of sheet, 200 px gives ~26 px.
    - Sonner: `delta * 1 / (1.5 + |delta| / 20)`, which never exceeds 20 px.
    - iOS `UIScrollView`, reportedly `(1 − 1 / (x·c/d + 1))·d` with c = 0.55. This is from a secondary source (confidence low).
  - On release, return with no bounce (M-5).
  - Clamp any JS that reads scroll positions, such as a collapsing search header, because Safari reports positions past the edge while bouncing.
- Sources:
  - Chan Karunamuni (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "It means we're softly indicating boundaries of the interface."
  - Emil Kowalski — Building a Drawer Component — https://emilkowal.ski/ui/building-a-drawer-component — n.d. — "the more you drag, the less the drawer will move."
  - Vaul source — `src/helpers.ts` — https://github.com/emilkowalski/vaul/blob/3e97aac6a38e4481bade71d7233ed6002e80f9b0/src/helpers.ts — 2025-10-03 — "return 8 * (Math.log(v + 1) - 2);"
  - Sonner source — `src/index.tsx` — https://github.com/emilkowalski/sonner/blob/8e4662b39255120b62138312058f5d77c0139a5e/src/index.tsx — 2026-08-10 — "return 1 / (1.5 + factor);"
  - MDN — overscroll-behavior — https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior — 2026-04-20 — "Default scroll overflow behavior (e.g., "bounce" effects) is observed inside the element where this value is set."
  - MDN — Element.scrollLeft — https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft — 2025-08-12 — "Safari responds to overscrolling by updating scrollLeft beyond the maximum scroll position"
  - originell (secondary; quotes @chpwn) — Analysis of Apple's rubber band scrolling — https://gist.github.com/originell/6961057 — 2013-10-13 — "c = constant value, UIScrollView uses 0.55"
- Confidence: high for the principle; medium for the exact curves; low for the iOS constant.
- Conflicts: none. The vendored Vercel rule "`overscroll-behavior: contain` in modals/drawers" agrees.

### M-11: Swipe actions on saved-listing rows: no momentum, commit at half, destructive only on release
- Owner example: new, relates to #17
- How:
  - Motion values from Jakub: `dragMomentum={false}`, `dragElastic={0.05}`, snap points at ±116 px, commit threshold 58 px, and progressive reveal of a first and second action at 44 px and 88 px.
  - Lightweight actions, such as revealing the buttons, may happen during the swipe.
  - Removing a saved listing happens only when the finger lifts, followed by an undo toast (M-33).
  - Don't start row swipes at the screen edge, where they collide with the browser's back swipe.
- RTL/Farsi: the actions sit at the inline end, which is on the left in RTL. Mirror the swipe direction and the snap-point signs.
- Sources:
  - Jakub Krehel — Drag gestures on the web — https://jakub.kr/work/drag-gesture — 2026-01-27 — "For swipe actions, you want the row to stop where you decide, not where velocity decides."
  - Jakub Krehel — same — "The two thresholds I used are 44px and 88px ."
  - Rauno Freiberg — Invisible Details of Interaction Design — https://rauno.me/craft/interaction-design — 2023-07 — "Lightweight actions, such as displaying overlays, feel more natural to trigger during the swipe after an arbitrary amount of distance."
  - Rauno Freiberg — same — "The iOS App Switcher will never dismiss an app before the gesture ends."
  - Apple — HIG Gestures — https://developer.apple.com/design/human-interface-guidelines/gestures — 2024-09-09 — "Avoid conflicting with gestures that access system UI."
  - Vercel (vendored Web Interface Guidelines) — `vendor/vercel-web-interface-guidelines.md` — pinned 2026-09-18 — "MUST: Confirm destructive actions or provide Undo window"
- Confidence: medium (the values are one practitioner's; the principle is corroborated by Rauno)
- Conflicts: Sheets use momentum (M-9) and rows must not. They do different jobs.

### M-12: Exit faster and more quietly than you enter
- Owner example: new (durations and asymmetry)
- How:
  - Material Design 2 values (enter / exit, in ms): dialog fade 150 / 75, navigation drawer 250 / 200, bottom sheet 250 / 200, card 300 / 250.
  - NN/g: 300 in, 200 to 250 out.
  - Next.js view-transition recipe: exit 150; enter fade 210, starting after the exit; movement 400.
  - Exits travel a shorter distance too. Jakub moves an exiting panel only 70% of the way and lets opacity and blur finish it.
  - Rule (inference from the ranges): exit time is 50 to 85% of enter time, with no attention-grabbing effects.
- Sources:
  - Google — Material Design: Speed (snapshot 2018-10-31) — https://web.archive.org/web/20181031201120/https://material.io/design/motion/speed.html — 2018 — "Transitions that close, dismiss, or collapse an element use shorter durations, as they require less user attention than the user's next task."
  - Page Laubheimer (NN/g) — Executing UX Animations — https://www.nngroup.com/articles/animation-duration/ — 2020-02-09 — "a popup window may take 300ms to appear, but only 200 or 250ms to disappear."
  - Vercel — Next.js 16.3.5 "Designing view transitions" (installed) — 16.3.5 — "Old content should leave quickly so it does not compete for attention."
  - Jakub Krehel — Details that make interfaces feel better — https://jakub.kr/writing/details-that-make-interfaces-feel-better — 2026-03-10 — "Exit animations often work better when they're more subtle than enter animations."
- Confidence: high
- Conflicts: motion.md says exits are 20 to 30% shorter. Material's dialog fade is 50% shorter. Emil's vendored "enter 2s, exit 200ms" is about hold-to-delete, not a general rule.

### M-13: Scale duration with distance and area; up to 300 ms for controls, 400 ms only for full-screen moves
- Owner example: new
- How:
  - Small (switches, press feedback, icons): about 100 ms. Material uses 100 ms for selection controls.
  - Medium (popovers, chips, bottom sheets): 150 to 250 ms.
  - Large (full-screen page slides, shared-element photo morphs): 300 to 400 ms.
  - Proposed tokens: keep motion.md's press 120, popover 160, sheet 240 and modal 280 ms. Add `--duration-morph` of about 350 ms for view-transition morphs and page slides (inference, inside the sources' 300 to 500 ms range).
- Sources:
  - Google — Material Design: Speed (snapshot 2018-10-31) — https://web.archive.org/web/20181031201120/https://material.io/design/motion/speed.html — 2018 — "Transitions that traverse a small area of the screen have shorter durations than those that traverse larger areas."
  - Page Laubheimer (NN/g) — Executing UX Animations — https://www.nngroup.com/articles/animation-duration/ — 2020-02-09 — "400ms being a very slow animation, to be used only for big movements across large screens."
  - Emil Kowalski — You Don't Need Animations — https://emilkowal.ski/ui/you-dont-need-animations — n.d. — "A 180ms dropdown animation feels more responsive than a 400ms one"
  - Vercel — react-view-transitions skill, `references/patterns.md` — https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions — 2026-08-28 — "Shared element morph | 300–500ms"
- Confidence: high
- Conflicts: motion.md's "stay under 300 ms" clashes with the Next guide's 400 ms morph and slide and with Vaul's 500 ms settle. Name those exceptions explicitly.

### M-14: Choose easing by what the element is doing, and override Tailwind's defaults once in `@theme`
- Owner example: new
- How:
  - Entering or responding: a strong ease-out. motion.md uses `(0.16, 1, 0.3, 1)`; Emil `(0.23, 1, 0.32, 1)`; Material 3 emphasized decelerate `(0.05, 0.7, 0.1, 1)`.
  - Moving across the screen: ease-in-out. Material 3 standard `(0.2, 0, 0, 1)`; Emil `(0.77, 0, 0.175, 1)`.
  - Leaving the screen for good, such as a dismissed sheet or a toast swiped away: an accelerating curve is legitimate. Material accelerate `(0.4, 0, 1, 1)`; Material 3 emphasized accelerate `(0.3, 0, 0.8, 0.15)`.
  - Closing but still near its trigger, such as a popover: ease-out.
  - Tailwind 4.3.3 ships `--ease-out: cubic-bezier(0, 0, 0.2, 1)`, `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)`, `--default-transition-duration: 150ms` and `--default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)`. Any bare `transition` or `transition-transform` class uses them.
  - Redefine those four variables in `@theme` (CS-3) so utility classes pick up the project curves.
- Sources:
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — n.d. — "If you are animating something that is entering or exiting the screen, use ease-out."
  - Google — Material Design: Speed (snapshot 2018-10-31) — https://web.archive.org/web/20181031201120/https://material.io/design/motion/speed.html — 2018 — "Elements exiting a screen use acceleration easing, where they start at rest and end at peak velocity."
  - Josh W. Comeau — An Interactive Guide to CSS Transitions — https://www.joshwcomeau.com/animation/css-transitions/ — 2021-02-09 — "It can be useful for modals to enter with an ease-out animation, and to exit with a quicker ease-in animation"
  - Google — Compose Material 3 `MotionTokens.kt` — https://github.com/androidx/androidx/blob/160825094a81825468a95b115bfb1b541e549856/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt — 2026-08-05 — "EasingEmphasizedDecelerateCubicBezier … CubicBezierEasing(0.05f, 0.7f, 0.1f, 1.0f)"
  - Installed Tailwind — `node_modules/tailwindcss/theme.css` 4.3.3 — "--default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)"
- Confidence: high for the tokens; medium for exit easing (the sources disagree)
- Conflicts: Emil (vendored) says "Never use ease-in for UI animations". Material and Josh accelerate permanent exits. Proposal: allow accelerating curves only for elements that leave the viewport for good.

### M-15: Choreograph page transitions: outgoing fades fast, incoming follows, persistent elements move throughout
- Owner example: #14, #15
- How:
  - Sort every element into outgoing, incoming, persistent or static.
  - Material: outgoing fades over 90 ms, incoming appears over 210 ms, split at peak velocity (30% into the standard curve).
  - Chrome's sample uses a 90 ms fade-out and a 210 ms fade-in delayed 90 ms. The Next guide uses 150 and 210 ms.
  - Persistent elements, such as the car photo, move for the full duration.
  - Pin the header with a `viewTransitionName` and `animation: none`.
  - Keep the number of independently moving elements small, with a single focal element.
- Sources:
  - Google — Material Design: Choreography (snapshot 2019-05-08) — https://web.archive.org/web/20190508011629/https://material.io/design/motion/choreography.html — 2019 — "Outgoing elements disappear over 90ms, and incoming elements appear over 210ms."
  - Google — same — "Minimize the number of elements that move independently."
  - Google — Material Design 1: Choreography (snapshot 2017-05-22) — https://web.archive.org/web/20170522114928/https://material.io/guidelines/motion/choreography.html — 2017 — "Guide the user's focus to the next view using the most important shared element."
  - Vercel — Next.js 16.3.5 "Designing view transitions" (installed) — 16.3.5 — "A sliding header breaks the user's spatial anchor."
- Confidence: high
- Conflicts: the exit length differs: Material 90 ms, Next 150 ms. Either works; fix one value in the tokens.

### M-16: Stagger only first-time or rare entrances, in reading order, with the most important group first
- Owner example: #9
- Why: A stagger draws a path for the eye. It only helps when the order matches the reading order, which in a good layout is also the order of importance. On a list that refreshes often it just delays data.
- How:
  - Where: the valuation panel on first view (market value and deal rating first, then reasons, then comparable listings), empty and success states, and the first load of the home page.
  - Where not: search results after each filter change, infinite-scroll pages, and rows appended by "more".
  - Order: group by importance and keep the reading order. The price and the deal rating go in the first group, with no delay.
  - Timing: 20 ms (Material 1) to 30–80 ms (Emil) between items, about 100 ms between semantic groups (Jakub). Start each item before the previous one finishes. Stagger only the first 4–6 visible items so the whole sequence stays under about 300 ms (inference). Never block input.
  - CSS: `animation: enter 200ms var(--ease-out) both; animation-delay: calc(var(--i) * 40ms)` with `--i` set inline, or `sibling-index()` (Chrome 138, Firefox 154, Safari 26.2) behind `@supports`.
  - React `<ViewTransition>` cannot stagger items during a Next navigation, so use CSS when the element mounts.
  - Under reduced motion: no stagger.
- RTL/Farsi: Material's "left to right, and top to bottom" becomes right to left, then top to bottom. A grid starts at the top-right card.
- Sources:
  - Google — Material Design 1: Choreography (snapshot 2017-05-22) — https://web.archive.org/web/20170522114928/https://material.io/guidelines/motion/choreography.html — 2017 — "quickly stagger the appearance of each. Create a clear, smooth focal path in a single direction."
  - Google — same — "Grid items populate left to right, and top to bottom."
  - Google — same — "Begin each item's staggered entrance no more than 20ms apart."
  - Google — Material Design 2: Choreography (snapshot 2019-05-08) — https://web.archive.org/web/20190508011629/https://material.io/design/motion/choreography.html — 2019 — "A good sequence makes it easy to understand … what's important to know about the next interaction."
  - Emil Kowalski (vendored copy of his skill) — `vendor/emil-design-eng.md` — pinned 2026-09-18 — "Keep stagger delays short (30-80ms between items)."
  - Jakub Krehel (vendored) — `vendor/make-interfaces-feel-better/animations.md` — pinned 2026-09-18 — "Do not stagger routine interactions such as row hovers, keystrokes, or repeated tab changes."
  - Vercel — react-view-transitions skill, `SKILL.md` — https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions — 2026-08-28 — "Per-item staggered animations during page navigation are not currently available in Next.js"
- Confidence: medium-high (the order principle has two sources; "most valuable first" only holds when the layout already puts the most valuable first)
- Conflicts:
  - #9 says the most valuable items appear first. The sources say to follow one reading direction. The two coincide only when the layout order is the importance order. Never stagger against reading order (Material 1: "shouldn't appear in an order that's confusing to follow").
  - The gap is disputed: 20 ms (Material 1), 30–80 ms (Emil), 100 ms between groups and 80 ms between words (Jakub).

### M-17: Animate `display: none`, popovers and dialogs in plain CSS, and know where it degrades
- Owner example: #16, new
- How:
  ```css
  .menu { opacity: 1; scale: 1;
    transition: opacity 160ms var(--ease-out), scale 160ms var(--ease-out),
                display 160ms allow-discrete, overlay 160ms allow-discrete; }
  .menu:not(:popover-open) { opacity: 0; scale: .96; }            /* where it exits to */
  @starting-style { .menu:popover-open { opacity: 0; scale: .96; } }  /* after the base rule */
  ```
  - Place `@starting-style` after the base rule, since it has the same specificity. Write `transition-behavior` after the `transition` shorthand, or set `allow-discrete` inside the shorthand for each property.
  - Support:
    - `@starting-style`: Chrome 117, Firefox 129, Safari 17.5.
    - `allow-discrete`: Chrome 117, Firefox 129, Safari 17.4.
    - Transitioning `display`: Chrome 117 and Safari 18 only. Firefox has none, so exits snap there.
    - `overlay`: Chromium only. Safari drops a closing popover out of the top layer mid-fade.
    - Treat all of this as progressive enhancement.
  - Gotcha: `@starting-style` also applies when an element is first rendered, so server-rendered content animates on page load. Keep it off listing grids and use it only for things that appear after interaction.
  - Tailwind 4.3 has a `starting:` variant (for example `starting:opacity-0`) and a `transition-discrete` utility (verified in the installed package).
- Sources:
  - Una Kravets and Joey Arhar — Four new CSS features for smooth entry and exit animations — https://developer.chrome.com/blog/entry-exit-animations — 2023-08-16 — "you must declare transition-behavior: allow-discrete after the shorthand, because otherwise the shorthand reverts the value back to normal."
  - Una Kravets and Joey Arhar — same — "If you don't transition overlay, your element will immediately go back to being clipped, transformed, and covered up"
  - MDN — @starting-style — https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style — 2026-04-20 — "an element will transition from its @starting-style styles when it is first rendered in the DOM"
  - MDN — same — "include the @starting-style at-rule after the "original rule"."
  - MDN browser-compat-data — `css.properties.transition-behavior.transitionable_display`, `css.properties.overlay` — fetched 2026-09-26 — Firefox `false` for both; Safari `false` for `overlay`.
- Confidence: high
- Conflicts: none with the sources. Emil (vendored) covers `@starting-style` briefly but not these gaps.

### M-18: Grow popovers and menus from their trigger; keep modals centred; bring sheets up from the bottom edge
- Owner example: #16
- How:
  - Start from `scale` 0.9–0.97 plus `opacity: 0`, never from 0. Base UI uses 0.9, Emil's demo 0.93, Emil's tooltip 0.97.
  - `transform-origin` is where the trigger sits relative to the popup. A sort menu under a trigger at the inline start (right in RTL) uses `top right`.
  - Once Base UI is initialised (ADR-0005), use `transform-origin: var(--transform-origin)`. It is computed per placement, including flips.
  - Native `popover` plus CSS anchor positioning (Chrome 125, Firefox 147, Safari 26): set the origin for the default `position-area`. When `position-try-fallbacks` flips the menu, only Chrome 143+ can restyle it, through anchored container queries (`container-type: anchored`). Elsewhere, accept the mismatch or compute the origin in JS.
  - Modals keep `transform-origin: center`. Bottom sheets translate from 100% and don't scale.
- RTL/Farsi:
  - `transform-origin` accepts only physical keywords, and Tailwind's `origin-*` classes are physical. ADR-0005's lint restricts `origin-left/right`.
  - So set the origin through Base UI's variable, or in a CSS Module with a comment explaining the RTL choice. Mirror any physical `side` props.
- Sources:
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — n.d. — "They should scale in from the trigger."
  - Emil Kowalski — same — "its default value is center, which is wrong in most cases."
  - Google — Material Design 1: Choreography (snapshot 2017-05-22) — https://web.archive.org/web/20170522114928/https://material.io/guidelines/motion/choreography.html — 2017 — "New surfaces usually emerge from radial or rectangular expansions from the point of touch."
  - Base UI — Animation handbook — https://base-ui.com/react/handbook/animation — fetched 2026-09-26 — "transform-origin: var(--transform-origin);" with "transform: scale(0.9);"
  - MDN — transform-origin — https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin — 2026-04-20 — "one of the keywords left , center , right , top , and bottom"
  - MDN browser-compat-data — `css.properties.container-type.anchored` — fetched 2026-09-26 — Chrome 143; Firefox and Safari `false`.
- Confidence: high
- Conflicts: every source starts at 0.85 or above (Vercel's view-transition scale recipe uses 0.85), so motion.md's "about 0.8, Rauno" has no support (see Corrections).

### M-19: Use the individual `translate`, `scale` and `rotate` properties so separate motions don't overwrite each other
- Owner example: new
- How:
  - The press effect uses `scale`, the entrance uses `translate`, and neither touches `transform`. List all three in `transition-property`.
  - The order is fixed: translate, then rotate, then scale, then `transform`. So `scale` never scales the translation.
  - Baseline since August 2022 (Chrome 104, Firefox 72, Safari 14.1).
  - Tailwind v4's `translate-*` and `scale-*` already emit these properties. Their `--tw-translate-*` variables are fine for toggling a class but not for per-frame updates (M-21).
- Sources:
  - MDN — translate — https://developer.mozilla.org/en-US/docs/Web/CSS/translate — 2026-09-16 — "allows you to specify translation transforms individually and independently of the transform property."
  - CSSWG — CSS Transforms Level 2 (ED), "Current Transformation Matrix" — https://drafts.csswg.org/css-transforms-2/ — fetched 2026-09-26 — "Translate by the computed X, Y, and Z values of translate . Rotate by the computed <angle> … Scale by the computed … values of scale ."
- Confidence: high
- Conflicts: none. The vendored examples mix `transform: scale()` and `scale`, and both work.

### M-20: Set `will-change` only on the one element about to move, and only for as long as it moves
- Owner example: #10 (performance)
- How:
  - On the filter sheet, add `will-change: transform` on `pointerdown` or at open, and remove it on `transitionend`.
  - Never set it on 24 or more listing cards or thumbnails.
  - It creates a stacking context up front.
  - It can fix a one-pixel "snap" when a transform starts or ends; use it only on the element that shows the snap.
- Sources:
  - MDN — will-change — https://developer.mozilla.org/en-US/docs/Web/CSS/will-change — 2026-08-04 — "Use the will-change property as a last resort to try to deal with existing performance problems."
  - MDN — same — "switch will-change on and off using script code before and after the change occurs."
  - Matt Perry — The Web Animation Performance Tier List — https://motion.dev/magazine/web-animation-performance-tier-list — 2025-11-05 — "on mobile devices it's easy to blow out the GPU memory and crash a website."
  - Josh W. Comeau — An Interactive Guide to CSS Transitions — https://www.joshwcomeau.com/animation/css-transitions/ — 2021-02-09 — "Just don't broadly apply will-change to elements that won't move."
- Confidence: high
- Conflicts: Josh sets `will-change` statically on the element, while MDN toggles it from script. Both agree it must not be applied broadly.

### M-21: Drive per-frame motion through the moving element's own style, never through an inherited CSS variable
- Owner example: #10 (performance)
- How:
  - While dragging, write `sheet.style.translate = \`0 ${y}px\``, not `container.style.setProperty('--y', …)`.
  - If a variable must animate, register it with `@property --p { syntax: '<number>'; inherits: false; initial-value: 0 }` and set it on the element itself.
  - Pause endless loops, such as a skeleton shimmer, with an IntersectionObserver when they scroll out of view.
- Sources:
  - Emil Kowalski — Building a Drawer Component — https://emilkowal.ski/ui/building-a-drawer-component — n.d. — "Since CSS Variables are inheritable, changing them will cause style recalculation for all children"
  - Matt Perry — The Web Animation Performance Tier List — https://motion.dev/magazine/web-animation-performance-tier-list — 2025-11-05 — "It forced style recalculations on 1300+ elements, costing a whopping 8 ms per frame."
  - Matt Perry — same — "changing one will always trigger paint on affected elements."
- Confidence: high
- Conflicts: none. motion.md's `translate: calc(var(--inline-direction) * 8px)` is fine for a static value but not for per-frame updates.

### M-22: Use blur only as a 2–4 px bridge inside short cross-fades; drop it under reduced motion and on weak devices
- Owner example: #17
- How:
  - Emil uses 2 px. The Next guide peaks at 3 px, 30% into its morph. Jakub uses 4 px for icons and entrances.
  - Blur costs more as the radius and the layer grow, and it is heavier in Safari. Matt Perry flags anything above 10 px.
  - Remove blur under reduced motion (M-30). On low-tier devices, drop it first (M-31).
- Sources:
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — n.d. — "try adding a bit of filter: blur() to mask those imperfections."
  - Vercel — Next.js 16.3.5 "Designing view transitions" (installed) — 16.3.5 — "The blur hides pixel-level interpolation artifacts during the transition."
  - Matt Perry — The Web Animation Performance Tier List — https://motion.dev/magazine/web-animation-performance-tier-list — 2025-11-05 — "The cost of a blur can escalate sharply with every increased pixel of blur radius, and with larger layers."
  - Apple — HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — 2025-06-09 — "Avoiding animating into and out of blurs"
- Confidence: high
- Conflicts:
  - Val Head (2015) says "opacity, color, and blurs, are unlikely to be problematic".
  - Apple's HIG and WCAG's motion-animation definition, amended on 2025-06-27 so that blur is no longer excluded, now treat blur as motion.
  - The Vercel skill keeps its shared fade keyframe opacity-only and uses blur only for the morph.

### M-23: Cross-fade an icon or label in place instead of swapping it
- Owner example: #17
- How:
  - Keep both icons in the DOM, stacked. Jakub overlays one absolutely; putting both in one grid cell with `display: grid` and `grid-area: 1 / 1` also works (inference).
  - Animate `opacity` 0↔1, `scale` 0.25↔1 and `filter: blur(4px)`↔0 over about 300 ms with `cubic-bezier(0.2, 0, 0, 1)` (Jakub's CSS). His spring version uses duration 0.3 and bounce 0.
  - For the save heart, keep it to 200 ms or less because it is tapped often (inference).
  - The toggle carries `aria-pressed`, and the hidden icon is `aria-hidden`. Don't animate on first render.
  - When a label changes, for example «ذخیره» to «ذخیره شد», stack both labels in the same grid cell so the width doesn't jump (inference), and cross-fade over 150–200 ms.
  - Under reduced motion: opacity only.
- Sources:
  - Jakub Krehel — Details that make interfaces feel better — https://jakub.kr/writing/details-that-make-interfaces-feel-better — 2026-03-10 — "Animating opacity , scale and blur on icons when they are shown contextually makes the transition feel better and more responsive."
  - Jakub Krehel (vendored) — `vendor/make-interfaces-feel-better/animations.md` — pinned 2026-09-18 — "`scale-[0.25] opacity-0 blur-[4px]`" with "`ease-[cubic-bezier(0.2,0,0,1)]`"
  - Emil Kowalski — 7 Practical Animation Tips — https://emilkowal.ski/ui/7-practical-animation-tips — n.d. — "Blur works here because it bridges the visual gap between the old and new states."
- Confidence: medium-high
- Conflicts: motion.md lists "saving a listing" under "never animate". A short icon cross-fade is state feedback, not decoration; Jakub's table animates "like → liked". Allow it at 200 ms or less with no pop (see Corrections).

### M-24: Never animate Persian text letter by letter; split only at spaces, and keep parts joined by the zero-width non-joiner (ZWNJ) together
- Owner example: new (Farsi)
- Why: A transform only applies to a box that is not a plain inline box, so each letter would need `inline-block`. Arabic-script shaping breaks at box boundaries, so the letters would render in their isolated forms.
- How:
  - No per-character split-text, and no Family-style shared-letter morph on Farsi labels.
  - Animate whole words or whole labels, usually as a cross-fade (M-23).
  - Split words on U+0020 only, never on the zero-width non-joiner (ZWNJ, U+200C), for example «ذخیره‌شده».
  - A price counter animates the whole number string, never single digits.
- RTL/Farsi: this is the whole point of the tip. Verify it in the browser before relying on it.
- Sources:
  - CSSWG — CSS Transforms Level 1 (ED), "transformable element" — https://drafts.csswg.org/css-transforms-1/ — fetched 2026-09-26 — "all elements whose layout is governed by the CSS box model except for non-replaced inline boxes"
  - CSSWG — CSS Text Level 3 (ED), "Shaping Across Element Boundaries" — https://drafts.csswg.org/css-text-3/ — fetched 2026-09-26 — "Text shaping must be broken at inline box boundaries when any of the following are true"
  - Benji Taylor — Family Values — https://benji.org/family-values — 2024-07-08 — "This effect is achieved through a system we created that leverages shared letters"
- Confidence: medium (inference from two specs; not yet tested in this repo)
- Conflicts: Family's shared-letter morph and Jakub's and Emil's split-text techniques are designed for Latin script and are unsafe for Farsi.

### M-25: Morph containers, not piles of parts
- Owner example: #14
- How:
  - When a small control becomes a panel, animate the container's bounds while the contents fade through and are clipped by it. Examples: the «ذخیره جستجو» pill becoming a confirmation card, or the filter summary bar becoming the filter sheet.
  - Without a library: React `<ViewTransition>` with `update` or `share` inside `startTransition`. The group animates size and position while the old and new snapshots cross-fade. Set `border-radius` on the captured element itself, and handle aspect-ratio changes (M-26).
  - Or FLIP: measure once, then animate `transform` with WAAPI.
  - Motion's `layoutId` is the library alternative. Pass the border radius through `style` or `animate` so it can be corrected, keep ids unique, and keep elements with a `layoutId` outside `AnimatePresence`.
  - Give consecutive steps different heights so each change reads (Family's trays).
  - Only for rare moments (M-2).
- Sources:
  - Google — Material Design 2: Choreography (snapshot 2019-05-08) — https://web.archive.org/web/20190508011629/https://material.io/design/motion/choreography.html — 2019 — "When a group of elements is contained by clearly defined borders during a transition, such as a card or set of dividers, the container transforms."
  - Benji Taylor — Family Values — https://benji.org/family-values — 2024-07-08 — "To prevent any confusion during transitions, each subsequent tray is designed to vary in height."
  - Rauno Freiberg — Invisible Details of Interaction Design — https://rauno.me/craft/interaction-design — 2023-07 — "Swiping up morphs the full screen app into its icon"
  - Emil Kowalski — You Don't Need Animations — https://emilkowal.ski/ui/you-dont-need-animations — n.d. — "This works as long as the user will rarely interact with it."
  - Jakub Krehel — How I use shared layout animations — https://jakub.kr/work/shared-layout-animations — 2025-11-24 — "If you assign the same layoutId to multiple elements in the same state, the animation will break"
  - Matt Perry — The Web Animation Performance Tier List — https://motion.dev/magazine/web-animation-performance-tier-list — 2025-11-05 — "This one upfront measurement takes the most expensive kind of animation and makes it one of the least."
- Confidence: high
- Conflicts: WWDC18 describes iOS deliberately stretching the app icon during launch ("motion stretching"). Never stretch photographs; keep their aspect ratio (M-26).

### M-26: Morph a listing card's photo into the detail page with React `<ViewTransition>` on Next 16.3.5
- Owner example: #15
- How:
  - On the card: `<Link href={…} transitionTypes={['nav-forward']}><ViewTransition name={`listing-photo-${id}`} share="morph" default="none"><Image …/></ViewTransition></Link>`. On the detail page's main photo, use the same `name`, `share` and `default`.
  - Name only the first photo of each card. A duplicate name cancels the transition, and so does one component rendered twice.
  - The pair forms only if the detail photo renders in the same commit as the navigation. With `cacheComponents: true`, keep the photo and its `name` in the cached shell, outside any Suspense boundary that waits on dynamic data.
  - Aspect ratio: give the thumbnail and the detail photo the same ratio, or style `::view-transition-old(.morph), ::view-transition-new(.morph) { height: 100%; width: auto }` with `::view-transition-group(.morph) { overflow: clip }`.
  - Slow networks: don't cross-fade into a photo that hasn't loaded. Set `animation: none; mix-blend-mode: normal` on old and new so the thumbnail stays underneath.
  - The detail photo's first frame can reuse the thumbnail URL the browser has already cached (inference).
  - Before animating, React waits a bounded time for images and fonts. Constants in the react-dom build that Next 16.3.5 bundles: 500 ms for fonts and in-viewport images; 800 ms to suspend on images; only 50 ms when their estimated bytes exceed what the measured bandwidth can fetch in about 500 ms.
  - Duration 300–400 ms, with an optional 3 px blur at 30%. Don't fade out the page that holds the source photo.
  - Give text beside the photo, such as the price, its own `text-morph` handling or no name, because snapshots are rasters. In RTL, anchor it with `object-position: right top` (inference).
  - Back navigation carries no type, but the untyped morph still runs. On iOS Safari, which draws its own swipe-back animation, that can animate twice: neither Next 16.3.5 nor the bundled React checks `hasUAVisualTransition` (a grep of the installed code finds no occurrence).
  - Mitigation (inference, untested): in a `popstate` listener, when `event.hasUAVisualTransition` is true, set `html[data-ua-swipe]` and cancel `::view-transition-*` animations under it. Support: Chrome 118, Firefox 149, Safari 18.
  - Double-tap zoom delays every single tap by about 500 ms, so don't combine double-tap zoom with a single-tap action in the photo viewer.
- Sources:
  - Vercel — Next.js 16.3.5 "Designing view transitions" (installed) — 16.3.5 — "The morph plays when the destination content renders in the same commit as the navigation, which is the case with prefetched (cached) pages."
  - Vercel — same — "Browser-initiated back navigations (the back button or swipe gestures) do not carry a transition type"
  - Jake Archibald — View transitions: Handling aspect ratio changes — https://jakearchibald.com/2024/view-transitions-handling-aspect-ratio-changes/ — 2024-02-21 — "When folks ask me for help with view transition animations that "don't quite look right", it's usually because the content changes aspect ratio."
  - Jake Archibald and Bramus — Same-document view transitions — https://developer.chrome.com/docs/web-platform/view-transitions/same-document — 2024-09-25 — "Now the thumbnail doesn't fade away, it just sits underneath the full image."
  - Jake Archibald and Bramus — same — "In that case you shouldn't trigger your own view transition as it would lead to a poor or confusing user experience."
  - React team — React 19.3 — https://react.dev/blog/2026/09/09/react-19-3 — 2026-09-09 — "View Transitions act as a way to opt images or fonts into triggering Suspense while they load."
  - Vercel — react-view-transitions skill, `SKILL.md` and `references/css-recipes.md` — https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions — 2026-08-28 — "Only one VT with a given `name` can be mounted at a time"; "Shared element transitions take raster snapshots."
  - Marcos Alonso (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "every time we use the double-tap in our UIs, all normal taps will be delayed."
  - Installed code — `next/dist/compiled/react-dom/cjs/react-dom-client.development.js` — 19.3.0-canary-cbb046ab-20260731 — "SUSPENSEY_FONT_AND_IMAGE_TIMEOUT = 500" and "SUSPENSEY_IMAGE_TIMEOUT = 800"
- Confidence: high for the mechanics; medium for the iOS swipe-back mitigation (inference)
- Conflicts:
  - motion.md forbids `<ViewTransition>`, which is wrong (see Corrections).
  - The Vercel skill says "Firefox 144+", but the `startViewTransition({ update, types })` form React needs arrived in Firefox 147. Until then, React applies the DOM change without animation: the `catch` branch in react-dom calls the mutation callbacks directly.

### M-27: In RTL, forward navigation moves content to the right; flip every horizontal offset and define direction variables on `:root`
- Owner example: new (RTL), relates to #15
- How:
  - The Next guide's forward slide (old page to −60 px, new page from +60 px) is left-to-right. For Carshenas, forward sends the old page to +60 px and brings the new page in from −60 px; back does the opposite.
  - The next photo in a gallery arrives from the left.
  - The view-transition pseudo-elements originate from `html`, so direction variables must be set on `:root`. On a page wrapper they will not reach the transition.
  - ADR-0005 says the app has one direction and forbids `rtl:` variants, so hard-code the RTL signs with a comment. Where a variable is needed, `:dir(rtl)` works in Chrome 120, Firefox 49 and Safari 16.4.
  - Family's rule ("If you tap on a tab on the left, the transition moves left") stays physical and is already correct in RTL, because the tab positions are mirrored.
- RTL/Farsi: this is the whole point of the tip.
- Sources:
  - Vercel — Next.js 16.3.5 "Designing view transitions" (installed) — 16.3.5 — "Moving left means progressing forward (like turning a page in a left-to-right language)."
  - Apple — HIG Right to left — https://developer.apple.com/design/human-interface-guidelines/right-to-left — n.d. — "When something moves in the same direction that people read, they typically interpret that direction as forward"
  - Google — Material Design: Bidirectionality (snapshot 2018-05-28) — https://web.archive.org/web/20180528164348/https://material.io/design/usability/bidirectionality.html — 2018 — "In general, the passage of time is depicted as left to right for LTR languages, and right to left for RTL languages."
  - CSSWG — CSS View Transitions Level 1 (ED) — https://drafts.csswg.org/css-view-transitions-1/ — fetched 2026-09-26 — "Its originating element is the document's document element"
  - Benji Taylor — Family Values — https://benji.org/family-values — 2024-07-08 — "If you tap on a tab on the left, the transition moves left, and vice versa for the right."
- Confidence: high
- Conflicts: The Next guide and the Vercel skill hard-code the left-to-right layout ("next" slides in from the right). Copied verbatim, their CSS is wrong for Carshenas.

### M-28: Don't mirror everything: rotation stays clockwise, photos never flip, vertical motion doesn't change
- Owner example: new (RTL)
- How:
  - Spinners, refresh icons and clock-like progress rotate clockwise in RTL too.
  - Linear progress and the skeleton shimmer run right to left.
  - Car photos are never mirrored, because a flipped photo misrepresents the listing.
  - Sheets and toasts move vertically and need no change.
- Sources:
  - Google — Material Design: Bidirectionality (snapshot 2018-05-28) — https://web.archive.org/web/20180528164348/https://material.io/design/usability/bidirectionality.html — 2018 — "Clocks still turn clockwise for RTL languages."
  - Google — same — "Progress bars fill in the same direction as content is read"
  - Apple — HIG Right to left — https://developer.apple.com/design/human-interface-guidelines/right-to-left — n.d. — "Avoid flipping images like photographs, illustrations, and general artwork."
- Confidence: high
- Conflicts: none. Our `rtl-bidi.md` table agrees. motion.md's "carousel advance travel right to left" is ambiguous (see Corrections).

### M-29: Build photo carousels on native scroll-snap, with RTL-aware scroll arithmetic and no autoplay
- Owner example: #15, #17
- How:
  - On the strip: `scroll-snap-type: x mandatory; overscroll-behavior-x: contain`. That gives native momentum and bounce with no JS physics.
  - Scroll arithmetic in RTL: `scrollLeft` is 0 at the start (the right edge) and grows negative toward the end. The "next" button calls `scrollBy({ left: -slideWidth })`.
  - Clamp values because Safari overshoots while bouncing (M-10).
  - Never autoplay listing photos.
  - Under reduced motion, programmatic jumps use `behavior: 'auto'`.
- RTL/Farsi: in RTL you swipe to the right to reach later photos.
- Sources:
  - MDN — Element.scrollLeft — https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft — 2025-08-12 — "scrollLeft is 0 when the scrollbar is at its rightmost position (at the start of the scrolled content), and then increasingly negative"
  - Google — Material Design: Bidirectionality (snapshot 2018-05-28) — https://web.archive.org/web/20180528164348/https://material.io/design/usability/bidirectionality.html — 2018 — "users swipe to the right to see more tabs."
  - Val Head — Designing Safer Web Animation For Motion Sensitivity — https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/ — 2015-09-08 — "For Craig, the carousel on Apple.com poses a big problem, especially when it flicks back to the first picture."
- Confidence: high
- Conflicts: `rtl-bidi.md` says `scrollLeft` is "negative or reversed in RTL depending on the engine". MDN now documents a single behaviour. Keep the test of the first and last photo.

### M-30: Under reduced motion, replace movement with fades, keep feedback, and wire it into view transitions yourself
- Owner example: #10
- Why: Reduced motion is an accessibility preference, and React's view transitions ignore it. Reducing motion is not the same as removing it.
- How:
  - Keep: opacity and colour fades, state changes, one-to-one gesture tracking (the sheet still follows the finger) and progress indicators.
  - Replace or drop:
    - Slides along x, y or z become cross-fades of 150–200 ms.
    - Scale-zooms, including the shared-element morph, and parallax: drop them.
    - Blur, stagger and autoplay: remove them.
    - Springs: tighten them to bounce 0.
  - Author motion inside `@media (prefers-reduced-motion: no-preference)`, which is Tailwind's `motion-safe:`, so an unknown preference gets no motion.
  - View-transition recipe (inference; use your own keyframes):
    ```css
    @media (prefers-reduced-motion: reduce) {
      ::view-transition-group(*) { animation-duration: 0s; }                    /* no travel, no resize */
      ::view-transition-old(*) { animation: 150ms ease-out both vt-fade-out; }   /* explicit: they inherit from the group in Chrome 140+ */
      ::view-transition-new(*) { animation: 150ms ease-out both vt-fade-in; }
    }
    ```
    Class-specific rules such as `::view-transition-old(.nav-forward)` outrank `(*)`, so put their movement inside `no-preference`.
  - In JS, subscribe to `matchMedia('(prefers-reduced-motion: reduce)')` with `useSyncExternalStore`. Assume reduced motion on the server and listen for `change`.
  - Never use the global `* { animation-duration: 0.01ms !important }` reset.
  - Test with Playwright's `reducedMotion: 'reduce'`.
- Sources:
  - MDN — prefers-reduced-motion — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — 2026-06-10 — "an interface that removes, reduces, or replaces motion-based animations."
  - Apple — HIG Accessibility — https://developer.apple.com/design/human-interface-guidelines/accessibility — 2025-06-09 — "Replacing transitions in x-, y-, and z-axes with fades to avoid motion"
  - Apple — same — "Tracking animations directly with people's gestures"
  - Jake Archibald and Bramus — Same-document view transitions — https://developer.chrome.com/docs/web-platform/view-transitions/same-document — 2024-09-25 — "a preference for 'reduced motion' doesn't mean the user wants no motion ."
  - React team — `<ViewTransition>` — https://react.dev/reference/react/ViewTransition — fetched 2026-09-26 — "React doesn't automatically disable animations for this case."
  - Josh W. Comeau — Accessible Animations in React — https://www.joshwcomeau.com/react/prefers-reduced-motion/ — 2020-05-04 — "start without animations, and enable them if the user wishes"
  - Josh W. Comeau — same — "this snippet can paradoxically speed up the motion, making it even more dizzying."
  - Val Head — Designing Safer Web Animation For Motion Sensitivity — https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/ — 2015-09-08 — "the relative size of the movement, the direction of movement, and the perceived distance an animated object covers."
  - Motion docs — MotionConfig `reducedMotion` — https://motion.dev/docs/react-motion-config — fetched 2026-09-26 — "transform and layout animations will be disabled. Other animations, like `opacity` and `backgroundColor`, will persist."
  - W3C WAI — WCAG term "motion animation" (w3c/wcag commit 342b58e) — https://github.com/w3c/wcag/blob/main/guidelines/terms/21/motion-animation.html — 2025-06-27 — "does not include changes – such as changes of color or opacity – that do not alter the perceived size, shape, position, or distance/depth"
- Confidence: high
- Conflicts:
  - Next's guide and the Vercel skill set durations to `0s`, and Sonner sets `transition: none` and `animation: none`. Both remove motion entirely.
  - Chrome, Apple, Josh and Motion replace it with fades instead.
  - motion.md's "shorten to about half" has no source.

### M-31: Treat weak devices and low battery as a performance tier, separate from reduced motion, and use only reliable signals
- Owner example: #10
- Why: `prefers-reduced-motion` expresses what the person wants, not what the device can do. Device signals are coarse; several exist only in Chromium or are deliberately blurred against fingerprinting. Browsers already lower the frame rate on low battery.
- How:
  - Signals:
    - `prefers-reduced-motion`: every browser. Honour it for accessibility (M-30); never read it as a performance signal.
    - `navigator.deviceMemory`: Chromium only, HTTPS only.
      - On Chrome for Android 147+ it returns 1, 2, 4 or 8. Google's hooks treat `< 4` as low-end.
      - Chromium browsers carry about 87% of Iranian mobile browsing (StatCounter, August 2026: Chrome 80.52%, Samsung Internet 5.71%, Opera 0.47%; Android 85.5%, iOS 14.49%).
      - Usable, but coarse.
    - `navigator.hardwareConcurrency`: every browser, but Safari clamps it to 4 or 8. It separates phones poorly (inference), so combine it with memory.
    - Save-Data (`navigator.connection.saveData` or the request header): Chromium only, and sent only when the user turns on a data-saving mode. How many Iranian users do that is unknown. It means "less data", so skip autoplay and heavy media; it is not a motion signal.
    - `prefers-reduced-data`: Chrome only, behind a flag. Unusable.
    - Battery Status API: Chromium only (Firefox removed it in 52; Safari never had it). When a supporting browser cannot read the battery, the API reports a full, plugged-in battery, and it says nothing about iOS Low Power Mode. Don't use it.
    - Compute Pressure (`PressureObserver`): desktop Chrome 125+ only, not Chrome for Android. Irrelevant to a phone-first app.
    - Continuous frame-time sampling with `requestAnimationFrame`: Chrome advises against it. The polling drains the battery it is meant to save.
  - Browsers already throttle:
    - iOS Low Power Mode caps both rAF and CSS animations at 30 fps.
    - Chrome's Energy Saver lowers the display refresh rate.
    - rAF pauses in background tabs.
    - Firefox's resistFingerprinting coarsens timers to 100 ms.
    - So write JS animation against time (rAF timestamp deltas), never frame counts.
  - Policy (inference):
    - Pick a tier once at startup from `deviceMemory`, plus `hardwareConcurrency` when present.
    - The low tier drops blur, `backdrop-filter`, shared-element morphs (replaced by fades), staggers and looping shimmer. It never drops state feedback or information.
    - Never send the raw values to analytics or the server. At most, record the coarse tier.
  - Long Animation Frames (`long-animation-frame` entries in a `PerformanceObserver`, Chrome 123+) belong in field monitoring, not in per-session gating (inference).
- Sources:
  - MDN — Navigator.deviceMemory — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory — 2026-01-26 — "The reported value is imprecise to curtail fingerprinting ."
  - MDN browser-compat-data — `api.Navigator.deviceMemory` and `api.Navigator.hardwareConcurrency` notes — fetched 2026-09-26 — "From Chrome 147, reported values are 1, 2, 4, and 8." / "clamped to 4 or 8 cores, to prevent device fingerprinting."
  - GoogleChromeLabs — react-adaptive-hooks README — https://github.com/GoogleChromeLabs/react-adaptive-hooks — 2022-02-24 — "{ deviceMemory < 4 ? <img src='...' /> : <video muted controls>...</video> }"
  - Milica Mihajlija — Adaptive loading — https://web.dev/articles/adaptive-loading-cds-2019 — 2019-12-16 — "Throttling the frame-rate of animations on low-end devices."
  - W3C DAS WG — Battery Status API (ED) — https://w3c.github.io/battery/ — fetched 2026-09-26 — "SHOULD not expose high precision readouts of battery status information as that can introduce a new fingerprinting vector."
  - Philip Walton — Memory and Energy Saver modes — https://developer.chrome.com/blog/memory-and-energy-saver-mode — 2022-12-08 — "There is no dedicated web API to measure display refresh rate, and in general, attempting to do so with current APIs is not recommended ."
  - Chris Dumez (Apple) — WebKit bug 168837 — https://bugs.webkit.org/show_bug.cgi?id=168837 — 2017-02-24 — "Throttle requestAnimationFrame to 30fps in low power mode on iOS to save battery."
  - Matt Perry — When browsers throttle requestAnimationFrame — https://motion.dev/magazine/when-browsers-throttle-requestanimationframe — 2020-10-01 — "reduces JavaScript time accuracy to 100ms"
  - MDN — Compute Pressure API — https://developer.mozilla.org/en-US/docs/Web/API/Compute_Pressure_API — 2025-07-11 — "enables you to observe the pressure of system resources such as the CPU."
  - StatCounter — Iran mobile browser and OS share (CSV exports of https://gs.statcounter.com/browser-market-share/mobile/iran and https://gs.statcounter.com/os-market-share/mobile/iran) — August 2026 — Chrome 80.52%, Safari 11.29%, Samsung Internet 5.71%; Android 85.5%, iOS 14.49%.
  - Chrome Platform Status — Add Save Data Client Hint — https://chromestatus.com/feature/5645928215085056 — Chrome 102 — "This hint will still be sent by default (when lite mode is on)"
  - W3C DAS WG — Battery Status API (ED) — https://w3c.github.io/battery/ — fetched 2026-09-26 — "which emulate a fully charged and plugged in battery."
- Confidence: high for the support facts; medium for the tiering policy (inference)
- Conflicts:
  - #10 folds device weakness into reduced motion. They are separate policies.
  - web.dev (2019) suggests throttling animation frame rates on low-end devices, while Chrome (2022) advises against measuring refresh rate. Resolve it by tiering on memory rather than sampling frames.

### M-32: Don't flash motion on fast responses: delay pending hints about 100 ms and keep loading motion honest
- Owner example: new
- How:
  - A pending link hint from `useLinkStatus` starts invisible and fades in after `animation-delay: 100ms`.
  - Skeleton to content: the skeleton leaves fast and the content fades in within 150 ms (motion.md's rule), with the space already reserved.
  - A spinner that spins faster reads as faster loading.
- Sources:
  - Vercel — Next.js 16.3.5 `use-link-status.md` (installed) — 16.3.5 — "add an initial animation delay (e.g. 100ms) and start the animation as invisible (e.g. `opacity: 0`)."
  - Emil Kowalski — You Don't Need Animations — https://emilkowal.ski/ui/you-dont-need-animations — n.d. — "a faster-spinning spinner makes the app seem to load faster, even though the load time is the same."
  - Google — Material Design 1: Choreography (snapshot 2017-05-22) — https://web.archive.org/web/20170522114928/https://material.io/guidelines/motion/choreography.html — 2017 — "allow sufficient space in the location where the element will appear."
- Confidence: high
- Conflicts: Next's Suspense-reveal recipe makes content fully visible only at 360 ms (a 150 ms delay plus a 210 ms fade), which breaks motion.md's 150 ms rule for data (see Corrections).

### M-33: Leave along the path you arrived on, and make each animation teach its gesture
- Owner example: new (spatial consistency)
- How:
  - A toast rises from the bottom, leaves downwards and is dismissed by swiping down.
  - A sheet opened upwards closes downwards.
  - A "remove saved listing" animation slides the row the same way the swipe-to-remove gesture does.
  - Pause toast timers while `document.hidden` is true.
- RTL/Farsi: horizontal paths are mirrored (M-27).
- Sources:
  - Chan Karunamuni (Apple) — Designing Fluid Interfaces — https://developer.apple.com/videos/play/wwdc2018/803/ — 2018-06 — "if something is going out of view in your interface, and coming back into view, it should do so in symmetric paths."
  - Chan Karunamuni (Apple) — same — "we slide the tab left to indicate it's deleted. This hints to me that I can slide it myself to the left."
  - Apple — HIG Motion — https://developer.apple.com/design/human-interface-guidelines/motion — 2025-09-09 — "if someone reveals a view by sliding it down from the top, they don't expect to dismiss the view by sliding it to the side."
  - Emil Kowalski — You Don't Need Animations — https://emilkowal.ski/ui/you-dont-need-animations — n.d. — "Because it comes from and leaves in the same direction, it creates spatial consistency, making the swipe-down-to-dismiss gesture feel more intuitive."
- Confidence: high
- Conflicts: none.

### M-34: Test motion where it breaks: in slow motion, on a mid-range Android phone, in iOS Low Power Mode, with reduced motion and in RTL
- Owner example: #10
- How:
  - Scrub and pause in the DevTools Animations panel. Since Chrome 139 it shows `view-transition-class` rules.
  - Test gestures on a real phone over USB.
  - Toggle Chrome's battery saver from `chrome://discards`, with the `#battery-saver-mode-available` flag enabled first.
  - Test with iOS Low Power Mode on.
  - Run with 4× CPU throttling.
  - Run a Playwright pass with `reducedMotion: 'reduce'`.
  - Check the direction of every horizontal movement in RTL.
- Sources:
  - Emil Kowalski — Building a Drawer Component — https://emilkowal.ski/ui/building-a-drawer-component — n.d. — "Most of the time, I used my phone which I then connected to my computer with a cable"
  - Bramus — What's new in view transitions (2025 update) — https://developer.chrome.com/blog/view-transitions-in-2025 — 2025-10-08 — "use the Animations panel from DevTools to pause all animations."
  - Philip Walton — Memory and Energy Saver modes — https://developer.chrome.com/blog/memory-and-energy-saver-mode — 2022-12-08 — "Visit chrome://discards and click the Toggle battery saver mode link"
  - Matt Perry — When browsers throttle requestAnimationFrame — https://motion.dev/magazine/when-browsers-throttle-requestanimationframe — 2020-10-01 — "Toggling low-power mode on and off had an immediate effect on the smoothness of the animations."
- Confidence: high
- Conflicts: none.

### M-35: Keep Next 16 from smooth-scrolling every navigation
- Owner example: new
- How:
  - If `html { scroll-behavior: smooth }` is ever added for in-page anchors, Next 16 no longer overrides it on route changes, so every navigation would smooth-scroll to the top.
  - Either don't set it globally, or add `data-scroll-behavior="smooth"` to `<html>` so Next overrides it during navigation.
  - Also scope smooth scrolling to `prefers-reduced-motion: no-preference`.
  - The app sets neither today (checked `apps/web/src/app/globals.css`).
- Sources:
  - Vercel — Next.js 16 upgrade guide (installed `upgrading/version-16.md`) — 16.3.5 — "By default, Next.js will **no longer override** your `scroll-behavior` setting during navigation."
  - Josh W. Comeau — Accessible Animations in React — https://www.joshwcomeau.com/react/prefers-reduced-motion/ — 2020-05-04 — "scroll-behavior : auto !important"
- Confidence: high
- Conflicts: none.

### M-36: Animate list reflow only when it explains the user's own action, such as removing a listing with undo
- Owner example: #14
- How:
  - Removing a saved listing: the row collapses (for example `grid-template-rows` from `1fr` to `0fr` over 200 ms) while the rows below glide up. Then an undo toast appears.
  - With React view transitions: give each item `<ViewTransition key={id}>` and update inside `startTransition`. Rows that get pushed need `update`, so don't give them `default="none"`.
  - Use committed state for the list order, not `useOptimistic`, or the reorder won't animate.
  - Never animate reflow caused by a background data refresh (`default="none"` there).
- Sources:
  - Vercel — react-view-transitions skill, `references/troubleshooting.md` — https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-view-transitions — 2026-08-28 — "Optimistic values resolve before snapshot. Use committed state for list order."
  - Vercel — same, `SKILL.md` — "Revalidation / background refresh | `default="none"` | Silent — no animation needed"
  - Emil Kowalski — Great Animations — https://emilkowal.ski/ui/great-animations — n.d. — "The opacity change in exiting and entering items works well with the height animation."
- Confidence: medium
- Conflicts: `grid-template-rows` animates layout, which is expensive on large trees. Keep it to one small row.

## Corrections to our current motion.md

1. **"The React `<ViewTransition>` component is stable only from React 19.3; the scaffold pins 19.2, so do not use it until the pin moves."** This is wrong for the App Router.
   - Next 16.3.5 runs app code on its own bundled React, not on the pinned package. `apps/web/node_modules/next/dist/compiled/react/cjs/react.production.js` reports `exports.version = "19.3.0-canary-cbb046ab-20260731"` and exports `ViewTransition` and `addTransitionType`.
   - The installed guide says "View transitions work in the App Router with no configuration" and "You do not need to install `react@canary` yourself".
   - `<Link transitionTypes>` and `router.push(href, { transitionTypes })` are documented. There is no `viewTransition` flag in 16.3.5's config docs or config code.
   - React 19.3.0 has also been stable on npm since 2026-09-09 ("both of these are now stable in React 19.3!"), and the installed `@types/react` 19.3.0 declares `ViewTransition` (`@version 19.3.0`).
   - The one real catch: Vitest resolves the workspace `react` 19.2.8, which does not export `ViewTransition` (a grep of its build finds nothing). A unit test that renders it would get `undefined`.
   - Replacement: "Use `<ViewTransition>` from `react` for navigations and rare reveals (M-3, M-26). To unit-test components that render it, move `react` and `react-dom` to 19.3.0, or keep it in thin client wrappers that aren't unit-tested."
   - Moving the pin is the owner's decision.
2. **"nothing enters from `scale(0)` (0.9 or above, Emil; about 0.8, Rauno)"**: "Invisible Details of Interaction Design" (fetched in full) contains no 0.8 value. The sources start at 0.9 (Emil "0.9+", Base UI 0.9) or higher (Emil 0.93 and 0.97, Jakub 0.95–0.96). Replace with "start at 0.9–0.97".
3. **"Reduced motion means reduce, not remove: … shorten to about half"**: "about half" has no source. Replace it with Apple's list: fades instead of x/y/z movement, no blur, tightened springs, keep one-to-one gesture tracking. Add that React's view transitions ignore the preference, so the view-transition CSS is required (M-30). Note that the Next and Vercel recipes remove motion rather than reduce it.
4. **"Transitions for anything that can be interrupted … Interrupting an animation must not snap."**: two precisions are missing.
   - A reversed CSS transition replays its full curve over a shorter time, so its velocity jumps (CSS Transitions spec; Josh).
   - View transitions cannot be interrupted: a new one skips the old one to its end (Chrome) and React batches the updates in between (react.dev). So never use them on controls that are tapped again quickly (M-1, M-3).
5. **"stay under 300 ms"**: name the exceptions the sources require.
   - Full-screen slides and shared-element morphs: 300–400 ms (NN/g reserves 400 ms for large movements; the Next guide uses 400 ms).
   - The settle after a drag: up to 500 ms, or matched to the finger's velocity (Vaul 500 ms; M-7).
   - Without these, the rule contradicts the recipes we will copy.
6. **`--ease-out` "enter and exit; the default"**: Material and Josh use an accelerating curve for elements that leave the screen for good. Also note that Tailwind 4.3.3's own `--ease-out: cubic-bezier(0, 0, 0.2, 1)` and `--default-transition-timing-function`/`--default-transition-duration` (150 ms) apply to every bare `transition-*` class until `@theme` overrides them (M-14).
7. **"`translateX` distances … express them from a direction-aware variable (`--inline-direction: -1` set by `:dir(rtl)`)"**:
   - ADR-0005 says the app has one direction and bans `rtl:` variants, so a hard-coded RTL sign with a comment is enough.
   - Where a variable is used for view transitions, it must be defined on `:root`, because the view-transition pseudo-elements originate from `html` (CSS View Transitions 1).
   - Add the missing case: `transform-origin` has only physical keywords (MDN) and ADR-0005's lint restricts `origin-left/right`. Set it through Base UI's `--transform-origin` or in a CSS Module with a comment (M-18).
8. **"Skeleton shimmer, progress fill and carousel advance travel right to left."**: the shimmer and progress fill are correct (Material: "Progress bars fill in the same direction as content is read"). For the carousel the sentence is ambiguous: when a carousel advances in RTL, the content moves to the right and the next photo arrives from the left (Material: "users swipe to the right to see more tabs"; M-27, M-29). Rephrase it so nobody copies the left-to-right slide.
9. **"use `grid-template-rows: 0fr → 1fr` or `interpolate-size` for reveals"**: `interpolate-size` works only in Chromium (browser-compat-data: Chrome 129; Firefox and Safari `false`), so it is progressive enhancement only. The `grid-template-rows` fallback animates layout, which costs a reflow every frame (Matt Perry's D tier), so keep it to small, contained elements.
10. **"skeleton-to-content crossfades longer than 150 ms"**: this rule should explicitly override the copied Next recipe. Next's Suspense reveal (exit 150 ms, then the enter fade over 210 ms) shows listing data only at 360 ms. Cap the content fade at 150 ms with no delay beyond the skeleton's exit (M-32, inference).
11. **"saving a listing" under "never animate"**: this conflicts with #17 (cross-fading the icon inside a button) and with Jakub's list of state-change icons that should animate ("like → liked"). Keep it free of pop or bounce, but allow a cross-fade of 200 ms or less as state feedback (M-23).
12. **Missing: entering and leaving `display: none`, popovers and dialogs in plain CSS.** Add `@starting-style` plus `transition-behavior: allow-discrete`, with the ordering rules and the gaps: Firefox cannot transition `display`, and `overlay` is Chromium-only. Add the gotcha that `@starting-style` also plays on first render, including server-rendered HTML (M-17).
13. **"View transitions: same-document … cross-document ones are not Baseline"**: correct, but beside the point for the App Router, where every navigation is a same-document transition. What matters more:
    - Transition types (Next's `transitionTypes`) require the `startViewTransition({ update, types })` form: Chrome 125, Safari 18.2, Firefox 147. Older browsers get React's no-animation fallback.
    - On iOS Safari a swipe back can animate twice, because neither Next nor React checks `hasUAVisualTransition` (M-26).
14. **Tokens**: add `--duration-morph` (about 350 ms, inference) for page slides and shared-element morphs. Add a drag-release setting: either 500 ms with `cubic-bezier(0.32, 0.72, 0, 1)` (Vaul) or a duration derived from the finger's velocity (M-7). The current `--duration-sheet` of 240 ms combined with an `--ease-out` whose initial slope is 6.25 fits a sheet opened by tap, but lurches after a slow drag release (inference).
