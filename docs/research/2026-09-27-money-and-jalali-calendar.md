# How Carshenas stores and shows money, and which Jalali calendar it can trust

- Date: 2026-09-27
- Asked by / for: task CS-2 (the owner: "go for toman", readable amounts "the way native users expect to see them like in Divar", and a Jalali calendar "reliable for production grade code" that later visit-slot booking for native listings can rely on, offloaded rather than maintained by us)
- Outcome: ADR-0014 (proposed); a catalog check in `schema-catalog.test.ts` that holds every amount column to `bigint` whole tomans with a range CHECK; this note's lab (`2026-09-27-money-and-jalali-calendar/lab/`), which pins eight Jalali implementations against the astronomical calendar

## Questions

1. Storage: the owner chose the toman. Which integer type, what is the largest plausible car price now and after years of inflation, and what range keeps every amount exact in PostgreSQL and in JavaScript, given that `parseInt8` in `apps/web/src/server/db/database.ts` throws on a `bigint` above 2^53 − 1?
2. The law that removes four zeros from the rial: what is its status on 2026-09-27, what is the new unit called, and how do stored tomans stay unambiguous across it?
3. How do Iranian car sites, Divar first, show a price: full digits or «میلیارد / میلیون» words, which separator, where the unit goes, how negotiable and installment prices read, and how filters and charts abbreviate amounts?
4. What does the platform's `Intl` produce for `fa-IR` amounts (grouping, compact notation) on Node and Chromium, and where does it mislead?
5. Which Jalali implementation is correct and production-grade: the platform's `Intl` (ICU), `Temporal`, `@internationalized/date`, `jalaali-js`, `date-fns-jalali`, or a web service? How accurate is each against the astronomical calendar Iran uses, who maintains it, and do the server and the browser agree?
6. What does booking visit slots need beyond converting dates: the `Asia/Tehran` time-zone rules, official holidays (the lunar ones depend on moon sighting), and a reliable source for them?
7. How are model years stored in both calendars, and how does a year stated in one calendar compare with the other for search and valuation?

## Method

- **Lab** (`2026-09-27-money-and-jalali-calendar/lab/`, rerun instructions in its README), on 2026-09-27:
  - `jalali-accuracy.mjs` checks seven libraries, the runtime's `Intl` and native `Temporal` in both directions. It runs on Node 22.14.0 (ICU 76.1) and Node 26.10.0 (ICU 78.3), for 1206 to 1501 SH and again for 1206 to 1800. The reference is the Calendar Center's published leap list for 1206 to 1498 [C3, C4]; beyond it, the Center's rule applies: the March equinox from astronomy-engine, compared with true noon at 52.5° E.
  - `platform-check.mjs` runs the same probe in Node and in the repository's pinned Chromium 153.
- **Database checks**, run by hand:
  - PostgreSQL 18.6 in the Compose container (`pnpm db:psql`) for time zones and aggregate types.
  - PGlite (PostgreSQL 18.3) for how CHECKs print and for whether a domain column rewrites a table.
- **Separators in real fonts.** Chromium rendered the separators and the three amount forms in Vazirmatn 33.003 and Estedad 8.5 (scratch screenshot, described in finding 3.4).
- **Two research passes on the web.**
  - **Currency and price display.** One GET per page, on robots-allowed paths only; zero calls to Divar's API.
  - **Calendar libraries, the official calendar and holidays.**
  - **Separator evidence.** Separators were settled byte by byte from public captures of the sites' JSON on GitHub, because the page summariser misreports them.

## Sources

Currency law and prices (published date; accessed 2026-09-27):

- [A1] Tehran Times, 2025-10-05, <https://www.tehrantimes.com/news/518711/Parliament-approves-plan-to-remove-4-zeros-from-national-currency>. State-affiliated daily; vote counts and the law's terms.
- [A2] Entekhab, 2025-10-05, <https://www.entekhab.ir/fa/news/888204/>. The Majlis vote and an MP's statement that the unit stays the rial.
- [A3] Mehr News Agency, 2025-11-08, <https://www.mehrnews.com/news/6648527/>. The Guardian Council spokesman confirms approval.
- [A5] Iran International, 2025-11-22, <https://www.iranintl.com/en/202511224715>. Independent of Tehran; promulgation and the two-year preparation.
- [A6] Shahrebours, 2025-11-22, <https://shahrebours.com/قانون-حذف-4-صفر-از-پول-ملی-ابلاغ-شد؛-جزئی/>. Secondary; the notified text with its dates.
- [A8] Tabnak, 2025-12-24, <https://www.tabnak.ir/fa/news/1347722/>. The 1405 budget drafted in new rials; deadline for the regulation.
- [A10] IRIB News, 2026-02-23, <https://www.irib-news.ir/fa/news/5725514/>. State agency quoting the Central Bank on the transition rules.
- [A11] Young Journalists Club, 2026-02-24, <https://www.yjc.ir/fa/news/9058779/>. Expected transition start, Azar 1406.
- [A13] Asriran, 2025-12-27, <https://www.asriran.com/fa/news/1127403/>; [A14] Faradeed, 2026-09-22, <https://faradeed.ir/بخش-مجله-تاریخ-39/316837->. Commentary that people will keep saying toman.
- [A15] Wikipedia, "Iranian toman", <https://en.wikipedia.org/wiki/Iranian_toman>. Tertiary; the 1932 precedent.
- [A17] Euronews, 2026-09-02, <https://www.euronews.com/business/2026/09/02/iranian-rial-hits-record-low-as-us-dollar-breaks-22-million-mark>. The rate of about 220,000 tomans to the dollar; still calls the reform "replace the rial with the toman".
- [B1] Carna, 2026-09-27, <https://carna.ir/fa/news/26187/>. An ad at 400 billion tomans.
- [B3] Eghtesad Online, 2026-07-09, <https://www.eghtesadonline.com/fa/news/2149585/>. BMW 735i M Package 2026 at 90 and 115 billion tomans.
- [B5] Nabz-e Gheymat, 2026-09-27, <https://nabzgheymat.ir/قیمت-محصولات-ایران-خودرو-یکشنبه-۵-مهر-۱/>; [B6] Vana News, 2026-09-27, <https://vananews.com/fa/news/667115/>; [B7] Eghtesad Online, 2026-09-26, <https://www.eghtesadonline.com/fa/news/2165338/>. Daily market prices, written in words.
- [B8] Mehr News, 2026-09-26, <https://www.mehrnews.com/news/6959216/>; [B9] Tejarat News, 2026-09-27, <https://tejaratnews.com/تورم-ماهانه-شهریور-از-قله-فاصله-گرفت-ت>. Central Bank inflation for Shahrivar 1405.

