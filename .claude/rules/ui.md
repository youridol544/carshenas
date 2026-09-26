---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.css"
---

# Anything a user sees (`apps/web/src`, components and styles)

Farsi, right-to-left, phone-first. These are the invariants; the `ui-design` skill has the reasons, the recipes and the references, and `docs/design/design-language.md` (CS-3) has the tokens. If that file does not exist, build with neutral structure and say CS-3 is needed; never invent a palette.

- The base direction is set once, `<html lang="fa" dir="rtl">` in the root layout; never set it anywhere else and never through CSS `direction`. Flex and grid mirror by themselves. (`dir` on an element is only for isolating opposite-direction content, below.)
- Horizontal styling is logical only (`ms-`, `me-`, `ps-`, `pe-`, `inset-s-`, `inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`); the lint enforces it. `translateX`, horizontal shadows, gradients, `background-position`, JS positioning and library props such as a drawer `side` do **not** flip by themselves: flip them on purpose and leave a comment.
- Mirror arrows, chevrons, progress, sliders and steppers (`−` on the right, `+` on the left); never mirror logos, checkmarks, the search magnifier, clocks, media controls, numbers or charts.
- Isolate every left-to-right run inside Persian text: `<bdi>` or `dir="auto"` for names from data, `dir="ltr"` on phone, OTP, email, URL, VIN and card fields and spans. Ranges use words («۳ تا ۵»), never a hyphen.
- UI text uses Persian digits and Jalali dates through `Intl` with `fa-IR` in Server Components (or the formatted string is passed down); data, URLs and APIs keep Latin digits; typed input accepts any digit script and is normalised. Never the `currency` style, never `dateStyle: 'full'`, never `<input type="number">`. «ناعدد» on screen is a bug.
- Persian text: no `letter-spacing`, `uppercase`, italics or text opacity; body line height ≥ 1.7; check that dots and descenders are not clipped in buttons, badges and inputs.
- Tokens only. No raw colour, size, radius, shadow or duration (`bg-[#…]`, `text-[13px]`, `duration-[180ms]` are missing tokens). No `dark:` in components.
- Touch: targets ≥ 44 px (primary action 48 px) with 8 px gaps; input text ≥ 16 px; zoom and paste never blocked; hover only under `@media (hover: hover) and (pointer: fine)`; every swipe has a tap alternative.
- One solid primary action per screen; secondary outlined or quiet; tertiary looks like a link. Labels above fields, outside them. Errors inline, saying what happened and how to fix it, `aria-invalid` only after validation.
- Every screen ships its loading, empty, error and long-content states, not only the happy path.
- Native elements before ARIA (`<button>`, `<a href>`, `<dialog>`, `<details>`); headings in order; landmarks; focus always visible (`:focus-visible` ring ≥ 2 px, 3:1); focused elements never hidden under sticky bars (`scroll-padding-block`).
- Contrast 4.5:1 for all Persian text including placeholders (no large-text exemption), 3:1 for controls, icons and focus rings.
- Motion: `transform` and `opacity` only, under 300 ms from a duration token, ease-out, a `prefers-reduced-motion` variant, and none on actions used dozens of times a day. Horizontal motion is expressed logically.
- Reuse `src/components/ui/` before creating; copy comes from `docs/product/glossary.md`; nothing is copied from a reference site except the pattern.
- Before calling a screen done: `/verify-ui` at 412 px and 1440 px, measured (overflow, target sizes, contrast, axe), then the `design-reviewer` agent. Taste and copy tone are "left for you to check", never self-approved.
