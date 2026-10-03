# ADR-0040: Read a mileage typed in thousands by the listing's words first and the asking price second, store the reading, and say so on every screen

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him)
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-101 lane)
- Related: CS-101, CS-86; ADR-0013, ADR-0028, ADR-0030; `docs/design/data-model.md` ("Added by CS-101"); `docs/evidence/listing-facts/2026-10-03-mileage-in-thousands.md`; S01

## Context

CS-86 left a mileage under 1,000 km on a car of three or more model years unread, because the thousands were a reading it could not prove. The owner's feedback of 2026-10-03: some sellers write 100 and mean 100,000 km, others mean 100 km (a car never driven), the text often says which, and when it does not the price does. 82 of 6,088 listings are affected; they lose their rating and the fit loses their comparables.

## Decision

1. **Three readings, by code, no model.** For a figure under the CS-86 floor (the rule itself is unchanged): the listing's words decide first (`mileage-wording.ts`): «صفر خشک», «۴۴۰ کیلومتر», «۷۰کیلومتر راه رفته» make it **really that low** and it is kept; «۶۰ هزار», «۱۰۹تا کیلومتر», «۷۳۰۰۰» make it **thousands** (`thousands_text`); a text that points both ways, or only uses figures of speech («در حد صفر»), decides nothing. When the words settle nothing, the valuation run decides by the price (`thousands_price`) or leaves it **unread**, as under CS-86.
2. **The price test**, in `apps/worker/src/valuation/mileage.ts`, with the run's own fit: read in thousands when the asking price is at most 1.15 times the market value at 1,000 times the figure, the value at the figure as written is at least 1.15 times the value at 1,000 times it, and 1,000 times the figure is at most 40,000 km for each year of age counted from mid-year. 15 % is the error a model may have and still rate (S01); 40,000 km a year is above the 99th percentile of stated mileages. Chosen on the 82 listings and recorded with the data; the numbers live once in `@carshenas/search/mileage-reading` and the info control quotes them.
3. **One effective value, the evidence beside it.** `listing.mileage_km` stays what valuation, search, filters and sorts read: the figure as written, or the assumed one. `mileage_written_km`, `mileage_reading`, `mileage_wording` and `mileage_ask_ratio` (asking price over the value at 1,000 times the figure) say how it got there, with named CHECKs that tie the four together. The derivation carries the run's `thousands_price` over while the seller's figure is unchanged, so a re-derivation does not undo a decision the next run will take again; a changed figure replaces it.
4. **The price reading never teaches the fit.** `loadComparables` leaves out `thousands_price` listings: the price chose the reading, so it cannot also be evidence for what a price is. Text readings are ordinary comparables.
5. **Every screen says so.** An assumed mileage shows «۱۰۰ کیلومتر نوشته شده؛ با توجه به قیمت و سال، احتمالاً ۱۰۰٬۰۰۰ کیلومتر» (or the text variant) under the mileage on the card and the listing page, «احتمالاً» before the figure in lists, with an info control that gives the rule. The words are one module in `@carshenas/search`.

## Alternatives considered

- **A model reads the text.** Rejected by the task: wordings and a price are enough, cost nothing and are testable.
- **Decide in the parser by price.** The parser has no valuation; the run has the fit. The parser decides by words, the run by price.
- **A separate table for the reading.** Every reader would join it or learn a second mileage; the one-column rule keeps every existing reader right.
- **Keep the price-read listings in the fit.** Circular: they would confirm their own reading.
- **One-sided price test with no gap rule** (ratio at most 1.15 only): reads 33 listings, including cars of three to five years, where the model's mileage effect (5 to 14 %) is below its error and a near-new car cannot be told from a used one. Rejected.

## Consequences

- On the lane copy of 2026-10-03: 21 really low, 4 thousands by text, 20 by price, 37 unread; 0 of 17 text-proven near-new cars would be read as thousands; of the 24 read in thousands, 23 are plainly used cars and 1 is a finance advert (evidence file). Recall is low where the price is blind: cars under about nine years stay unread unless the text says, by design.
- A near-new car stated as «۱۰۰» with no wording and a used-looking price is unread, as today; a wrongly assumed one costs a wrong rating, which the note, the info control and the stored evidence let a person see.
- Follow-up: the same reading for a car under three years whose figure is implausibly high-priced is not attempted; bare «کارکرد ۳۰۷» texts could count as thousands with more labelled data.