Sites, captures and style (pages accessed 2026-09-27; captures dated as shown):

- [P2] <https://divar.ir/s/tehran/car>, [P3] <https://divar.ir/v/ام-وی-ام-ایکس-33-mvm-x33-مدل-1404-اقساط/ga4y9UPt>, [P4] <https://bama.ir/car>, [P6] <https://bama.ir/price>, [P15] <https://www.hamrah-mechanic.com/carprice/>, [P16] <https://www.hamrah-mechanic.com/carprice/audi/a3l/2025/2934/>, [P17] <https://www.sheypoor.com/s/tehran/car>, [P18] <https://torob.com/browse/94/گوشی-موبایل-mobile/>. One polite GET each; no block or challenge.
- [P19] Divar blog, 2020-11-09, <https://divar.news/most-expensive-cars-in-iran/>. Divar's own prose writes amounts in words.
- [G1] github.com/shojaee76-cmyk/divar-mcp, `tests/fixtures/search_response.json` and `detail_sale.json`, Divar API captures of 2026-09-21 and 2026-09-22. Raw bytes; the separator evidence.
- [G3] github.com/pejmanS21/drill, README and `src/main.rs`, 2026-09-24. Reports Divar's numeric price rounded through a 32-bit float.
- [G4] github.com/sobhanaz/khodrobin, `services/crawler/testdata/details/`, captures of 2026-09-06 to 09. Integer prices in Khodro45's and Hamrah Mechanic's page data; schema.org model years.
- [G5] github.com/avakof/bama_scraper, API fixtures of 2026-07-28. Bama's price types (`lumpsum`, `installment`, `negotiable`).
- [G6] github.com/Erfan-Sadegh/torobjan and github.com/elias-shahani2007/Torob_Crawling_project. Torob's «٫» grouping.
- [G7] github.com/melodiw82/divar-crawler-py, `json_data/car.json`, 2025-11-30. Divar's earlier separator.
- [G8] github.com/FarhamAghdasi/sheypoor-mcp, `document/search-api.md`, 2026-09-20. Sheypoor's price object and negotiable form.
- [G10] github.com/divar-ir/kenar-docs, Divar's official developer documentation (kenar.divar.dev itself answered 403), pushed 2026-09-26. Price as toman `uint64`; the `EVALUATION_ROW` widget.
- [N1] Tejarat News, 2022-07-27, <https://tejaratnews.com/بخش-خبر-آگهی-60/685555-بررسی-قابلیت-تخمین-قیمت-خودرو>; [N2] Donya-e-Eqtesad, 2022-09-27, <https://donya-e-eqtesad.com/بخش-وب-گردی-96/3885539->. Divar's used-car price estimator.
- [W1] Persian Wikipedia, «جدا کننده‌ی هزارگان», <https://fa.wikipedia.org/wiki/جدا_کننده‌ی_هزارگان>; [W2] «جداکننده اعشار», <https://fa.wikipedia.org/wiki/جداکننده_اعشار>. U+066C and U+066B under ISIRI 6219.
- [W3] Virastaran, «عددنویسی», <https://virastaran.net/a/v/s/sa/9861/>. Established Persian editing institute; mixed words and digits for large amounts.

Time and calendars:

