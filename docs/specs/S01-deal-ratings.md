# S01: Market value and deal ratings

- Status: approved (owner, 2026-09-30)
- Date: 2026-09-30
- Tasks: CS-51 (this spec); read by CS-59, CS-61, CS-64, CS-65, CS-67, CS-72, CS-73, CS-74
- Related: ADR-0006 (CarGurus's mechanics), ADR-0014 (tomans, Jalali only on screen), ADR-0017 (live bounded index), `docs/research/2026-09-30-iranian-used-car-price-factors.md` (the factors and their sizes), `docs/research/2026-09-30-cargurus-autolist-jabama-teardown.md` (how CarGurus shows a rating), `docs/design/data-model.md` layer 6

## Users and goal

A buyer looking at a used car on Divar or Bama cannot tell whether the price is fair: Iranian prices move by several percent a month, and the same model sells at very different prices depending on its year, mileage and paint. Carshenas estimates each car's **market value** («ارزش بازار») every day from the asking prices of comparable listings, and rates each asking price against it with one of five **deal ratings** («ارزیابی قیمت»), as CarGurus does with its IMV:

| Code | Shown as |
|---|---|
| `great` | «معامله‌ی عالی» |
| `good` | «معامله‌ی خوب» |
| `fair` | «قیمت منصفانه» |
| `high` | «گران» |
| `overpriced` | «خیلی گران» |

A listing that cannot be rated honestly gets **no rating** («بدون ارزیابی») with a reason, never a guess.

## Flows

1. **Daily run.** Each day at 04:00 Tehran time the worker computes one valuation run for that Tehran day (`as_of_date`): it gathers comparables, fits the price model, values and rates every active listing, and stores the run, the fitted parameters, each listing's result and the comparables behind it.
2. **Search and listing pages** (CS-59, CS-61, CS-64) read the latest successful run: the rating and the gap sort and filter search; the listing page shows the market value, the gap and the comparables.
3. **A listing that arrives between runs** (a new crawl, a pasted link in CS-65) is valued in SQL from the latest run's stored parameters, so it gets a value without waiting for tomorrow.
4. **Accuracy report.** `pnpm valuation:evaluate` fits on listings posted before a cut date and scores listings posted on or after it (section "Accuracy").

## Rules

### Comparables: who enters the fit

A listing is a **comparable** in the run for day D when all of these hold:

1. Its `price_type` is `asking` with an `asking_price_toman`. **Negotiable, instalment and placeholder prices never enter a market value** (CS-51 #3).
2. It is matched to a catalogue model (`catalogue_match` is `model` or `trim`), with `model_year_sh`, `mileage_km` and `gearbox` known.
3. It was on the market inside the window: listed on or before D, and either still active (whenever it was posted: an active listing is asking its price now) or, having left the market, last seen within **30 days** before D. A listing that left the market stays a comparable at its last asking price until it falls out of the window (the planning note of 2026-09-28). Prices move about 17 % a month, so a longer window would mix markets.
4. Its condition is not in the **excluded conditions**: body `fully_repainted`, `accident_damaged` or `salvage`; engine `replaced` or `needs_repair`; gearbox `replaced` or `needs_repair`; either chassis `damaged`. The sources put these at 7 % to 40 % off, depending on details we cannot read yet, so they are neither comparables nor rated.
5. Any fuel: an electrified drive (hybrid, plug-in hybrid, electric) is a shared adjustment, `electrified`, learned from the models that have both.
6. It is not a same-source repost of another comparable (same source, same model, year, mileage and price within the window: the first one counts); once CS-55 lands, only one listing per duplicate group counts.
7. It is not a **price outlier**: its asking price lies within a factor of 3 of the median of its model's comparables within two model years (the whole model's when fewer than three are that close), and after a first fit its residual lies within 3 median absolute deviations. An outlier is stored with the reason `price_outlier` and is not rated either. The residual's spread is measured over all models together.
8. It is not a **dealer's zero-km post** (`seller_type = 'dealer'` and under 1,000 km). On 2026-09-30 these showed teaser prices (a down payment, a pre-sale, a price "from", one post for every colour): the median dealer zero-km 207i asked 1,810M toman against 2,260M from private sellers, some as low as 800M, and 63 % of them rated «معامله‌ی عالی» before this rule (owner's decision, 2026-09-30). They get a market value but no rating (`dealer_new_car`) until CS-52 reads what the price means.

### The price model

The price model is a log-price regression, one level and age slope per model, the other coefficients shared by all models. It is fitted each run on the comparables:

```
ln(price) = level[model] + level[trim]
          + age_slope[model] · age
          + b_mileage · mileage_deviation
          + b_zero_km · zero_km
          + b_body[body_bucket]
          + b_chassis_repainted · chassis_repainted
          + b_gearbox_automatic · automatic   (only within a model that has both)
          + b_dual_fuel_aftermarket · dual_fuel_aftermarket
          + b_electrified · electrified
          + b_off_colour · off_colour
          + b_day · days_before_D
```

