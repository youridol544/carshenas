# The Carshenas design language

- Status: normative. Written 2026-09-27 with CS-3; the palette and the overall look await the owner's approval on the sample page, `/design`.
- Decisions it rests on: ADR-0005 (Tailwind v4, logical utilities only), ADR-0014 (tomans and Jalali dates on screen), ADR-0015 (Yekan Bakh, self-hosted and never committed).
- Evidence:
  - `docs/research/2026-09-27-persian-typeface.md`: the survey of every Fontiran font, the licence, and the font measurements with their lab.
  - `docs/research/2026-09-27-rtl-and-locale-architecture.md`: direction, formatters and bidi.
  - `docs/research/2026-09-26-ui-craft-details.md`: the craft rules behind the numbers.
- The `ui-design` skill reads this file. Its rules (`.claude/skills/ui-design/`) say how to use the tokens; this file says what they are.

## How this document changes

- **The code is the truth.** The tokens are `apps/web/src/app/globals.css`, and the formatters are `apps/web/src/lib/`. This file explains them. Where it disagrees with them, the code is right and this file has a bug.
- **The tokens are enforced, not only written.**
  - **Tailwind.** `globals.css` removes Tailwind's own palette, font sizes, line heights, letter spacing, weights below 400, radii, shadows, easings and animations. A class that is not a role here is unknown, and `better-tailwindcss/no-unknown-classes` fails the lint.
  - **Lint.** `no-restricted-classes` rejects raw colours, magic numbers, spacing off the rhythm, every `leading-*` class and durations by number (`duration-300`), which Tailwind 4 still generates after its scales are removed. `no-restricted-syntax` rejects hand-typed percentages and invisible characters written literally. The lint self-test (`apps/web/eslint/samples/bad-tokens.tsx`, `bad-percent.tsx`, `bad-invisible.tsx`, and `clean-percent-style.tsx`, which must pass) proves they fire.
  - **Contrast.** `apps/web/src/lib/color-contrast.test.ts` holds every pair in section 3 to its WCAG threshold, the deal ramp to rising lightness, and every colour token to sRGB. Browsers clip an out-of-gamut colour per channel instead of reducing its chroma (Chromium painted `oklch(0.9 0.065 25)` as `#ffcec8`), so only a token inside sRGB is painted as computed.
- **The sample page shows all of it.** `/design` has visual baselines at phone and desktop width (`e2e/tests/app/__screenshots__/`), made in the official Playwright container, so a changed token or font shows up as a changed screenshot.
- **Changing a token.**
  1. Change `globals.css` and this file in one commit.
  2. Run `pnpm check`.
  3. Regenerate the baselines with `pnpm e2e:visual --update-snapshots=all` and look at the diff. A bare `--update-snapshots` rewrites only images outside the 1% tolerance, so a small change, such as a sign moving to the other side of its number, would keep the old image.
- **Adding a token.**
  1. Prove two components need the value (`.claude/skills/ui-design/references/tokens.md`).
  2. Add it at the right tier with a role name.
  3. For a colour, add its pair to section 3 and to the contrast test.

## 1. Typeface

One family covers Persian, Latin and digits: **Yekan Bakh 4** by Reza Bakhtiarifard and Mahan Jafarzadeh (Fontiran, 2026 release 4.000). The app loads only its variable web font, weights 100 to 950 on one `wght` axis, 69,304 bytes. It is licensed per site and never committed; `docs/runbooks/licensed-font.md` says how a machine gets it.

- **Loading.**
  - `next/font/local` in `apps/web/src/components/layout/app-font.ts`, preloaded on every route, with `display: 'swap'`.
  - `adjustFontFallback` is `false`, because Next.js sizes that fallback on Latin letters against Arial. The fallbacks are `system-ui`, Segoe UI, Tahoma, Geeza Pro, Noto Naskh Arabic and `sans-serif`.
  - **Layout shift, measured on the production build** (`docs/research/2026-09-27-persian-typeface/lab/font-display-cls.mjs`):

    | Extra delay on the font | CLS |
    |---|---|
    | up to 300 ms | 0 |
    | 1.5 s | at most 0.033 |

  - **Why not `optional`.** `optional` leaves the fallback in place for the whole visit after a slow first load: measured after a client-side navigation, the text was still 197.4 px wide against 213.0 px in Yekan Bakh.
