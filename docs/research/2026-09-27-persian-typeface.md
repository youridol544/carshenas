# Which commercial Persian typeface should Carshenas buy, how may it be used, and how does it load?

- Date: 2026-09-27
- Asked by / for: CS-3. The owner asked for "the best font choice" on fontiran.com: standard, beautiful, suiting the product, with "all weights", "also for numbers", checked across every font, and "how many fonts I need to buy". A demo, so no company licence. The owner decided on 2026-09-26 against Vazirmatn.
- Outcome: the owner bought Yekan Bakh 4 («حرفه‌ای» package) the same day. ADR-0015 (proposed) covers the choice and the handling; `docs/design/design-language.md` holds the measured type roles; `docs/runbooks/licensed-font.md` explains how a machine gets the file.

## Questions

1. Which of Fontiran's fonts suit a Farsi, phone-first, number-heavy product interface, and which one is best?
2. What does the owner need to buy: which package, which licence, and how many families?
3. What does the licence allow: self-hosting, modifying (subsetting, metric patches), and committing to a repository?
4. How does the bought font measure: vertical metrics, line heights per role, clipping, centring, stems, digits and coverage?
5. Swap or optional: which loading strategy, by measured layout shift?

## Method

- **The catalogue.**
  - **Pages visited.** In the repository's pinned Playwright (headless Chromium), every font page under Fontiran's category menu and sitemap, sequentially, a few seconds apart, never logged in.
  - **robots.txt.** It allows `/fonts/<slug>` and disallows `/fonts/generate-font-lab`, which each font page's own script calls to render its specimen. After the first pages, that request was blocked in the browser, so later pages caused no server-side rendering.
  - **The type tester.** The custom-text tester needs a login and renders through the same disallowed path, so it was not used.
  - **What was recorded per page.** Designer, version, update date, weights, variable axes, languages, Persian digits, packages and prices from the page's JSON-LD, the personal web-licence price, and the package contents.
- **The contenders.** The specimen galleries of six fonts were downloaded as static images into a scratch folder, not the repository, and viewed as contact sheets.
- **What the market uses.** One polite GET each of torob.com and divar.ir, reading their CSS.
- **The bought font.**
  - **The files.** `fontTools` (name table, metrics, features, cmap, `tnum` coverage) on the delivered TTF and WOFF2, plus a scan of every package file for the buyer's details.
  - **The CS-26 lab.** `docs/research/2026-09-26-ui-craft-details/lab/`, now able to measure one font alone (`LAB_FONTS=yekanBakh`) through an ignored symlink to the app's copy.
  - **Layout shift.** `lab/font-display-cls.mjs` beside this note, on the production build with the font response delayed.

## Sources

Fontiran (fontiran.com), read 2026-09-27:
- `/robots.txt`, `/sitemap.xml` and `/pages_sitemap.xml` (140 font pages).
- `/fonts` and its category menu: text fonts in naskh, sans, geometric and handwritten; title fonts in naskh, geometric and handwritten.
- The page of each of the 41 text fonts and the 14 fonts outside the menu.
- `/about-licenses` (licence types and the rules for web use), `/faq` (licence questions 1 to 19), and `/tutorials/license-guide` (an interactive guide, not used).
- In the delivered package: «قوانین استفاده از فونت» (License Help.pdf), «شرایط استفاده و مسئولیت کاربر», and «راهنمای کار با فونت، نسخهٔ ۴» (Yekan Bakh 4 Help.pdf).

Other sources:
- torob.com and divar.ir home pages and their CSS, 2026-09-27.
- The measurement labs, with results in the findings.

## Findings

### 1. The catalogue: 140 fonts, 41 text faces, 6 real contenders

- **Title fonts (73)** set headlines. Most have one to four weights and no small-size design.
- **Handwritten text fonts (12)** are brush and script styles.
- **Fonts outside the menu (14)** are single-weight display or handwriting faces, or the retired "Iran" family.
- None of these can carry a data interface.
- **Naskh text faces (18)** are editorial. Samarqand, Abar, Shazde and On carry a UI tag, but they are calligraphic at small sizes, and most have no Latin.
- **Sans and geometric text faces (23).** Those without Latin (Bon, Noora, Ekraan, Lahzeh), display or advertising faces (Kamand, Shoor, Narengi, Morabba, Rokh, Kalameh, Modam, Emkan), and faces with too few weights (Kook, Tajrid) drop out.
- **What remains:**

