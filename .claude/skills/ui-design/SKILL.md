---
name: ui-design
description: Design and review user interface for Carshenas, a Farsi, right-to-left, phone-first used-car search product. Use when building, restyling or reviewing anything a user sees (pages, components, forms, empty and error states, motion), when choosing spacing, colour, type or layout, when adapting a pattern seen on CarGurus, Autolist or another reference site, when polishing the small details that make an interface feel fast and alive (interruptible motion, layout shift, skeletons, optimistic updates, touch targets, tooltips and menus, icons, colour budget, empty states, scroll fades, Persian line height), or when a screen looks generic, cramped, misaligned or "off".
---

# ui-design: interfaces for a Farsi, right-to-left, phone-first search product

No published design skill covers right-to-left or Persian. This one does, and it outranks everything in `references/vendor/` wherever they disagree. The design language itself (colours, type roles, spacing, radii) is decided once in `docs/design/design-language.md` by CS-3. **If that file does not exist yet, do not invent a palette or a type scale: build with neutral structure only and say that CS-3 is needed.** Concrete tokens work; vague taste words ("clean", "modern", "minimal") push a model to a different generic look, so never brief yourself with them.

## Non-negotiables (check every one before you call a screen done)

1. `<html lang="fa" dir="rtl">` is set once in the root layout. Never set direction with CSS.
2. Horizontal styling is logical: `ms-/me-/ps-/pe-`, `inset-s-/inset-e-`, `border-s/e`, `rounded-s/e`, `text-start/end`. No `left`/`right` in CSS, class names, token names or JavaScript positioning. What does not flip by itself must be flipped on purpose: `translateX`, horizontal shadows, gradients, `background-position`, `clip-path`, library props such as a toast position or a drawer side.
3. Tokens only. No raw colour, size, radius, shadow or duration values in components.
4. Numbers, prices and dates are formatted through `Intl` with `fa-IR` (Persian digits, Persian calendar) on the server side of a component; data and APIs stay in Latin digits; anything a user types is accepted in Persian, Arabic-Indic or Latin digits and normalised.
5. Every left-to-right run inside Persian text is isolated: phone numbers, prices with Latin parts, VINs, URLs, emails, seller names from data (`<bdi>` or `dir="auto"`; `dir="ltr"` on phone, OTP, email, URL and card fields). Write ranges with words («۳ تا ۵»), never with a hyphen.
6. Persian text never gets `letter-spacing`, `uppercase`, italics or an alpha colour. Line height is set per role and falls as the size grows: 1.7 for reading text (never below 1.6), 1.5 for controls, chips, badges, meta and clamped titles (never below 1.3), headings from 1.5 at 20 px to 1.3 from 36 px (`references/craft.md` section 7). Test anything that clips with «تأیید آگهی؛ پراید غ».
7. Tap targets are at least 44 px (48 px for the primary action), measured as the hit area, and spaced by how they look (8 px between bordered chips, about 12 px around filled controls, about 24 px between bare icons); input text is at least 16 px; zoom is never disabled; paste is never blocked.
8. One primary action per screen, solid. Secondary is outlined or quiet, tertiary looks like a link.
9. Every screen has its loading, empty, error and long-content states designed, not just the happy path.
10. All Persian text meets 4.5:1 contrast (the "large text" exemption is defined for Latin and CJK only); controls, icons and focus rings meet 3:1; focus is always visible.
11. Motion animates `transform` and `opacity` only, can be interrupted, stays under 300 ms (shared-element morphs and page slides up to 400 ms, a drag settle up to 500 ms), has a reduced-motion variant, and is absent from anything used dozens of times a day.
12. Labels sit outside fields and above them. Errors say what happened and how to fix it, inline next to the field.
13. Nothing moves unless the person moved it: image and late-arriving boxes are reserved before they load, skeletons match the real layout, numbers that change in place use `tabular-nums` in a box sized for their widest value, and nothing changes weight or size between states.

## Workflow

1. **Read** the task's spec, `docs/design/design-language.md`, and the glossary for the words. If a reference site matters, capture it first (`/capture-site`) and adapt; never copy assets, copy text or brand colours.
2. **Reuse before creating.** Look in `src/components/ui/` and the feature's own components first.
3. **Structure first, in the browser, at 412 px.** Semantic elements, real Farsi copy, real longest-case data. Then 1440 px.
4. **Build the states** (loading, empty, error, long content, disabled, focus) before polishing the happy path.
5. **Verify with `/verify-ui`**: measured facts (overflow, target sizes, contrast, computed spacing) beat looking. A model reads images in coarse patches and cannot see a 2 px misalignment, so measure instead of squinting; when you do look, use viewport-sized shots or element crops, never a tall full-page image.
6. **Walk `references/craft.md`**: every section that applies to what is on screen, measuring the rules marked **Measure**. Then **self-review against `references/anti-slop-review.md`** and ask the `design-reviewer` agent for a fresh-context review. Fix one thing per round; stop after about three rounds and list what is left for a human. Taste, copy tone and brand feel are the owner's call and go under "left for you to check".

## Read the reference you need, not all of them

| Reference | Read when |
|---|---|
| `references/craft.md` | the small details, by topic, with sources: motion, layout stability, loading, optimistic updates and undo, touch, pointer and keyboard (targets, tooltips, menus, sheets), visual restraint (icons, colour budget, empty states, scroll fades, surfaces), Persian type. Read the section for what you build; walk it before calling a screen done |
| `references/rtl-bidi.md` | anything horizontal, icons, mixed Persian and Latin content, carousels, progress, steppers |
| `references/persian-type-formatting.md` | fonts, sizes, line height, digits, prices, phone numbers, Jalali dates, `Intl` traps |
| `references/mobile-forms.md` | forms, OTP and phone fields, bottom navigation, sheets, touch |
| `references/listing-patterns.md` | search results, deal badges, filters and ranges, plain-Farsi search, listing, model and valuation pages, saved searches and alerts |
| `references/states-a11y.md` | loading, empty and error states, focus, contrast, error wording, validation timing |
| `references/motion.md` | any animation or transition |
| `references/tokens.md` | adding or naming a token, theming |
| `references/anti-slop-review.md` | before calling a screen done; reviewing someone else's screen |
| `references/vendor/` | the original texts behind much of `craft.md` (Vercel web interface rules, Emil Kowalski on motion, Jakub Krehel on surfaces and icons, accessibility fixes); `VENDORED.md` lists where they do not apply here or were found wrong |
