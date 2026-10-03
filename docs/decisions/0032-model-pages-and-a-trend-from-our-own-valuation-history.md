# ADR-0032: Model pages at /models/<make>/<model>, with a price trend built only from our own daily valuation history

- Status: accepted by delegation (the owner's standing instruction of 2026-09-30, decided by the CS-67 lane on 2026-10-03)
- Date: 2026-10-03
- Deciders: Pedrum (delegated)
- Related: CS-67, S01 (`docs/specs/S01-deal-ratings.md`, "Runs are kept for 90 days; CS-67's price trend reads model levels over time"), ADR-0017 (live bounded index), ADR-0028 (search table and freshness window), teardown pattern 33

## Context

CS-67 is Torob's product page applied to cars: a page per model with today's market value, a trend and the best deals. Two things had to be decided, and both bind later pages. First, the address: the catalogue has slugs for makes, models and trims, and the search already names a model by the key «make.model». Second, where a trend may come from. Listings carry a posting date (`listed_at`), so a trend by posting week looks possible, but it is not honest: a listing that sold or was removed before the crawl began is not in the table, so the older a week is, the more it shows only unsold cars. Measured on 2026-10-03, for the Peugeot 206 there were 61 to 136 listings posted a day in the two weeks before the crawl began (2026-09-30) and 370 to 500 a day after it; the "price" of those weeks is the price of what did not sell. The valuation has run daily since 2026-09-30, and each run stores every active listing with its asking price (`listing_valuation`, kept 90 days).

## Decision

1. **Address.** `/models` is the index (popular models first, then every model that has listings, by make) and `/models/<make slug>/<model slug>` is a model's page, with the model year in `?year=<Jalali year>` when one is chosen. Slugs are the catalogue's, the same ones the search key «make.model» is made of (`src/lib/model-address.ts` is the one place that builds and reads the address, so the search page, the listing page and the home page link to it without importing the model feature; a result card has the link behind an opt-in prop, off by default, because a second link in every card doubles the Tab stops of a page of cards). The proxy answers a real 404 for an unknown model; trims have no page of their own, only a row that opens the search for that trim.
2. **Trend.** The price trend of a model year is drawn only from our own daily runs: for each run's date, the median asking price (with the middle half of the prices) of the rated listings of that model year that the run valued. A day is a point only with at least 8 such listings, a chart is drawn from at least 3 points, points are days while the history is 21 days or shorter and weeks (the last day of each Saturday-week) beyond it, and a change over 30 or 90 days is stated only when a point exists within 4 days of that distance. Fewer points are shown as a designed «تاریخچه هنوز کوتاه است» state with the numbers in a table, never as a line. The constants live in `features/model/model-rules.ts` and the info controls print them.
3. **Current figures** (count, median, middle 80 % range, medians by year and trim, rating shares) come from `search_document` inside the search's own 48-hour window, so a count on the page is the number the search finds.
4. **Rise is bad news.** A rise in the median is coloured as a warning and a fall as good news for the buyer, with the sign always printed (teardown pattern 33).

## Alternatives considered

- **A trend by posting week from `listed_at`.** Draws weeks of history on day one, but the early weeks are survivors; rejected as dishonest (measured above). It becomes possible only once the index is older than the longest listing life, and by then the runs hold the same history without the bias.
- **A model-level market-value index from the fitted coefficients.** Each run's `level[model]` is per model, but the day term `b_day` is shared by all models and, with four days of data, is mostly its prior (+0.3 % a day): the line would show the prior, not the market. Rejected for now; the median asking price is an observation.
- **A page per trim and year.** Too thin at today's volume (most trim-year cells have a handful of listings); a year filter and a trims table give the same answers.
- **Address by the numeric model id.** Not readable and not shareable; the slugs are already unique and stable.

## Consequences

- Positive: every figure on the page is a count or a median from the database; a short history says so; the page gets richer as runs accumulate, with no change.
- Negative: on 2026-10-03 the history is three days long, so most models show «تاریخچه هنوز کوتاه است» or a three-point chart, and no change over 30 or 90 days; the runs are kept 90 days, so a 90-day change is the longest the trend can ever state until the retention changes.
- The figures at the top of a page count every priced listing the search shows; the trend counts only the rated ones of one model year (the page says so).
- After migrating, run `ANALYZE listing` (main too): the trend plan needs the new index's statistics.
- Follow-ups: a nightly model snapshot table (median and band per model and model year) if the 90-day retention proves too short; a model page per trim when the volume allows.
