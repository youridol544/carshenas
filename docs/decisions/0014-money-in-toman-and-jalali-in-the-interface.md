# ADR-0014: Store amounts as bounded whole tomans and dates as UTC instants; show them the way Iranian buyers read them

- Status: proposed (the owner chose the toman on 2026-09-27 and delegated the rest of CS-2 the same day; this awaits the owner's review)
- Date: 2026-09-27
- Deciders: Pedrum
- Related: ADR-0005 (React Aria for date inputs), ADR-0011, ADR-0012, ADR-0013 (points 5 and 6); tasks CS-2, CS-3, CS-6, CS-8, CS-12, CS-16 to CS-20; `docs/research/2026-09-27-money-and-jalali-calendar.md` and its lab; `docs/design/data-model.md`

## Context

Every listing, valuation, chart and alert carries an amount and a date.

- **Prices.** In September 2026 car prices ran from about 365 million tomans for an old Pride to 115 billion for a new BMW 7 Series. One ad asked 400 billion, and inflation ran at 68 % (twelve-month average) to 84 % (year on year).
- **Model years** come in two calendars.
- **The app's limit.** `parseInt8` refuses a `bigint` above 2^53 − 1, so one absurd crawled price could break every page that lists it.
- **The currency is changing.** A 2025 law takes four zeros off the currency: the unit stays the rial, and one new rial is 10,000 of today's rials (1,000 tomans). Old and new rials circulate together for up to three years from about late 2027.
- **The owner's direction.** The owner chose the toman. They asked that big numbers fit the database decisions, that amounts read the way Divar's users expect, and that the Jalali calendar come from production-grade code that others maintain, fit for booking visits later.

The first stored price (CS-6) fixes all of this for every amount column and screen.

## Decision

1. **Whole tomans.**
   - **Storage.** Every amount is a `bigint` of whole tomans in a column ending in `_toman`; one toman is 10 rials of the rial in use in 1405. Nothing is stored in rials.
   - **Conversion.** Extraction converts whatever unit the ad uses: rials, «میلیون» and «میلیارد» words, and after the redenomination new rials (1,000 tomans) and qerans (10 tomans). The snapshot keeps the ad's own words.
   - **Parsing.** Extraction reads the price the source displays, in any digit script and with any separator, never a numeric field. One public crawler found Divar's numeric price rounded through a 32-bit float: 2,150,000,000 came back as 2,150,000,128.
2. **A bound every column states.**
   - **The CHECK.** Each amount column has its own CHECK `<table>_<column>_range`, written `<column> BETWEEN <low> AND 999999999999999`. The low end is 1 for a price, 0 where zero means something, and −999999999999999 for a difference, and nothing else: a higher floor would be a plausibility rule.
   - **Why this bound.** It is 2,500 times the most expensive ad, which is 13 to 15 years of today's inflation. It is also nine times below 2^53 − 1, so every amount and any sum of nine are exact in JavaScript, and `parseInt8` never throws on money.
   - **What it guards.** The bound guards only what a number can represent. Plausibility moves with inflation, so extraction and valuation flag implausible prices into the review queue instead.
   - **Not a domain.** A per-column CHECK rather than a domain type, because adding a column of a constrained domain rewrites the table (measured on PostgreSQL 18). On a table that already has rows, the column is added bare and its CHECK `NOT VALID`, then validated in a later migration: an inline CHECK scans the whole table under an ACCESS EXCLUSIVE lock, and Squawk does not flag it.
   - **Prices that are not prices.** A placeholder price is stored without an amount; its figure stays in the snapshot. An installment ad's figure goes into its own down-payment column. So the range never has to hold a fake price, and a switch to either is a change of price type, never a price drop.
   - **Enforcement.** `schema-catalog.test.ts` enforces the suffix, the type, and the CHECK's form and name on every migration. It covers every column whose name holds a currency word (toman, rial, irr, irt) and every `numeric` or floating-point column that names a price, amount, cost, fee or value. An integer amount named without any of these words can only be caught by review (ADR-0013's rule that units go in names).
   - **When to revisit.** When a stored amount passes 10^14, choose between widening the bound to 2^53 − 1, which gives up the room for sums, and moving to the new unit.
