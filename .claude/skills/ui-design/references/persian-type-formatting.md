# Persian typography, digits, prices, phones and dates

Sources: W3C alreq (Arabic and Persian layout requirements); Ahmad Shadeed, RTL Styling 101; Material Design (Persian as a "tall" script); Unicode CLDR data through `Intl` (hands-on on Node 22 with CLDR 46 and on Chromium 153, identical output, 2026-09-18); web.dev on one-time codes; font repositories and licences checked 2026-09-18; line heights, clipping, underlines, tabular digits and alpha colours measured with Vazirmatn and Estedad in Chromium 153 for CS-26 (2026-09-26, `craft.md` section 7). The font choice itself is CS-3's decision; the unit, the amount forms and the calendar are ADR-0014's (CS-2, with the price displays of Divar, Bama, Sheypoor, Hamrah Mechanic and Torob measured on 2026-09-27).

## Type

- No `letter-spacing` on Persian text, ever: "Arabic letters are supposed to look connected." No `uppercase` (the script has no case), no italics, no abbreviation by truncating letters.
- Persian is a tall script: glyphs look smaller than Latin at the same size and ascenders and descenders reach further. Line height is set per role and falls as the size grows (Vazirmatn; Estedad about 0.1 more): reading text 16 px at 1.7 (never below 1.6), secondary paragraphs 14 px at 1.65, one-line meta and every control, chip, badge or clamped title at 1.5 (never below 1.3, never `leading-none`), headings 1.5 at 20 px, 1.45 at 24 px, 1.4 at 28 to 32 px and 1.3 from 36 px. The table, the evidence and the traps (`line-height: normal`, the `font` shorthand, `text-box` trimming) are in `craft.md` section 7; the values are re-measured for the font the owner buys. Test buttons, badges and clamped titles with «تأیید آگهی؛ پراید غ», whose hamza clips first.
- Build hierarchy with weight and colour before size: two weights (regular and bold; never below 400) and about three text colours are enough; 12 to 13 px labels (chips, badges, meta) use 500 if the font has it (owner, 2026-09-26). Steps of at least 1.25× between type sizes.
- Do not give text an alpha colour (`rgb(… / .5)`, `text-neutral-900/60`): joined letters overlap and leave darker spots (measured). Use a solid lighter colour token.
- Default underlines collide with the dots under Persian letters, and default skip-ink then breaks them into pieces: `text-underline-offset: 0.45em; text-decoration-thickness: 1px` clears the dots in both candidate fonts (measured), or use another link treatment.
- `word-break: break-all` splits connected words; use `overflow-wrap: anywhere` only on long unbroken Latin strings (a VIN, a URL) and on digit runs, which `NumericText` (`apps/web/src/components/ui/numeric-text.tsx`) marks; never on a Persian word.
- Keep the zero-width non-joiner (U+200C) in storage, display and tests: «می‌دهد», «آگهی‌ها». Normalise Arabic yeh and kaf (ي ك) to Persian (ی ک) for search and comparison, not for display of user names.

## Fonts

| Font | Licence | Notes |
|---|---|---|
| Vazirmatn | OFL-1.1 | variable `woff2` about 111 KB; last release 2022-06, mature but dormant; Latin glyphs from Roboto |
| Estedad | OFL-1.1 | variable 100 to 900; released 2026-03, active |
| Noto Sans Arabic | OFL-1.1 | active |
| IRANSans, IRANYekan, Dana, Yekan Bakh, Peyda | commercial (fontiran.com) | need a purchased licence per site |

- **The typeface is Yekan Bakh 4** (ADR-0015, bought 2026-09-27): one variable woff2 for Persian, Latin and digits, loaded by `apps/web/src/components/layout/app-font.ts`. It is licensed per site, never committed and never modified (`docs/runbooks/licensed-font.md`). Its measured line heights, stems and metrics are in `docs/design/design-language.md`.
- Self-host through `next/font/local`. `next/font/google` downloads at build time, so a build inside Iran would depend on Google. The Playwright container has no Persian UI font, so visual tests only match production once the app ships its own font, and they must wait for `document.fonts.ready`.
- Vazirmatn's Farsi-digit stylistic set (`ss01`) is missing from the fontsource subsets; do not rely on font features for digits. Put real Persian digits in the text. `tabular-nums` works on Persian digits but makes them 20 to 140 % wider, because the default ones are proportional: use it for columns and for numbers that change in place, never for a card's static price or running text.

## Digits and numbers

- Display: `new Intl.NumberFormat('fa-IR').format(1234567.89)` gives «۱٬۲۳۴٬۵۶۷٫۸۹». Use the formatters in `apps/web/src/lib/` rather than `Intl` directly, in Server Components or with the string passed down, because the server's and the browser's ICU data can differ and cause hydration mismatches.
- **Percentages come from `formatPercent` only.** `Intl` writes «۲۵٪» in the right order, but Persian digits are European numbers to the bidi algorithm and the sign after them joins their left-to-right run, so the sign shows on the right. `formatPercent` puts a right-to-left mark (U+200F) before «٪» so it sits to the left, where Persian reads «درصد»; «‰» and «°» behave the same way. The lint rejects a typed percentage, and `inspectLayout` measures the rendered order on every page.
- Input: `Number('۱۲۳')` is `NaN`; `<input type="number">` drops «۱۲۳» entirely. Accept text, normalise Persian (۰-۹) and Arabic-Indic (٠-٩) digits to Latin before parsing, and show Persian digits back.
- **Never use the `currency` style**: for IRR it prints «ریال ۱۲٬۵۰۰٬۰۰۰» with the unit first, and the Toman has no ISO code at all. Format the number and append the unit yourself («۱۲٬۵۰۰٬۰۰۰ تومان»).
- `NaN` formats as «ناعدد» in `fa-IR`. If that word ever appears on screen it is a bug, exactly like `NaN`.

