# The bake-off's data (CS-46)

What `pnpm --filter @carshenas/ai bakeoff` runs the models on, labelled by hand. The research note is `docs/research/2026-09-30-model-per-ai-step.md`. CS-48 builds the product's labelled set; these files are only what chose the models.

## The files

- `listings.json`: 36 real Divar listings, crawled on 2026-09-30 by lane F (one discovery round, the owner's approval), and X01 to X03, three copies of real listings with injected instructions and the values each injection asks for (`attack`). Personal data is removed: sales staff names («خانم [نام]»), gallery names («[نام نمایشگاه]»), street addresses («[نشانی]») and registration codes; the crawler had already removed phone numbers. No Divar token is kept (ADR-0017 point 7); `snapshotId` is the snapshot's row.

## Where the listings are

All 120 listings of that discovery round, with their snapshots and first price events, are in the main checkout's database (`carshenas`, port 5418), copied from lane F's on 2026-09-30 with the same ids, so every `snapshotId` here is that database's row: CS-34, CS-48, CS-50 and CS-51 start from them. The copy is checked row for row (the checksums are in `~/Dev/carshenas-db-backups/2026-09-30-lane-f-divar-listings-counts.txt`, beside the dump). Lane F's own request log of the round (`crawl_run`, `fetch_log`) stayed in lane F's database: its ids overlap CS-33's measurement in the main database, and the crawl-run guard refuses runs for a paused source.
- `queries.json`: 24 searches written in the styles buyers use (the owner's decision of 2026-09-30: the product has no users yet, so they are written, not collected).
- `duplicates.json`: 20 questions built from the listings. In P01 to P10 one candidate is the same car as its seller would re-list it on another site, written by hand from the real listing with every fact kept (model, year, mileage, colour, paint, replaced parts, chassis, accident, terms) and the wording, the site and at times the price changed a little. Every other candidate is a real listing of another car, often a near miss of the same model, year and colour.
- `deals.json`: 20 deal fact sets, four per rating band, from the listings' stated condition. The band is set by hand: there is no market value before CS-51.

## Labelling rules

Set before any model saw an item, from the full text:

- A fact is labelled only from the title and the description. Divar's structured fields and the seller's ratings (engine, chassis, body, gearbox) are left to CS-34, even where they would settle a fact.
- Paint: the most severe paintwork stated. «لیسه» and a few fingers of «آبرنگ» are touch-ups (spots); «... ولی به اسم دور رنگ میدم» is sold as fully painted (full); a body that «دور رنگ میخاد» needs a repaint and is not stated as painted (not stated).
- Replaced: body panels and structural parts only («درب صندوق استوک», «قوطی زیر رادیاتور»); bumpers, lights, glass, the engine, the gearbox, the suspension and consumables («تعویضی‌ها», «مصرفی‌ها») are not.
- Chassis: damaged when the text states damage to it, repaired or not, even beside «شاسی سالم» («فقط پالونی ترک دست اندازی دارد»: the front chassis rail).
- Accident: an explicit «تصادف نداشته» decides; a stated collision or knock («ترافیکی برخورد داشته», «ضربه جزئی ترافیکی») is had_accident.
- Price terms: «تخفیف» for insurance («۷۰٪ تخفیف بیمه بدنه») is not a negotiable price; a price shown as a down payment is an instalment sale.

## Labels changed after the first run

Every disagreement between a model and a label in the first run was read again. Where a careful reader could read the text two ways, the label now accepts both; where the label says what the text states, it was kept, even when every model disagreed. Changed on 2026-09-30:

| Item | Field | Was | Now | Why |
|---|---|---|---|---|
| L04 | paint | full | full or partial | Several painted pieces, sold as fully painted |
| L05 | accident | none | none or had_accident | «تصادف نداشته» beside a very minor traffic knock |
| L12 | paint | spots | spots or partial | «درب راننده قسمتی آبرنگ»: part of a door, size not given |
| L19 | paint | full | full or partial | «۴ـ۵ تیکه رنگ ولی به اسم دور رنگ میدم» |
| L22, X03 | chassis | not stated | not stated or damaged | Corrosion of the trunk floor, which the text does not call the chassis |
| L25 | chassis | intact | intact or not stated | «سقف ستون عقب جلو پلمپ» without the word شاسی |
| L27 | accident | had_accident | had_accident or not stated | The car hit a kerb |
| L28 | chassis | not stated | not stated or damaged | «از پشت کف صندوق ضربه دارد»: the trunk floor |
| Q14 | has_trim | false | either | «اتومات» can name the trim |
| Q19 | has_trim | false | either | The instructions list «پلاس» as a trim word, though it is part of this model's name |
| Q20 | has_trim | true | either | «جدید» is not among the instructions' trim words |

Kept although every model disagreed: L03's paint (spots, from «بیرنگ ولی لیسه دارد») and L23's chassis (damaged, from «پالونی ترک»). The prompt did not define «لیسه» or «پالونی», a gap for CS-52's glossary.