- [T1] Jon Skeet, "Storing UTC is not a silver bullet", 2019-03-27, <https://codeblog.jonskeet.uk/2019/03/27/storing-utc-is-not-a-silver-bullet/>. The author of Noda Time; future local events need their local time and zone, because zone rules change (paraphrased; the page did not load for quoting).
- [C1] Law of 11 Farvardin 1304, Majlis Research Center, <https://rc.majlis.ir/fa/law/show/91067>. Official text: the year starts on the first day of spring, is the true solar year, and Esfand has 30 days in leap years.
- [C2] Calendar Center, Institute of Geophysics, University of Tehran, «هجری شمسی», archived 2024-11-10, <https://web.archive.org/web/20241110081937/https://calendar.ut.ac.ir/هجري-شمسي>. The authority itself: the equinox is compared with true noon at the official meridian, 52.5° E, and «کبیسه‌های تقویم هجری شمسی تثبیت شده نیستند». From outside Iran the live site answers with an ArvanCloud challenge, which we did not get around.
- [C3] Calendar Center, «Kabise Shamsi 1206-1498» PDF, <https://calendar.ut.ac.ir/documents/2139738/7092644/Kabise+Shamsi+1206-1498.pdf>. The official leap years. Its «اول فروردین» column is a day early in 144 of 293 rows of the linked copy; the leap markings are right.
- [C4] Roozbeh Pournader (author of ICU's Persian calendar), persiancalendar, `kabise.txt`, CC0, <https://github.com/roozbehp/persiancalendar>. A transcription of C3; the lab's `kabise-1206-1498.txt` is a copy.
- [C5] K. M. Borkowski, "The Persian calendar for 3000 years", Earth, Moon and Planets 74 (1996), <https://web.archive.org/web/20241203201237/http://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm>. Peer-reviewed basis of `jalaali-js`; calls 2124 "the nearest doubtful year".
- [C6] TC39, Intl era and monthCode proposal, Stage 4 draft of 2026-03-19, <https://tc39.es/proposal-intl-era-monthcode>. Normative: `persian` uses "leap years as published by the Iranian calendar authority for dates between 1206 AP and 1498 AP".
- [C7] ICU Jira ICU-8952 (fixed in ICU 50.1: the 2820-year rule "fails to match the official calendar as early as 2025 CE") and ICU-22736 (fixed in ICU 77.1, 2025-03-13: a correction table for years from 1502), <https://unicode-org.atlassian.net/browse/ICU-8952>, <https://unicode-org.atlassian.net/browse/ICU-22736>. Primary.
- [C8] ICU4X, `utils/calendrical_calculations/src/persian.rs`, <https://github.com/unicode-org/icu4x>. Primary code: the 33-year rule plus 78 correction years, "tested to match the modified astronomical algorithm based on the 52.5 degrees east meridian from 1178 AP … to 3000 AP". V8's and Firefox's `Temporal` use it.
- [C9] The 1403/1404 bug reports and fixes: adobe/react-spectrum PR #6118 (`@internationalized/date` 3.5.3, 2024-05-02); unicode-org/icu4x#4713 ("fails in exactly a year from now, on March 20, 2025"); alibaba-aero/jalaliday#41 (2024-04-16); plotly/plotly.js PR #7456. The maintainers' own statements.
- [C10] Temporal: TC39 notes of 2026-03-11 (Stage 4), <https://github.com/tc39/notes>; Chrome 144 release notes (2026-01-13), <https://developer.chrome.com/release-notes/144>; Node.js 26.0.0 (2026-05-05), <https://nodejs.org/en/blog/release/v26.0.0>; WebKit blog (2026-09-17), <https://webkit.org/blog/18325>. The vendors' own announcements.
- [C11] `temporal-polyfill` (FullCalendar), <https://github.com/fullcalendar/temporal-polyfill>, and `@js-temporal/polyfill`, <https://github.com/js-temporal/temporal-polyfill>. Primary code.
- [C12] IANA tz database, NEWS, <https://raw.githubusercontent.com/eggert/tz/main/NEWS>. Release 2022b: "Iran no longer observes DST after 2022"; the latest release is 2026d (2026-09-11), which only corrects 1979.
- [C13] PostgreSQL 18.2, 18.4 and 18.6 release notes, <https://www.postgresql.org/docs/release/18.6/>. The bundled tz data is updated in minor releases.
- [C14] The npm registry: versions and weekly downloads for 2026-09-19 to 25, and the package tarballs read. Primary.
- [C15] React Aria documentation, <https://react-aria.adobe.com/Calendar> and <https://react-aria.adobe.com/internationalized/date>, and react-aria-components 1.21.1's locale strings. Adobe's own documentation and code.
- [C16] StatCounter, Iran, mobile browsers, August 2026, <https://gs.statcounter.com>. A traffic sample, not a census.

Holidays:

- [H1] The 1378 amendment to the law on official holidays, Majlis Research Center, <https://rc.majlis.ir/fa/law/show/93217>. Official.
- [H2] Persian Wikipedia, «تعطیلات عمومی در ایران». Tertiary; the list and its amendments.
- [H3] Tasnim, 2026-03-01, <https://www.tasnimnews.ir/en/news/2026/03/01/3528137>. State-affiliated; the closure of 1 to 7 March 2026, declared the same day.
- [H4] vacanza/holidays, `holidays/countries/iran.py` (python-holidays 0.105, MIT, "add 2026 exact dates", 2026-09-01), <https://github.com/vacanza/holidays>. Primary code.
- [H5] persian-calendar/events, CC0, <https://github.com/persian-calendar/events>. Primary data.
- [H6] One request each to holidayapi.ir, api.persian-calendar.ir, pnldev.com/api/calender, Google Calendar's Iran feed and calendarific.com, on 2026-09-27.

## Findings

### 1. Storage: toman, `bigint`, and a bound below 10^15

1.1. Car prices in September 2026:
   - **The top.** The highest legitimate price found is a BMW 735i M Package 2026: «۹۰,۰۰۰,۰۰۰,۰۰۰ تومان» with 45-day delivery and «۱۱۵,۰۰۰,۰۰۰,۰۰۰ تومان» for immediate delivery [B3]. One ad asked «۴۰۰ میلیارد تومان» for a 2013 Bentley [B1].
   - **Common cars.** A Pride sells for 365 to 580 million, a Peugeot 206 for 680 to 715 million, a Dena Plus for 2.45 billion, and Chinese SUVs for 5.5 to 7.5 billion tomans [P2, P4, B5, B6, B7].
   - **Placeholders exist.** Divar shows prices such as «۱۰,۰۰۰ تومان» [P2, G1].

1.2. Inflation. The Central Bank puts Shahrivar 1405 at 83.8 % year on year and 68.4 % as the twelve-month average [B8, B9]; the dollar traded at about 220,000 tomans on 2026-09-02 [A17].

1.3. Headroom, by our arithmetic:
   - **PostgreSQL.** `integer` already fails, because a Tara at «۳,۱۳۰,۰۰۰,۰۰۰ تومان» exceeds 2,147,483,647. `bigint` reaches 9.22 × 10^18.
   - **JavaScript.** Numbers are exact to 2^53 − 1 = 9,007,199,254,740,991. `parseInt8` returns numbers and throws above that (checked in CS-4's lab), so a crawled absurdity above 2^53 would throw on every page that reads its row.
   - **The chosen bound.** 999,999,999,999,999 tomans is 2,500 times the 400-billion ad: 15.0 years at 68.4 % inflation and 12.9 years at 83.8 %. It is 8,700 times the BMW (17.4 and 14.9 years).
   - **The alternative, 2^53 − 1**, would add about 4 years at these rates, but it removes the room for sums: below 10^15, any nine amounts add up exactly.

1.4. How PostgreSQL behaves (PostgreSQL 18.6):
   - **Aggregates.** `sum(bigint)` and `avg(bigint)` return `numeric` (a string in the app) and `percentile_cont` returns `double precision`.
   - **Rounding.** `round(avg(x))` on four prices returned 1,320,000,000, and `percentile_disc` returns a member of the set.
   - **Domains rewrite.** PGlite (PostgreSQL 18.3) showed what a constrained domain costs. Adding a nullable `bigint` column with a named CHECK kept the table's file node (16388). Adding a column of a domain with a CHECK rewrote it (16397). The database review reproduced this: 2,275 ms on a million rows. A domain would also report `toman_range` without saying which column failed.
   - **An inline CHECK still scans.** It does not rewrite the table, but the database review measured 202 ms on a million rows under ACCESS EXCLUSIVE, against 1.1 ms for a bare column, and Squawk reports nothing. On a table with rows, add the column, then the CHECK `NOT VALID`, then `VALIDATE` it in a later migration.
   - **Prices that are not prices.** The CS-4 lab model required an amount for `installment` and `placeholder` prices. With a range CHECK, a placeholder of 0 or of 10^15 and above could not be stored at all. A switch to either type would also have been recorded as a price change. Placeholders now carry no amount, and an installment ad's figure goes into its own `down_payment_toman` (the data model's layer 3 has the constraints, tested on 13 rows).

1.5. How a range CHECK prints. PostgreSQL prints `CHECK (asking_price_toman BETWEEN 1 AND 999999999999999)` as `CHECK (((asking_price_toman >= 1) AND (asking_price_toman <= '999999999999999'::bigint)))`; that fixed form is what the catalog check matches.

### 2. The redenomination

2.1. The law:
   - **Vote.** Parliament resolved the Guardian Council's objections on 2025-10-05 (144 for, 108 against, 3 abstaining) [A1, A2].
   - **Approval and promulgation.** The Guardian Council approved it on 2025-11-05, and it was notified on 2025-11-22 [A3, A6].
   - **Terms.** The national currency stays «ریال»: "10,000 current rials will be equal to one new rial, which will be divided into 100 Qerans" [A1], with «واحد پول ملی ریال باقی می‌ماند» [A2]. So one new rial is 1,000 of today's tomans, and one qeran is 10 tomans.

2.2. Timeline:
   - **Preparation.** The Central Bank has two years to prepare, then up to three years in which both units circulate [A1, A5].
   - **Transition rules.** The draft regulation (2026-02-23) announces the transition at least four months ahead and requires dual price labels during it: «اجرای برچسب گذاری دوگانه قیمت‌ها» [A10].
   - **Expected dates.** YJC expects the transition around Azar 1406 (late 2027) and the old rial's end in 1409 [A11].
   - **Today.** The 1405 budget is drafted in new rials [A8], but no bank, shop or listing site quoted new rials on 2026-09-27; all seven car sites checked quote «تومان».

2.3. The word "toman" will outlive the law, as it outlived 1932, when the rial officially replaced it [A15]. Commentators expect people to keep saying toman [A13, A14]. Euronews still describes the reform as replacing the rial with the toman [A17], so the word is ambiguous in the press already. A stored `_toman` value is therefore defined as 10 of today's rials, whatever the word comes to mean.

### 3. How Iranian sites show prices

3.1. **Stated prices are full digits everywhere:**
   - **Divar.** A card reads «۴۸۵,۰۰۰,۰۰۰ تومان» [P2, G1]: Persian digits, the ASCII comma (33 of 33 separators in the capture), then a space and «تومان». The detail page's «قیمت پایه» value starts with U+200F, e.g. `"‏۱۲,۰۰۰,۰۰۰ تومان"` [G1]. Words appear only for salaries («حداکثر ۵۵ میلیون تومان»).
   - **Bama.** «4,380,000,000تومان», with Latin digits; its price table shows «1,600,000,000» and a signed percentage change [P4, P6].
   - **Sheypoor.** «۳,۰۵۰,۰۰۰,۰۰۰»; its API has `"amount":"4,200,000,000","currency":"تومان"` [P17, G8].
   - **Hamrah Mechanic.** «9,800,000,000 تومان» [P15].
   - **Torob.** «از ۶۹٫۴۹۹٫۰۰۰ تومان», grouped with U+066B [P18, G6].
   - **No price.** Negotiable is «توافقی» or «قیمت توافقی». Installments appear as «اقساطی» with the down payment named (Bama's API: `prepayment_primary`, `payment_primary`, `installments` [G5]). Nobody writes "call for price".

3.2. **Estimates are full digits too.** Hamrah Mechanic, the closest analogue to a market value, prints [P16]:
   - «قیمت کارشناسی(تقریبی) 9,100,000,000 تومان», rounded to 100 million.
   - «بازه قیمت پیشنهادی برای فروش: 8,736,000,000 تومان تا 9,464,000,000 تومان», which is exactly ±4 %, with «تا» between the ends.
   - **Divar's estimator.** Divar's own used-car estimator (2022) showed only «قیمت بالا، منصفانه و قیمت پایین», and only for models where it was accurate enough [N1, N2]. Divar's developer platform has an `EVALUATION_ROW` widget: cheap, fair and expensive sections with an indicator [G10].

3.3. **Words are for sentences and compact filters:**
   - **News and prose.** News writes «۲ میلیارد و ۳۳۰ میلیون تومان» [B5], and Divar's blog «حدود ۷ میلیارد و ۵۰ میلیون تومان» [P19].
   - **Persian style.** Virastaran recommends mixed words and digits for large amounts [W3].
   - **Filters.** Torob's price filter is compact decimal: «از ۲۰۳ هزار تا ۷٫۹۸۳۸۳۱ میلیارد» [P18].

3.4. **Separators vary, and the standard looks like Divar's:**
   - **Across sites.** Divar used the Arabic comma U+060C in November 2025 («۱،۰۳۰،۰۰۰،۰۰۰») [G7] and the ASCII comma in September 2026 [G1]. Torob groups with the decimal separator U+066B, and Bama uses Latin digits.
   - **The standard.** ISIRI 6219 and Persian Wikipedia give U+066C «٬» for thousands and U+066B «٫» for decimals [W1, W2]; `Intl` prints the same two marks (finding 4.1).
   - **Rendered.** In Vazirmatn and Estedad at 18 px, «۱٬۲۵۰٬۰۰۰٬۰۰۰» with U+066C is nearly indistinguishable from Divar's «۱,۲۵۰,۰۰۰,۰۰۰». U+066B renders as a slash-like mark, the Persian decimal point, so Torob's grouping reads like decimals. U+060C is a turned comma.

3.5. **Traps in Divar's data** (for CS-6 and CS-8):
   - **Search results.** The only price is the formatted string, e.g. «۷,۰۰۰,۰۰۰ تومان». The page's schema.org data says `"price":"70000000","priceCurrency":"IRR"`, which is rials [G1].
   - **Detail pages.** The detail page's schema.org data labels the toman figure IRR [G1].
   - **Numeric field.** The numeric `webengage.price` has been reported rounded through a 32-bit float, 2,150,000,000 read as 2,150,000,128 [G3]; float32 of 2,150,000,000 is exactly that value.
   - **Kenar.** Divar's official Kenar API carries the price as a toman `uint64` string [G10].
   - **The rule.** Parse the displayed string in any digit script and separator (U+002C, U+060C, U+066B, U+066C), with or without a leading U+200F.

### 4. What `Intl` prints (Node 22.14 with ICU 76.1, and Chromium 153: identical)

4.1. **Plain.** `Intl.NumberFormat('fa-IR')` prints «۱٬۲۵۰٬۰۰۰٬۰۰۰», with the `arabext` digits, U+066C between thousands and U+066B for decimals. It accepts `bigint` («۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳»).

4.2. **Compact, default.** Compact notation (short and long alike) keeps two significant digits, which misleads for prices:
   - 1,049,000,000 prints «۱ میلیارد», losing 49 million.
   - 1,250,000,000 prints «۱٫۳ میلیارد».
   - 12,500,000 prints «۱۳ میلیون».
   - At the top, the short form says «تریلیون» and the long form «هزارمیلیارد».

4.3. **Compact with `maximumSignificantDigits: 3`.** It prints «۱٫۲۵ میلیارد», «۱٫۲۶ میلیارد» for 1,263,456,789, «۸۵۰ میلیون», «۱۲٫۵ میلیون» and «۱۲۵ میلیارد».

4.4. **Other options:**
   - `formatRange` joins with a dash («۱٫۱–۱٫۳ میلیارد»), while Persian uses «تا».
   - Percent is «‎−۱۲٫۳٪», with U+200E, U+2212 and U+066A.
   - `style: 'currency', currency: 'IRR'` prints «‎ریال ۱۲٬۵۰۰٬۰۰۰», with the unit first.
   - `NaN` prints «ناعدد».

4.5. **Dates** (`timeZone: 'Asia/Tehran'`, for 2026-09-27 12:00 UTC):
   - `dateStyle: 'long'` prints «۵ مهر ۱۴۰۵», and `medium` prints the same.
   - `full` prints «۱۴۰۵ مهر ۵, یکشنبه»: wrong order, with a Latin comma.
   - `short` prints «۱۴۰۵/۷/۵», and two-digit parts give «۱۴۰۵/۰۷/۰۵».
   - `{ month: 'long', year: 'numeric' }` prints «۱۴۰۵ مهر», year first, where Persian writes «مهر ۱۴۰۵».
   - Date and time together print «۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰», and `formatRange` prints «۵ تا ۱۰ مهر ۱۴۰۵».
   - `RelativeTimeFormat` gives «۳ روز پیش» and «دیروز».
   - Week info: the week starts on Saturday, and Friday is the weekend.

### 5. Which Jalali implementation

5.0. **The official calendar:**
   - **The law.** The 1304 law fixes only that the year starts on the first day of spring, follows the true solar year, and gives Esfand 30 days in a leap year [C1].
   - **The rule in practice.** The Calendar Center compares the equinox with true noon at the official meridian, 52.5° E, and says leap years are not fixed [C2].
   - **What it publishes.** It publishes each year's calendar as PDFs, with no API or data file, and a leap list for 1206 to 1498 [C3].
   - **The machine-readable copy.** That list is transcribed as CC0 [C4], and the ECMAScript specification defines the `persian` calendar by it [C6].
   - **Our check.** The lab's astronomy, with the Center's rule, reproduces all 293 years of the list.

5.1. **Accuracy** (lab, 1206 to 1501 SH: every Nowruz and all 108,111 days, in both directions, on Node 22 and 26):
   - **Correct everywhere.** These match the official calendar on every day:
     - `jalaali-js` 2.0.1
     - `@internationalized/date` 3.12.4
     - `date-fns-jalali` 4.4.0-0
     - `Intl` on ICU 76.1 and on ICU 78.3
     - `temporal-polyfill` 1.0.5, through its `/full` build (the default build refuses `persian`)
     - `@js-temporal/polyfill` 0.5.1
     - native `Temporal` on Node 26
   - **One exception: `jalaliday` 3.1.1.** It converts Jalali to Gregorian correctly, but Gregorian to Jalali wrongly on 4,320 days. Every 1 January to 29 February of a Gregorian leap year comes out one day ahead: 2028-01-01 gives 1406/10/12 instead of 1406/10/11, and 2028-02-29 and 2028-03-01 both give 1406/12/11. The research pass found this and the lab reproduces it; no report upstream was found.
   - **Past checks.** Nowruz 1403 fell on 2024-03-20 and 1404 on 2025-03-21, so Esfand 1403 had 30 days; native `Temporal` agrees, starting Esfand on 2025-02-19. The next leap year after 1403 is 1408, not 1407 [C3].
   - **Close calls.** Equinoxes within 15 minutes of true noon fall in 1210, 1309, 1371 and 1470; every correct implementation gets them right.

5.2. **Where they part** (lab, 1206 to 1800). Every correct implementation agrees until 29 Esfand 1502 (2124-03-19).
   - **The first split.** It comes on 2124-03-20. The equinox is then about three minutes before true noon by astronomy-engine, or nine seconds by JPL DE440 (per the research pass). That is less than the uncertainty in the Earth's future rotation, so the date cannot be decided today; Borkowski called 2124 "the nearest doubtful year" [C5].
   - **The 33-year rule** (`@internationalized/date`, `date-fns-jalali`, ICU 76 and earlier, and the polyfills on Node 22) differs in 1503, 1635, 1668, 1701, 1734, 1767 and 1800.
   - **`jalaali-js`** differs in 1503 only.
   - **ICU 77 and later** add ICU4X's correction table [C7, C8]. So ICU 78, native `Temporal` and both polyfills on Node 26 differ only in 1602, where the equinox falls within a minute of true noon.
   - **What this means.** ICU 76 (Node 22.14) and ICU 78 (Node 22.23 and later, 24 and 26, and Chrome 148 and later) disagree from 2124-03-20, so a runtime upgrade can move dates. A pinned range and a test are part of "offloaded".

5.3. **Server and browser agree.** Chromium 153's `Intl` gives the same Jalali date as Node 22's for all 108,111 days from 1 Farvardin 1206 to the end of 1501, and the same Nowruz for all 202 years from 1300 to 1501. It also prints every amount and date in finding 4 identically. Node's dates match the Calendar Center's list day by day (5.1), so Chromium's do too.

5.4. **Temporal availability** (lab): native in Node 26.10.0 (V8 14.6) and Chromium 153; absent from Node 22.14.0 and Node 24.21.0.

5.5. **History: who broke on 1403/1404, and why.** Every failure came from Birashk's 2820-year rule, which makes 2025-03-20 into 1 Farvardin 1404 [C7, C9].
   - **Fixed.** ICU4X up to 1.4 (fixed in 1.5, 2024-05-28); `@internationalized/date` up to 3.5.2 (fixed in 3.5.3, 2024-05-02, by porting ICU); `jalaliday` up to 3.1.0; plotly.js before 3.0.2.
   - **Still wrong.** The default mode of persian-datepicker; persian-date 1.1.0 (its npm release is from 2019); react-date-object.
   - **Unaffected.** ICU has used the 33-year rule since ICU 50 (2012), and .NET and `jalaali-js` were never affected.

5.6. **The candidates, as maintained on 2026-09-27** [C14] (sizes are minified and gzipped, measured by the research pass):

   | Package | Version and date | Weekly downloads | Maintainer | Leap rule | Time zone | Size | What booking needs |
   |---|---|---|---|---|---|---|---|
   | `@internationalized/date` | 3.12.4, 2026-09-01 | 17.6 M | Adobe; releases every one to two months; no open Persian issue | the 33-year rule, ported from ICU | through `Intl`, independent of the process's zone | 5.4 kB for the calendar subset | all pass: month start, `startOfWeek(date, 'fa-IR')` is Saturday, month lengths, adding months with clamping, comparing, `toZoned` and `parseAbsolute` |
   | `jalaali-js` | 2.0.1, 2026-08-09 | 1.1 M | one maintainer; rewritten in TypeScript in 2026-06 | Borkowski's break table, valid −61 to 3177 | reads local time | 1.4 kB | conversion and month length only |
   | `date-fns-jalali` | 4.4.0-0, 2026-05-31 | 31.4 M, mostly through react-day-picker 9 | one maintainer following date-fns | the 33-year rule | the process's zone unless given `TZDate` | 8.6 kB for nine functions | all pass with `TZDate` |
   | `dayjs` with `jalaliday` | 3.1.1, 2025-09-16 | 6.5 K | a community fork | Borkowski one way, jdf-style code the other | ignores dayjs's timezone plugin | 7.9 kB | the bug above |

   - **Temporal polyfills.** `temporal-polyfill` 1.0.5 (FullCalendar, 4.19 M weekly, 23.6 kB) computes the Persian calendar with the 33-year rule and defers to a native `Temporal`. `@js-temporal/polyfill` 0.5.1 (alpha, 46.8 kB, no release since 2025-03-31) reads the host's `Intl`.

5.7. **Temporal** [C10, C16]:
   - **Status.** Stage 4 on 2026-03-11.
   - **Where it ships.** Native in Chrome and Android Chrome 144 (2026-01-13), Firefox 139, Node 26.0.0 (2026-05-05; LTS from 2026-10-28), Deno 2.7 and Bun 1.4.
   - **Where it does not.** Not in Safari (on WebKit's main branch since 2026-07-08, release unknown) or Samsung Internet 30 (Chromium 143). In Node 22 and 24, `--harmony-temporal` crashes on the Persian calendar.
   - **Types.** TypeScript ships `lib.esnext.temporal` from 6.0; the repository pins 5.9.
   - **Audience.** In Iran's mobile traffic for August 2026, iOS is about 14.4 % and Samsung Internet about 5.6 %, so at least a fifth of mobile page views have no native `Temporal`.

5.8. **React Aria** [C15]:
   - **Calendar support.** Its Calendar and DatePicker run on `@internationalized/date`, take the Persian calendar from `fa-IR` (or `fa-IR-u-ca-persian`), accept `firstDayOfWeek="sat"`, and lay out right to left from the locale.
   - **Bundle size.** A `createCalendar` that returns only the Persian and Gregorian calendars keeps the bundle small.
   - **A gap.** react-aria-components 1.21.1 ships no Persian strings, so its screen-reader labels ("Previous", "Next", "Selected Date") fall back to English and need our own.

5.9. **No calendar web service is needed or available.** The authority publishes PDFs only. The calendar is deterministic for every date we will store, and a service would add a network dependency and a failure mode to every page.

### 6. Booking visits later: time zones and holidays

6.1. **`Asia/Tehran` rules:**
   - **The offsets.** Iran observed daylight saving time through 2022: noon UTC on 1 June 2021 and on 1 June 2022 was 16:30 in Tehran, and on 1 June 2023 and 1 June 2026 it was 15:30. Node and Chromium agree.
   - **Data versions.** PostgreSQL 18.6 in the Compose image reads the system tzdata 2026b (`--with-system-tzdata`) and reports `Asia/Tehran` at +03:30 without DST. Node 22.14 carries tz 2024b; Node 24.21 and 26.10 carry 2026c.
   - **Updates.** Every runtime brings its own copy, so a rule change reaches us through upgrades of Node and of the database image. PostgreSQL 18 bundles tz data and updates it in minor releases [C13], but the Compose image is built with `--with-system-tzdata` and uses Debian's package (2026b), which changes only when the image is rebuilt. The current IANA release, 2026d of 2026-09-11, only corrects 1979 [C12].

6.2. **Future appointments.** A future appointment converted to UTC when it is booked shows the wrong local time if the zone's rules change before it happens. Store the local date and time the person chose with its zone, and derive the instant [T1]. Iran changed its rules with little notice in 2022, so this applies to visit slots. In our schema that is a `date` and a `time` in Tehran, since the tests forbid `timestamp` without a time zone.

6.3. **Holidays cannot be offloaded:**
   - **The law.** There are about 26 official holidays a year, under the law of 1359 as amended in 1377, 1378, 1390 and 1396 [H1, H2].
   - **Solar and lunar holidays.** Solar holidays are fixed; the Nowruz span, 29 Esfand to 4 Farvardin, includes 30 Esfand in a leap year. Lunar holidays are printed as the Calendar Center's crescent predictions, and each lunar month's start is announced by the Leader's office's moon-sighting headquarters on the evening of the 29th.
   - **Printed dates move.** In at least two of the eight years 1398 to 1405, a printed lunar holiday moved by a day after publication: 21 Ramadan 1398, and Eid al-Fitr 1401, announced the evening before. These come from news reports gathered by the research pass and are not an exhaustive count.
   - **Ad-hoc closures.** The cabinet also declares national or provincial closures, usually the evening before; 1 to 7 March 2026 was declared on 1 March [H3].
   - **No feed is both correct and dependable.** Checked on 2026-09-27 [H4, H5, H6]:
     - holidayapi.ir is dead.
     - api.persian-calendar.ir, pnldev, the `date-holidays` package and Google Calendar's Iran feed returned wrong dates.
     - time.ir needs an API key.
     - python-holidays 0.105 (MIT) is the best open dataset, but corrects lunar dates only after the event.
     - persian-calendar's CC0 events were right in the checks.
   - **What works.** A yearly curated import from the official PDF, into a table with the date, the holiday, its status (predicted or confirmed), its scope and its source URL. It is cross-checked in CI against python-holidays, can be overridden for closures, and flags booked slots when a holiday moves.

### 7. Model years

7.1. **Divar pairs by adding 621.** Its detail page shows «مدل (سال تولید)» «۱۴۰۴ - ۲۰۲۵» [P3], and its schema.org data computes the Gregorian year as the solar one plus 621 (it prints «621» when the solar year is missing) [G4].

7.2. **No source uses 622.** The other sites keep one calendar per car: domestic and locally assembled cars in solar years («۱۴۰۳»), imports in Gregorian («۲۰۲۶», «توربو1500-2025», «تویوتا|کرولا|2008») [P4, P15, G4]. Hamrah Mechanic has separate `year` and `gregorianyear` filters; Kenar's car category uses solar years (`production_year` 1400 to 1403) [G10].

7.3. **Minus 621 matches most of the year.** From Nowruz (20 or 21 March) to 31 December, more than three quarters of a Gregorian year falls in solar year AD − 621.

7.4. **The lab model.** The CS-4 research model already stores `model_year_sh`, `model_year_ad` and `model_year_written` with a CHECK that a stated pair differs by 621 or 622 (`2026-09-27-database-research/lab/data-model/01_core.sql`).

## Recommendation

Recorded as ADR-0014 (proposed):

- **Money.**
  - **Storage.** Whole tomans in `bigint` columns ending in `_toman`. Each column has a CHECK `BETWEEN <low> AND 999999999999999`, enforced on every migration by the catalog test.
  - **Arithmetic.** Aggregates are rounded to whole tomans in SQL, and amounts are branded `Toman` in TypeScript.
  - **Parsing.** Extraction parses the displayed price, never a numeric field, and converts rials, words and, later, new rials into tomans.
- **Display.**
  - **Full digits** for every price and value, with `Intl`'s «٬»: stated amounts exact, estimates rounded to three significant digits.
  - **Mixed words** inside Farsi sentences: «۱ میلیارد و ۲۵۰ میلیون تومان».
  - **Compact** only on axes, chips and band edges: «۱٫۲۵ میلیارد», with `maximumSignificantDigits: 3`.
- **Calendar.**
  - **Display** through `Intl.DateTimeFormat('fa-IR')` with `Asia/Tehran`, on the server.
  - **Arithmetic and date inputs** through `@internationalized/date` (at least 3.5.3; 3.12.4 today), added by the first task that needs it.
  - **A pin.** A unit test pins the runtime's `Intl` to the official leap list, so an upgrade that moves a date fails CI.
  - **Temporal** replaces `@internationalized/date` when Safari and Samsung Internet ship it, the production Node is 26 or later, and React Aria moves to it.
  - **Never** `jalaliday`, persian-date or react-date-object.
- **Model years.** Store what the ad wrote. `model_year_sh` is always set, derived as AD − 621 for an ad that gives only a Gregorian year, with the flag and a CHECK.
- **Booking.** Slots are stored as Tehran wall-clock times with their instant derived; holidays are a curated yearly import.

Trade-offs accepted:

- Three amount formats to keep consistent.
- The bound gives 13 to 15 years at today's inflation, and a migration after that.
- One calendar dependency, which React Aria requires anyway.
- A person reads the official holiday PDF once a year.

What would change this:

- A car site that prints stated prices in words (none found).
- Buyers and sources moving to new rials, which would reopen the display unit.
- `Temporal` shipping everywhere we serve.
- A dependable official holiday feed.
