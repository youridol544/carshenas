# S02: Search filters and catalogues

- Status: approved (decided under the owner's delegation, 2026-10-01; CS-58)
- Date: 2026-10-01
- Tasks: CS-58 (this spec); read by CS-59 (search and API), CS-61 (search page), CS-62 (plain-Farsi search), CS-63 (home page), CS-70 (search files), CS-72 (matching)
- Related: ADR-0027 (definitions in one package, the row contract, one serialisation), S01 (deal ratings), ADR-0014 (tomans, Jalali), ADR-0017 (live bounded index), `docs/research/2026-09-30-cargurus-autolist-jabama-teardown.md`, `docs/design/data-model.md` ("Added by CS-58")

## Users and goal

A buyer narrows Tehran's used-car market to the cars worth looking at, by the facts the listings state (make, year, mileage, price, paint, the engine) and by what Carshenas adds (the deal rating, the condition read from the text). The same filters appear everywhere a search does: the search page's sheet and chips, the home page's catalogue rows and body-type selector, a search file («پرونده‌ی جست‌وجوی خودرو») that keeps watching, and plain-Farsi search, which turns words into these filters. A **catalogue** is a premade search with a Farsi title: nothing more than filter values and an order.

## Flows

1. **Filter sheet and chips (CS-61).** The sheet lists the filters by group («خودرو», «قیمت و معامله», «بدنه و فنی», «شرایط فروش», «مکان و فروشنده», «آگهی»); applied values show as chips («تا ۱ میلیارد تومان», «مدل ۱۳۹۸ تا ۱۴۰۲», «بدون رنگ»), each removable on its own. The URL holds the whole search.
2. **Catalogue rows (CS-63).** The home page shows the catalogues in order, «پیشنهاد کارشناس» first, each a row of cards linking to `/search?catalogue=<id>`.
3. **A catalogue on the search page (CS-61).** Tapping one applies its filters and order; its title shows while nothing has changed; changing a filter keeps the change and forgets the title (the URL still says where it started).
4. **Search file (CS-70).** «بسپارش به کارشناس» stores the current search in its stored form: versioned, every catalogue expanded to its filters, so a later change to a catalogue never changes a buyer's file.
5. **Plain-Farsi search (CS-62).** The model answers in the same search schema; its filters are validated like the sheet's input and shown as chips the buyer can remove. A request that names no model («یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه») maps to the filters below: `paint_free`, `no_accident`, `no_replaced_parts` (clean), `low_mileage_for_age` (کم‌کار), `engine_condition`, `gearbox_condition` and `chassis` sound (technically sound), `popular_model` (بی‌دردسر), which together are the catalogue «تمیز و بی‌دردسر».

## Rules

### The filters

Each filter is one definition in `packages/search/src/filters.ts`; its predicate names one column of `listing_filter_row`. "Declared" means the seller chose it in the site's own field; "text" means CS-52 read it from the listing's words and the field was accepted.

| Filter (URL) | Kind | Keeps | Data behind it |
|---|---|---|---|
| برند (`make`) | choice, from the database | the makes chosen | the catalogue match (CS-50) |
| مدل (`model`) | choice, from the database | `make.model` keys (`peugeot.206`) | the catalogue match |
| تیپ (`trim`) | choice, from the database | `make.model.trim` keys; a listing matched only to its model is dropped | the catalogue match |
| نوع بدنه (`body`) | choice, from the database | the trim's body type where it has one, else the model's | `body_type`, curated per model (CS-50) |
| سال ساخت (`year`) | range | Solar Hijri model years, both ends included | `model_year_sh` |
| حداکثر عمر (`age`) | limit | model year at least the current Jalali year minus N; moves with the calendar | `model_year_sh` |
| کارکرد (`km`) | range | kilometres as stated; unknown mileage is dropped | `mileage_km` |
| کم‌کارکرد نسبت به سن (`lowkm`) | on/off | at most 12,000 km per year of age, a car under a year counted as half a year | mileage and year; S01's norm is 20,000 km a year, Tehran's median about 16,000 on 2026-09-30 |
| مدل پرطرفدار (`popular`) | on/off | the 15 models with the most active listings | computed from the listings themselves |
| قیمت (`price`) | range | asking prices in whole tomans; negotiable and instalment listings have none and are dropped | `asking_price_toman` |
| ارزیابی قیمت (`deal`) | ranked | the rating chosen or better: `good` keeps great and good | the latest succeeded valuation run (S01) |
| گیربکس (`gearbox`), سوخت (`fuel`), رنگ (`colour`) | choice | codes; colour by family («سفید» keeps «سفید صدفی») | declared |
| بدون رنگ (`nopaint`) | on/off | a body declared intact, scratched or dent-repaired without paint, or the text saying unpainted; any paint in the text, a spot included, drops it | declared and text |
| وضعیت بدنه (`bodystate`) | ranked | the body condition chosen or better, from «سالم و بی خط و خش» to «اوراقی» | declared |
| وضعیت موتور (`engine`), وضعیت گیربکس (`gearboxstate`) | choice | sound, needs repair, replaced | declared |
| وضعیت شاسی (`chassis`) | choice | intact (both chassis declared intact, or the text says so when neither is declared), repainted, damaged (declared or in the text) | declared and text |
| بدون تصادف (`noaccident`) | on/off | drops a body declared accident-damaged or salvage and a text that states an accident; silence passes | declared and text |
| بدون تعویض بدنه (`noreplaced`) | on/off | drops a text that states a replaced body part | text |
| کار نکرده در تاکسی اینترنتی (`notaxi`) | on/off | drops a text that says it worked for Snapp, Tapsi or as a taxi | text |
| بدون پلاک منطقه آزاد (`nofreezone`) | on/off | drops a text that states a free-zone plate | text |
| بیمه‌ی شخص ثالث (`insurance`) | limit | at least N months of third-party insurance left | declared |
| معاوضه (`swap`), فروش قسطی (`installments`) | on/off | the site's field or the text offers it; a down-payment price counts as instalments | declared and text |
| شهر (`city`), محله (`district`) | choice, from the database | the city's slug; the district as the listing names it | declared |
| فروشنده (`seller`) | choice | private or dealer | the source |
| منبع (`source`) | choice, from the database | the sources chosen | `source`; a new source needs no code |
| عکس‌دار (`photo`) | on/off | listings with at least one photo address | `listing_photo` (ADR-0025) |
| زمان انتشار (`posted`) | limit | listed within the last N days, by the database's clock | `listed_at` |

- WHEN a filter's options come from the database THE SYSTEM SHALL offer only values that active listings have, with their count; body types in the catalogue's order, the others most listed first.
- WHEN a text fact is not stated, not accepted, held for review, or belongs to an older snapshot than the listing's current one THE SYSTEM SHALL treat it as unknown: exclusion filters (`noaccident`, `noreplaced`, `notaxi`, `nofreezone`) keep the listing, positive filters (`nopaint`, `chassis`) do not.
- Descriptions say what the data cannot: a declared condition is the seller's claim, not an inspection, and not stating an accident is not having none.

### The catalogues

In order (`packages/search/src/catalogues.ts`, each with its reason in code):

| Catalogue | Filters | Order | Why it exists |
|---|---|---|---|
| پیشنهاد کارشناس (`karshenas-pick`) | deal good or better; no paint, no accident, no replaced part; engine, gearbox and chassis sound | best deal | The product's headline: what an expert would shortlist. Always first. |
| معامله‌های عالی زیر ۱ میلیارد (`great-deals-under-1b`) | deal great; price up to 1,000,000,000 | best deal | The budget line most first-car and family buyers in Tehran search under. |
| تمیز و بی‌دردسر (`clean-and-easy`) | clean; technically sound; low mileage for its age; popular model | best deal | The request buyers make without naming a model. |
| خانوادگی (`family`) | sedan, crossover, SUV, minivan or wagon; at most 10 years old; technically sound | best deal | Families are the largest group of buyers. |
| کم‌کارکرد (`low-mileage`) | low mileage for its age | best deal | Mileage is the second price factor after paint. |
| دنده‌اتوماتیک (`automatic`) | automatic; fair price or better | best deal | Tehran's traffic; automatics are few and hard to find by scrolling. |
| مناسب کار در تاکسی اینترنتی (`ride-hailing`) | popular model; at most 10 years old; engine and gearbox sound | best deal | Many buyers buy to work; the description sends them to each service's own rules. |
| فروش قسطی (`installments`) | instalments offered | best deal | Instalment sales are common and hidden behind down-payment prices. |
| تازه‌های امروز (`new-today`) | listed today | newest | Good deals sell within days. |

### The orders

Best deal (the most below market value first, unrated last; the default), cheapest, most expensive, lowest mileage, newest listing, newest model year. Each ends on the listing id, so pages can use keyset pagination.

### One schema, one serialisation

- A search is `{ q?, filters, sort?, catalogue? }`, checked by `SearchSchema` wherever it arrives from.
- URL form: one parameter per filter, a choice repeated per value (`?make=peugeot&make=kia`), a range `min..max` with either end open (`price=..1000000000`), a flag `1`; an unchanged catalogue is `?catalogue=<id>` alone. Persian digits and commas typed into an address are read. A value that fails its schema is dropped and named (`ignored`), never guessed; unknown parameters are passed over.
- Stored form (search files, the API's JSON body): `{ v: 1, …search }`, canonical, a catalogue always expanded. A stored search that no longer fits the schema is refused, never repaired.

## What we are NOT doing

- Text matching of `q` and the search table: CS-59 builds `search_document` from `listing_filter_row` with the same column names, and its text index.
- Facet counts for every filter: CS-59 (the options here count active listings for the database-backed filters only).
- Any number a model wrote: plain-Farsi search chooses filter values; the numbers a buyer sees still come from the database.
- Freshness and tracked-model scope of results (ADR-0017): CS-59's base scope, applied beside the filters.

## Success criteria

- Automated: `packages/search` unit tests (every definition has a Farsi label, description, words and test cases; a search with every filter round-trips the URL, the API and a stored file); `pnpm db:check` runs every filter's cases and every catalogue's expected fixtures through the SQL on the web app's role, the database-backed options, and a new source and body type found without a code change.
- Manual: in the In Review column, read the catalogue titles and chips in Farsi, and the counts per catalogue on the local data (CS-58's notes).

## Open questions

- Popularity is the 15 most listed models; once the superadmin tracks more models (CS-53), check that the threshold still separates common models from rare ones.
- Whether `no_accident` should require the seller to state it: kept as an exclusion because only a few listings state it (CS-52's coverage on 2026-09-30).
