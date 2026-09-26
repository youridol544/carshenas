# Which small interface details make a product feel good, and who says so?

- Date: 2026-09-26
- Asked by / for: Pedrum ("individually each one of them are very small, but when gathered all together, they make a product feel very good"), for CS-26
- Outcome: the craft checklist `.claude/skills/ui-design/references/craft.md` (seven sections, every rule sourced), wired into the rules, skills, lint, review rubric and browser checks; no ADR; ten decisions left to the owner (below).

## Questions

1. The owner named seventeen details: interruptible motion, no layout shift, icons whose stroke matches the text, empty states with an action, Persian line height per text role, 44 px touch targets, optimistic updates, restrained colour, skeletons with reusable abstractions, staggers ordered by importance, reduced motion for weak devices, tooltip delay groups, tabular numbers, scroll fades, safe hover areas for submenus, morphs, shared-element gallery transitions, origin-aware popovers, rubber-banding and icon cross-fades. Which of them do credible practitioners and platform documents state, with which exact values, and where does the evidence differ from the owner's wording or from this repository's current rules?
2. Which practitioners independently state several of these details, so that their other advice can be trusted to share the owner's taste, and what else do they recommend?
3. How does each detail apply to a Farsi, right-to-left, phone-first product built on Next.js 16.3 and React 19, with no component or animation library installed yet (ADR-0003, ADR-0005)?
4. Which details can be measured in the browser, so a review can check them with evidence instead of taste?

## Method

Six research passes ran in parallel on 2026-09-26: five by topic (motion; layout stability, loading and optimistic updates; pointer, touch and keyboard; visual craft; Persian typography, with hands-on measurements in Chromium) and one that scored practitioners by how many of the owner's details they state in their own published work, then harvested the rest of their advice from the best matches. Every source was fetched; quotes are verbatim and at most 25 words; values without a source are marked as inference. Library and platform APIs were checked against the installed packages (React 19.2.8; Next.js 16.3.5, whose App Router runs its bundled React 19.3 canary) and their version-matched documentation. The files already vendored in `.claude/skills/ui-design/references/vendor/` were read first, so this note adds evidence and precision instead of restating them.

The six passes are kept, unedited apart from local paths, in [`2026-09-26-ui-craft-details/`](2026-09-26-ui-craft-details/README.md): `motion.md` (M-1 to M-36), `loading.md` (L-1 to L-35), `interaction.md` (I-1 to I-38), `visual.md` (V-1 to V-38), `typography.md` (T-1 to T-25 and measurements M1 to M17), `taste-match.md` (the scoring table and H-1 to H-50). Every quote, link and date is there; this note summarises. The font measurements are repeatable with the scripts in `lab/`, and the page measurements with `.claude/skills/verify-ui/craft-checks.js`.

## Sources: who sees design the way the owner does

A source scored one point for each of the owner's details it states independently in its own published text (half a point each for the two-part details 7, 11 and 17). The full table, with evidence per cell, is in `taste-match.md`.