| Font | Designer | Weights | Variable | Latin | Last update | Full package | Personal web licence |
|---|---|---|---|---|---|---|---|
| **Yekan Bakh 4** | Reza Bakhtiarifard, Mahan Jafarzadeh | 8, and 7 widths | weight (width in Pro+) | redrawn 2024, 60 languages | 2026-04-18 | 698,000 T | 400,000 T |
| IRANSans X | Moslem Ebrahimi | 11 | weight, dots | yes | 2026-07-21 | 698,000 T | 350,000 T |
| Peyda | Seyed Naser Khadem | 10 | weight | yes | 2025-08-16 | 698,000 T | 350,000 T |
| IRANYekan X | Moslem Ebrahimi | 11 | weight, dots | yes | 2022-11-20 | 698,000 T | 350,000 T |
| Dana | Moslem Ebrahimi, Shahrzad Akbari | 13 | weight, kashida | yes | 2022-11-23 | 698,000 T | 350,000 T |
| Ravi | Reza Bakhtiarifard | 8 | weight | yes | 2026-04-11 | 698,000 T | 350,000 T |
| Ravagh, Anjoman, Pelak | (three more UI faces) | 8, 13, 8 | yes, yes, no | yes, not listed, yes | 2026-06-14, 2022-11-23, 2022-11-25 | 698,000 / 798,000 / 598,000 T | 350,000 / 400,000 / 300,000 T |

### 2. Why Yekan Bakh

- **A screen face.** Its page calls it "simple, neutral, made for pixel space". Its forms are simplified almost to monoline, with the stroke contrast corrected optically, which suits a calm judge of prices.
- **Numbers.** The gallery shows crisp digits and an optional open zero (stylistic set 6). The 2026 help file shows proportional and tabular digits, with tabular digits keeping their width across weights.
- **Latin.** It was redrawn in 2024 to match the Persian, and supports 60 languages. It is the best Latin of the contenders, which matters for trim codes and VINs inside Persian titles.
- **Maintained.** Version 4 was released on 2026-04-18.
- **Distinct.** Divar sets its interface in IRANSans (its CSS, 2026-09-27), and Torob uses Noto Sans Arabic with Montserrat. IRANSans X was the closest runner-up and the market's standard, but a site that shows Divar's listings should not look like Divar.
- **How many to buy.** One family covers Persian, Latin and numbers. The «حرفه‌ای» package (698,000 tomans) is the smallest with weight 500 and the variable file; the cheaper ones lack both.

### 3. The licence

**The rules.**
- **Terms in the package.** Buying grants no right to copy, distribute or modify the files; copies are allowed only as backups.
- **Two conditions for use.** The buyer bought the files personally, and a licence matching the use was issued.
- **Web and app use.** These put the file in a project and on a server, so they need a licence registered per site. Using the file only on one's own computer needs none.
- **Sharing.** The FAQ (question 16) forbids sharing the file, even with a friend.
- **Licence prices** (Yekan Bakh, 2026-09-27):

  | Licence | Price |
  |---|---|
  | «وبسایت یا نرم‌افزار شخصی», for a personal or self-employed project | 400,000 T |
  | «وبسایت یا نرم‌افزار شرکتی» | 1,200,000 T |

- **A free licence?** FAQ questions 9 and 10 say a non-commercial project can register a free licence after buying the font; the buy box does not show one.
- **The licence notice.** In CSS "where technically possible"; `next/font` generates the rule, so it is left out.

**The package.** It is "prepared for you" and identifies the buyer ("این اطلاعات صرفاً برای شناسایی مالک فایل‌ها و جلوگیری از انتشار غیرمجاز استفاده می‌شود"). The files checked carry no readable buyer data:
- The TTF name table has no personal data.
- The WOFF2 decompresses to identical name, OS/2, hhea and cmap tables.
- There is no WOFF metadata or private block.
- No email address appears in any file, in ASCII or UTF-16.

