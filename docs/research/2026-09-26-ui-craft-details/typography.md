# Persian (Farsi) typography and right-to-left details: research pass for CS-26

Date: 2026-09-26. Scope: line height above all, then vertical metrics, trimming, size, weight, measure, justification, underline, digits, fallbacks, `lang="fa"`, punctuation and ZWNJ, for Carshenas (Farsi, RTL, phone-first, Next.js 16.3.5, React 19.2, Tailwind CSS 4.3.3; font to be chosen in CS-3 from Vazirmatn and Estedad).

Method in one line: every source below was fetched on 2026-09-26 (JavaScript-heavy pages were rendered in headless Chromium and their text extracted; every quote was then checked verbatim against the saved text), and every numeric claim about the fonts was measured hands-on in Chromium 153 with the real font files (method and raw tables in `## Measurements`; scripts and screenshots in `typography-lab/`).

## Line height verdict

### Short answer

The owner is right about the mechanism: in CSS, line height is a multiplier of font size, and it has to differ by role (body, titles, buttons) and fall as the size grows. The right numbers for Persian also depend on the font's vertical proportions, so they have to be set per font. Measured and sourced values for Vazirmatn and Estedad are:

- **UI text on one line** (buttons, chips, badges, tabs, truncated or clamped titles): **1.5**. Never below 1.3.
- **Headings**: **1.5 at 20 px, falling to 1.3 from 36 px**.
- **Reading text** (listing descriptions, reviews, guides at 14–16 px): **1.65–1.75**.

Estedad needs about 0.1 more than Vazirmatn at the same size.

So:
- The owner's **1.4–1.6** is right for UI text and headings, and 1.6 is the correct floor for Vazirmatn body text. It is too low as a ceiling for long Persian paragraphs, especially in Estedad.
- Our **"body ≥ 1.7"** is right for long-form paragraphs. It is wrong as a universal minimum: headings and controls should be lower.

### Recommended values (proposed defaults for CS-3; unitless)

These values are my synthesis (inference) from the Material 3 Arabic tokens and the lab measurements (M3, M4 and M5 in `## Measurements`). "Floor" means the lowest value the evidence supports.

| Role (Carshenas example) | Size | Vazirmatn | Estedad | Material 3, "Medium" language height (Arabic) | Lowest value with no clipped ink under `overflow: hidden` (measured) |
|---|---|---|---|---|---|
| Long-form body: listing description «کارکرد ۴۵ هزار کیلومتر، بیمه‌ی شخص ثالث تا اسفند…» | 16 px | **1.7** (floor 1.6) | **1.75** (floor 1.7) | 27/16 = 1.69 | 1.2–1.25 (ordinary text) · 1.4 (stress string) |
| Secondary paragraph: card snippet, helper text | 14 px | **1.65** (floor 1.55) | **1.65** (floor 1.6) | 23/14 = 1.64 | 1.2–1.3 · 1.25–1.5 |
| One-line meta: «۲ ساعت پیش · تهران» | 12–13 px | **1.5** | **1.5** | 18/12 = 1.5 | 1.1–1.25 · 1.4–1.5 |
| Controls: button, chip, deal badge «معامله‌ی عالی», tab, list row | 12–16 px | **1.5** | **1.5** | label 18/12 = 1.5, 23/14 = 1.64 | 1.5 covers every case |
| Card title, 1–2 lines, clamped: «پژو ۲۰۶ تیپ ۲، مدل ۱۳۹۸» | 16–18 px | **1.55** | **1.6** | title 27/16 = 1.69 | 1.2–1.25 · 1.4 at 16 px (18 px not measured) |
| Section heading | 20 px | **1.5** | **1.6** | (22 px: 31/22 = 1.41) | 1.2–1.3 · 1.3–1.4 |
| Page heading | 24 px | **1.45** | **1.55** | 35/24 = 1.46 | 1.3–1.4 (inferred from 20 and 28 px) |
| Large heading | 28–32 px | **1.4** | **1.5** | 38/28 = 1.36, 42/32 = 1.31 | 1.3 at 28 px (Estedad 700: 1.4) |
| Display, price hero «۶۸۰ میلیون تومان» | ≥ 36 px | **1.3** | **1.4** | 47/36 = 1.31, 56/45 = 1.24 | not measured above 28 px (inference: 1.3) |
| Dense table, comparison or spec rows (with `tabular-nums`) | 14 px | **1.5** | **1.5** | — | 1.5 |

### Evidence

1. **Material 3 publishes Arabic line heights per style.** Its type-scale token viewer has a "language height" context. Arabic is in the "Medium" category. The values below were extracted from the live token viewer on 2026-09-26, in px.

   | Style | Size | Latin ("Small") | Arabic ("Medium") | Medium ÷ size |
   |---|---|---|---|---|
   | Body large / medium / small | 16 / 14 / 12 | 24 / 20 / 16 | 27 / 23 / 18 | 1.69 / 1.64 / 1.50 |
   | Label large / medium / small | 14 / 12 / 11 | 20 / 16 / 16 | 23 / 18 / 18 | 1.64 / 1.50 / 1.64 |
   | Title large / medium / small | 22 / 16 / 14 | 28 / 24 / 20 | 31 / 27 / 23 | 1.41 / 1.69 / 1.64 |
   | Headline large / medium / small | 32 / 28 / 24 | 40 / 36 / 32 | 42 / 38 / 35 | 1.31 / 1.36 / 1.46 |
   | Display large / medium / small | 57 / 45 / 36 | 64 / 52 / 44 | 73 / 56 / 47 | 1.28 / 1.24 / 1.31 |

   The page labels Medium as "~7% taller". The token values are 5–15 % taller than the Latin ones.

