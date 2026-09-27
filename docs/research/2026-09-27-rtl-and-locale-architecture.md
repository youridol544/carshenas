# What is the cleanest, standard way to build a one-locale, right-to-left Next.js 16 and React 19 app?

- Date: 2026-09-27
- Asked by / for: CS-3. The owner asked for the best Next.js and React abstractions for right to left, with legitimate sources, clean architecture and standard solutions.
- Outcome:
  - `apps/web/src/lib/` gained `locale.ts`, `format-number.ts`, `toman.ts`, `format-date.ts`, `digits.ts` and `bidi.ts`, with tests that pin them.
  - The font loads as ADR-0015 says.
  - The percent-sign fix and its guards came from the owner's review.
  - The `ui-design` references were corrected where this pass found them wrong.

## Questions

1. How do the component libraries we will use (Base UI through shadcn, React Aria for dates) learn the direction, and what does shadcn's RTL support actually do?
2. Should the locale's facts be derived at run time (`Intl.Locale` text and week info) or stated as constants?
3. How do mature libraries structure number and date formatting, and what does it cost?
4. How do we avoid hydration mismatches from `Intl`, and what does Next.js 16 with Cache Components add?
5. Which bidi isolation tools does the platform offer, and where is markup impossible?
6. What does `next/font/local` do with a commercial Persian font, and does its automatic fallback help?
7. Which Tailwind 4.3 features matter (logical utilities, line-height pairs, per-utility colour namespaces)?
8. Which codebases do right to left well, and what is worth copying?

## Method

- A research agent read the installed sources and bundled docs, used Context7 and web fetches, and ran small scripts (microbenchmarks, a Tailwind compile, the parsers) on 2026-09-27.
- Each claim below is tagged:
  - **[V]** checked in docs, library source or by running code;
  - **[I]** inferred;
  - **[U]** not verified.
- The scratch scripts were not kept. The conclusions that matter are pinned by the tests in `apps/web/src/lib/` and `e2e/`.

## Sources (checked 2026-09-27 unless dated)

**Libraries, read in their installed or published source:**
- Base UI 1.8.0 (`@base-ui/react`): its source, and <https://base-ui.com/react/utils/direction-provider>.
- shadcn 4.21.0: CLI source and <https://ui.shadcn.com/docs/rtl>.
- react-aria 3.52.1 and `@react-aria/i18n` 3.13.1.
- `@internationalized/number` 3.6.8 and `@internationalized/date` 3.12.4.
- `@formatjs/intl` 6.1.2.
- next-intl 4.14.7.
- Next.js 16.3.5 as installed: `dist/docs` on fonts, caching and server components; `server/node-environment-extensions/date.js`; `compiled/@next/font/dist/local`.
- Tailwind 4.3.3, compiled.

**Standards and specifications:**
- MDN browser-compat data 8.1.3: `Intl.Locale.getTextInfo`, `@font-face` `ascent-override` and `size-adjust`, and `:dir()`.
- ECMA-402 (the 2027 draft).
- The WHATWG HTML rendering and directionality sections.
- W3C Internationalization, "Inline markup and bidirectional text in HTML" (Ishida and Lanin, updated 2021-06-25) and "Unicode controls vs. markup" (updated 2023-02-23).
- Unicode UAX #9, revision 52 (2026-09-01).
- CSS Writing Modes 4 (CR, 2019-07-30).

**Issues, posts and other references:**
- Node.js issues 46123 (2023-01-06) and 58870 (2025-06-27), on ICU drift between runtimes.
- react.dev on `hydrateRoot` and `suppressHydrationWarning`.
- next-intl's blog post on date formatting in Next.js (2024-09-25, updated 2025-03-28).
- The Firefox front-end CSS guidelines.
- MUI v9.4's right-to-left guide.
- GitHub's 2021-10-31 warning about bidirectional Unicode (CVE-2021-42574).
- Capsize 4.1.3 and fontaine 1.0.0.
- Microsoft's Arial font page (2026-07-08).

## Findings