**Consequences for the code.**
- The file is served unmodified.
- It is never committed: a private repository shared with reviewers still shares the file.
- Anything public, CI artifacts included, must not carry it.

### 4. Yekan Bakh measured

- **Coverage.** Persian and Arabic-Indic digits, «٬» «٫» «٪», «» ، ؛ ؟, ZWNJ, ZWJ, LRM, RLM, NBSP, the minus sign U+2212, ی and ک in both forms, and the hamza above. The isolate controls U+2066 to U+2069 have no glyphs, as expected for invisible characters.
- **Features.** `tnum` covers the Persian digits.
  - Other features: `kern`, `mark`, `mkmk`, `curs`, `rlig`, `init`, `medi`, `fina`, `ccmp`, `locl`, `frac`, `sups`, `subs`, `ordn`, `zero`, `case`, `salt`, `swsh`, and `ss01` to `ss07` except `ss04`.
  - The stylistic sets are Farsi numbers, kaf swash, reversed yeh, riyal and dirham, toman and rial, and vertical alignment.
- **Metrics.** hhea, typo and win are equal: ascent 1000, descent −550, line gap 0, `USE_TYPO_METRICS` on, unitsPerEm 1000. The head box runs from −610 to 969; the x-height is 450 and the cap height 612.
- **The CS-26 lab** (Chromium 153):
  - **Latin-equivalent line heights:**

    | Size | 12 px | 14 px | 16 px | 20 px | 24 px | 28 px | 32 px |
    |---|---|---|---|---|---|---|---|
    | Line height | 1.55 | 1.59 | 1.73 | 1.60 | 1.49 | 1.49 | 1.45 |

    Yekan Bakh needs more than Vazirmatn (1.61 at 16 px), close to Estedad (1.69 to 1.72).
  - **Clipping.** No ink is clipped from line height 1.4. At 1.2, 0.5 to 1 px is clipped at the top in weights 400 and 700; at 1.3, 0.5 px at 16 px only.
  - **Centring.** At every line height, the ink sits between 2 px high («تأیید») and 1 px low («جستجو») in a flex-centred box.
  - **Trimming.** `trim-both cap alphabetic` leaves 10.4 px of a 28 px heading's ink below the box; never on Persian.
  - **Stems (alef):**

    | Weight | 400 | 500 | 600 | 700 |
    |---|---|---|---|---|
    | Share of the font size | 8.23 % | 9.42 % | 10.64 % | 12.62 % |

- **Separators.** «٬» renders as a comma. The help file's own Persian examples use it.

### 5. Loading: swap, measured

Production build, Pixel 7 profile, the font response delayed by 0, 300 or 1,500 ms:

| Page | swap, 0 ms | swap, 300 ms | swap, 1,500 ms | optional, any delay |
|---|---|---|---|---|
| `/design` | 0 | 0 | 0.0332 | 0 |
| `/` | 0 | 0 | 0.0036 | 0 |
| 404 | 0 | 0 | 0.0002 | 0 |

- **The cost of `optional`.** When the font missed its window, the fallback stayed for the rest of the visit: after a client-side navigation, the same text was 197.4 px wide against 213.0 px in Yekan Bakh. With `swap`, the worst case measured is well under the 0.1 of a good CLS, and the brand font always arrives.

## Recommendation

- **What to buy.** One family, Yekan Bakh 4, «حرفه‌ای» package (698,000 tomans). Before the demo is public, add the «وبسایت یا نرم‌افزار شخصی» licence (400,000 tomans), or a free non-commercial one if the account panel offers it.
- **How to load it.** Only `YekanBakh-VF.woff2`, through `next/font/local`, with `display: 'swap'`, preload, and no automatic Latin fallback metrics.
- **How to handle the file.** Never commit it or change it.
- **What follows from the measurements.** Line heights per role follow section 4: body 1.75, secondary 1.6, heading 1.6, title 1.5, display 1.3, one-line and clamped text 1.5, never below 1.4.

Written up in ADR-0015 and `docs/design/design-language.md`.
