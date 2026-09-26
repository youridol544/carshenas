# Persian typography, digits, prices, phones and dates

Sources: W3C alreq (Arabic and Persian layout requirements); Ahmad Shadeed, RTL Styling 101; Material Design (Persian as a "tall" script); Unicode CLDR data through `Intl` (hands-on on Node 22 with CLDR 46 and on Chromium 153, identical output, 2026-09-18); web.dev on one-time codes; font repositories and licences checked 2026-09-18; line heights, clipping, underlines, tabular digits and alpha colours measured with Vazirmatn and Estedad in Chromium 153 for CS-26 (2026-09-26, `craft.md` section 7). The font choice itself is CS-3's decision; currency unit is CS-2's.

## Type

- No `letter-spacing` on Persian text, ever: "Arabic letters are supposed to look connected." No `uppercase` (the script has no case), no italics, no abbreviation by truncating letters.
- Persian is a tall script: glyphs look smaller than Latin at the same size and ascenders and descenders reach further. Line height is set per role and falls as the size grows (Vazirmatn; Estedad about 0.1 more): reading text 16 px at 1.7 (never below 1.6), secondary paragraphs 14 px at 1.65, one-line meta and every control, chip, badge or clamped title at 1.5 (never below 1.3, never `leading-none`), headings 1.5 at 20 px, 1.45 at 24 px, 1.4 at 28 to 32 px and 1.3 from 36 px. The table, the evidence and the traps (`line-height: normal`, the `font` shorthand, `text-box` trimming) are in `craft.md` section 7; the values are re-measured for the font the owner buys. Test buttons, badges and clamped titles with «تأیید آگهی؛ پراید غ», whose hamza clips first.
- Build hierarchy with weight and colour before size: two weights (regular and bold; never below 400) and about three text colours are enough; 12 to 13 px labels (chips, badges, meta) use 500 if the font has it (owner, 2026-09-26). Steps of at least 1.25× between type sizes.
- Do not give text an alpha colour (`rgb(… / .5)`, `text-neutral-900/60`): joined letters overlap and leave darker spots (measured). Use a solid lighter colour token.
- Default underlines collide with the dots under Persian letters, and default skip-ink then breaks them into pieces: `text-underline-offset: 0.45em; text-decoration-thickness: 1px` clears the dots in both candidate fonts (measured), or use another link treatment.
- `word-break: break-all` splits connected words; use `overflow-wrap: anywhere` only on data that may contain long unbroken Latin strings.
- Keep the zero-width non-joiner (U+200C) in storage, display and tests: «می‌دهد», «آگهی‌ها». Normalise Arabic yeh and kaf (ي ك) to Persian (ی ک) for search and comparison, not for display of user names.

## Fonts

| Font | Licence | Notes |
|---|---|---|
| Vazirmatn | OFL-1.1 | variable `woff2` about 111 KB; last release 2022-06, mature but dormant; Latin glyphs from Roboto |
| Estedad | OFL-1.1 | variable 100 to 900; released 2026-03, active |
| Noto Sans Arabic | OFL-1.1 | active |
| IRANSans, IRANYekan, Dana, Yekan Bakh, Peyda | commercial (fontiran.com) | need a purchased licence per site |

- The owner will buy a commercial font (2026-09-26; not Vazirmatn) and choose it with Claude from options the owner brings; its licence must allow self-hosting on the web, and CS-3 re-measures line heights and stems for it (`docs/research/2026-09-26-ui-craft-details/lab/`).
- Self-host through `next/font/local`. `next/font/google` downloads at build time, so a build inside Iran would depend on Google. The Playwright container has no Persian UI font, so visual tests only match production once the app ships its own font, and they must wait for `document.fonts.ready`.
- Vazirmatn's Farsi-digit stylistic set (`ss01`) is missing from the fontsource subsets; do not rely on font features for digits. Put real Persian digits in the text. `tabular-nums` works on Persian digits but makes them 20 to 140 % wider, because the default ones are proportional: use it for columns and for numbers that change in place, never for a card's static price or running text.

## Digits and numbers

- Display: `new Intl.NumberFormat('fa-IR').format(1234567.89)` gives «۱٬۲۳۴٬۵۶۷٫۸۹»; percent gives «۲۵٪». Do this in Server Components or pass the formatted string down, because the server's and the browser's ICU data can differ and cause hydration mismatches.
- Input: `Number('۱۲۳')` is `NaN`; `<input type="number">` drops «۱۲۳» entirely. Accept text, normalise Persian (۰-۹) and Arabic-Indic (٠-٩) digits to Latin before parsing, and show Persian digits back.
- **Never use the `currency` style**: for IRR it prints «ریال ۱۲٬۵۰۰٬۰۰۰» with the unit first, and the Toman has no ISO code at all. Format the number and append the unit yourself («۱۲٬۵۰۰٬۰۰۰ تومان»).
- `NaN` formats as «ناعدد» in `fa-IR`. If that word ever appears on screen it is a bug, exactly like `NaN`.

## Phone and one-time codes

- Phone: `<input type="tel" inputmode="tel" autocomplete="tel" dir="ltr">`, displayed as `09XX XXX XXXX` (11 digits, country code +98), always isolated when shown inside Persian text.
- OTP: one field, not six boxes: `<input type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr">`. The commonly recommended `pattern="\d{6}"` rejects «۱۲۳۴۵۶»; use `[0-9۰-۹٠-٩]{6}` or normalise on input. Never block paste (WCAG 3.3.8). Offer resend, and never wipe the form when a code expires.

## Dates

- `new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long' })` gives «۲۷ شهریور ۱۴۰۵» (Persian calendar and digits are the default for `fa-IR`).
- `dateStyle: 'full'` is wrong for UI: it prints «۱۴۰۵ شهریور ۲۷, جمعه». Build the weekday form from parts: «جمعه ۲۷ شهریور ۱۴۰۵».
- The week starts on Saturday. Storage stays ISO-8601 in UTC; display uses `Asia/Tehran`.
- Show a delivery date, not a delivery speed («تحویل تا ۲ مهر», not «ارسال ۳ روزه»).