1. **Direction for primitives.**
   - **Base UI 1.8.0.** Its `DirectionProvider` (`@base-ui/react/direction-provider`, prop `direction`, default `'ltr'`) is a plain React context: it never reads `<html dir>`, and "does not affect HTML and CSS" [V].
     - Without it, keyboard handling and popup placement stay left to right in tabs, menus, sliders, select, combobox, toast and every positioned popup [V].
     - The module is already a client module, so the root layout can render it directly [V].
   - **shadcn 4.21.0** has `rtl` in `components.json` and `migrate rtl` [V]. Its rewrite conflicts with this repository in five ways [V]:
     - It adds `rtl:` variants, which the lint rejects.
     - It adds `space-x-reverse`, which reverses Tailwind 4.3's already-logical `space-x` a second time.
     - It maps `inset-l-*` to a class Tailwind 4.3 does not generate.
     - It turns icons with `rotate-180`, which puts asymmetric ones upside down.
     - It leaves Calendar, Pagination and Sidebar to migrate by hand.
   - **React Aria.** Without a `locale`, it renders `en-US`/`ltr` on the server and then switches to `navigator.language`; it never reads `<html lang>` [V]. With `locale="fa-IR"` it works out the direction itself, but it has no `fa-IR` strings [V].
   - **What we do.** Keep `<html lang dir>`. Add Base UI's `DirectionProvider direction="rtl"` to the root layout with the first Base UI primitive. Wrap React Aria's `I18nProvider locale="fa-IR"` round the date field only.
2. **Constants over derivation.**
   - **Where `getTextInfo()` exists** [V]: Chrome 130, Safari 17, Firefox 153 and Node 24.
   - **Where only the older accessor exists** [V]: Node 22 and older Chrome have the `textInfo` accessor, and Safari's preview builds are removing it.
   - **The cost.** Deriving the direction adds a three-step fallback to compute a value that never changes.
   - **What we do.** `locale.ts` states the language, direction, locale, calendar, numbering system, first day of the week and time zone. `locale.test.ts` derives each from the runtime's `Intl` and fails if they drift.
3. **Formatter architecture.** Every mature library caches its `Intl` formatters by locale and options [V]: FormatJS, next-intl, `@internationalized/*` and Base UI.
   - **Cost on Node 22.14:**

     | Call | Time |
     |---|---|
     | A reused formatter | about 1 µs |
     | A new `NumberFormat` | 38 µs |
     | A new compact `NumberFormat` | 64 µs |
     | A new `DateTimeFormat` | 134 µs |

     V8 caches internally only when no options are passed [V].
   - **Traps in the formatter APIs** [V]:
     - `DateTimeFormat.format()` with no argument reads the clock.
     - `null` formats as the 1970 epoch or «۰», and `undefined` as «ناعدد».
   - **The parsers.** `@internationalized/number`'s `NumberParser` reads Persian and Arabic-Indic digits with «٬» and «٫», but returns NaN for Divar-style Persian digits with ASCII commas. It also reads `,` as a decimal point after Arabic-Indic digits [V]. Base UI's own parser reads `1,250,000` as 1 in `fa-IR` [V].
   - **What we do.** Plain `Intl` instances created once at module scope, typed and required arguments, and an explicit `now` for relative time. `toLatinDigits` handles what people type. Parsing the prices that sources print belongs to extraction (CS-8), which must also accept ASCII commas.
4. **Hydration and Cache Components.**
   - **Where mismatches come from.** React DOM names locale-dependent dates as a cause of hydration mismatches [V], and the runtimes' ICU data does drift (Node issues 46123 and 58870) [V].
   - **What Next.js 16.3.5 does with `cacheComponents`.** It replaces `Date` while prerendering: `new Date()`, `Date()` and `Date.now()` throw E1432, while `new Date(iso)` is fine [V].
   - **What we do.** Format in Server Components and pass strings. Give relative time a request-time `now`. Run unit tests with `TZ=UTC`, as production runs: on this machine, set to Tehran, a missing `timeZone` option passes and then fails in UTC [V].