## Prices (ADR-0014)

- **The unit.** Amounts are whole tomans. «تومان» follows the number and never wraps away from it (join with a no-break space, or `whitespace-nowrap` on the amount).
- **The separator.** `Intl` separates thousands with «٬» (U+066C) and decimals with «٫» (U+066B). In Yekan Bakh, Vazirmatn and Estedad «٬» looks like the ASCII comma Divar prints. Sources use every variant (Divar the ASCII comma, Torob «٫», Bama Latin digits), so parsers accept all of them and we print one.
- **Full digits for every price and value.** This covers an asking price on a card, the listing page, comparables, price history and alerts, an earlier price, a price drop, and the market value and its range: «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان». Iranian car sites print prices this way, estimates and ranges included.
  - A stated amount is never rounded.
  - An estimate is rounded to three significant digits: «۱٬۲۶۰٬۰۰۰٬۰۰۰ تومان».
  - A price gap is a whole percentage.
- **Mixed words inside Farsi sentences.** Explanations, Telegram alerts and the echo under an amount field use this form: «۱ میلیارد و ۲۵۰ میلیون تومان».
- **Compact only on scales.** Chart axes, filter chips and the gauge's band edges, and nowhere else, use `{ notation: 'compact', compactDisplay: 'long', maximumSignificantDigits: 3 }`: «۱٫۲۵ میلیارد», «۸۵۰ میلیون».
  - The default keeps two digits and misleads: 1,250,000,000 becomes «۱٫۳ میلیارد» and 1,049,000,000 becomes «۱ میلیارد».
  - Write ranges with «تا» («۱٫۲ تا ۱٫۳۵ میلیارد تومان»); `formatRange` joins with a dash.
  - Stop at «میلیارد» («۱٬۲۰۰ میلیارد»), never «تریلیون» or «هزارمیلیارد».
- **No price, no number.** A missing price is a label: «توافقی», or «اقساطی» with the down payment named as such. A placeholder price (Divar shows ones such as «۱,۰۰۰ تومان» and «۱۰,۰۰۰ تومان») is stored without an amount and never printed as one, and «۰ تومان» is a bug.

## Phone and one-time codes

- Phone: `<input type="tel" inputmode="tel" autocomplete="tel" dir="ltr">`, displayed as `09XX XXX XXXX` (11 digits, country code +98), always isolated when shown inside Persian text.
- OTP: one field, not six boxes: `<input type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr">`. The commonly recommended `pattern="\d{6}"` rejects «۱۲۳۴۵۶»; use `[0-9۰-۹٠-٩]{6}` or normalise on input. Never block paste (WCAG 3.3.8). Offer resend, and never wipe the form when a code expires.

## Dates

- `new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' })` gives «۲۷ شهریور ۱۴۰۵» (Persian calendar and digits are the default for `fa-IR`).
- `dateStyle: 'full'` is wrong for UI: it prints «۱۴۰۵ شهریور ۲۷, جمعه». Build the weekday form from parts: «جمعه ۲۷ شهریور ۱۴۰۵».
- The week starts on Saturday. Storage stays ISO-8601 in UTC; display uses `Asia/Tehran`, passed explicitly every time, because the server runs in UTC and 02:00 in Tehran is still the previous day there.
- Other forms `Intl` gets right: «۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰» (`dateStyle: 'long', timeStyle: 'short'`); «۵ تا ۱۰ مهر ۱۴۰۵» (`formatRange`); «۱۴۰۵/۰۷/۰۵» for dense tables (two-digit month and day); «دیروز» and «۳ روز پیش» (`RelativeTimeFormat` with `numeric: 'auto'`).
- Build the month-and-year form from parts: `{ month: 'long', year: 'numeric' }` prints «۱۴۰۵ مهر», and Persian writes «مهر ۱۴۰۵».
- Calendar arithmetic and date inputs (month grids, week starts, adding months, a Jalali date plus a Tehran time to an instant) use `@internationalized/date` 3.5.3 or later with the `persian` calendar, the model under React Aria's date components. Never hand-write leap years.
  - Avoid `jalaliday` (3.1.1 puts every January and February of a Gregorian leap year a day ahead), persian-date and react-date-object.
  - React Aria has no Persian strings for its calendar's screen-reader labels; supply them.
- Jalali is display only. URLs, APIs and the database carry ISO-8601 dates with Latin digits; model years are the one stored Jalali value (ADR-0014).
- Show a delivery date, not a delivery speed («تحویل تا ۲ مهر», not «ارسال ۳ روزه»).
