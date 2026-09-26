# Persian typography, digits, prices, phones and dates

Sources: W3C alreq (Arabic and Persian layout requirements); Ahmad Shadeed, RTL Styling 101; Material Design (Persian as a "tall" script); Unicode CLDR data through `Intl` (hands-on on Node 22 with CLDR 46 and on Chromium 153, identical output, 2026-09-18); web.dev on one-time codes; font repositories and licences checked 2026-09-18. The font choice itself is CS-3's decision; currency unit is CS-2's.

## Type

- No `letter-spacing` on Persian text, ever: "Arabic letters are supposed to look connected." No `uppercase` (the script has no case), no italics, no abbreviation by truncating letters.
- Persian is a tall script: glyphs look smaller than Latin at the same size and ascenders and descenders reach further. Start body text at 16 px with line height 1.7 to 1.8 and headings at 1.4 to 1.5, then look for clipped dots and diacritics, especially in buttons, badges and single-line inputs with fixed heights.
- Build hierarchy with weight and colour before size: two weights (regular and bold; never below 400) and about three text colours are enough. Steps of at least 1.25× between type sizes.
- Do not set text with opacity: it renders badly with connected glyphs where they overlap. Use a solid lighter colour.
- Default underlines collide with the dots under Persian letters: use `text-underline-offset` and a thin `text-decoration-thickness`, or another link treatment.
- `word-break: break-all` splits connected words; use `overflow-wrap: anywhere` only on data that may contain long unbroken Latin strings.
- Keep the zero-width non-joiner (U+200C) in storage, display and tests: «می‌دهد», «آگهی‌ها». Normalise Arabic yeh and kaf (ي ك) to Persian (ی ک) for search and comparison, not for display of user names.

## Fonts

| Font | Licence | Notes |
|---|---|---|
| Vazirmatn | OFL-1.1 | variable `woff2` about 111 KB; last release 2022-06, mature but dormant; Latin glyphs from Roboto |
| Estedad | OFL-1.1 | variable 100 to 900; released 2026-03, active |
| Noto Sans Arabic | OFL-1.1 | active |
| IRANSans, IRANYekan, Dana, Yekan Bakh, Peyda | commercial (fontiran.com) | need a purchased licence per site |

- Self-host through `next/font/local`. `next/font/google` downloads at build time, so a build inside Iran would depend on Google. The Playwright container has no Persian UI font, so visual tests only match production once the app ships its own font, and they must wait for `document.fonts.ready`.
- Vazirmatn's Farsi-digit stylistic set (`ss01`) is missing from the fontsource subsets; do not rely on font features for digits. Put real Persian digits in the text. `tabular-nums` does survive and is right for prices in columns.

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
