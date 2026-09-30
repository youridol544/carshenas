# Which factors move a used car's price in Iran, by how much, and which should Carshenas's market value use?

- Date: 2026-09-30
- Asked by / for: CS-51 (market value from comparable listings and deal ratings), before its spec `docs/specs/S01-deal-ratings.md`
- Outcome: the owner chose, on 2026-09-30, a per-model log-price regression bounded by the magnitudes below, with pooled coefficients where a model has too few listings, and a time-split accuracy report on live data in place of CS-49's frozen releases (skipped until after the demo). Carried into S01; no ADR.

## Questions

1. Which factors move the asking price of a used car in the Iranian market, Tehran in particular, and by roughly how much?
2. How do Iranian appraisers («کارشناس») actually price a car?
3. Which of these factors do Divar's listings give as structured fields, which only in free text?
4. Which should a comparables-based market value segment on, adjust for, or ignore in its first version?

## Sources

Web searches in Farsi and English on 2026-09-30 by a research subagent; every page below was fetched then. They are market rules of thumb from appraisal companies, insurers and car magazines, not fitted models: bimeh.com says outright that no official rule fixes how much damage lowers a car's price between private parties, and that it is market convention plus the appraiser.

- https://www.hamrah-mechanic.com/mag/how-to-price-used-car/ and https://www.hamrah-mechanic.com/mag/calculating-car-price-falling/ — Hamrah-e Mechanic, a large Iranian inspection and appraisal company: its appraisal method and depreciation table.
- https://khodro45.com/mag/used-car-pricing/, https://khodro45.com/mag/car-usage/, https://khodro45.com/mag/white-car-vs-black-car/, https://khodro45.com/mag/third-party-discount-insurance-transfer/ — Khodro45, a used-car trading and inspection platform.
- https://www.azki.com/blog/car-price-drop-paint-replacement/ — Azki, an insurance marketplace: per-panel deductions.
- https://bimeh.com/mag/car-repair-price-drop/ — Bimeh.com, an insurance marketplace: per-panel deductions and the "no official rule" statement.
- https://www.asriran.com/fa/news/927927/ — Asriran, news site: toman examples of paint deductions and of combined age and mileage loss.
- https://www.pedal.ir/magazine/ (article on colour and price) — Pedal, car magazine.
- https://www.donyayekhodro.com/news/234178/ — Donya-ye Khodro, trade press: free-zone against national plate prices.
- https://bankavl.com/ (Peugeot 207 manual against automatic) — price comparison site.
- https://fararu.com/fa/news/1000266/ — Fararu: market over factory price for zero-km cars in early 1405 (**seen only as a search summary**).
- https://rahbordemoaser.ir/fa/news/319636/ — monthly price report for Shahrivar 1405.
- Academic: Hadinejad and Shabgard (2011), Abounoori and Rezvani (2012) model new-car features; **seen only as abstracts**, no used-car coefficients to reuse. No Iranian hedonic study of used-car prices was found.
- Our own data: the local database on 2026-09-30 and the Divar parser (`apps/worker/src/sources/divar/attributes.ts`, parser version 2); Divar's statistics on misstated condition from `2026-09-28-listing-data-and-freshness.md`.

## Findings

### How appraisers price a car

Start from the zero-km market price of the same model and trim and from prices of similar used cars, then take percentages off for age, mileage above the norm, paint and replaced panels, chassis, engine and colour, and 5–10 % more for a model that sells poorly («بدفروش») (Hamrah-e Mechanic, Khodro45). Deductions add up panel by panel (Azki, Bimeh.com).

### Factors, largest first

S marks a sourced figure, I our inference.