2. **Equal white space between lines, measured.** I set the same 16 px listing description in Persian and in English (the same font's own Latin) at 380 px wide. I then found the Persian line height that leaves the same mean white band between lines of ink as Latin gets at the Material 3 or Tailwind Latin value. Results:
   - Vazirmatn: 1.46 (12 px), 1.52 (14), **1.61 (16)**, 1.51 (20), 1.45–1.46 (24), 1.41 (28), 1.38 (32).
   - Estedad: 1.48, 1.52–1.60, **1.69–1.72**, 1.61, 1.54–1.56, 1.50, 1.48.

   Where two values appear, they come from two different texts (M4). Persian needs about +0.1 (Vazirmatn) to +0.2 (Estedad) over Latin at the same size. That matches the Material 3 offsets.

3. **Clipping floor, measured.** With `overflow: hidden`, ordinary titles lose no ink from line height 1.2–1.3 upward. The stress string «تأیید آگهی؛ پراید غ» needs 1.4–1.5. At line height 1, up to 5.5 px of ink is cut (M3). So clipping sets the floor only for single-line or clamped UI text. Reading text is limited by comfort, not by ink.

4. **Font metrics explain why a single multiplier cannot be universal.** `line-height: normal` for each font is its ascent plus descent:
   - Vazirmatn 1.5625
   - Estedad 1.525
   - Noto Naskh Arabic 1.703
   - Noto Sans Arabic 2.112

   At 1.4, Vazirmatn lines already have negative half-leading. Estedad's «ع غ پ» reach 0.40–0.41 em below the baseline, against 0.32–0.34 em in Vazirmatn, which is why Estedad needs more (M1, M2).

5. **Other institutional sources agree on direction, not on numbers.**
   - Google Fonts Knowledge (Latin): 1.15–1.5; smaller type needs more; scripts with diacritics need more.
   - UAE Design System (Arabic, Noto Kufi Arabic, a font whose normal line height is 1.897): body at least 1.5; "the larger the font size, the lesser" the line height.
   - Dubai Design System (Arabic and English in its own "Dubai" font): body 18/28 = 1.56, caption 16/24 = 1.5, small 14/20 = 1.43, H6 22/28 = 1.27, H4 32/32 = 1.0. I did not measure that font, so these figures cannot be transferred.
   - WCAG 1.4.12 requires layouts to survive 1.5.
   - Ahmad Shadeed and Apple warn that Arabic lines look tighter than Latin at the same value, and that clipped marks are a real bug.

### Where the owner's 1.4–1.6 is right, and where it is wrong

- **Right:**
  - The mechanism: a multiplier of font size, different per role, falling with size.
  - The whole range for Vazirmatn UI text, titles and headings: measured equivalents 1.38–1.51 for 20–32 px; Material 3 gives 1.31–1.46 for headlines.
  - 1.6 as the Vazirmatn body floor: measured 1.61 at 16 px.
  - 1.4 is acceptable even for truncated labels: at most one device pixel of the hamza on «أ» at 12–14 px (M3).
- **Wrong or incomplete:**
  - As a ceiling for long reading text. Material 3's Arabic body is 1.64–1.69, and Estedad needs 1.69–1.72 at 16 px to match Latin at 1.5.
  - It gives no rule for display sizes (≥ 36 px: about 1.3).
  - It ignores that the same number means different spacing in different Persian fonts.
- No fetched Persian or Arabic source states "1.4–1.6" for Persian. The range matches Latin guidance (Google Fonts 1.15–1.5; WCAG 1.5) and the Dubai Design System's body and caption values.

### Where our current 1.7 minimum is right, and where it is wrong

- **Right:** for multi-line reading text at 16 px. It equals Material 3's 1.69 and Estedad's measured 1.69–1.72, and it is the Persian equivalent of WCAG AAA's "space-and-a-half" for Latin.
- **Wrong:** as a minimum for everything.
  - Headings should run 1.5 → 1.3 as size grows.
  - Controls and one-line labels should be 1.5.
  - Meta text at 12 px should be 1.5.
  - Our "headings 1.4–1.5" is right for 20–28 px but loose for ≥ 32 px in Vazirmatn (1.38) and for display sizes (1.3).
  - The rule "check that dots are not clipped" should name the real risk: `overflow: hidden` with line height below 1.5, and `leading-none`.

## Sources consulted

| Source (author; why credible) | URL | Date | Fetched | Owner example |
|---|---|---|---|---|
| W3C, "Arabic & Persian Layout Requirements" (alreq), ed. Richard Ishida; the W3C's normative-intent requirements note for the script | https://www.w3.org/TR/alreq/ | Group Draft Note 2025-10-02 | yes | #5 (§7.4 ascenders and descenders); new (justification, kashida, ZWNJ, separators) |
| Google, Material Design 3, "Typography: type scale tokens" and "Language height support"; Google's current design system | https://m3.material.io/styles/typography/type-scale-tokens | undated; accessed 2026-09-26 | yes (rendered; token viewer read in Small, Medium, Large and Extra-large contexts) | #5 |
| Google, Material Design 2, "Language support" (Persian listed as "Tall") | https://m2.material.io/design/typography/language-support.html | undated (M2 no longer maintained); accessed 2026-09-26 | yes (rendered) | #5 |
| Elliot Jay Stocks for Google Fonts Knowledge, "Choosing a suitable line height"; reviewed by Bram Stein, Ellen Lupton and others | https://fonts.google.com/knowledge/using_type/choosing_a_suitable_line_height | undated; accessed 2026-09-26 | yes (rendered) | #5 |
| Sebastian Bailey for Google Fonts Knowledge, "Vertical spacing & line-height in design systems"; reviewed by Laurence Penney | https://fonts.google.com/knowledge/using_type/vertical_spacing_and_line_height_in_design_systems | undated; accessed 2026-09-26 | yes (rendered) | #5 (buttons, centring) |
| Material Design for Google Fonts Knowledge, "Language support in fonts" | https://fonts.google.com/knowledge/using_type/language_support_in_fonts | undated; accessed 2026-09-26 | yes (rendered) | #5 |
| Elliot Jay Stocks for Google Fonts Knowledge, "Understanding measure/line length" | https://fonts.google.com/knowledge/using_type/understanding_measure_line_length | undated; accessed 2026-09-26 | yes (rendered) | new |
| Google Fonts, gf-docs "Vertical Metrics"; the onboarding rules Google Fonts applies to every family | https://github.com/googlefonts/gf-docs/blob/main/VerticalMetrics/README.md | last change 2021-06-26 | yes | #5 (metrics behind line height) |
| Microsoft, OpenType specification, "OS/2 table"; the format owner | https://learn.microsoft.com/en-us/typography/opentype/spec/os2 | 2024-05-29 | yes | #5 |
| Saber Rastikerdar, Vazirmatn FAQ «راهنمای فونت وزیرمتن - پرسش و پاسخ»; the font's author | https://github.com/rastikerdar/vazirmatn/blob/master/website/src/_docs/HELP-fa.md | 2022-03-07 | yes (the rendered site is JavaScript only, so its markdown source was read) | #5 |
| Saber Rastikerdar, «راهنمای نسخه‌های موجود در بسته فونت وزیرمتن» (versions, including the UI build) | https://github.com/rastikerdar/vazirmatn/blob/master/website/src/_docs/Vazirmatn-Files-fa.md | 2022-04-18 | yes | new |
| Vazirmatn v33.003 release: font files, CHANGELOG, OFL | https://github.com/rastikerdar/vazirmatn/releases/tag/v33.003 | 2022-06-22 | yes (downloaded) | measured |
| Amin Abedi, Estedad README; the font's author | https://github.com/aminabedi68/Estedad | release 8.5 2026-03-20; repository pushed 2026-07-19 | yes | new |
| Google Fonts CSS2 API for Vazirmatn (v16) and Estedad (v3): same metrics as the GitHub releases; subset ranges | https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900 | accessed 2026-09-26 | yes | new |
| Ahmad Shadeed, "RTL Styling 101"; the most-cited RTL CSS guide, by a front-end author with standing | https://rtlstyling.com/posts/rtl-styling | updated 2020-01-18 | yes | #5 |
| Apple, Human Interface Guidelines, "Right to left" | https://developer.apple.com/design/human-interface-guidelines/right-to-left | undated; accessed 2026-09-26 | yes (rendered) | new (size) |
| Mohamed Samir (Apple Design team), WWDC22 "Design for Arabic" (transcript) | https://developer.apple.com/videos/play/wwdc2022/10034/ | June 2022 | yes | #5 (vertical spacing), new (size, transparency) |
| Apple, "Fonts" and "System Fonts" (SF Arabic, Geeza Pro on iOS and macOS) | https://developer.apple.com/fonts/ · https://developer.apple.com/fonts/system-fonts/ | accessed 2026-09-26 | yes | new |
| Adam Argyle, Chrome for Developers, "CSS text-box-trim" | https://developer.chrome.com/blog/css-text-box-trim | 2025-01-14 | yes (rendered) | new |
| Katie Hempenius, Chrome for Developers, "Improved font fallbacks" | https://developer.chrome.com/blog/font-fallbacks | updated 2023-02-10 | yes (rendered) | new |
| MDN: `text-box-trim` / `text-box-edge` (Baseline banner) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim | modified 2026-09-16 | yes | new |
| MDN Browser Compatibility Data API (text-box, font metric overrides, size-adjust, underline offset, font-variant-numeric) plus web-features 3.40.0 | https://bcd.developer.mozilla.org/bcd/api/v0/current/css.properties.text-box-trim.json · https://cdn.jsdelivr.net/npm/web-features/data.json | BCD 8.1.3 (2026-09-24); web-features 3.40.0 | yes | new |
| MDN: `ascent-override`, `size-adjust`, `text-justify`, `text-underline-offset`, `font-variant-numeric` (banners) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/ascent-override | modified 2026-04-20 to 2026-09-10 | yes | new |
| MDN: `line-height`, `font` shorthand, `<length>` (`ch`) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-height | modified 2026-08-11, 2026-09-17, 2026-07-08 | yes | #5 |
| CSS Working Group, CSS Inline Layout Module Level 3 (Editor's Draft) | https://drafts.csswg.org/css-inline-3/ | 2026-08-11 | yes | new |
| W3C WAI, "Understanding SC 1.4.12 Text Spacing" (WCAG 2.2) | https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html | updated 2025-10-01 | yes | #5 |
| W3C WAI, "Understanding SC 1.4.8 Visual Presentation" (WCAG 2.2, AAA) | https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html | updated 2026-03-09 | yes | #5; new (measure, justification) |
| Richard Ishida, W3C Internationalization, "Why use the language attribute?" | https://www.w3.org/International/questions/qa-lang-why | first published 2004-06-21; substantive update 2014-11-18; version 2025-09-05 | yes | new |
| UAE Design System 2.0 (UAE government), "Typography guidelines" (Arabic web) | https://designsystem.gov.ae/guidelines/typography | undated; accessed 2026-09-26 | yes (rendered) | #5 |
| Dubai Design System (Government of Dubai), "Typography" (Arabic and English) | https://designsystem.dubai.ae/foundations/typography | undated; accessed 2026-09-26 | yes (rendered) | #5 |
| AOSP `frameworks/base/data/fonts/fonts.xml` (Android's font fallback chain) | https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/data/fonts/fonts.xml | main branch, fetched 2026-09-26 | yes | new |
| Microsoft Typography font list: Segoe UI, Tahoma, Arial | https://learn.microsoft.com/en-us/typography/font-list/segoe-ui | 2025-07-25 (Arial page 2026-07-08) | yes | new |
| Unicode CLDR 48 (cldr-json 48.2.2), `fa` delimiters and number symbols | https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-misc-full/main/fa/delimiters.json | cldr-json 48.2.2 | yes | new |
| Noto Arabic fonts (Naskh 2.021, Naskh UI 2.017, Sans 2.013), for fallback metrics | https://github.com/notofonts/notofonts.github.io/tree/main/fonts | accessed 2026-09-26 | yes (downloaded) | new |
| Next.js 16.3.5 `next/font` docs and implementation (installed package) | `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` and `…/compiled/@next/font/dist/local/get-fallback-metrics-from-font-file.js` | 16.3.5 | yes (local, read-only) | new |
| Tailwind CSS 4.3.3 `theme.css` and `preflight.css` (installed package) | `node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/` | 4.3.3 | yes (local, read-only) | #5 |
| Fontiran (فونت ایران, Iranian commercial foundry), web-font installation guide | https://blog.fontiran.com/راهنما-نصب-استفاده-وب-فونت/ | undated | yes; **no line-height or metric guidance found** | — |
| Public design systems of Iranian products (Divar, Snapp, Digikala, Cafe Bazaar) | web search | — | **not found**; no primary source | — |

## Tips

### T-1: Give every text role its own unitless line height, and let it fall as the size grows
- Owner example: #5
- Why: Line height multiplies font size, but the right multiplier shrinks as type grows and rises for tall scripts. Material 3's Arabic tokens run from 1.69 (16 px body) down to 1.24–1.31 (display). The lab's equal-white-space measurement gives the same curve: Vazirmatn 1.61 → 1.38 from 16 to 32 px, Estedad 1.72 → 1.48. No single value (our "≥ 1.7") and no single range (the owner's "1.4–1.6") fits both a 16 px description and a 28 px heading.
- How: in Tailwind v4, set size and line height together in `@theme`. Values are proposed for Vazirmatn; Estedad values are in brackets. This is an inference to be ratified in CS-3.
  ```css
  @theme {
    --text-xs: 0.75rem;   --text-xs--line-height: 1.5;    /* 12px meta, one line (1.5) */
    --text-sm: 0.875rem;  --text-sm--line-height: 1.65;   /* 14px secondary text (1.65) */
    --text-base: 1rem;    --text-base--line-height: 1.7;  /* 16px descriptions (1.75) */
    --text-lg: 1.125rem;  --text-lg--line-height: 1.55;   /* 18px card titles (1.6) */
    --text-xl: 1.25rem;   --text-xl--line-height: 1.5;    /* 20px (1.6) */
    --text-2xl: 1.5rem;   --text-2xl--line-height: 1.45;  /* 24px (1.55) */
    --text-3xl: 1.875rem; --text-3xl--line-height: 1.4;   /* 30px (1.5) */
    --text-4xl: 2.25rem;  --text-4xl--line-height: 1.3;   /* 36px price hero (1.4) */
    --leading-control: 1.5;  /* buttons, chips, badges, tabs, inputs, clamped titles */
  }
  ```
- Sources:
  - Google, Material Design 3 — Type scale tokens — https://m3.material.io/styles/typography/type-scale-tokens — accessed 2026-09-26 — "The type scale can adapt line height automatically based on language height category: small, medium, large, and extra large."
  - Elliot Jay Stocks — Choosing a suitable line height — https://fonts.google.com/knowledge/using_type/choosing_a_suitable_line_height — accessed 2026-09-26 — "The smaller the type, the more generous we should be with our line height values."
  - UAE Design System 2.0 — Typography guidelines — https://designsystem.gov.ae/guidelines/typography — accessed 2026-09-26 — "The larger the font size, the lesser you may apply a line height value, but never less than 1rem."
  - Measurement M4.
- Confidence: high for the shape; medium for the exact numbers.
- Conflicts:
  - Our `ui-design` non-negotiable 6 and `.claude/rules/ui.md` say "body line height ≥ 1.7" as a global floor.
  - The Dubai Design System uses much tighter Arabic values (body 1.56, H4 1.0) with a font I could not measure.

### T-2: Set reading text (descriptions, reviews, guides) at 1.7 on 16 px; never below 1.6 in Vazirmatn or 1.7 in Estedad
- Owner example: #5
- Why: To give Persian the white space between lines that Latin gets at 1.5:
  - Vazirmatn needs 1.61 and Estedad 1.69–1.72 at 16 px (M4, two texts).
  - Material 3's Arabic "Body large" is 27/16 = 1.69.
  - In a 380 px column, 1.4–1.5 looks crowded: descenders of one line meet the dots of the next (`shot-para-*.png`, my visual judgement). 1.7–1.8 reads comfortably; 2.0 is loose.
- How:
  - `line-height: 1.7` on description paragraphs (Estedad 1.75).
  - 14 px secondary paragraphs 1.65.
  - Always unitless.
- Sources:
  - Saber Rastikerdar — Vazirmatn FAQ — https://github.com/rastikerdar/vazirmatn/blob/master/website/src/_docs/HELP-fa.md — 2022-03-07 — «در نتیجه حروف فارسی غالبا به فضای بیشتری نسبت به حروف لاتین برای نمایش احتیاج دارند.» (gloss: as a result, Persian letters usually need more space than Latin ones to display).
  - Ahmad Shadeed — RTL Styling 101 — https://rtlstyling.com/posts/rtl-styling — updated 2020-01-18 — "the spacing between lines for the Arabic text is less than for the English one, even though both of them have the same line-height".
  - Google, Material Design 3 — Type scale tokens — (as T-1) — "Medium (~7% taller): Amharic, Arabic, Armenian".
- Confidence: high that the floor is at least 1.6; medium on 1.7 against 1.65, which is a taste call inside the measured range.
- Conflicts:
  - The owner's upper bound 1.6 fits only Vazirmatn's floor.
  - Dubai Design System body text is 1.56.

### T-3: Tighten headings as they grow: 1.5 at 20 px, 1.45 at 24 px, 1.4 at 28–32 px, 1.3 from 36 px (Estedad about +0.1)
- Owner example: #5
- Why:
  - Material 3 Arabic values: 22 px 1.41, 24 px 1.46, 28 px 1.36, 32 px 1.31, 36 px 1.31, 45 px 1.24.
  - Equal-white-space values: Vazirmatn 20 px 1.51, 24 px 1.45, 28 px 1.41, 32 px 1.38; Estedad 1.61, 1.54–1.56, 1.50, 1.48.
  - None of these clip from 1.3 up (M3), so the floor for headings is readability of wrapped lines, not ink.
  - Latin display advice (line height ≤ 1.0) does not transfer: at 1.0, Persian loses 1–4 px of ink.
- How: a two-line listing page title such as «پژو ۲۰۶ تیپ ۲، مدل ۱۳۹۸، بدون رنگ» at 24 px gets `line-height: 1.45` (Estedad 1.55).
- Sources:
  - Elliot Jay Stocks — Choosing a suitable line height — (as T-1) — "When text is set large, the space between lines need not be too big."
  - Google, Material Design 3 — (as T-1) — "Ignoring language height can lead to overlapping text and broken UI elements".
- Confidence: medium.
- Conflicts:
  - Our "headings 1.4–1.5" is right for 20–28 px and slightly loose for ≥ 32 px.
  - Google Fonts' Latin display advice ("smaller than the type size") would clip Persian.

### T-4: Give every one-line control and every truncated or clamped text line height 1.5; never below 1.3, never `leading-none`
- Owner example: #5
- Why: `overflow: hidden` cuts any ink that leaves the line box. This applies to Tailwind `truncate` and `line-clamp-*`, to chips with an ellipsis, and to fixed-height badges. Measured in Chromium 153:
  - At line height 1, ordinary text loses 0.5–2 px at the top and up to 3.5–4 px of descenders (Estedad at 28 px).
  - The word «تأیید» with its hamza-alef loses up to 5.5 px.
  - From 1.3, ordinary text is safe in every font, weight and size tested.
  - From 1.5, the stress string is safe everywhere (M3).
  - Text inside a 44 px `<input>` was not clipped at any line height (M16).
- How:
  - `line-height: var(--leading-control)` (1.5) on buttons, chips, the deal badge «معامله‌ی عالی», tabs, list rows, truncated seller names and clamped listing titles.
  - Control height comes from `min-block-size` and padding, not from line height.
- Sources:
  - Ahmad Shadeed — RTL Styling 101 — (as T-2) — "On Twitter, for example, there is a button with cut-off content due to an unsuitable value for line-height".
  - Mohamed Samir (Apple) — WWDC22 Design for Arabic — https://developer.apple.com/videos/play/wwdc2022/10034/ — June 2022 — "make sure to have more vertical spacing in the UI to avoid clipping."
  - Google, Material Design 3 — (as T-1) — "Components with fixed heights are built for small values and may not adapt by default."
- Confidence: high.
- Conflicts:
  - The owner's 1.4 is acceptable here: at most a 0.5 px sliver on «أ» at 12–14 px.
  - Tailwind's `leading-none` (1), `leading-tight` (1.25), `text-3xl` (1.2) and `text-4xl` (1.11) all fall below the floor.

### T-5: Centre labels in fixed-height controls with the box (flex plus height); line height does not move them, so do not tune it
- Owner example: #5 (buttons)
- Why: CSS puts half the leading above and half below the font's content area, so one line of text sits where the font's ascent and descent put it. Measured:
  - In 48, 44 and 28 px flex-centred boxes, each label moved by at most 1 px across line heights 1.0 to 1.8.
  - Vazirmatn and Estedad are balanced. Across 8 real labels, the ink centre sat between −2.25 and +1.75 px of the box centre. For Vazirmatn at 16 px in a 48 px box, «جستجو» has gaps of 18 px above and 17 px below; «مشاهده آگهی» has 14.5 and 17.
  - Chromium snaps each baseline to a whole pixel. Text sat above its ideal position in 81 % of 600 cases, by up to 1.3 px (M17).
- How:
  - `display: inline-flex; align-items: center; min-block-size: 44px` (48 px for the primary action); `padding-inline: 16px; line-height: 1.5`.
  - Accept 1 px of rounding jitter.
  - Check icon-and-label alignment in a screenshot rather than by nudging line height.
- Sources:
  - Sebastian Bailey — Vertical spacing & line-height in design systems — https://fonts.google.com/knowledge/using_type/vertical_spacing_and_line_height_in_design_systems — accessed 2026-09-26 — "The web renders text with half-leading above and below the 100% line-height for a font."
  - Same article — "Choosing one that is exactly centered within its default line height means it will always be centered, no matter the line height."
- Confidence: high.
- Conflicts: none.

### T-6: Do not apply `text-box: trim-both cap alphabetic` to Persian; it is a Latin recipe
- Owner example: new
- Why: the `cap` and `alphabetic` edges come from Latin. A large share of Persian ink sits below the alphabetic baseline. Measured in Chromium 153:
  - A 28 px Vazirmatn heading trimmed to 22.4 px leaves 7–9 px of ink below the box (Estedad 7–11 px) and up to 3 px above (Estedad 8.5 px).
  - A padded «جستجو» button ends up with 16 px above the ink and 7.8 px below, so the label looks low.
  - `trim-both ex alphabetic` is worse: 4–12.5 px above, 7.7–11.3 px below.
  - `trim-both text` trims to the font's ascent and descent. With a line height below `normal` (1.4 < 1.5625), it grows the box instead: 39.2 → 44 px.
  - Support: MDN marks it Baseline 2026, newly available (Chrome 133, Safari 18.2, Firefox 154 on 2026-08-18). web-features 3.40.0 still reports the `text-box` feature as not Baseline, because its `<text-edge>` type keys lack Firefox. Browsers from before 2025 ignore it.
- How: for tight vertical rhythm in a Persian heading, use `text-box: trim-both text` only when the line height is at least the font's `normal` (Vazirmatn 1.5625, Estedad 1.525). Treat it as a progressive enhancement; the layout must work without it.
- Sources:
  - Adam Argyle — CSS text-box-trim — https://developer.chrome.com/blog/css-text-box-trim — 2025-01-14 — "Trimming both to cap alphabetic will be the most common use of this feature."
  - MDN — text-box-trim — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim — modified 2026-09-16 — "Baseline 2026 Newly available Since August 2026, this feature works across the latest devices and browser versions."
  - CSSWG — CSS Inline Layout 3 (ED) — https://drafts.csswg.org/css-inline-3/ — 2026-08-11 — on `text`: "Use the text-over baseline / text-under baseline as the over / under edge."
- Confidence: high (measured in Chromium only; Safari and Firefox not measured).
- Conflicts: the Chrome article presents cap/alphabetic trimming as the default use and calls the result "optically centered". That holds for Latin, not for Persian.

### T-7: Keep the chosen font's vertical metrics as shipped; if a later font sits off-centre, patch the font file, not `ascent-override`
- Owner example: new
- Why:
  - Both candidate fonts follow Google Fonts' metric scheme: hhea equals typo, line gap is 0, USE_TYPO_METRICS is on, and the win metrics cover the bounding box. For Vazirmatn, 2200/1300 against a bounding box of 2163/−1142; for Estedad, 1025/500 against 1001/−452.
  - So they lay out the same on every operating system, and their labels are already centred (T-5, M1).
  - `ascent-override`, `descent-override` and `line-gap-override` have "limited availability": there is no Safari or iOS release support (MDN BCD lists Safari as "preview"). A fix there would miss every iPhone.
- How:
  - Audit any candidate font with fontTools: hhea against typo against win, and fsSelection bit 7 (see `lab/metrics.py`).
  - If a font is off-centre, patch hhea and typo ascender and descender in a build step and ship the patched woff2.
  - OFL 1.1 permits modified versions. Neither Vazirmatn's nor Estedad's copyright line declares a Reserved Font Name (read from their OFL files; not legal advice).
- Sources:
  - Google Fonts — gf-docs Vertical Metrics — https://github.com/googlefonts/gf-docs/blob/main/VerticalMetrics/README.md — 2021-06-26 — "Hhea metrics are used in Mac OS X, whilst Microsoft uses Typo when Use_Typo_Metrics is enabled. They should ideally be identical."
  - Microsoft — OpenType OS/2 — https://learn.microsoft.com/en-us/typography/opentype/spec/os2 — 2024-05-29 — "If set, it is strongly recommended that applications use OS/2.sTypoAscender - OS/2.sTypoDescender + OS/2.sTypoLineGap as the default line spacing for this font."
  - MDN — ascent-override — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/ascent-override — 2026-04-20 — "Limited availability This feature is not Baseline because it does not work in some of the most widely-used browsers."
- Confidence: high (metrics and support); medium (the licence reading).
- Conflicts: Chrome's "Improved font fallbacks" recommends the overrides. That works for fallback faces in Chromium and Firefox, but it is not a cross-browser fix.

### T-8: Use standard Vazirmatn, not its "UI" build
- Owner example: new
- Why:
  - The UI build lowers only the typo and win metrics (1950/−970) and keeps hhea at 2100/−1100, with USE_TYPO_METRICS on.
  - Chromium on Linux used the typo values: canvas ascent 0.952 em, and `normal` gave 23 px instead of 25 px at 16 px.
  - Google Fonts says macOS uses hhea, so the same page would get different line boxes per platform. I did not measure this on Apple hardware.
  - With explicit line heights, the UI build gave no measurable gain: label positions matched standard Vazirmatn within 0.5 px, and it clipped slightly more at 1.2.
- How: self-host the standard `Vazirmatn[wght].woff2` (v33.003, 111,152 bytes) through `next/font/local`, and set explicit line heights (T-1).
- Sources:
  - Saber Rastikerdar — Vazirmatn FAQ — (as T-2) — «در این نسخه از ارتفاع فونت کاسته شده است تا اختلاف ارتفاع بین لاتین و فارسی کم شود.» (gloss: in this version the font's height is reduced to narrow the height gap between Latin and Persian).
  - Google Fonts — gf-docs Vertical Metrics — (as T-7).
- Confidence: medium-high (the Apple behaviour comes from Google Fonts' documentation, not measured).
- Conflicts: Vazirmatn's docs suggest the UI build for applications that need less height. That targets native apps using default line spacing.

### T-9: Never leave Persian text at `line-height: normal`, and watch the `font` shorthand, which resets it
- Owner example: #5
- Why:
  - `normal` is the font's ascent plus descent, not MDN's "roughly 1.2": Vazirmatn 1.5625, Estedad 1.525, Noto Naskh Arabic (Android's fallback) 1.703, Noto Naskh Arabic UI 1.362, Noto Sans Arabic 2.112.
  - A two-line paragraph measured 44–54 px across these fonts with `normal`, but 54.4 px in every font that kept two lines at 1.7 (M9). With a number, swapping from the fallback font to the web font moves the page only where line breaks change.
  - Verified in Chromium: `font: 400 16px Vazirmatn` reset an inherited 1.7 to `normal`, and reset `tabular-nums` to `normal`.
- How:
  - Keep Tailwind preflight's `html { line-height }` and the role tokens.
  - In review, reject `line-height: normal` and any `font:` shorthand without `/<number>`.
  - Declare `font-variant-numeric` after any `font:` shorthand.
- Sources:
  - MDN — line-height — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-height — 2026-08-11 — "Desktop browsers (including Firefox) use a default value of roughly 1.2, depending on the element's font-family".
  - Same page — "In most cases, this is the preferred way to set line-height and avoid unexpected results due to inheritance." (about unitless numbers)
  - MDN — font — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font — 2026-09-17 — "any of the longhand component properties not specified are set to their initial values, possibly overriding values previously set using non-shorthand properties."
- Confidence: high.
- Conflicts: none.

### T-10: Replace Tailwind's Latin line-height defaults, and flag `leading-none` and `leading-tight` on Persian text
- Owner example: #5
- Why:
  - Tailwind 4.3.3 ships these size/line-height pairs: text-xs 12/16 (1.33), text-sm 14/20 (1.43), text-base 16/24 (1.5), text-lg 18/28 (1.56), text-xl 20/28 (1.4), text-2xl 24/32 (1.33), text-3xl 30/36 (1.2), text-4xl 36/40 (1.11).
  - It also ships `leading-none: 1`, `leading-tight: 1.25` and `max-w-prose: 65ch`.
  - For Persian these pairs are 0.1–0.2 too tight for multi-line text (M4), and 1.0–1.25 clip under `overflow: hidden` (M3).
- How:
  - Override `--text-*--line-height` in `@theme` (T-1).
  - In design review, flag `leading-none`, `leading-tight` and `leading-[<1.3]` on anything that contains Persian.
- Sources:
  - Tailwind CSS 4.3.3 `theme.css` (installed package, read locally) — values above.
  - Google, Material Design 3 — (as T-1) — "Ignoring language height can lead to overlapping text and broken UI elements".
- Confidence: high.
- Conflicts: none.

### T-11: Re-derive the line-height tokens when CS-3 picks the font; Estedad needs about 0.1 more than Vazirmatn
- Owner example: #5
- Why:
  - The multiplier depends on vertical proportions. Estedad's «ع غ پ» reach 0.40–0.41 em below the baseline, against 0.32–0.34 em in Vazirmatn (M2).
  - To match Latin at 1.5, Estedad needed 1.69–1.72 at 16 px; Vazirmatn needed 1.61 (M4).
  - Much of the Persian alphabet sits below the baseline.
- How:
  - Rerun `lab/lab-equiv.js` (equal white space against Latin) and `lab/lab-clip.js` (clipping) against the chosen woff2 (`lab/README.md`).
  - Record the numbers in `docs/design/design-language.md`.
- Sources:
  - Google, Material Design 3 — (as T-1) — "fonts with long ascenders and descenders will require different line heights."
  - Saber Rastikerdar — Vazirmatn FAQ — (as T-2) — «بخش عمده‌ای از حروف فارسی مثل «ح ر ی ...» در زیر خط کرسی یا زمینه قرار دارند» (gloss: a large part of Persian letters, such as «ح ر ی», sit below the baseline).
- Confidence: high.
- Conflicts: none.

### T-12: Set Persian reading text at 16 px and secondary text at 14 px; keep 12 px for one-line meta only
- Owner example: new
- Why:
  - At the same px size, Persian letter bodies (the tops of «س م و ی») sit at 0.31–0.41 em. The same fonts' Latin x-height is 0.49–0.53 em, so the Persian bodies are about 65–75 % of it (M2). Persian therefore looks smaller at equal size.
  - Apple suggests Arabic 10 % larger, or about 2 pt larger next to uppercase Latin.
  - Estedad's author describes a "relatively small optical size".
- How:
  - Descriptions and inputs at 16 px; inputs of at least 16 px also avoid iOS zoom, which is an existing rule.
  - Secondary paragraphs at 14 px or more.
  - 12 px only for one-line meta such as «۲ ساعت پیش · تهران».
  - If a Latin UI would use 14–15 px body, Persian at 16 px is Apple's +10 % (inference).
- Sources:
  - Google, Material Design 2 — Language support — https://m2.material.io/design/typography/language-support.html — accessed 2026-09-26 — "Those fonts may appear smaller than Latin ones at the same font-size, requiring adjustments to line spacing and alignment".
  - Mohamed Samir (Apple) — WWDC22 Design for Arabic — (as T-4) — "To compensate for this this optical size difference in the UI, you may want to increase the Arabic font size by 10%." (sic)
  - Amin Abedi — Estedad README — https://github.com/aminabedi68/Estedad — 2026 — "simple, smooth, and compact, with low contrast and a relatively small optical size (slightly increased in bold and heavier weights)".
- Confidence: medium. The smaller look is measured and sourced; the exact sizes are judgement.
- Conflicts: none with current rules (16 px body and inputs).

### T-13: Use weight 400 as the floor for text and 500 for 12–13 px labels; never 100–300 for text
- Owner example: new
- Why: alef stem widths per weight, measured from the font outlines (M13):

  | Weight | Stem (em) | At 12 px |
  |---|---|---|
  | Regular (400) | 0.083–0.084 | 1.0 px |
  | Light (300) | 0.066–0.068 | 0.8 px |
  | ExtraLight (200) | 0.047–0.054 | 0.6 px |
  | Thin (100) | 0.025–0.029 | 0.3 px |

  Stems under 1 px render grey on 1× screens. Material 3 labels use weight 500.
- How: take 400, 500 and 700 from the variable font; use 500 for chips, badges and meta at 12–13 px.
- Sources:
  - Google, Material Design 3 — type-scale token viewer (Label large / medium / small weight = 500) — (as T-1).
  - Google, Material Design 2 — Language support — (as T-12) — "Use regular weight, as medium weight is unavailable in Noto. Avoid using the bold weight, as bold is too heavy."
- Confidence: medium.
- Conflicts:
  - Our rule allows "two weights (regular and bold)"; 500 would be an addition.
  - Material 2's "avoid bold" is specific to Noto Arabic.

### T-14: Balance Latin trim codes inside Persian titles («پژو ۲۰۶ SD», «توسان GLS»)
- Owner example: new
- Why:
  - In Vazirmatn, the Latin capitals (from Roboto) stand 0.711 em tall against 0.688 em for alef, and the Latin x-height is 0.528 em against about 0.35 em for Persian letter bodies. Uppercase trim codes therefore look bigger and louder than the Persian around them.
  - Measured: a separate Latin-range face with `size-adjust: 90%` shrank «SD» from 23 to 21 px cap height at 32 px, leaving the Persian untouched (M15).
  - `size-adjust` is Baseline widely available; the metric overrides are not.
- How: only if the owner judges trim codes too loud, because this is a taste call. Two approaches:
  - Hand-written `@font-face` rules with `unicode-range`: Arabic ranges plus U+00AB and U+00BB in one face; `U+0000-00AA, U+00AC-00BA, U+00BC-024F` with `size-adjust: 90%` in the other.
  - Or two `next/font/local` families in the stack: the Non-Latin build first, then a Latin family with `declarations: [{ prop: 'size-adjust', value: '90%' }]`.
- Sources:
  - Apple — HIG Right to left — https://developer.apple.com/design/human-interface-guidelines/right-to-left — accessed 2026-09-26 — "Arabic or Hebrew text can appear too small when next to uppercased Latin text".
  - Same page — "it often works well to increase the RTL font size by about 2 points".
  - MDN — size-adjust — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/size-adjust — 2026-04-20 — banner "Baseline Widely available".
- Confidence: low-medium (taste).
- Conflicts: the font choice in CS-3.

### T-15: Cap Persian reading width in `em`, not `ch`: about 30–33 em (≈ 70–75 characters)
- Owner example: new
- Why:
  - Persian and Latin both average about 0.43–0.44 em per character in these fonts (M14).
  - `ch` is the advance of the Latin «0»: 0.562 em in Vazirmatn, 0.59 em in Estedad. So Tailwind's `max-w-prose` (65ch) holds about 85–87 Persian characters.
  - On a 412 px phone (380 px of text), 16 px gives about 55 characters (about 10.5 Persian words). That is inside Bringhurst's 45–75, and nothing needs capping.
  - Paragraph spacing: I found no Persian-specific source. WCAG's AAA criterion explains its paragraph-spacing figure as a blank line between paragraphs. With line height 1.7 that means a margin of about 1.7 em (inference). Layouts must also survive a user override to 2 em (WCAG 1.4.12).
- How: `max-inline-size: 32em` on description and guide text on desktop.
- Sources:
  - Elliot Jay Stocks — Understanding measure/line length — https://fonts.google.com/knowledge/using_type/understanding_measure_line_length — accessed 2026-09-26 — "anything from 45 to 75 characters is widely regarded as a satisfactory length of line".
  - Same article — "The Material Design guidelines suggest “between 40 to 60 characters” as a suitable measure for body text on screen."
  - MDN — `<length>` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length — 2026-07-08 — `ch` "Represents the width or, more precisely, the advance measure of the glyph 0 (zero, the Unicode character U+0030)".
  - Dubai Design System — Typography — https://designsystem.dubai.ae/foundations/typography — accessed 2026-09-26 — "Limit line length to 80 characters or fewer".
  - W3C WAI — Understanding SC 1.4.8 Visual Presentation — https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html — 2026-03-09 — "Width is no more than 80 characters or glyphs (40 if CJK)."
  - Same — "Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing."
  - Same — "(i.e., that there is a blank line between the two paragraphs that is 150% of the single space blank line)".
- Confidence: medium for the measure; low for the paragraph-spacing number.
- Conflicts: the UAE Design System allows up to 100 characters.

### T-16: Align Persian paragraphs to the start; never `text-align: justify`
- Owner example: new
- Why:
  - Chromium 153 justified Persian by widening spaces only; no kashida was inserted.
  - In 300–380 px columns, the largest gap reached 10–11 px against 7–8 px unjustified: 2.5–3.7 times a space (M10, `shot-justify.png`).
  - alreq warns that relying on space stretching creates rivers, and that kashida needs typographic care that browsers do not implement.
  - `text-justify` has limited availability.
  - Persian is not hyphenated: lines wrap between words.
- How: `text-align: start`, which is the default under `dir="rtl"`. For one- or two-line headings, `text-wrap: balance` is fine (Baseline newly available since 2024-05).
- Sources:
  - W3C alreq — https://www.w3.org/TR/alreq/ — 2025-10-02 — "Depending solely on this mechanism for aligning lines in a justified paragraph can lead to unpleasant results, such as rivers".
  - Same, §7.2.5 — "Excessive use of kashida or applying very long kashidas results in uneven color."
  - UAE Design System 2.0 — (as T-1) — "Never justify texts in both English and Arabic as it slows down the reading speed for users."
  - W3C WAI — Understanding SC 1.4.8 — (as T-15) — "Text is not justified (aligned to both the left and the right margins)."
- Confidence: high.
- Conflicts: Apple's native text system inserts kashida (WWDC22). Browsers do not.

### T-17: Draw link underlines below the dots with `text-underline-offset: 0.45em; text-decoration-thickness: 1px`
- Owner example: new
- Why: measured at 16 px on «پیکان ۱۶۰۰ و پژو پارس» (M8):
  - The default underline sits 1–1.5 px below the baseline, inside the dot and descender zone; the deepest ink is at 5 px (Vazirmatn) and 6 px (Estedad).
  - With default skip-ink, only 46–49 % of the underline is drawn, so it looks broken.
  - `skip-ink: none` cuts through the dots.
  - At 0.45em the underline sits 7–7.5 px below the baseline: continuous, and clear of all ink in both fonts.
  - 0.3em is enough for Vazirmatn but still touches Estedad (91 % drawn).
- How: `a { text-decoration-line: underline; text-underline-offset: 0.45em; text-decoration-thickness: 1px; }`, or colour plus an underline on `:hover` and `:focus-visible` only.
- Sources:
  - Ahmad Shadeed — RTL Styling 101 — (as T-2) — "The dots highlighted in blue overlap with the underline. This is not good, and it makes the text hard to read."
  - Same — "using text-decoration-skip-ink property can solve the issue of dots overlapping with the underline".
  - MDN — text-underline-offset — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-underline-offset — 2026-09-10 — banner "Baseline Widely available".
- Confidence: high on the position (measured); medium on the look.
- Conflicts: Shadeed proposes skip-ink as the fix. In Persian it breaks the line into fragments; an offset is better.

### T-18: Use `tabular-nums` only where digits must line up, and keep real Persian digits in the text
- Owner example: new
- Why:
  - Both fonts register `tnum` for Arabic script, and it works on Persian digits: all ten become 1349 units wide in Vazirmatn and 740 in Estedad.
  - The default Persian digits are proportional (Vazirmatn «۱» is 591 units against 1349 for «۳»). So tabular figures widen «۱۱۱۱۱۱» by 120–140 % and «۱۲۵٬۰۰۰٬۰۰۰» by 49–71 % (M7).
  - Good in comparison tables and price columns; bad on listing-card prices and in running text.
  - Vazirmatn's Latin digits are already tabular; Estedad's are not.
- How:
  - `font-variant-numeric: tabular-nums` on table cells only, declared after any `font:` shorthand (T-9).
  - Format digits with `Intl` (existing rule). Never rely on `ss01` or the Farsi-digit builds.
- Sources:
  - Saber Rastikerdar — Vazirmatn FAQ — (as T-2) — «این حالت بیشتر برای گزارشات مناسب است.» (gloss: this [tabular] mode suits reports).
  - Same — «یک فونت استاندارد نباید چیزی غیر از اصل متن را نمایش دهد» (gloss: a standard font should show nothing but the actual text).
  - MDN — font-variant-numeric — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric — 2026-09-10 — banner "Baseline Widely available".
- Confidence: high.
- Conflicts: none; this refines the current rule "`tabular-nums` … is right for prices in columns".

### T-19: Never give Persian text a semi-transparent colour; use solid colour tokens
- Owner example: new
- Why: measured at 40 px (M11):
  - `color: rgb(0 0 0 / .5)` leaves dark spots where connected glyphs overlap: minimum luminance 63 instead of 128, with 182 pixels darker than the intended grey in Vazirmatn and 64 in Estedad.
  - `opacity: .5` on the element and a solid `#808080` show none.
  - The culprit is alpha in the colour, which is what Tailwind modifiers like `text-gray-900/60` produce.
- How: define solid secondary and tertiary text tokens; no alpha modifiers on text colour. Element `opacity` renders cleanly in Chromium, but tokens are still preferred.
- Sources:
  - Ahmad Shadeed — RTL Styling 101 — (as T-2) — "The solution is simply to set the color without RGBa or opacity."
  - Mohamed Samir (Apple) — WWDC22 Design for Arabic — (as T-4) — "Sometimes you can see visible joints between letters."
- Confidence: high (Chromium).
- Conflicts: our rule forbids "text opacity". The measured fault is alpha colour; element opacity was clean.

### T-20: Keep `lang="fa"` on the root and on Persian islands; it changes quotation marks, voices and some glyphs
- Owner example: new
- Why: measured in Chromium 153 (M12):
  - `<q>` renders «قیمت منصفانه» under `lang="fa"`, but ”سعر عادل“ under `lang="ar"`.
  - Noto Naskh Arabic (Android's fallback) has a `FAR` language system that swaps the glyphs of ۴ ۶ ۷, ٫ ٬ and « ».
  - Vazirmatn and Estedad have no `FAR` system, so `lang` does not change their glyphs.
  - Language also selects screen-reader voices.
- How:
  - `<html lang="fa" dir="rtl">` (existing rule).
  - `lang="en" dir="ltr"` on English islands such as a VIN or a URL.
  - Never `lang="ar"` for Persian.
- Sources:
  - Richard Ishida — Why use the language attribute? — https://www.w3.org/International/questions/qa-lang-why — version 2025-09-05 — "fonts or line spacing may need to change to accommodate different alphabets, style-generated quotation marks may need to be different by language".
  - Same — "Language information assists speech synthesizers and Braille translators to produce usable results."
  - Unicode CLDR 48 — fa delimiters — quotationStart «, quotationEnd », alternates ‹ › (data, not prose).
- Confidence: high.
- Conflicts: none.

### T-21: Use Persian punctuation and number symbols, never ASCII look-alikes
- Owner example: new
- Why:
  - Persian uses « » for quotations, ، ؛ ؟ for comma, semicolon and question mark, ٬ (U+066C) as thousands separator, ٫ (U+066B) as decimal separator and ٪ (U+066A) for percent.
  - alreq's appendix marks the ASCII `"` as not used in Persian.
  - CLDR 48 lists these symbols for `fa`. `Intl` returns «۱٬۲۳۴٬۵۶۷٫۸۹» and «۲۵٪» (Node 22, ICU 76.1).
  - Both fonts contain every one of these glyphs.
  - Google Fonts puts U+00AB and U+00BB in the *Latin* subset, not the Arabic one.
- How:
  - Format with `Intl` (existing rule) and write copy with Persian punctuation.
  - If fonts are ever subset, keep U+00AB, U+00BB, U+060C, U+061B, U+061F, U+066A–U+066C and U+200C–U+200F.
- Sources:
  - W3C alreq §6.1.3 — (as T-16) — "Arabic-Indic numerals use two specific separators: "٫" ( U+066B ARABIC DECIMAL SEPARATOR ) "٬" ( U+066C ARABIC THOUSANDS SEPARATOR )".
  - Google Fonts CSS2 API — https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900 — accessed 2026-09-26 — the Arabic subset's `unicode-range` (data).
- Confidence: high.
- Conflicts: none.

### T-22: Preserve the ZWNJ in the font, in any subset and in every text pipeline
- Owner example: new
- Why:
  - alreq defines U+200C as the character that prevents joining, and its appendix marks it as used in Persian but not in Arabic.
  - Both fonts have a zero-width U+200C glyph.
  - Vazirmatn 32.101 fixed a build that had dropped ZWNJ and ZWJ.
  - Google Fonts' Arabic subset includes U+200C–U+200E.
- How:
  - Pin Vazirmatn ≥ 33.003 or Estedad 8.5.
  - Keep «آگهی‌ها» and «بیمه‌ی» in test fixtures.
  - Never strip U+200C in normalisers, search indexing or slug code (the storage rule already exists).
- Sources:
  - W3C alreq §4.3.4.1 — (as T-16) — "a special character should be used to enforce disjoining of these letters. This character is called U+200C ZERO WIDTH NON-JOINER".
  - Saber Rastikerdar — Vazirmatn CHANGELOG, v32.101 — https://github.com/rastikerdar/vazirmatn/blob/master/CHANGELOG.md — ۲۹ اسفند ۱۴۰۰ (2022-03-20) — "Fixed the lack of glyphs (ZWJ, ZWNJ) in the generated fonts".
- Confidence: high.
- Conflicts: none; this extends the existing storage rule.

### T-23: Name Persian-capable fallbacks, and do not count on `next/font`'s automatic fallback for Persian
- Owner example: new
- Why:
  - `next/font/local` defaults to `adjustFontFallback: 'Arial'`. It computes `size-adjust` from Latin a–z widths only; the source says "TODO: Currently only works for the latin alphabet".
  - Android has no Arial.
  - Platform Arabic-script fonts:
    - Android: Noto Naskh Arabic and Noto Naskh Arabic UI (AOSP `fonts.xml`).
    - Windows: Segoe UI, Tahoma and Arial.
    - Apple: Geeza Pro on iOS and macOS, and SF Arabic as Apple's Arabic system typeface.
  - The fallback fonts measured here have `normal` line heights from 1.36 to 2.11 em, so numeric line heights matter (T-9). Segoe UI, Tahoma and Geeza Pro were not measured.
  - Which font Safari actually picks for Persian when the web font is missing is UNVERIFIED (no Apple device here).
- How:
  - `font-family: var(--font-vazirmatn), system-ui, "Segoe UI", Tahoma, "Geeza Pro", "Noto Naskh Arabic", sans-serif;` (the order is inference).
  - Keep `display: 'swap'` and preload.
  - Measure layout shift with and without `adjustFontFallback: false`: the generated Arial face does not match Persian.
- Sources:
  - Next.js 16.3.5 — `font.md` (installed docs) — "The possible values are `'Arial'`, `'Times New Roman'` or `false`. The default is `'Arial'`."
  - Katie Hempenius — Improved font fallbacks — https://developer.chrome.com/blog/font-fallbacks — 2023-02-10 — "These APIs make it possible to use local fonts to create fallback font faces that closely or exactly match the dimensions of a web font."
  - Microsoft — Segoe UI — https://learn.microsoft.com/en-us/typography/font-list/segoe-ui — 2025-07-25 — "Segoe UI supports a very wide range of languages and scripts, including the Latin, Greek, and Cyrillic alphabets, Arabic, Hebrew".
  - AOSP — fonts.xml — (as table) — `<family lang="und-Arab" variant="elegant">` NotoNaskhArabic (data).
- Confidence: medium.
- Conflicts: none known.

### T-24: Build text containers that survive WCAG 1.4.12 overrides: minimum heights and padding, not fixed heights with `overflow: hidden`
- Owner example: #5
- Why:
  - Users may force line height 1.5, paragraph spacing 2 em and word spacing 0.16 em, and nothing may be cut off.
  - Letter spacing may be treated as not applicable to Persian under the SC's script exception. Persian letters join, and our rule already bans tracking.
  - A chip at 1.3 with a fixed height and `overflow: hidden` would clip under a 1.5 override.
  - Our 1.5 control floor (T-4) means no box grows.
- How: `min-block-size` plus `padding-block`; `overflow: hidden` only where truncation is intended, and then at line height 1.5 or more.
- Sources:
  - W3C WAI — Understanding SC 1.4.12 — https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html — 2025-10-01 — "Line height (line spacing) to at least 1.5 times the font size".
  - Same — "Text fits within the bounds of its containing box without being cut off."
  - Same — "Authors are encouraged to follow locally available guidance for improving readability and legibility".
- Confidence: high.
- Conflicts: none.

### T-25: Test every text container with a Persian stress string
- Owner example: #5
- Why:
  - The first ink to clip is the hamza of «أ» (0.88–0.90 em above the baseline). Next come the madda of «آ» and the stroke of «گ» (0.77–0.80 em), then the tails and dots of «ع غ پ» (0.32–0.41 em below).
  - Ordinary listing titles are safe from 1.2–1.3; the stress string only from 1.4–1.5 (M2, M3).
  - Words like «تأیید» are common in the UI.
- How: add «تأیید آگهی؛ پراید غ» and «گ ژ ی ؛ ؟» to the fixtures of every Playwright check on buttons, chips, badges and clamped titles. Assert that no ink leaves the box: screenshot with `overflow: visible` and compare ink rows with the box (`typography-lab/pixels.js`, `lab-clip.js`).
- Sources:
  - Mohamed Samir (Apple) — WWDC22 Design for Arabic — (as T-4) — "Digital Arabic fonts are usually designed to match the lower case Latin."
  - W3C alreq §7.4 — (as T-16) — "Arabic ascenders and descenders extend much further than those of the Latin script, and care must be taken to correctly align text".
- Confidence: high.
- Conflicts: none.

## Measurements

### Method

- **Environment:**
  - Linux 7.0.
  - Headless Chromium 153.0.8010.12, driven by the repository's Playwright 1.63.0 (the CommonJS `playwright` package; nothing was installed).
  - Device pixel ratio 2 for ink measurements, 1 for the paragraph screenshots.
  - Firefox and WebKit binaries are not installed, so every browser number is Chromium only.
  - Chromium on Linux uses whole-pixel glyph advances here, so text widths are whole numbers; Android and macOS may differ by fractions of a pixel.
- **Fonts:**
  - Vazirmatn v33.003 (GitHub release, 2022-06-22): `Vazirmatn[wght].woff2`, 111,152 bytes, sha256 `4e3fa217d38fdafc…`; static TTFs; `Vazirmatn-UI-NL-Regular.woff2`.
  - Estedad 8.5 (GitHub release, 2026-03-20): `Estedad[wght].woff2`, 120,924 bytes, sha256 `b40ce2504e442a79…`; static TTFs.
  - Google Fonts serves the same versions (Vazirmatn v16 is 33.003; Estedad v3 is 8.5) with identical vertical metrics (checked on the TTF builds).
  - Noto Naskh Arabic 2.021, Noto Naskh Arabic UI 2.017 and Noto Sans Arabic 2.013 from notofonts, for the fallback comparison.
  - Fonts were served through `page.route` under unique family names (`LabVazirmatn` and similar), because Vazirmatn is also installed system-wide on this machine. `document.fonts.check()` confirmed every face loaded.
- **Ink measurement:** each case was rendered alone in a wrapper whose top sits on a whole pixel, with generous padding and `overflow: visible`. A screenshot of the box ±1.2 em was decoded with the pngjs bundled in playwright-core. A pixel counts as ink when its luminance is below 160. Ink above or below the element's line box is exactly what `overflow: hidden` would cut. The baseline was read from a zero-size inline-block at `vertical-align: baseline`.
- **Glyph extents:** fontTools 4.58.2 on the outlines (Vazirmatn) and canvas `measureText` at 1000 px (both fonts; Estedad builds dotted letters from components, which fontTools' bounds pen did not resolve). Canvas values are quantised to about ±0.01 em.
- **Equal white space (M4):** the same 5-line listing description in Persian, and its English version in the same font's Latin, 16 px at 380 px wide (width scaled with size). I measured the mean height of fully empty pixel rows between consecutive lines of ink, then interpolated the Persian line height (steps of 0.05) that matches the Latin mean at the Latin reference: Material 3 "Small" (Latin) values where Material 3 has the size, Tailwind 4.3.3 otherwise. This is a model of equal interline space, not a standard.
- **Files**: the scripts that re-derive font-dependent numbers are kept in `lab/` (`common.js`, `pixels.js`, `metrics.py`, `lab-clip.js`, `lab-button.js`, `lab-trim.js`, `lab-equiv.js`, plus `lab-stem.js`); every other file named here was a throwaway from the research session and is not kept:
  - measurement scripts: `metrics.py`, `tnum.py`, `scriptfeat.py`, `glyphs.js`, `lab-clip.js`, `lab-clip-low.js`, `lab-button.js`, `lab-trim.js`, `lab-equiv.js`, `lab-equiv2.js`, `lab-gap.js`, `lab-misc.js`, `lab-fallback.js`, `lab-justify*.js`, `lab-alpha.js`, `lab-mixed.js`, `lab-input.js`, `lab-measure.js`, `lab-shorthand.js`;
  - shared helpers: `common.js`, `pixels.js`;
  - raw results: `results-*.json`;
  - screenshots: `shot-*.png`;
  - fetched sources: `src/`.

### M1. Vertical metrics (fontTools)

| Font | UPM | hhea asc / desc / gap | typo asc / desc / gap | USE_TYPO_METRICS | win asc / desc | bbox yMax / yMin | `normal` line height | Content-area centre above baseline |
|---|---|---|---|---|---|---|---|---|
| Vazirmatn 33.003 | 2048 | 2100 / −1100 / 0 | 2100 / −1100 / 0 | on | 2200 / 1300 | 2163 / −1142 | 1.5625 em (25 px at 16 px, measured) | 0.244 em |
| Vazirmatn UI NL 33.003 | 2048 | 2100 / −1100 / 0 | **1950 / −970** / 0 | on | 1950 / 970 | 2003 / −1142 | 1.426 em typo (23 px measured on Chromium/Linux); 1.5625 em hhea where hhea is used (Google Fonts says macOS; not measured) | 0.239 em (typo) |
| Estedad 8.5 | 1000 | 1025 / −500 / 0 | 1025 / −500 / 0 | on | 1025 / 500 | 1001 / −452 | 1.525 em (24 px measured) | 0.263 em |
| Noto Naskh Arabic 2.021 | 1000 | 1069 / −634 / 0 | same | on | 1405 / 634 | 1405 / −590 | 1.703 em | 0.218 em |
| Noto Naskh Arabic UI 2.017 | 1000 | 1069 / −293 / 0 | same | on | 1069 / 293 | 1191 / −419 | 1.362 em | 0.388 em |
| Noto Sans Arabic 2.013 | 1000 | 1374 / −738 / 0 | same | on | 1431 / 738 | 1431 / −548 | 2.112 em | 0.318 em |

Chromium's canvas `fontBoundingBoxAscent` and `fontBoundingBoxDescent` gave 1.025 / 0.537 em for Vazirmatn, 1.025 / 0.500 em for Estedad and 0.952 / 0.474 em for the UI build. So Chromium on Linux honours USE_TYPO_METRICS.

### M2. Glyph ink extents (em above / below the baseline)

| | Vazirmatn (outline; canvas in brackets) | Estedad (canvas) |
|---|---|---|
| Tallest, up | «أ» 0.878 (0.891) · «گ» 0.795 (0.797) · «آ» 0.784 (0.797) · «ف» 0.739 (0.750) · «ا ک ل ط» (0.688) · Persian digits (0.657–0.672) | «أ» 0.900 · «ف» 0.820 · «گ» 0.781 · «آ» 0.773 · «غ» 0.744 · «ا» 0.657 · digits 0.657–0.672 |
| Deepest, down | «ع ج» 0.337 (0.344) · «پ» 0.317 (0.329) · «م» 0.311 (0.313) · «ر» 0.263 · «ی» 0.247 | «ع غ» 0.407 · «پ» 0.403 · «م» 0.360 · «ج چ ح خ» 0.344 · «ر و» 0.266 · «ی» 0.235 |
| Persian letter bodies (tops) | «س» 0.346 · «م» 0.350 · «و» 0.357 · «ی» 0.374 · «ر» 0.266 | «س» 0.313 · «م» 0.360 · «و» 0.375 · «ی» 0.407 · «ر» 0.282 |
| Latin (same font) | H 0.711 · x 0.528 · g below 0.219 | H 0.655 · x 0.489 · g below 0.235 |

### M3. Clipping under `overflow: hidden`

Values are ink outside the line box, in px, above / below, at DPR 2, in Chromium 153.

**Ordinary text:** S1 «پژو ۲۰۶ تیپ ۲ بدون رنگ، کارکرد ۴۵ هزار کیلومتر» and S2 «گ ژ ی ؛ ؟». `·` means less than 0.5 px (one device pixel at DPR 2; antialiasing only).

| Font, weight | Size | lh 1 | lh 1.1 | lh 1.2 | lh 1.25 | lh 1.3 | lh 1.4 | lh 1.5 | lh 1.6 |
|---|---|---|---|---|---|---|---|---|---|
| Vazirmatn 400 | 12 | 0.5/1.0 | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 14 | 1.0/0.5 | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 16 | 1.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 20 | 1.0/1.5 | ·/0.5 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 28 | 1.0/2.0 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 12 | 1.0/1.0 | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 14 | 1.5/0.5 | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 16 | 2.0/· | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 20 | 1.0/1.5 | ·/0.5 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 28 | 1.5/2.0 | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 12 | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 14 | 1.0/0.5 | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 16 | 1.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 20 | 1.0/1.5 | ·/0.5 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 28 | 1.0/2.0 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 12 | ·/1.0 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 14 | 1.0/1.5 | ·/1.1 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 16 | 0.5/2.0 | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 20 | ·/2.0 | ·/1.0 | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 28 | ·/3.5 | ·/1.7 | ·/0.9 | ·/0.5 | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 12 | 1.0/1.5 | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 14 | 1.5/1.5 | 0.5/1.1 | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 16 | 1.5/2.0 | 1.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 20 | 1.5/3.0 | 0.5/2.0 | ·/1.0 | ·/1.0 | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 28 | 3.0/4.0 | 2.0/2.2 | ·/1.4 | ·/1.0 | ·/· | ·/· | ·/· | ·/· |

**Stress text:** S3 «تأیید آگهی؛ پراید غ» (hamza-alef, madda, gaf, ain/ghain, peh).

| Font, weight | Size | lh 1 | lh 1.1 | lh 1.2 | lh 1.25 | lh 1.3 | lh 1.4 | lh 1.5 | lh 1.6 |
|---|---|---|---|---|---|---|---|---|---|
| Vazirmatn 400 | 12 | 1.5/1.0 | 1.5/· | 0.5/· | 0.5/· | 0.5/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 14 | 2.5/1.0 | 2.5/· | 1.5/· | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· |
| Vazirmatn 400 | 16 | 3.0/0.5 | 2.0/· | 1.0/· | 1.0/· | 1.0/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 20 | 2.5/2.0 | 1.5/1.0 | 0.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 400 | 28 | 3.5/2.5 | 2.5/0.7 | 1.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 12 | 2.0/1.0 | 2.0/· | 1.0/· | 1.0/· | 1.0/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 14 | 2.5/1.0 | 2.5/· | 1.5/· | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· |
| Vazirmatn 700 | 16 | 3.0/0.5 | 2.0/· | 1.0/· | 1.0/· | 1.0/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 20 | 2.5/2.0 | 1.5/1.0 | 0.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn 700 | 28 | 4.0/2.5 | 3.0/0.7 | 2.0/· | 1.0/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 12 | 2.5/· | 1.5/· | 1.5/· | 0.5/· | 0.5/· | 0.5/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 14 | 2.5/1.0 | 2.5/· | 1.5/· | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 16 | 3.0/0.5 | 2.0/· | 1.0/· | 1.0/· | 1.0/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 20 | 2.5/2.0 | 1.5/1.0 | 0.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Vazirmatn UI NL 400 | 28 | 3.5/2.5 | 2.5/0.7 | 1.5/· | 0.5/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 12 | 2.0/2.0 | 2.0/0.8 | 1.0/0.6 | 1.0/· | 1.0/· | ·/· | ·/· | ·/· |
| Estedad 400 | 14 | 2.0/1.5 | 1.0/1.1 | 1.0/· | ·/· | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 16 | 2.5/2.5 | 2.5/0.9 | 1.5/· | 0.5/0.5 | 0.5/· | ·/· | ·/· | ·/· |
| Estedad 400 | 20 | 3.0/3.0 | 2.0/2.0 | 1.0/1.0 | ·/1.0 | ·/· | ·/· | ·/· | ·/· |
| Estedad 400 | 28 | 4.0/4.0 | 3.0/2.2 | 1.0/1.4 | ·/1.0 | ·/· | ·/· | ·/· | ·/· |
| Estedad 700 | 12 | 2.5/2.0 | 2.5/0.8 | 1.5/0.6 | 1.5/· | 1.5/· | 0.5/· | ·/· | ·/· |
| Estedad 700 | 14 | 2.5/1.5 | 1.5/1.1 | 1.5/· | 0.5/· | 0.5/· | ·/· | ·/· | ·/· |
| Estedad 700 | 16 | 3.0/2.5 | 3.0/0.9 | 2.0/· | 1.0/0.5 | 1.0/· | ·/· | ·/· | ·/· |
| Estedad 700 | 20 | 4.0/3.0 | 3.0/2.0 | 2.0/1.0 | 1.0/1.0 | 1.0/· | ·/· | ·/· | ·/· |
| Estedad 700 | 28 | 5.5/4.5 | 4.5/2.7 | 2.5/1.9 | 1.5/1.5 | 1.5/· | ·/· | ·/· | ·/· |

Line heights 1.7, 1.8 and 1.9 were also tested; no ink was outside the box in any case. The smallest line height with no clipping from that value upward:

| Text | Vazirmatn 400 | Vazirmatn 700 | Estedad 400 | Estedad 700 |
|---|---|---|---|---|
| Ordinary | 1.1–1.2 | 1.2–1.3 | 1.1–1.3 | 1.2–1.3 |
| Stress | 1.3–1.5 | 1.3–1.5 | 1.25–1.4 | 1.4–1.5 |

### M4. Persian line height with the same white space as Latin (same font, same size)

| Size | Latin reference | Latin mean white band | Vazirmatn equivalent (text A / text B) | Estedad equivalent (text A / text B) |
|---|---|---|---|---|
| 12 px | 16/12 = 1.333 | 4.5 px | 1.46 | 1.48 |
| 14 px | 20/14 = 1.429 | 6.4–6.5 px | 1.52 / 1.52 | 1.60 / 1.52 |
| 16 px | 24/16 = 1.500 | 9.4–9.6 px | **1.61 / 1.61** | **1.72 / 1.69** |
| 20 px | 28/20 = 1.400 (Tailwind) | 9.4–10.1 px | 1.51 | 1.61 |
| 24 px | 32/24 = 1.333 | 10.0–10.9 px | 1.45 / 1.46 | 1.56 / 1.54 |
| 28 px | 36/28 = 1.286 | 10.3–11.1 px | 1.41 | 1.50 |
| 32 px | 40/32 = 1.250 | 10.5–11.8 px | 1.38 | 1.48 |

- Text A is a Peugeot 206 description; text B is a Kia Cerato description.
- Raw white bands at 16 px:

  | Text | Line height | Mean white band |
  |---|---|---|
  | Vazirmatn | 1.4 / 1.5 / 1.6 / 1.7 / 1.8 / 2.0 | 6.0 / 7.5 / 9.0 / 10.8 / 12.3 / 15.5 px |
  | Estedad | same values | 4.5 / 6.3 / 7.8 / 9.5 / 11.0 / 14.3 px |
  | Latin (Roboto in Vazirmatn) | 1.5 | 9.4 px |

### M5. Label position in fixed-height, flex-centred boxes

| Font | Label size / box height | Ink-centre offset at lh 1.5, over 8 labels | Change per label across lh 1.0–1.8 | Top / bottom gap, «جستجو» and «مشاهده آگهی» |
|---|---|---|---|---|
| Vazirmatn 500 | 16 px / 48 px | −2.25 … +0.50 | ≤ 0 px | 18/17 and 14.5/17 |
| Vazirmatn 500 | 14 px / 44 px | −1.75 … +1.00 | ≤ 1 px | 17.5/15.5 and 14/15.5 |
| Vazirmatn 500 | 12 px / 28 px | −1.00 … +1.25 | ≤ 1 px | 10.5/8 and 7.5/8 |
| Vazirmatn UI NL 400 | 16 px / 48 px | −2.25 … +0.75 | ≤ 0 px | 18.5/17 and 14.5/17 |
| Estedad 500 | 16 px / 48 px | −1.25 … +1.50 | ≤ 1 px | 19/16 and 15.5/15.5 |
| Estedad 500 | 14 px / 44 px | −0.25 … +1.75 | ≤ 1 px | 18/14.5 and 15/14 |
| Estedad 500 | 12 px / 28 px | −1.25 … +1.25 | ≤ 1 px | 10.5/8 and 7/7.5 |

- Positive offsets mean the ink sits low.
- The labels were «جستجو», «مشاهده آگهی», «تماس با فروشنده», «ذخیره جستجو», «معامله‌ی عالی», «خیلی گران», «۱۲ آگهی» and «تأیید». «تأیید» sits highest because of its hamza.
- The same label «مشاهده آگهی» in fallback fonts (16 px, 48 px box, top / bottom gap): Noto Naskh Arabic 14.0/16.5, Naskh UI 16.0/15.5, Noto Sans Arabic 16.0/15.5.

### M6. `text-box` in Chromium 153 (all `CSS.supports` checks true)

| Case | Box height | Ink above box | Ink below box |
|---|---|---|---|
| 28 px 700 Vazirmatn heading, lh 1.4, `none` | 39.19 px | none (7 px gap) | none |
| same, `trim-both cap alphabetic` | 22.39 px | −3 to +3 px | **7.1–8.6 px** |
| same, `trim-both ex alphabetic` | 14.80 px | 4–10 px | 7.7–9.2 px |
| same, `trim-both text` | **44.00 px** (grows) | none | none |
| 28 px Estedad heading, `trim-both cap alphabetic` | 18.34 px | 2–8.5 px | **7.2–10.7 px** |
| 16 px 500 button, padding 12 px, «جستجو», Vazirmatn, `none` | 48 px | gap 18 | gap 17 |
| same, `trim-both cap alphabetic` | 36.8 px | gap 16 | gap **7.8** (label looks low) |

- With `ascent-override: 92%; descent-override: 47%` on Vazirmatn, `trim-both text` gave a 39 px box and no ink outside it. Estedad with the same overrides left 0.5 px of «أ» outside.

### M7. Tabular figures at 16 px (width in px, normal → `tabular-nums`)

| Text | Vazirmatn | Estedad |
|---|---|---|
| «۱۱۱۱۱۱» | 30 → 66 (+120 %) | 30 → 72 (+140 %) |
| «۸۸۸۸۸۸» | 54 → 66 (+22 %) | 60 → 72 (+20 %) |
| «۱۲۵٬۰۰۰٬۰۰۰» | 72 → 107 (+49 %) | 77 → 132 (+71 %) |
| «۹۸۷٬۵۴۰٬۰۰۰» | 80 → 107 (+34 %) | 87 → 132 (+52 %) |
| "111111" | 54 → 54 (already tabular) | 42 → 72 (+71 %) |

- Advance widths in font units (fontTools):
  - Vazirmatn Persian digits range 591–1349; `tnum` maps all ten to 1349. Its Latin digits are all 1151.
  - Estedad Persian digits range 319–708; `tnum` maps all ten to 740.
- `tnum` is registered under `arab/dflt` in both fonts. Neither font has a `FAR` language system.

### M8. Link underline at 16 px, line height 1.7, «پیکان ۱۶۰۰ و پژو پارس»

| Style | Vazirmatn: underline position / share drawn | Estedad: underline position / share drawn |
|---|---|---|
| default (skip-ink auto) | +1 to 1.5 px / 46 % | +1 to 1.5 px / 49 % |
| `text-underline-offset: 0.3em; thickness: 1px` | +5 to 5.5 px / 100 % | +5 to 5.5 px / 91 % |
| `text-underline-offset: 0.45em; thickness: 1px` | +7 to 7.5 px / 100 % | +7 to 7.5 px / 100 % |
| `text-decoration-skip-ink: none` | +1 to 1.5 px / 94 % (crosses dots) | +1 to 1.5 px / 95 % |

Positions are below the baseline. The deepest ink is +5.0 px in Vazirmatn and +6.0 px in Estedad.

### M9. `line-height: normal` against a number

- **One line at 16 px:**
  - With `normal`: Vazirmatn 25 px, Vazirmatn UI 23 px, Estedad 24 px.
  - With 1.6: 25.59 px in all three.
  - Adding an emoji or a Latin fallback glyph did not grow the Chromium line box.
- **Two-line paragraph, 380 px wide, 16 px:**

  | Font | `normal` | 1.7 |
  |---|---|---|
  | Vazirmatn | 50 px | 54.4 px |
  | Estedad | 48 px | 54.4 px |
  | Noto Naskh Arabic | 54 px | 54.4 px |
  | Noto Naskh Arabic UI | 44 px | 54.4 px |
  | Noto Sans Arabic (wraps to 3 lines) | 102 px | 81.6 px |

- **`font` shorthand:** `font: 400 16px X` reset an inherited `line-height: 1.7` to `normal` and `tabular-nums` to `normal` (verified with `getComputedStyle`).

### M10. Justification (16 px Vazirmatn and Estedad, line height 1.7)

| Column | Font | Normal space | Largest gap, start-aligned | Largest gap, justified |
|---|---|---|---|---|
| 300 px | Vazirmatn | 4 px | 8 px | 11.1 px (2.8×) |
| 300 px | Estedad | 3 px | 7 px | 9.2 px (3.1×) |
| 380 px | Vazirmatn | 4 px | 8 px | 10.1 px (2.5×) |
| 380 px | Estedad | 3 px | 7 px | 11.0 px (3.7×) |

- No kashida was inserted.
- `text-justify: inter-character` is supported (`CSS.supports`) and looked the same as `justify` on Persian (`shot-justify.png`).

### M11. Alpha colour and connected letters (40 px «کارشناسی بیمه‌ی شخص ثالث»)

| Style | Minimum luminance | Pixels darker than the intended 50 % grey |
|---|---|---|
| `color: rgb(0 0 0 / .5)`, Vazirmatn | 63 | 182 |
| `color: rgb(0 0 0 / .5)`, Estedad | 63 | 64 |
| `opacity: .5` | 126 | 0 |
| solid `#808080` | 128 | 0 |

### M12. `lang` and quotation marks (screenshots `shot-quote-*.png`)

- `<q>` under `lang="fa"` renders «قیمت منصفانه».
- Under `lang="ar"` it renders ”سعر عادل“.
- Computed `quotes` is `auto` in both cases.
- Noto Naskh Arabic's `FAR` `locl` lookups replace ۴, ۶, ۷, ٫, ٬, « and » with Persian-specific glyphs.

### M13. Alef stem width (static TTFs)

| Weight | Vazirmatn (em / px at 12) | Estedad (em / px at 12) |
|---|---|---|
| 100 | 0.025 / 0.30 | 0.029 / 0.35 |
| 200 | 0.054 / 0.64 | 0.047 / 0.56 |
| 300 | 0.068 / 0.82 | 0.066 / 0.79 |
| 400 | 0.083 / 0.99 | 0.084 / 1.01 |
| 500 | 0.104 / 1.25 | 0.102 / 1.22 |
| 600 | 0.113 / 1.36 | 0.120 / 1.44 |
| 700 | 0.122 / 1.46 | 0.139 / 1.67 |

### M14. Measure at 16 px (347-character Persian and 381-character English description)

| Text, font | em per character | Characters per 380 px line | 45 / 65 / 75 characters in em |
|---|---|---|---|
| Persian, Vazirmatn | 0.431 | 55 (10.6 words) | 19.4 / 28.0 / 32.3 |
| Persian, Estedad | 0.441 | 54 (10.4 words) | 19.8 / 28.6 / 33.1 |
| English, Vazirmatn | 0.429 | 55 | — |
| English, Estedad | 0.421 | 56 | — |

- Persian averages 5.18 characters per word including the space; English 5.69.
- `ch` is 0.562 em in Vazirmatn and 0.59 em in Estedad, so 65ch is about 85–87 Persian characters.

### M15. Latin trim codes in a mixed line (32 px)

- With one face, «SD» cap height is 23 px next to «آلفا» (25 px ink above the baseline, madda included).
- With a Latin `unicode-range` face at `size-adjust: 90%`, «SD» drops to 21 px and the Persian is unchanged.

### M16. Inputs

In a 44 px `<input>` at 16 px, the stress string lost no ink at line heights 1, 1.2, 1.5 or `normal`, in both fonts (Chromium; WebKit not tested).

### M17. Chromium baseline rounding

- In all 600 cases, the baseline offset from the top of the line box was a whole pixel.
- Against the ideal half-leading position, text sat higher in 81 % of cases.
- The mean deviation was 0.54 px; the largest was 1.32 px (Vazirmatn 14 px at 1.7, and 16 px at 1.3).