3. **Exact arithmetic.**
   - **In SQL.** Averages, medians and percentiles are rounded to whole tomans and cast to `bigint` in SQL, as in `round(avg(x))::bigint`. `round` alone returns `numeric`, which reaches the app as a string, and `percentile_cont` returns `double precision`. Estimates are stored as whole tomans. A sum of many amounts can pass 2^53 − 1, so it stays in SQL or comes back as a `numeric` string, never as a JavaScript number.
   - **In TypeScript.** An amount is a safe-integer number branded `Toman` where it is parsed.
   - **Never.** No floats, no `parseFloat`, and not `Intl`'s currency style, which prints «ریال ۱۲٬۵۰۰٬۰۰۰»; the toman has no ISO code.
4. **Amounts on screen.**
   - **Common form.** Amounts are formatted on the server with `Intl.NumberFormat('fa-IR')`: Persian digits, «٬» between thousands and «٫» for decimals (the standard marks), and «تومان» after the number, never wrapped apart from it. In the fonts measured, «٬» looks like the comma Divar prints.
   - **Full digits for every price and value.** This covers asking prices everywhere, earlier prices, drops, and the market value and its range: «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان». Divar, Bama, Sheypoor and Hamrah Mechanic print prices this way, and Hamrah Mechanic's estimate and range too. A stated amount is never rounded, because the buyer checks it against the source. An estimate is rounded to three significant digits («۱٬۲۶۰٬۰۰۰٬۰۰۰ تومان»). A price gap is a whole percentage.
   - **Mixed words inside sentences.** Explanations, alerts and the echo under an amount field write «۱ میلیارد و ۲۵۰ میلیون تومان», as Persian news and Divar's own writing do.
   - **Compact on scales only.** Axes, filter chips and the gauge's band edges use three significant digits: «۱٫۲۵ میلیارد», «۸۵۰ میلیون», and ranges with «تا». «میلیارد» is the largest unit. `Intl`'s compact default keeps two digits (1,250,000,000 becomes «۱٫۳ میلیارد»), so set `maximumSignificantDigits: 3`.
   - **No amount, no number.** A missing price shows «توافقی», or «اقساطی» with the down payment named. A placeholder price is never printed as an amount, and «۰ تومان» or «ناعدد» on a page is a bug.
5. **Dates.**
   - **Storage.** Instants stay `timestamptz` in UTC, and Tehran days are computed with `AT TIME ZONE 'Asia/Tehran'` (ADR-0013).
   - **Jalali only on screen.** Jalali is never stored (model years aside), keyed, sorted, or put in a URL or an API, which carry ISO-8601 with Latin digits.
   - **Formatting.** Dates are formatted on the server with `Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' })`, always passing the time zone.
   - **Forms.** «۵ مهر ۱۴۰۵», «۵ مهر ۱۴۰۵ ساعت ۱۵:۳۰», «۵ تا ۱۰ مهر ۱۴۰۵», «۱۴۰۵/۰۷/۰۵» in tables, and «۳ روز پیش». «یکشنبه ۵ مهر ۱۴۰۵» and «مهر ۱۴۰۵» are built from parts, because the built-in patterns print «۱۴۰۵ مهر ۵, یکشنبه» and «۱۴۰۵ مهر». Weeks start on Saturday.
6. **A calendar others maintain, pinned by our test.**
   - **Display** uses the platform's ICU through `Intl`.
   - **Arithmetic and date inputs** use `@internationalized/date` (Adobe; the date model under React Aria, ADR-0005), version 3.5.3 or later, added by the first task that needs it. That covers month grids, week starts, adding months, and turning a Jalali date and a Tehran time into an instant.
   - **Nothing of our own.** No web service, and no leap-year code of ours.
   - **Accuracy.** On Node 22 and 26, `Intl`, `@internationalized/date`, `jalaali-js`, `date-fns-jalali`, two `Temporal` polyfills and native `Temporal` match the Calendar Center's calendar on every day up to 29 Esfand 1502 (2124-03-19). That means its published leap list for 1206 to 1498 and its rule after that. Chromium 153's `Intl` gives the same Jalali date as Node for every day from 1206 to 1501. The implementations part after 1502, where ICU 78 already differs from ICU 76. `jalaliday` fails: it puts every January and February of a Gregorian leap year a day ahead.
   - **The pin.** A unit test pins the runtime's `Intl` to the Center's leap list (1206 to 1498, a CC0 copy in the lab) (CS-3), so an upgrade that moves a date fails CI.
   - **Temporal** takes over once the production Node (26 has it), the oldest supported browser and React Aria all do.
