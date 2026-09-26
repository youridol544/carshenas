# Motion

Sources: Emil Kowalski, `vendor/emil-design-eng.md` (frequency table, easing flowchart, durations); Rauno Freiberg, "Invisible Details of Interaction Design" (2023-07); NN/g on animation duration ("At 500 ms, animations start to feel like a real drag"); Vercel Web Interface Guidelines ("NEVER `transition: all`"); Jakub Krehel, `vendor/make-interfaces-feel-better/animations.md`; MDN on `prefers-reduced-motion` ("removes, reduces, or replaces"); Apple HIG on RTL ("a back button must point to the right"); Baseline data for View Transitions (same-document: newly available 2025-10-14; cross-document: not Baseline).

## When not to animate

- Anything used dozens of times a day or driven from the keyboard: list rows, dropdown items, tab switches, filter chip edits, saving a listing, search suggestions. Emil: "You should never animate them." Rauno removed motion from core interactions and "suddenly felt like I was moving much faster."
- Anything that delays reading data (a price fading in, skeleton-to-content crossfades longer than 150 ms).
- Loading states beyond a skeleton or spinner; no bouncing logos.
- Attention-seeking motion in the product (pulsing deal badges, shaking buttons) is a bug unless the spec asks for it.

Animate what helps orientation: where a sheet came from, that a button was pressed, that a saved listing was removed and can be undone, that a filter chip appeared.

## Tokens (values are tokens, never inline numbers)

| Token | Value | Use |
|---|---|---|
| `--duration-press` | 120 ms | button press, toggle |
| `--duration-popover` | 160 ms | popovers, tooltips, menus |
| `--duration-sheet` | 240 ms | sheets, drawers |
| `--duration-modal` | 280 ms | dialogs |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | enter and exit; the default |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | movement from one on-screen place to another |

Rules behind the numbers: stay under 300 ms (Emil; NN/g on 500 ms); exits run 20 to 30 % shorter than enters; never ease-in on an enter; press feedback scales to 0.97; nothing enters from `scale(0)` (0.9 or above, Emil; about 0.8, Rauno). Adjust the tokens in `docs/design/design-language.md` (CS-3), not per component.

## How

- Animate `transform` and `opacity` only. No `width`, `height`, `top`, `margin`, `box-shadow` transitions; use `grid-template-rows: 0fr → 1fr` or `interpolate-size` for reveals. Never `transition: all`; list the properties.
- Transitions for anything that can be interrupted or re-triggered (hover, open/close); keyframes only for one-shot effects. Interrupting an animation must not snap.
- Hover effects only under `@media (hover: hover) and (pointer: fine)`; touch gets press feedback instead.
- Horizontal movement is logical: a drawer enters from the inline end, "next" moves toward the inline end (to the left in RTL), "back" toward the inline start. `translateX` distances are physical, so express them from a direction-aware variable (`--inline-direction: -1` set by `:dir(rtl)`, `translate: calc(var(--inline-direction) * 8px)`), and say so in a comment. Vertical motion (sheets, toasts from the bottom) needs no mirroring.
- Reduced motion means reduce, not remove: keep opacity fades, drop translation and scale, and shorten to about half. `@media (prefers-reduced-motion: reduce)` is required on every animation; the e2e `mobile` project can run with it forced to check nothing depends on motion to become visible.
- View transitions: same-document transitions are usable as progressive enhancement (they fall back to an instant swap); cross-document ones are not Baseline. Never make the Back button depend on a transition finishing. The React `<ViewTransition>` component is stable only from React 19.3; the scaffold pins 19.2, so do not use it until the pin moves.
- Skeleton shimmer, progress fill and carousel advance travel right to left.

## Checklist for a review

Duration under 300 ms, from a token; `transform`/`opacity` only; reduced-motion variant present; no motion on high-frequency actions; direction expressed logically; nothing blocks reading or tapping while it animates.