- `age` = the current Jalali year on D − `model_year_sh`, floored at 0. Where a listing stated a Gregorian year only (`model_year_written = 'ad'`), its `model_year_sh` may be a year off, so its age carries half a year of uncertainty; no special term.
- `mileage_deviation` = (`mileage_km` − 20,000 × max(age, 0.5)) / 100,000: kilometres above or below the norm of 20,000 a year that Iranian appraisers use.
- `zero_km` = 1 when `mileage_km` < 1,000 (a zero-km or «کارکرده صفر» car; 30 % of priced listings on 2026-09-30).
- `body_bucket`: `intact` (also `paintless_dent_repair` and unknown body, the reference), `minor` (`minor_scratches`), `painted` (`partly_repainted`), `painted_around` (`repainted_around`).
- `chassis_repainted` = 1 when either chassis is `repainted`.
- `off_colour` = 1 unless the colour's family is white, black, silver, grey or unknown.
- `level[trim]` is used only for a trim with at least 5 comparables; otherwise the trim is valued at its model's level.

**Priors and bounds.** Each shared coefficient is pulled toward a prior taken from the appraisers' percentages, and clamped to a range, so thin data cannot learn that paint raises a price:

| Coefficient | Prior | Allowed range | From |
|---|---|---|---|
| `b_mileage` (per 100,000 km over the norm) | −8 % | −20 % to 0 | appraisers' «پرکار» discount; our inference for the size |
| `b_zero_km` | +6 % | 0 to +20 % | 4–8 % loss on registration |
| `b_body[minor]` | −2 % | −6 % to 0 | spot paint 1–3 % |
| `b_body[painted]` | −6 % | −15 % to 0 | one to two panels 2–15 % |
| `b_body[painted_around]` | −12 % | −25 % to 0 | between multi-panel and full repaint |
| `b_chassis_repainted` | −6 % | −12 % to 0 | chassis 5–10 % |
| `b_gearbox_automatic` | +10 % | 0 to +30 % | 207 manual against automatic |
| `b_dual_fuel_aftermarket` | −4 % | −10 % to 0 | our inference |
| `b_electrified` | +15 % | 0 to +40 % | our inference: hybrid trims sell above petrol ones |
| `b_off_colour` | −5 % | −12 % to 0 | 5–10 % |
| `b_day` (per day) | +0.3 % | −0.5 % to +1 % | 17 % in Shahrivar 1405 |
| `age_slope[model]` | the pooled slope, −6 % a year | −20 % to +5 % a year | 5–10 % a year; flat in toman terms under inflation |

The coefficients are fitted by penalised least squares (ridge toward the priors), where the weight of a prior counts as a fixed number of listings (`prior_strength`, 20 in method version 1). A model's level and age slope need its own comparables; its age slope is its own deviation from the pooled slope, pulled toward zero with `prior_strength` listings of typical age. The pooled slope is the mean of the models' slopes; its own prior weighs a single listing, or one large model would split its slope halfway toward the prior. When a coefficient leaves its range it is fixed at the bound and the rest refitted. Percentages above are on the price; stored coefficients are on the log scale (ln(1 + p)).

### Market value

- A listing's **market value** is the model's prediction for its own attributes on day D, `exp(ln_value)`, rounded to whole tomans in SQL and stored in `market_value_toman` (ADR-0014). Pages round it to three significant digits for display only.
- A listing with an excluded condition, an unmatched model or a missing year, mileage or gearbox gets no market value; nor does one whose model fails "Enough comparables", so a page never shows a value the model could not stand behind.
- A **negotiable** («توافقی») listing gets a market value but no rating (reason `no_asking_price`): the buyer still learns what the car is worth.

### Enough comparables

A listing gets a rating only when its model had, in the run:

1. at least **8 comparables**, and
2. at least **3 comparables whose model year is within 2 years** of the listing's (no extrapolation to years the model never saw), and at least 1 with the same `zero_km` value, and
3. a **segment error** (the model's median absolute percentage error in leave-one-out over its comparables) of at most **15 %**: a model the regression cannot price well is not rated.

Otherwise its reason is `too_few_comparables`, `year_out_of_range` or `uncertain_segment`.

### Price gap and ratings

- **Price gap** = (asking price − market value) / market value, stored as `price_gap_pct` with two decimals. Negative means cheaper than the market.
- Ratings, by price gap:

  | Rating | Price gap |
  |---|---|
  | `great` | ≤ −10 % |
  | `good` | above −10 %, up to −4 % |
  | `fair` | above −4 %, below +4 % |
  | `high` | from +4 %, below +10 % |
  | `overpriced` | ≥ +10 % |

- A rating needs an asking price and a market value that passed "Enough comparables"; everything else carries exactly one `no_rating_reason`:

  | Reason | When |
  |---|---|
  | `unknown_price` | the listing was seen only on a list page, its price type not read yet |
  | `no_asking_price` | negotiable |
  | `placeholder_price` | a price below the placeholder threshold (CS-34) |
  | `installment_price` | an instalment price (a down payment is not the car's price) |
  | `unmatched_model` | no catalogue model |
  | `missing_attributes` | year, mileage or gearbox unknown |
  | `excluded_condition` | a condition from comparables rule 4 |
  | `dealer_new_car` | comparables rule 8 |
  | `price_outlier` | comparables rule 7, or, for a listing that is not a comparable (a repost, one crawled after the run, a pasted link), a price beyond a factor of 3 of its market value |
  | `too_few_comparables`, `year_out_of_range`, `uncertain_segment` | "Enough comparables" |

- WHEN a listing is valued THE SYSTEM SHALL store either a deal rating or a no-rating reason, never both and never neither (a CHECK).
- WHEN a listing that is also a comparable is rated THE SYSTEM SHALL value it from the full fit, its own price included (as CarGurus values every listing in its market); leave-one-out values serve only the segment error and the accuracy report.

### Stored results

- **`valuation_run`**: one row per Tehran day and method version, `status` (`running`, `succeeded`, `failed`), counts, and the pooled coefficients and priors used. Only one succeeded run per day and method.
- **`valuation_coefficient`**: every fitted coefficient of a run as a typed row (`term`, optional `model_id` or `trim_id`, `value`), so SQL can value any listing from the latest run (flow 3).
- **`valuation_segment`**: per run and model: the number of comparables, the years seen, the segment error, and whether the model rates listings. It replaces the planned `segment_valuation` (per trim, year and province): with a model per catalogue model, a segment is a model.
- **`listing_valuation`**: per run and active listing: the asking price rated, `market_value_toman`, `price_gap_pct`, `deal_rating` (the ordered enum of the data model) or `no_rating_reason`.
- **`listing_valuation_comparable`**: for each rated listing, the **10 comparables** of its model closest in year and mileage, with their asking price and their price adjusted to this listing's attributes (their price × this listing's value ÷ their value). These are what CS-64 shows; the value comes from the whole model.
- Runs are kept for 90 days; CS-67's price trend reads model levels over time.

### Accuracy

`pnpm valuation:evaluate [--as-of <date>]` reports, per model with at least 5 test listings and overall:

1. **Time split** (CS-51 #5): fit on comparables listed before the cut date (D − 7 days), with the same rules, then predict the comparables listed on or after it; report the median absolute percentage error (MdAPE), the share within 10 %, and the test count. Learning only from the past is the harder, honest test.
2. **Random split**: a seeded 80/20 split of the same comparables, for comparison with Capot's 7.6 % on a random 20 % hold-out.

Until CS-49's frozen releases exist, both run on the live database and the report records its date and counts; CS-49 later reruns them on a frozen release. The report lists every tracked model a split could not score, with its counts. The time split separates listings by the day the source says they were posted, but each carries the asking price the crawler read: while the index is younger than the window (it was first filled on 2026-09-30), a listing posted before the cut carries today's price, so the split measures listing age rather than a market that moved. It becomes a true time test once `listing_price_event` holds weeks of history or a frozen release exists. The report is saved under `docs/evidence/valuation/<date>.md`.

## What we are NOT doing

- Reading paint panels, spot counts, free-zone plates, clearance year or the document from free text: CS-52. Until then a free-zone car is valued like a national-plate car (and is usually flagged as an outlier or `great` wrongly); the spec accepts this for the demo.
- Duplicate groups across sources: CS-55 (rule 6 handles same-source reposts only).
- Province or city segments: the index covers the Tehran market (ADR-0017); a `city` term waits for data from other cities.
- Frozen releases and backtests on them: CS-49, after the demo.
- The explanation in Farsi and the gauge: CS-64. Price trends: CS-67. Checking ratings against what the market did next: CS-73. Published price tables: CS-74.
- A gradient-boosted or machine-learned model beyond this regression: only if the accuracy report shows the regression is the bottleneck.

## Success criteria

- Automated:
  - Unit tests of the fit on synthetic listings with known coefficients: recovered within tolerance; coefficients clamped to their ranges; a thin model falls back to the pooled slope.
  - Unit tests of every no-rating reason and every rating threshold edge (−10 %, −4 %, +4 %, +10 %).
  - Schema tests: `deal_rating` is an ordered enum; `listing_valuation` has exactly one of a rating and a reason; amounts are `_toman` with their range CHECK.
  - An integration test: a run on a seeded database stores the run, coefficients, segments, listing results and comparables; negotiable, instalment and placeholder listings are never comparables; the SQL valuation of a listing from stored coefficients equals the worker's value to the toman.
  - `pnpm valuation:evaluate` prints the time-split and random-split MdAPE per model.
- Manual (In Review): the owner reads ten rated listings of the 206 and the 207i on Divar and agrees the ratings are plausible.

## Open questions

1. The thresholds (±4 %, ±10 %) are proposals: CarGurus does not publish its own. They should be revisited once the time-split MdAPE is known; a threshold narrower than the typical error rates noise.
2. `prior_strength` of 20 listings is a guess, to be tuned by the time-split error.