5. **Bidi isolation.**
   - **What the platform does.** The HTML rendering rules already isolate `bdi` and any element with `dir` [V].
   - **A correction to `rtl-bidi.md`.** CSS Writing Modes says authors "should not use `unicode-bidi`" in HTML, so it is no longer recommended [V].
   - **Where markup is impossible.** W3C allows the isolate characters (LRI, RLI, FSI with PDI) only there: `<title>`, attribute values, a native `<option>`, an SVG `<title>` [V].
   - **What is unverified.** Telegram clients and screen readers inside `aria-label` [U], so the isolates stay out of `aria-label`.
   - **What we do.** No component: `<bdi>` for text from data, and `dir="ltr" lang="en"` for text that is always left to right. `bidi.ts` adds `isolate` and `isolateLtr`, written as `\u` escapes, because GitHub flags literal bidi characters.
6. **`next/font/local`.**
   - **The API** [V]: one variable file with a weight range, `display` (default `swap`), `preload` (default on, every route from the root layout), `fallback`, `adjustFontFallback`, `declarations` and `variable`.
   - **The automatic fallback is Latin-only** [V]. It averages Latin a–z widths against hard-coded Arial or Times metrics (the source says "TODO: Currently only works for the latin alphabet") and names `local("Arial")`.
   - **What that does to Persian.** With Vazirmatn as a stand-in, the Latin ratio against Noto Naskh Arabic (78.6 %) points the wrong way from the Persian ratio (111.3 %) [V].
   - **No tool does Persian.** Capsize and fontaine both use Latin widths [V].
   - **Safari** still lacks `ascent-override` and `descent-override`; `size-adjust` works from Safari 17 [V].
   - **What we do.** `adjustFontFallback: false`, with Persian-capable fallbacks in `fallback`, and the variable put on `<html>` because Tailwind resolves theme variables at `:root` [V]. `display` was chosen by measurement (ADR-0015).
7. **Tailwind 4.3.3** [V, compiled].
   - **Logical utilities.** Every one exists, plus the block-axis ones. There is no logical `origin-*` and no logical gradient direction.
   - **Pairs and namespaces.** `--text-*--line-height` pairs work. So do per-utility colour namespaces: `--text-color-*`, `--background-color-*`, `--border-color-*`, `--outline-color-*` and `--ring-color-*`.
   - **The `rtl:` variant.** It compiles to `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`, which also matches inside `dir="ltr"` islands, one more reason to keep it banned.
   - **What we do.** Tokens use the per-utility namespaces, so each role produces only its own utility.
8. **Codebases worth copying.**
   - **React Aria:** the direction is worked out once and read by the behaviour modules through context.
   - **Base UI:** two channels, `dir` on `<html>` for CSS and the bidi algorithm, and a context for JavaScript behaviour.
   - **Firefox front end:** logical properties by default, and `:dir(rtl)` only where no logical property exists.
   - **MUI** is the counter-example. It flips physical CSS at run time with `stylis-plugin-rtl`, so the code says `left` while the browser applies `right`, left-to-right islands need opt-outs, and it depends on CSS-in-JS, which ADR-0005 rejects.

### Found later, in the owner's review

- **The percent sign.** Persian digits (U+06F0 to U+06F9) are bidi class EN, and «٪» (U+066A) is ET. By UAX #9 rule W5, an ET after an EN becomes EN, so `Intl`'s «۱۲٪» renders with the sign on the right of the number. Persian reads «درصد» after the number, which is its left.
- **The fix.** `formatPercent` inserts a right-to-left mark (U+200F) before the sign, so the sign resolves right to left and sits to the left. This was measured on the rendered glyphs.
- **The guards.** A lint rule rejects hand-typed percentages, and the layout inspector measures the rendered order on every app page.

## Recommendation

- **Keep the base.** `<html lang dir>` from constants, logical CSS only, and formatting on the server through cached `Intl` in `src/lib/`.
- **Add providers with their primitives.** Add `DirectionProvider direction="rtl"` with the first Base UI primitive; when shadcn arrives, resolve each `rtl:` class it writes by hand, as finding 1 lists.
- **Isolate with markup.** `<bdi>` and `dir="ltr"`, with `isolate()` only where markup is impossible.
- **Test what the eye would miss.** The locale drift, the Jalali calendar against the official leap list, the contrast of every token pair, and the rendered order of percent signs.