7. **Model years.**
   - **`model_year_written`** (`sh`, `ad`, `both`) records what the ad stated.
   - **`model_year_ad`** (1921 to 2121) is stored only when stated.
   - **`model_year_sh`** (1300 to 1500) is set whenever a year is known: as stated, or `model_year_ad − 621` for an ad that gives only a Gregorian year.
   - **The CHECK** spells out every case, with `IS [NOT] NULL` in each branch, so that no missing value slips through; `docs/design/data-model.md` gives it word for word:
     - `sh`: only `model_year_sh`.
     - `ad`: `model_year_ad`, and `model_year_sh = model_year_ad − 621`.
     - `both`: both years, 621 or 622 apart.
     - no flag: no year.
   - **Reading and display.** Search and valuation read `model_year_sh`; pages show the year as the ad wrote it. Minus 621 is how Divar pairs the two («۱۴۰۴ - ۲۰۲۵»).
8. **Future appointments are wall-clock times.**
   - **Slots.** When booking is planned, a visit slot is stored as the Tehran `date` and `time` a person chose, never as `timestamp`, which the schema tests forbid. Its UTC instant is derived from that and recomputed if Iran changes its time-zone rules again, as it did when it dropped daylight saving in 2022.
   - **Holidays** are data imported from the official calendar, because the lunar ones follow moon sighting.

## Alternatives considered

- **Rials**: the official unit, but every source and every buyer speaks tomans. Storing rials would add a factor of ten to every read and write.
- **`numeric`, or a `toman` domain**: `numeric` reaches the app as a string. A constrained domain rewrites the table on each new column, and its errors name no column.
- **No bound, or 2^53 − 1 now**: with no bound, one absurd number could break every page. 2^53 − 1 as today's bound leaves no room for sums, and it would spend the one widening that is possible without changing how amounts reach JavaScript.
- **Compact amounts by default** («۱٫۲ میلیارد تومان»): no car site prints prices that way, and it rounds away the differences of tens of millions that a buyer compares.
- **Divar's comma or Torob's «٫» as the separator**: the comma looks the same as «٬» but needs custom code. «٫» is the decimal mark.
- **jalaali-js, date-fns-jalali, dayjs with jalaliday, or a calendar API**: `jalaliday` 3.1.1 puts every January and February of a Gregorian leap year a day ahead. The others are correct for our years, but they have one maintainer each, depend on the process's local time zone, or need the network, and the authority publishes no API. React Aria needs `@internationalized/date` anyway.
- **Temporal now**: missing from Node 22 and older Android browsers. It would need a polyfill and a second date model beside React Aria's.
- **Jalali in storage or SQL**: PostgreSQL has no Persian calendar, and Jalali strings sort wrongly across months and years.

## Consequences

- Positive:
  - Amounts fit PostgreSQL and JavaScript exactly, and a test enforces it.
  - Prices read as they do on the source, and estimates show an honest precision.
  - The calendar is maintained upstream and pinned by our test.
  - Model years compare on one indexable column.
- Negative / risks:
  - A migration is needed if an amount nears 10^15; the trigger is 10^14.
  - The redenomination adds a conversion step to every parser and a display decision, while prices carry two labels.
  - A model year from an ad that gives only a Gregorian year can be one year off for cars built from 1 January to 20 March. A stated (1399, 2021) and a Gregorian-only 2021 (stored as 1400) land in different solar years, so comparables allow a year either side where the calendars written differ (CS-12).
  - There are three amount formats to keep consistent.
  - Holidays need a yearly import.
- Follow-ups:
  - CS-3: the formatters and the calendar pin test.
  - CS-6: `listing_price_event` with the range CHECK, keeping the displayed price text.
  - CS-8: converting prices, units and years.
  - CS-12: rounding estimates in SQL.
  - The booking task, when planned: point 8.
