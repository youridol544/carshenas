# Right-to-left and bidirectional text

Sources: Ahmad Shadeed, RTL Styling 101 (rtlstyling.com); W3C Internationalization, "Structural markup and right-to-left text" and "Inline markup and bidirectional text"; W3C Arabic and Persian Layout Requirements (alreq); Material Design 2 and 3 bidirectionality; NN/g; Apple HIG. Hands-on checks: 2026-09-18, Chromium 153.

## Direction

- Set `dir="rtl"` on `<html>`. W3C: "Never use CSS to apply the base direction."
- Flexbox and grid mirror by themselves; do not reverse them by hand.
- Use logical properties everywhere (Baseline widely available since 2024-03). Mapping:

| Physical | Logical CSS | Tailwind v4 |
|---|---|---|
| `margin-left` / `padding-right` | `margin-inline-start` / `padding-inline-end` | `ms-*` / `pe-*` |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` | `inset-s-*` / `inset-e-*` (`start-*`/`end-*` are deprecated) |
| `text-align: left` | `text-align: start` | `text-start` |
| `border-left` | `border-inline-start` | `border-s` |
| `border-top-left-radius` | `border-start-start-radius` | `rounded-ss-*` |
| `float: left` | `float: inline-start` | `float-start` |

  `space-x-*`, `divide-x` and `border-x` are already logical in Tailwind 4.3. Width, height and the block axis (`mt-`, `pb-`, `top-`) stay physical; RTL never swaps them.

## What does NOT flip by itself (flip it deliberately, and leave a comment saying so)

`translateX` and any horizontal animation distance; `transform-origin` with left or right; horizontal `box-shadow` offsets; gradient directions; `background-position`; `clip-path: inset()`; anything positioned from JavaScript (`getBoundingClientRect().left`); library props with physical names (a toast position, a drawer `side`, a swipe direction, popover `side="left"`).

## Icons and components: mirror or not

| Mirror | Do not mirror |
|---|---|
| back and forward arrows, chevrons, breadcrumbs separators | logos and brand marks |
| send, reply, undo/redo arrows | checkmarks, plus, close, search magnifier |
| sliders, linear progress (it fills right to left), steppers | clocks, circular progress, refresh |
| badge corner, chip trailing icons, list bullets | media playback controls (always left to right) |
| help "?" (mirrored in Persian per Material) | numbers, phone numbers, charts and graphs (stay left to right for Persian) |

Mirror with `scale: -1 1` on a wrapper keyed to direction-dependent meaning, not on every icon. Steppers mirror: decrement on the right, increment on the left (NN/g). "Back" points right (Apple HIG). A list thumbnail goes on the right; people scan a flipped F-pattern (NN/g), so put the information-carrying words first in headings. Bottom navigation: home is at the right end.

## Bidirectional text: isolate every opposite-direction run

Verified broken without isolation: `+98 912 345 6789` renders as `6789 345 912 98+`; `3-5` renders as `5-3`.

- Text that comes from data (seller names, listing titles, addresses): wrap in `<bdi>` or give the element `dir="auto"`.
- Known left-to-right content inside Persian text: `<span dir="ltr">` (phone numbers, VINs, URLs, emails, listing codes, Latin model names).
- Fields that stay left to right and left-aligned: phone, OTP, email, URL, card number, postal code, VIN (`dir="ltr"`). Search boxes use `dir="auto"`.
- Ranges and versus: use words («۳ تا ۵», «در برابر»), not hyphens or slashes that reorder.
- Prefer markup (`<bdi>`, `dir`) over invisible control characters; the HTML rendering rules already isolate both. Do not set `unicode-bidi` or `direction` in CSS (CSS Writing Modes: authors "should not" in HTML). Where markup is impossible (the document title, `title`, `alt` and `placeholder` attributes, a native `<option>`), use `isolate()` or `isolateLtr()` from `@carshenas/locale/bidi`; never inside `aria-label`.
- A sign read after a number (`%`, `٪`, `‰`, `°`) shows on the wrong side of Persian digits unless a right-to-left mark precedes it: use `formatPercent` (`persian-type-formatting.md`).
- Negative numbers formatted by `Intl` for `fa-IR` carry a left-to-right mark; do not strip it.

## Layout habits that break in RTL

- Absolute positioning of badges, close buttons and dropdown carets with `right-*`: use `inset-e-*`.
- Truncation: `text-overflow: ellipsis` works, but check which end is cut for mixed-direction strings; prefer wrapping for Persian listing titles.
- Carousels and horizontal scrollers start at the right. `scrollLeft` is 0 at the start and grows negative towards the end in current engines (MDN), so «بعدی» calls `scrollBy({ left: -slideWidth })`; Safari reports values past the ends while it bounces, so clamp them and test the first and last item. Swipe APIs name physical directions (a drawer at the inline end needs `swipeDirection="left"`), and inside an RTL scroll container the scrollbar sits on the left, so never compensate a hidden scrollbar with `padding-right`.
- Keyboard: Left and Right arrow meanings swap in tabs, sliders, carousels and menus (ArrowLeft opens a submenu); primitives that do not flip arrow keys are unusable here. Base UI and Radix read direction from their own provider, not from `<html dir>`: wrap the app in `DirectionProvider` with `direction="rtl"` (Base UI 1.8: `@base-ui/react/direction-provider`, rendered in the root layout with the first Base UI primitive), or their keyboard handling, submenu side and safe-triangle geometry stay left to right (`craft.md` section 5). shadcn's `migrate rtl` writes `rtl:` variants the lint rejects, adds `space-x-reverse` on top of Tailwind 4.3's already-logical `space-x`, maps `inset-l-*` to a class Tailwind does not build and turns icons with `rotate-180`: resolve each by hand (`docs/research/2026-09-27-rtl-and-locale-architecture.md`). React Aria reads `navigator.language` unless given `I18nProvider locale="fa-IR"`, and ships no Persian strings.