| # | Factor | Typical effect | Source |
|---|---|---|---|
| 1 | Make, model and trim | Sets the base; the automatic Peugeot 207 sells about 100M toman above the manual on the market (50M at the factory); a slow seller loses 5–10 % more | S: bankavl, Hamrah-e Mechanic |
| 2 | Free-zone plate («منطقه آزاد») against national | The same car on a national plate costs 83 % (Elantra) to 106 % (Azera) more: a separate market | S: Donya-ye Khodro |
| 3 | Model year | Cumulative loss about 12 %, 18 %, 23 %, 27 % after years 1–4, flattening after year 6–7; another rule says 5–10 % a year. In toman terms inflation often hides it | S: Hamrah-e Mechanic |
| 4 | Body paint | Spot («لکه») 1–3 %, fender 2–3 %, hood or door 3–4 %, trunk 3.5–4.5 %, roof 5–7 %; a replaced panel 1–2 points more than a painted one; two panels such as roof and hood up to 15 %; fully repainted («تمام رنگ») 20–30 %; replaced cabin about 40 %; no deduction for bumpers, factory paint or paintless dent repair; front damage weighs more | S: Azki, Bimeh.com, Hamrah-e Mechanic, Khodro45 |
| 4a | «دور رنگ» | No source gives a figure; between multi-panel paint and a full repaint, about 10–20 % | I |
| 5 | Chassis | Chassis, pillar or roof hit 5–10 %; replaced chassis 7–10 %; buyers avoid it, so dealers discount more | S: Hamrah-e Mechanic, Azki, Bimeh.com; I for the last part |
| 6 | Engine | Replaced engine 6–8 %; faults by the cost of repair | S: Azki |
| 7 | Mileage | Norm 17–25k km a year; a car driven well over it («پرکار») is discounted; no per-km coefficient published. Example: 100k km in 5 years, about 29 % with age | S: Khodro45, Hamrah-e Mechanic, Asriran |
| 8 | Zero-km against «کارکرده صفر» | A registered car under 1,000 km loses about 4 %, over 1,000 km about 8 %; zero-km market prices ran about 68 % above factory prices in early 1405 (107 % for the 207 panorama), so factory prices are no reference | S: Khodro45; Fararu (summary only) |
| 9 | Colour | White, black and silver sell easiest and price alike; an unpopular colour loses 5–10 % | S: Khodro45, Pedal, Hamrah-e Mechanic |
| 10 | Gearbox and fuel | Automatic above manual (the trim carries it); aftermarket dual-fuel probably discounted, unquantified | S for gearbox; I for fuel |
| 11 | Third-party insurance left | Less time left, lower price; worth roughly its premium. The no-claims discount stays with the owner since about 1399, so it no longer moves the price | S: Khodro45; I for the size |
| 12 | Import clearance year («سال ترخیص») | Buyers treat a later clearance as younger; unquantified | I |
| 13 | Market drift | Average car prices rose about 17 % in Shahrivar 1405 alone, imports 23 %; weekly moves of several percent follow the dollar | S: rahbordemoaser |
| 14 | Seller type, instalments, document («سند تک‌برگ») | Unquantified; an instalment price includes financing; dealers probably ask 3–5 % more | I |

### What our listings carry

- **Structured on Divar and parsed**: brand and model (trim for some), model year (`model_year_sh`, `model_year_written`), mileage, gearbox, fuel (factory and aftermarket dual-fuel apart), colour, third-party insurance months left, instalments possible, swap accepted, seller type, city and district, price type (asking, negotiable, placeholder).
- **The seller's own scores, parsed**: body (intact, minor scratches, paintless dent repair, partly repainted, repainted around, fully repainted, accident, salvage), engine and gearbox (sound, needs repair, replaced), front and rear chassis (intact, repainted, damaged). They are claims: Divar's own figures say about 20 % of listings misstate body condition.
- **On Divar, not parsed**: ownership, technical inspection, delivery voucher («حواله»).
- **Free text only**: which panels were painted or replaced, how many spots, free-zone plate, clearance year, engine replacement details, the document.
- **Volume, 2026-09-30**: 6,765 listings, of which 714 carry an asking price (the rest were seen only on list pages, or are negotiable or placeholders). The best-covered models have about 150 priced listings each (Peugeot 206 and 207i) over 12 to 22 model years; then Dena Plus 89, Samand Soren 63, Peugeot Pars 58, Pride 131 48. Body condition is known for about 630, colour for about 750.

## Recommendation

A market value from comparables, fitted per model because the data are thin:

- **Segment** (only like with like): model, and trim where known; national plate only (free-zone listings get no rating until the plate is extracted, CS-52); used only (a zero-km listing gets no rating); a comparables window of about 30 days so dollar-driven drift does not mix old and new prices.
- **Adjust** inside the segment with coefficients of a log-price regression: age from the model year, mileage against a norm of about 20k km a year, body condition in buckets, chassis damage, an off-colour flag, aftermarket dual-fuel, and the listing week. The sourced percentages above bound what the fit may learn, so a thin segment cannot learn that paint raises a price. A model with too few listings borrows the coefficients pooled over all models and fits only its own level.
- **Exclude from comparables and give no rating**: fully repainted, accident-damaged and salvage cars, a replaced engine; negotiable, instalment and placeholder prices.
- **Ignore in the first version** (show as facts, not adjustments): insurance months left, seller type, swap, district, clearance year, exact panel counts.

The trade-off: a pooled regression rates more listings than exact-match medians but explains itself less simply; the explanation shows the comparables and the adjustments applied. What would change this: a few thousand priced listings per model would let segments be exact (model, trim, year) with medians, which are easier to explain.