| Source | Score | Why it counts |
|---|---|---|
| Vercel Web Interface Guidelines | 10.5 | Vercel's design-engineering rulebook, grown from Rauno Freiberg's 2023 list |
| Apple: HIG, WWDC18 "Designing Fluid Interfaces", WWDC23 "Animate with springs" | 10 | the platform owner; the talk the other practitioners cite |
| Jakub Krehel | 8.5 | design engineer; author of the vendored make-interfaces-feel-better skill |
| Emil Kowalski | 8 | Linear, ex-Vercel; author of Sonner and Vaul |
| Adam Argyle; Rauno Freiberg | 6 each | Chrome CSS DevRel and CSSWG; Vercel staff design engineer |
| NN/g; Vercel Geist | 5 each | named usability research; Vercel's component guidance |
| Benji Taylor; Josh W. Comeau | 4.5; 4 | Family's fluid trays; CSS and animation teaching |
| Ahmad Shadeed; Material Design | 3 each | the main RTL and Arabic-script CSS source; Google's system |
| Component libraries (Base UI, Radix, React Aria, Ariakit, Floating UI) | 1.5 each | they implement delay groups, safe polygons and origins in code |
| IBM Carbon | 1 | states one detail and contradicts another (#9) |

The four strongest matches independently state most of the list, so the rest of their advice was harvested (H-1 to H-50) and weighed like any other source. The typography pass added W3C alreq, Material 3's Arabic type tokens, the Vazirmatn and Estedad authors, Apple's "Design for Arabic" (WWDC22) and hands-on measurements with both candidate fonts.

## Findings: the owner's seventeen details

| # | Detail | Sources stating it | Verdict | What the evidence adds or changes | craft.md |
|---|---|---|---|---|---|
| 1 | Interruptible animation | 7 | confirmed | CSS transitions retarget, but a reversed transition changes speed; only a velocity-keeping spring turns smoothly (a library decision). View transitions cannot be interrupted, so they are for navigations and rare reveals only. | §1 |
| 2 | No layout shift; reserve image space | 4 | confirmed | A zero-shift budget, measured with a `layout-shift` observer; `width`/`height` attributes map to `aspect-ratio`; reserve late blocks too; `scrollbar-gutter: stable`; Next.js's automatic font fallback is Latin-only. | §2 |
| 3 | Good icons, stroke matched to size and text | 5 | confirmed, refined | Match the rendered stroke to the stem of the label, measured on the real font (Vazirmatn: 1.32 px at 400, 1.81 at 600, 1.95 at 700, all at 16 px); Lucide's `absoluteStrokeWidth` is deprecated for `nonScalingStroke`; one family. | §6 |
| 4 | Empty states have actions | 5 | confirmed, with an exception | The rule is "no dead ends": classify five kinds; an all-clear state may offer nothing; no-results keeps the query and the chips. | §6 |
| 5 | Persian line height per role, 1.4 to 1.6 | 3 (platform level) | mechanism right, values refined | Measured: 1.4 to 1.6 fits controls, titles and headings and is Vazirmatn's floor for body text, but long reading text needs 1.65 to 1.75 (Estedad about 0.1 more). The old "body ≥ 1.7 everywhere" was wrong for headings and controls. | §7 |
| 6 | 44 px touch targets | 7 | confirmed | 44 is Apple's default and WCAG AAA; Material asks 48 dp; WCAG AA's 24 px is the legal floor. Space targets by how they look; measure the hit area, not the glyph. | §5 |
| 7a | Optimistic UI | 2 plus React and Next.js docs | confirmed, with conditions | Only for predictable, reversible changes with a visible rollback; never for computed values. The action must return the new truth: measured, `revalidateTag(tag, 'max')` made the control jump back at 451 ms, `updateTag` held. | §4 |
| 7b | Few colours per view | 2 | confirmed as a per-view budget | A hue budget per view (one action hue, states only while they exist), not a small palette; measurable with OKLCH buckets. | §6 |
| 8 | Skeletons, with clean reusable abstractions | 4 | confirmed within limits | First loads of a view only (NN/g; Roselli and Viget question them as a default). Abstraction: one frame with slots rendered by both the component and its skeleton, measured equal at 412 px once every slot had a fixed line count. | §3 |
| 9 | Staggers show the most valuable first | 0 | not supported as stated | No source says it; IBM Carbon says to end on the most important item. Resolved as reading order grouped by importance, which puts price and deal rating first in Carshenas's layouts; never stagger against reading order. Open question below. | §1 |
| 10 | Reduced motion for weak devices and low battery | 11 | confirmed, split in two | Reduced motion is a preference: reduce, do not remove. A weak phone is a performance tier from `navigator.deviceMemory` (Chromium only); battery signals are unusable, and browsers already throttle. | §1 |
| 11a | Tooltip delay group | 7 | confirmed | First delay 500 to 1500 ms (Base UI 600), skip window 300 to 400 ms counted from the last close; instant tooltips also skip their fade; desktop only. Implemented and measured in `react-patterns`. | §5 |
| 11b | `tabular-nums` for changing numbers | 4 | confirmed, with a Persian caveat | Tabular Persian digits are 20 to 140 % wider, so only numbers that change in place or align in columns; a box sized for the widest value. | §2, §7 |
| 12 | Scroll fades used properly | 4 | confirmed, with conditions | Only on a side with more content; the scroll-timeline mask needs an `@supports` guard (measured); gradient direction is physical, so set it for RTL; lint now restricts physical mask utilities. | §6 |
| 13 | Safe polygons for menus | 8 | confirmed | In RTL the triangle points left, which libraries do only inside their direction provider. | §5 |
| 14 | Morph animations | 7 | confirmed | Morph the container while its contents cross-fade; rare moments only. | §1 |
| 15 | Shared-element transitions for galleries | 5 | confirmed | `<ViewTransition>` works in the App Router today (React 19.3 canary); one element per name, same aspect ratio, in the cached shell. | §1 |
| 16 | Origin-aware popovers | 8 | confirmed | Scale from 0.9 to 0.97 with `var(--transform-origin)`, never from 0; modals centred; sheets do not scale. | §1 |
| 17a | Rubber-banding | 4 | confirmed | Keep the browser's bounce; damp custom drags (Vaul and Sonner formulas); clamp Safari's overscroll positions. | §1 |
| 17b | Icon cross-fade inside buttons | 5 | confirmed | Both icons mounted in one grid cell; 200 ms or less on frequent toggles; blur dropped under reduced motion. | §1 |

Beyond the seventeen, the passes produced about 250 tips; `craft.md` keeps the ones that apply to a Farsi, phone-first search product. Among the most useful: decide animation by frequency of use; press feedback on touch-down and the action on release; delay pending indicators and dim stale content instead of flashing skeletons; undo instead of confirmation; no weight change between states; hover styles only for a real mouse, with behaviour checking `pointerType`; keyboard shortcuts matched by `event.code`, because the Persian layout changes the characters; one icon family found through the glossary word; an ordinal colour ramp for the five deal ratings; no alpha text colours on Persian; link underlines below the dots; start-aligned, never justified text; and a stress string for clipping.

## What changed in the repository

- **New**: `craft.md` (the checklist); `react-patterns/references/ui-craft.md` (verified code for skeletons, pending states, optimistic toggle and undo, tooltip delay group, photo morph, motion hooks); `verify-ui/craft-checks.js` (the page measurements); this appendix and its `lab/`.
- **Corrected rules**: line height by role instead of "≥ 1.7" (`ui.md`, the `ui-design` non-negotiables, `persian-type-formatting.md`, `tokens.md`); target spacing by look instead of a flat 8 px (`ui.md`, `mobile-forms.md`); motion exceptions and interruption (`motion.md`, 14 corrections); pending buttons keep their label (`data-and-actions.md` §4, `mobile-forms.md`); the stepper's number is tabular in a reserved box (§5); `updateTag` behind optimistic controls (`server-actions-data.md`); a `useLinkStatus` hint for links without prefetch (`next-app-router.md`); empty-state kinds and the all-clear exception, and no weight change for a selected chip (`states-a11y.md`); RTL scrolling arithmetic and menu keys (`rtl-bidi.md`); wrong or outdated advice in the vendored files (`VENDORED.md`).
- **Enforced in code**: Tailwind's `hover:` limited to real mice and `scrollbar-gutter: stable` (`globals.css`); lint rejects physical mask edges, `leading-none` and `leading-tight`, any `text-*/*` slash (alpha text colour or a per-use line height) and `transition-all`, each proven in the lint self-test; the layout stress test now measures a control's hit area, as WCAG 2.5.8 defines a target, with harness self-checks that a grown hit area passes and one that lands beside the control still fails.
- **Review**: rubric rows M to S and three new tells (`anti-slop-review.md`); the `design-reviewer` runs the craft measurements; `/verify-ui` documents them with test snippets that were type-checked and run.

## Disagreements between sources, and how the rules settle them

- **Stagger order (#9)**: the owner says most valuable first; IBM Carbon says end on the most important; everyone else says follow the reading order. The rule follows reading order grouped by importance, which agrees with the owner in Carshenas's layouts. Open for choreographed sequences (below).
- **Persian line height (#5)**: the owner's 1.4 to 1.6, the old repo rule "≥ 1.7", Material 3's Arabic 1.69 for body, the Dubai Design System's 1.56. Settled by measurement per role and per font (typography M3, M4).
- **Target size (#6)**: 44 (Apple, WCAG AAA) against 48 (Material) against 24 (WCAG AA). The repo keeps 44 and 48 for the primary action.
- **Skeletons (#8)**: default everywhere (the owner's framing) against page loads only (NN/g) and against skeletons at all (Roselli, Viget). Settled: first loads of a view; updates dim instead.
- **Tooltip timing (#11)**: first delays from 500 to 1500 ms; 600 ms and a 400 ms window chosen with Base UI's defaults.
- **Hover gating**: media queries (Emil, Rauno, Vercel) against `pointerType` (Devon Govett, because touch laptops report hover). Both: CSS hover through the media query, behaviour through `pointerType`.
- **Springs and dismissal**: Emil's general `bounce: 0.2` and 0.11 px/ms threshold against Apple's zero bounce after a tap and sheet thresholds of 0.4 to 0.5 px/ms; the 0.11 value is Sonner's, for toasts.
- **Rejected as wrong or outdated**: Vercel's live page offering `maximum-scale=1` and claiming Suspense delays fallbacks; box-shadow focus rings "because outline ignores radius"; the Next.js guides' own `transition-all`, `disabled` buttons and a server-side cycle that is not safe to repeat; `text-box: trim-both cap alphabetic` for Persian (Chrome's article presents it as the default).

## Decisions left to the owner

1. **React pin**: move `react` and `react-dom` to 19.3.0 so Vitest can render `<ViewTransition>`; until then it stays in thin wrappers covered by e2e.
2. **Choreographed staggers**: keep reading order grouped by importance, or end on the most important item as IBM Carbon recommends, for sequences such as the first valuation reveal.
3. **Source photos and ADR-0008**: Next.js's image optimizer keeps resized copies of source photos on our server, which "images are never re-hosted" forbids; decide how listing photos are served before CS-16.
4. **Partial Prefetching**: one shared shell per route (`partialPrefetching`) against per-link prefetch control.
5. **Persian font loading (CS-3)**: `display: 'optional'` for body text against a tuned per-platform fallback, decided by measuring layout shift.
6. **Weight 500 for 12 to 13 px labels (CS-3)**: an addition to "400 with 600 or 700".
7. **Latin trim codes** («پژو ۲۰۶ SD»): shrink them with a Latin-only `size-adjust` face, or leave them (taste).
8. **Cursor on buttons**: the default arrow, or the hand for every enabled button.
9. **Minimum time for a shown indicator**: a small hook or the `spin-delay` package (an ADR-0003 dependency decision).
10. **The layout stress test now measures hit areas**: a 24 px icon whose hit area a pseudo-element grows to 44 px passes, as WCAG defines a target; previously its box alone failed it. A hit area placed beside the control still fails (harness self-check). Confirm this reading of the rule.

## Recommendation

Use `craft.md` as the checklist for every screen: read its section while building, walk it and run `craft-checks.js` before calling a screen done. CS-3 should build its tokens from it (durations and easings from `motion.md`, line heights per role from §7, the hue budget, skeleton tokens) and rerun `lab/` for the font it picks. Two follow-ups are worth tasks, pending the owner's go-ahead: e2e fixture helpers that turn the layout-shift, hit-area and reduced-motion checks into regression guards for every page in `fixtures/app-pages.ts`; and the photo-serving decision above before any listing photo ships.