- **Weights.**

  | Weight | Name | Use |
  |---|---|---|
  | 400 | `font-normal` | reading text |
  | 500 | `font-medium` | labels of 12 to 14 px (owner, 2026-09-26) |
  | 600 | `font-semibold` | controls, card titles and a card's price, so a card keeps to two weights |
  | 700 | `font-bold` | headings and the price hero |

  Nothing below 400 exists as a utility.
- **Vertical metrics.** hhea, typo and win are identical: ascent 1000, descent −550, gap 0, `USE_TYPO_METRICS` on. `line-height: normal` is 1.55, and the line box is the same on every OS. The glyph box reaches −610, so line heights below 1.4 can clip ink at the top (section 2). The licence forbids changing the file, so any metric correction is done in CSS.
- **Digits.** Persian digits come from `Intl` in real Unicode (U+06F0 to U+06F9). The package's FaNum builds, which disguise Latin digits, are not used.
  - Default digits are proportional (۱ is 260 units wide, ۳ is 700).
  - `tabular-nums` (the font's `tnum`, measured to cover Persian digits) is only for columns and numbers that change in place. Its width is the same at every weight.
  - «٬» (U+066C) renders as a comma.
- **Latin.** The Latin was redrawn in 2024 to match the Persian; «BMW X3 xDrive30i» and «GLS» sit at a comfortable height beside Persian. The owner judges trim codes on real listing titles (decision 7 of 2026-09-26). No `size-adjust` face exists.
- **Stems, for icon strokes** (the alef, `lab-stem.js`):

  | Weight | Stem, share of the font size | At 16 px |
  |---|---|---|
  | 400 | 8.23 % | 1.32 px |
  | 500 | 9.42 % | 1.51 px |
  | 600 | 10.64 % | 1.70 px |
  | 700 | 12.62 % | 2.02 px |

  An icon beside regular 16 px text draws 1.25 to 1.5 px; beside bold, 2 px.

## 2. Type roles

Each role is a size with its Persian line height (`--text-<role>` and `--text-<role>--line-height`), used as `text-<role>`. Sizes are in rem, so they follow the reader's font-size setting (WCAG 1.4.4).

| Role | Utility | Size | Line height | Weight | Use |
|---|---|---|---|---|---|
| Display | `text-display` | 36 px | 1.3 | 700 | short figures («۴۰۴», «۴۲ آگهی مشابه»); the price hero from a 24rem container |
| Title | `text-title` | 24 px | 1.5 | 700 | the page heading (`h1`) |
| Heading | `text-heading` | 20 px | 1.6 | 700 | section headings; a card's price, at 600 |
| Body | `text-body` | 16 px | 1.75 | 400 | reading text: descriptions, explanations |
| Control | `text-control` | 16 px | 1.5 | 600 or 400 | buttons, inputs, list rows, clamped card titles |
| Secondary | `text-secondary` | 14 px | 1.6 | 400 | secondary paragraphs, helper text |
| Label | `text-label` | 14 px | 1.5 | 500 | chips, badges, tabs |
| Meta | `text-meta` | 12 px | 1.5 | 400 | one-line meta: «تهران · ۳ ساعت پیش» |

- **Measured on Yekan Bakh** (`docs/research/2026-09-26-ui-craft-details/lab/`, `LAB_FONTS=yekanBakh`).
  - **Latin-equivalent line heights.** These are the Persian line heights that leave the same white space between lines as the font's own Latin at its reference line height:

    | Size | 12 px | 14 px | 16 px | 20 px | 24 px | 28 px | 32 px |
    |---|---|---|---|---|---|---|---|
    | Line height | 1.55 | 1.59 | 1.73 | 1.60 | 1.49 | 1.49 | 1.45 |

    Body is 1.75, above the measured 1.73, and never below 1.7. Secondary, heading and title follow their measurements. One-line roles use 1.5.
  - **Clipping.** With `overflow: hidden`, no ink is clipped from line height 1.4 at any size in weights 400 and 700, including the stress string «تأیید آگهی؛ پراید غ». At 1.2, up to 1 px goes at the top. So one-line and clamped text stays at 1.5 and never goes below 1.4.
  - **Centring.** A label centred by its box (flex, `min-block-size`) sits within about 2 px of the centre at every line height. Letters with tall ink, such as «تأیید» and «مشاهده», sit highest. Centre with the box, not with the line height.
  - **Trimming.** `text-box: trim-both cap alphabetic` leaves up to 10 px of a 28 px heading's ink outside its box. It is never used on Persian.
- **Hierarchy.**
  - Below 16 px, hierarchy comes from weight and colour, not size.
  - Heading steps are about 1.2 to 1.25 times apart (16, 20, 24, 36).
  - At most two weights and three text colours per component; a badge inside a card is its own component.
- **The price hero.** A full-digit price is too wide for the display role on a phone. Measured in Yekan Bakh 700, «۶۸۰٬۰۰۰٬۰۰۰ تومان» is 293.7 px at 36 px, and «۱۲۵٬۰۰۰٬۰۰۰٬۰۰۰ تومان» is 356.2 px, while a 320 px phone has 288 px of content width. So the hero is `text-title` (237.4 px for the twelve-digit price) and becomes `text-display` from a 24rem container (`@sm:`), where twelve digits fit. The threshold is in rem, so doubled text steps back to the title size.
- **Reading width.** `max-w-reading` is 32em, about 70 to 75 Persian characters; `ch` is the width of a Latin zero.
- **Never.** No letter spacing, uppercase, italics or alpha text colours. The lint rejects `tracking-*`, every `leading-*` class (Tailwind still makes `leading-none` and `leading-<n>`) and any slash on `text-*` (`text-x/60`, `text-body/7`).
- **Spelling.** Copy follows `docs/product/glossary.md`: the ezafe after a silent «ه» is «ه‌ی» («صفحه‌ی اصلی», «معامله‌ی عالی»), and «جست‌وجو» keeps its non-joiner. `Intl`'s own strings stay as the runtime prints them («هفتهٔ گذشته»).

## 3. Colour

**Three tiers.**
- **Primitives** are plain properties on `:root`: a 12-step neutral scale and the steps of blue, red, green, amber and the deal ramp that the roles use. No utility exists for them.
- **Roles** go through Tailwind's namespaces, which decide the only utility each role produces:
  - `--background-color-*` gives `bg-*`.
  - `--text-color-*` gives `text-*`.
  - `--border-color-*` gives `border-*`.
  - `--outline-color-*` gives `outline-*`.
  - `--color-*` gives every utility; it is used only for the deal ramp, which fills gauge bands too.
- **Component tokens** are created only when one component needs its own knob.

**The hues.**
- The neutrals lean towards the action hue (265) with very low chroma.
- The action hue is one blue, for the primary action, links, the focus ring and the selected state.
- The deal ratings use their ramp, only on ratings.
- Red, green and amber appear only while an error, success or warning exists.
- The action hue is never a deal hue. Dark mode is not defined yet; `color-scheme` is `light`.

### Primitives

| Primitive | OKLCH | sRGB | Backs |
|---|---|---|---|
| `--gray-1` | `oklch(0.99 0.002 265)` | `#fbfcfd` | (scale step, no role yet) |
| `--gray-2` | `oklch(0.975 0.004 265)` | `#f5f7fa` | `bg-surface-muted` |
| `--gray-3` | `oklch(0.95 0.006 265)` | `#eceef3` | `bg-surface-hover`, `bg-skeleton`, `bg-deal-none` |
| `--gray-4` | `oklch(0.925 0.008 265)` | `#e3e6ec` | `bg-surface-pressed` |
| `--gray-5` | `oklch(0.9 0.01 265)` | `#dbdee5` | `border-divider` |
| `--gray-6`, `--gray-7`, `--gray-9` | `oklch(0.865 0.012 265)`, `oklch(0.81 0.015 265)`, `oklch(0.6 0.02 265)` | `#cfd3db`, `#bcc1cb`, `#7a808d` | (scale steps, no role yet) |
| `--gray-8` | `oklch(0.645 0.018 265)` | `#888e99` | `border-control` |
| `--gray-10` | `oklch(0.54 0.02 265)` | `#696f7b` | `text-subtle` |
| `--gray-11` | `oklch(0.48 0.02 265)` | `#585e69` | `text-muted`, `text-on-deal-none` |
| `--gray-12` | `oklch(0.23 0.015 265)` | `#191d24` | `text-default` |
| `--blue-3` | `oklch(0.94 0.028 262)` | `#e1ecff` | `bg-action-subtle` |
| `--blue-9` | `oklch(0.53 0.2 262)` | `#2261dd` | `bg-action`, `outline-focus` |
| `--blue-10` | `oklch(0.47 0.19 262)` | `#154fc3` | `bg-action-hover` |
| `--blue-11` | `oklch(0.45 0.17 262)` | `#194cb1` | `text-link` |
| `--blue-12` | `oklch(0.3 0.11 262)` | `#0b2964` | `text-on-action-subtle` |
| `--red-3`, `--red-9`, `--red-11` | `oklch(0.955 0.022 27)`, `oklch(0.56 0.2 27)`, `oklch(0.5 0.18 27)` | `#ffebe8`, `#d02c2a`, `#b32322` | `bg-danger-subtle`; `bg-danger`, `border-danger`; `text-danger` |
| `--green-3`, `--green-11` | `oklch(0.955 0.03 150)`, `oklch(0.47 0.11 150)` | `#e3f6e6`, `#206b38` | `bg-success-subtle`, `text-success` |
| `--amber-3`, `--amber-11` | `oklch(0.96 0.04 85)`, `oklch(0.48 0.1 65)` | `#fef0d4`, `#845011` | `bg-warning-subtle`, `text-warning` |

The canvas and surfaces are white (`oklch(1 0 0)`), and so are `text-on-action` and `text-on-danger`.

### Pairs and their contrast (WCAG 2, computed from `globals.css` by the contrast test)

Persian text needs 4.5:1 wherever it sits, because WCAG's large-text exemption is defined for Latin. Control borders and the focus ring need 3:1 (WCAG 1.4.11).

| Foreground | Background | Ratio |
|---|---|---|
| `text-default` | `bg-canvas` / `bg-surface-muted` | 16.90:1 / 15.75:1 |
| `text-muted` | `bg-canvas` / `bg-surface-muted` / `bg-surface-hover` | 6.52:1 / 6.08:1 / 5.62:1 |
| `text-subtle` | `bg-canvas` / `bg-surface-muted` | 5.05:1 / 4.70:1 |
| `text-link` | `bg-canvas` / `bg-surface-muted` | 7.75:1 / 7.22:1 |
| `text-on-action` | `bg-action` / `bg-action-hover` | 5.49:1 / 7.15:1 |
| `text-on-action-subtle` | `bg-action-subtle` | 11.64:1 |
| `text-danger` | `bg-canvas` / `bg-danger-subtle` | 6.60:1 / 5.75:1 |
| `text-on-danger` | `bg-danger` | 5.15:1 |
| `text-success` | `bg-canvas` / `bg-success-subtle` | 6.52:1 / 5.77:1 |
| `text-warning` | `bg-canvas` / `bg-warning-subtle` | 6.70:1 / 5.94:1 |
| `border-control` | `bg-canvas` / `bg-surface-muted` | 3.29:1 / 3.07:1 |
| `outline-focus` | `bg-canvas` / `bg-surface-muted` | 5.49:1 / 5.12:1 |

### The deal ramp

Five levels on one path from green to red, whose lightness only rises, so they stay apart in greyscale and for colour-blind buyers (ui-design craft.md, V-16). Each badge shows its fill with its own ink at 4.5:1 or more. The word is always there («معامله‌ی عالی», «معامله‌ی خوب», «قیمت منصفانه», «گران», «خیلی گران»), and «بدون ارزیابی» uses the neutral.

| Rating | Fill utility | Fill | Ink | Contrast | Greyscale L* | Deuteranopia |
|---|---|---|---|---|---|---|
| great | `bg-deal-great` | `oklch(0.5 0.13 152)` `#05773b` | white | 5.66:1 | 43.6 | `#6c643f` |
| good | `bg-deal-good` | `oklch(0.61 0.15 140)` `#4c983a` | `#09200b` | 4.79:1 | 56.4 | `#928541` |
| fair | `bg-deal-fair` | `oklch(0.72 0.15 115)` `#a2af29` | `#212405` | 6.60:1 | 68.4 | `#bba835` |
| high | `bg-deal-high` | `oklch(0.81 0.14 75)` `#f5b34c` | `#472400` | 7.52:1 | 77.4 | `#dbc64f` |
| overpriced | `bg-deal-overpriced` | `oklch(0.9 0.0519 25)` `#ffd1cd` | `#901114` | 6.70:1 | 87.6 | `#e4dfcc` |
| none | `bg-deal-none` | `--gray-3` `#eceef3` | `--gray-11` | 5.62:1 | — | — |

- **Why this direction.** The best deal is the darkest and strongest, and the most overpriced is the palest. The ramp makes a good deal stand out, while an overpriced listing stays readable without shouting. The alternative, a diverging ramp that is pale at «منصفانه» and dark at both ends, reads better as a scale but fails in greyscale: great and overpriced come out at the same lightness.
- **Where the greys come from.** The greyscale steps (12.8, 12.0, 9.0 and 10.2 in L*) and the deuteranopia column (Machado, Oliveira and Fernandes 2009) are from the palette lab, `docs/design/palette-lab/`.

## 4. Space, size and shape

- **Spacing.** A 4 px base (`--spacing: 0.25rem`, Tailwind's own).
  - **Rhythm steps.** Padding, margin, gap and `space-*` use only the rhythm steps, which the lint enforces: 1, 2, 3, 4, 6, 8, 12 and 16 (4, 8, 12, 16, 24, 32, 48 and 64 px).
  - **Optical nudges.** 0.5 and `px` are for 2 px and 1 px nudges.
  - **Sizes.** Widths, heights and insets may use any 4 px multiple: `min-h-11` for a 44 px target, `min-h-12` for a 48 px primary action.
- **Radii.**

  | Utility | Radius | Use |
  |---|---|---|
  | `rounded-badge` | 6 px | badges |
  | `rounded-control` | 10 px | buttons, fields, photo frames inside cards |
  | `rounded-card` | 16 px | cards |
  | `rounded-sheet` | 24 px | sheets |
  | `rounded-full` | full | pills, the ramp's ends |

  Inner radius is the outer radius minus the padding, never below 4 px.
- **Elevation.** Only what floats casts a shadow. There are three, each ambient plus direct, with no horizontal offset, so nothing needs mirroring:

  | Utility | For |
  |---|---|
  | `shadow-raised` | a sticky bar with content under it |
  | `shadow-overlay` | menus and popovers |
  | `shadow-sheet` | bottom sheets, cast upwards |

  Separate with space first, then a background step (`bg-surface-muted`), then a divider (`border-divider`).
- **Actions.** `apps/web/src/components/ui/action-link.tsx` holds the three levels: primary (solid `bg-action`, 48 px high, one per screen), secondary (outlined, 48 px) and tertiary (a link, with a 44 px target). A link is an `ActionLink`; a `<button>` takes the same classes from `actionClasses(level)`.
- **Focus.** Every focusable element gets a 2 px `outline-focus` ring at a 2 px offset, on `:focus-visible` only (`globals.css`).
- **Links.** The underline sits at an offset of 0.45em, 1 px thick, below the dots of Persian letters.

## 5. Motion

These are the tokens of `.claude/skills/ui-design/references/motion.md`, in Tailwind's namespaces so the utilities exist.

| Token | Value | Utility |
|---|---|---|
| press | 120 ms | `duration-press` |
| popover | 160 ms | `duration-popover` |
| sheet | 240 ms | `duration-sheet` |
| modal | 280 ms | `duration-modal` |
| morph | 350 ms | `duration-morph` |
| settle | 500 ms | `duration-settle` |
| shimmer | 1.5 s | `duration-shimmer` |
| pending | 400 ms | `delay-pending` |
| stale | 200 ms | `delay-stale` |

- **Easings.**
  - `ease-out` is `cubic-bezier(0.16, 1, 0.3, 1)`, the default.
  - `ease-in-out` is `cubic-bezier(0.65, 0, 0.35, 1)`.
  - `ease-settle` is `cubic-bezier(0.32, 0.72, 0, 1)`.
- **Defaults.** A bare `transition-*` class takes 120 ms and `ease-out`.
- **By number.** Tailwind 4 turns any bare number into milliseconds (`duration-300`, `delay-75`); the lint rejects them, so every duration is a token.

## 6. Numbers, dates and direction

Every number, amount and date a person reads is formatted on the server by `apps/web/src/lib/`, never by hand.

| Module | What it does |
|---|---|
| `locale.ts` | `fa`, `rtl`, `fa-IR`, `persian`, `arabext`, Saturday, `Asia/Tehran`; a test checks each against the runtime's `Intl` |
| `toman.ts` | ADR-0014's amount forms |
| `format-number.ts` | `formatCount`, `formatMileage`, and `formatPercent`, the only source of «٪» |
| `format-date.ts` | Jalali forms, `formatTimeAgo(instant, now)`, and `tehranIsoDate` for Latin-digit data |
| `digits.ts` | `toLatinDigits` for anything typed |
| `bidi.ts` | isolates for plain-text contexts |

The amount forms in `toman.ts` are:
- **Stated prices.** `formatToman` prints full digits: «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان».
- **Estimates.** `formatTomanEstimate` and `formatTomanEstimateRange` round to three significant digits.
- **Sentences.** `formatTomanInWords` writes «۱ میلیارد و ۲۵۰ میلیون تومان».
- **Scales.** `formatTomanCompact` and `formatTomanCompactRange` write «۱٫۲۵ میلیارد» on scales only.

**The percent sign sits to the left of its number.**
- **The cause.** Persian digits are European numbers to the Unicode bidi algorithm, so a sign read after the number («٪», and likewise «‰» and «°») joins the digits' left-to-right run and shows on the right (UAX #9, W5).
- **The fix.** `formatPercent` puts a right-to-left mark (U+200F) before «٪», which keeps it on the left, where Persian reads «درصد».
- **What holds it in place.**
  - The lint rejects a percentage typed by hand in JSX text, strings, templates or concatenation. A CSS percentage built inside a `style` attribute (a gauge marker's `` `${share * 100}%` ``) is layout, not text, and passes.
  - The layout inspector (`e2e/gorilla/layout.ts`) measures the rendered glyphs on every app page and fails a sign on the wrong side.

**Isolating opposite-direction text.**
- **Direction.** It is set once, `<html lang="fa" dir="rtl">`, from `locale.ts`; never with CSS.
- **Text from data** (titles, seller names) goes in `<bdi>`.
- **Text that is always left to right** (VIN, URL, phone, trim code on its own) goes in `<span dir="ltr" lang="en">`. Phones keep Persian digits.
- **Ranges** use «تا», never a hyphen.
- **Plain text.** Where markup is impossible (the document title, `title`, `alt` and `placeholder` attributes, a native `<option>`), `isolate()` and `isolateLtr()` from `bidi.ts` add first-strong and left-to-right isolates. They are never used in `aria-label`.
- **Primitives.** Base UI and React Aria read direction from their own providers, not from `<html dir>`. When the first Base UI primitive arrives, the root layout renders Base UI's `DirectionProvider` with `direction="rtl"`; a React Aria date field gets `I18nProvider locale="fa-IR"` and Persian strings.

**Breaking long values.**
- **At normal sizes nothing breaks.** Each role is chosen so its longest value fits a 320 px phone (the price hero, section 2).
- **A number stays with its word.** The formatters join a number to its unit or scale word with a no-break space («۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان», «۱۲۰٬۰۰۰ کیلومتر»), and copy does the same («تیپ ۲», «۴۲ آگهی»; ui-design craft.md, V-30).
- **A long number breaks only after a thousands mark, as a last resort.** `NumericText` (`apps/web/src/components/ui/numeric-text.tsx`) keeps each group of digits whole, and the last group with its unit, and lets the line break only between groups: «۶۸۰٬۰۰۰٬» then «۰۰۰ تومان». That is where an amount breaks when doubled text on a narrow phone makes it wider than the line, instead of the page scrolling sideways (WCAG 1.4.10). Wrap every formatted amount a person reads in it.
- **A Persian word never breaks.** Never put `wrap-anywhere` or `break-all` on Persian text: it split «تومان» into «توما» and «ن» on a 320 px phone.
- **Checked on every page.** The layout inspector (`e2e/gorilla/layout.ts`) fails a Persian word whose letters sit on two lines, two digits of one group on different lines, and a line break at a no-break space, at every width and at double text size.
- **Codes may break anywhere.** A VIN or URL in its `dir="ltr"` span carries `wrap-anywhere` itself.

## 7. Left for the owner

- The palette, the direction of the deal ramp and the overall look, judged on `/design` at phone width.
- Whether «٪» at the left and the Yekan Bakh Latin read right on real listing titles.
- A dark theme: the tiers allow one (roles through `light-dark()`), but none is defined.
