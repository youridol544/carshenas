---
paths:
  - "apps/web/src/**/*.tsx"
  - "apps/web/src/**/*.css"
---

# Anything a user sees (`apps/web/src`, components and styles)

Farsi, right-to-left, phone-first. These are the invariants; the `ui-design` skill has the reasons, the recipes and the references (the small craft details, with sources, are in its `references/craft.md`), and `docs/design/design-language.md` (CS-3) has the tokens. If that file does not exist, build with neutral structure and say CS-3 is needed; never invent a palette.

- The base direction is set once, `<html lang="fa" dir="rtl">` in the root layout; never set it anywhere else and never through CSS `direction`. Flex and grid mirror by themselves. (`dir` on an element is only for isolating opposite-direction content, below.)
- Horizontal styling is logical only (`ms-`, `me-`, `ps-`, `pe-`, `inset-s-`, `inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`); the lint enforces it. `translateX`, horizontal shadows, gradients, `background-position`, JS positioning and library props such as a drawer `side` do **not** flip by themselves: flip them on purpose and leave a comment.
- Mirror arrows, chevrons, progress, sliders and steppers (`−` on the right, `+` on the left); never mirror logos, checkmarks, the search magnifier, clocks, media controls, numbers or charts.
- Isolate every left-to-right run inside Persian text: `<bdi>` or `dir="auto"` for names from data, `dir="ltr"` on phone, OTP, email, URL, VIN and card fields and spans. Ranges use words («۳ تا ۵»), never a hyphen.
- UI text uses Persian digits and Jalali dates through `Intl` with `fa-IR` in Server Components (or the formatted string is passed down); data, URLs and APIs keep Latin digits; typed input accepts any digit script and is normalised. Never the `currency` style, never `dateStyle: 'full'`, never `<input type="number">`. «ناعدد» on screen is a bug.
- Persian text: no `letter-spacing`, `uppercase`, italics or alpha text colours. Line height by role, from the type tokens: reading text 1.7 (never below 1.6), controls, chips, badges, meta and clamped titles 1.5 (never below 1.3), headings 1.5 falling to 1.3 as they grow; never `leading-none`, `leading-tight` or `line-height: normal`. Buttons, badges and clamped titles are checked for clipping with «تأیید آگهی؛ پراید غ». Link underlines sit below the dots (`underline-offset` 0.45em).
- Tokens only. No raw colour, size, radius, shadow or duration (`bg-[#…]`, `text-[13px]`, `duration-[180ms]` are missing tokens). No `dark:` in components.
- Touch: hit areas ≥ 44 px (primary action 48 px), grown with `after:-inset-*` rather than a bigger glyph; spacing by look (8 px between bordered chips, about 12 px around filled controls, about 24 px between bare icons); input text ≥ 16 px; zoom and paste never blocked; `hover:` already means a real mouse (`globals.css`), and behaviour that depends on hover checks `event.pointerType`; every swipe has a tap alternative.
- Nothing moves unless the person moved it: images and late-arriving blocks get their box before they load (`width`/`height`, `aspect-*`, `min-block-size`); skeletons render the component's own frame; numbers that change in place use `tabular-nums` in a box sized for the widest value (never on a static price); nothing changes weight or size between states; a pending button keeps its label.
- Waiting: indicators appear only after the pending-delay token; updates keep the old content and dim it instead of showing a skeleton; optimistic updates only for predictable, reversible changes, with a visible rollback; undo instead of a confirmation for anything reversible.
- Restraint: one icon family, strokes matched to the stem of the label beside them; a hue budget per view (tinted neutrals, one action hue, state colours only while the state exists); empty states have a way forward; scroll fades only on a side with more content, inside `@supports (animation-timeline: scroll())`.
- One solid primary action per screen; secondary outlined or quiet; tertiary looks like a link. Labels above fields, outside them. Errors inline, saying what happened and how to fix it, `aria-invalid` only after validation.
- Every screen ships its loading, empty, error and long-content states, not only the happy path.
- Native elements before ARIA (`<button>`, `<a href>`, `<dialog>`, `<details>`); headings in order; landmarks; focus always visible (`:focus-visible` ring ≥ 2 px, 3:1); focused elements never hidden under sticky bars (`scroll-padding-block`).
- Contrast 4.5:1 for all Persian text including placeholders (no large-text exemption), 3:1 for controls, icons and focus rings.
- Motion: `transform` and `opacity` only, from duration tokens (under 300 ms; shared-element morphs and page slides up to 400 ms, a drag settle up to 500 ms), interruptible (transitions for anything reversible, never input blocked while animating), written inside `motion-safe:` with view transitions given their own reduced-motion CSS, and none on actions used dozens of times a day. Staggers only on first-time entrances, in reading order. Horizontal motion is expressed logically.
- Reuse `src/components/ui/` before creating; copy comes from `docs/product/glossary.md`; nothing is copied from a reference site except the pattern.
- Before calling a screen done: walk the sections of the skill's `references/craft.md` that apply, then `/verify-ui` at 412 px and 1440 px, measured (overflow, hit areas, contrast, axe, layout shift, reduced motion), then the `design-reviewer` agent. Taste and copy tone are "left for you to check", never self-approved.
