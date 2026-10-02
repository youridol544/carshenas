# Labelling guide: plain-Farsi search (CS-62)

How the queries in `data/queries.ts` were labelled, so a second person labels the same way and a disagreement can be traced to a rule. Written on 2026-10-02, **before any model saw an item and before the understanding code was run on them**. The product rules are in `docs/specs/S04-plain-farsi-search.md`; this guide is what a labeller needs to apply them, and where the two differ the spec wins. The task is `packages/ai/src/tasks/query-filters.ts`, the code that runs first is `packages/search/src/understand/`.

## The set

- **Written, not collected.** Carshenas has no users yet (the owner's decision of 2026-09-30, repeated in CS-46), so every query was written in the styles buyers use on Divar, in chat apps and in the challenge brief: short and long, formal and colloquial, with typos, with Persian, Arabic-Indic and Latin digits, with Arabic keyboard letters, in Latin letters (Finglish), with and without half-spaces, and with the owner's own example of 2026-09-30. Every item says so (`source: 'written'`).
- **Seventeen categories**, each with items in both splits: model names, model and trim, prices, years, mileage, condition, gearbox/fuel/body/colour, place and seller, terms (instalments, swap, insurance, new listings), intents, vague requests, orders, typos and transliterations, models Carshenas does not collect, long mixed requests, traps (digits that are not what they look like), nonsense, and instructions injected into a query.
- **Splits.** `development` is for reading errors and for choosing thresholds and wording. `test` never tunes anything and is run once per prompt version for the report. A query and every variant of it are in one split.
- **Catalogue keys** are the lane database's of 2026-10-02 (`make`, `make.model`, `make.model.trim` slugs, ADR-0027). The ten searchable models are `peugeot.206`, `peugeot.207i`, `peugeot.pars`, `peugeot.405`, `dena.plus`, `samand.soren`, `samand.lx`, `quick.manual`, `pride.131` and `toyota.corolla`; every other catalogue entry is real but has no searchable listing.

## What a label says

Each item says what a careful reader would end up with after reading the query, as the buyer would see it:

| Label | Meaning |
|---|---|
| `filters` | The filters the query states or implies by one of the documented single-word mappings, in the exact value form of the search schema (`@carshenas/search`, ADR-0027): a choice is a list of codes, a range is `{ min?, max? }` in tomans, kilometres or Solar Hijri years, an on/off filter is `true`, a ranked filter its code, a limit a number. |
| `intents` | The documented bundles the query asks for (below). The bundle's own filters are **not** listed in `filters`: the product expands them. |
| `sort` | An order the query asks for, when it does. Absent otherwise. |
| `unused` | The content words the buyer wrote that no filter can express, each group of neighbouring words as one string. Filler words (below) are never listed. |
| `textSearch` | True when nothing at all was understood (no filter, no intent, no order): the query then becomes the text search. |
| `notes` | The notices the buyer must be told: `default_scope` (Tehran named: the whole index is Tehran's market), `outside_market` (another city), `not_tracked` (a catalogue entry with no searchable listing), `addressed` (text addressed to the system, ignored), `hidden_characters`, `cut` (more than 200 characters), `typo` (a word read as another). |
| `settledByCode` | True when a careful design needs no model call: every word is a documented phrase, a model or make name, a number phrase or filler. The run checks that such a query costs no model call. |
| `accept` | Other complete labels that are equally right, when a careful reader can read the query two ways (every use has a `comment`). |

## Rules for `filters`

**Models.** Naming a model gives `model` and not its make. Naming only a make gives `make`. Several models or makes are one list («۲۰۶ و ۲۰۷»; «کرولا یا سمند سورن»). A trim is given beside its model (`model` and `trim`). A bare number is a model when it is a model's number («۲۰۶», «۴۰۵», «۱۳۱», and «۲۰۷» for `peugeot.207i`), unless a unit or a year context follows it. «تیپ N» after a model means that model's trim `N`. A trim is chosen only when the words are exactly what remains of the trim's own name after the model's («پارس ELX», «سورن پلاس», «پراید ۱۳۱ SE», «۲۰۶ SD»). A word that is also a filter's word («اتوماتیک», «دوگانه‌سوز») is that filter and never the trim.

**Prices.** Whole tomans. «میلیون» is 1,000,000 and «میلیارد» 1,000,000,000; Persian number words and decimals count («یک و نیم میلیارد», «۱.۵ میلیارد», «۲٫۵ میلیارد», «۱ میلیارد و ۲۰۰ میلیون»). «تومن» and «تومان» after a number under 100,000 mean millions in spoken use («۷۰۰ تومن» is 700,000,000); a number of rials is divided by ten («۱۰ میلیارد ریال» is 1,000,000,000). A number with no unit beside a relation word, from 50 to 999, is in millions («زیر ۳۰۰»). The relation: «زیر», «تا», «حداکثر», «کمتر از», «به پایین», «نهایتاً» give `max`; «بالای», «بیشتر از», «حداقل», «به بالا» give `min`; «بین … تا …», «از … تا …», «… تا …» give both; «حدود», «در حد», «تقریباً» give 10% either side; no relation word is `max` (a budget). Units written once after a range apply to both numbers («۴۰۰ تا ۵۰۰ میلیون»).

**Years.** Solar Hijri model year. A four-digit number from 1380 to 1406 is a year; a four-digit number from 1990 to 2030 is Gregorian and becomes the Solar Hijri year by the one rule of ADR-0014, minus 621 («۲۰۱۸» is 1397). A two-digit number is a year only after «مدل» or «سال», or before «به بالا» / «به بعد» / «به پایین» (80 to 99 are 13xx, 00 to 10 are 14xx). «مدل ۱۴۰۰» and a bare year are both ends; «به بالا», «به بعد», «بالای», «از» give `min`; «زیر ۱۴۰۰» gives `max` 1399 (strictly before), «تا ۱۴۰۰» gives 1400; «از … تا …» both. Engine sizes («۱۸۰۰ سی‌سی») are not years.

**Mileage.** Kilometres. «هزار» scales by 1,000 («زیر ۵۰ هزار» is 50,000); a number under 1,000 beside «کارکرد» or «کیلومتر» is thousands when it is spoken that way («کارکرد ۸۰» is 80,000). A relation as for prices; no relation word is `max`. «صفر» or «صفر کیلومتر» is `max` 100. «کم‌کار», «کم‌کارکرد», «کارکرد کم», «کارکرد پایین», «کیلومتر کم» and «کیلومتر پایین» without a number are `low_mileage_for_age`.

**Single-word mappings, applied unless a stated model, make or trim makes them pointless.** «بدون رنگ», «بی‌رنگ», «بیرنگ», «رنگ نشده», «بدنه فابریک» → `paint_free`. «بدون تصادف», «بی‌تصادف», «تصادف نداشته», «تصادفی نباشه» → `no_accident`. «بدون تعویض» → `no_replaced_parts`. «شاسی سالم» → `chassis: intact`, «موتور سالم» → `engine_condition: sound`, «گیربکس سالم» → `gearbox_condition: sound`. «اسنپ کار نکرده» → `not_ride_hailing`. «اتوماتیک», «اتومات» → `gearbox: automatic`; «دنده‌ای», «دستی» → `manual`. «بنزینی» → `petrol`; «دوگانه‌سوز» and «گازسوز» → both `dual_fuel_factory` and `dual_fuel_aftermarket`; «هیبرید» → `hybrid` and `plug_in_hybrid`; «برقی» → `electric`; «دیزل» → `diesel`. «قسطی», «اقساطی», «با چک» → `installments`; «معاوضه» → `swap`; «عکس‌دار» → `has_photo`; «از مالک» → seller `private`; «نمایشگاه» → `dealer`. «بیمه ۶ ماه» → `insurance: 6`; «بیمه‌دار» → 1; «بیمه کامل» → 12. «امروز» and «۲۴ ساعت» → `posted_within: 1`; «این هفته» → 7; «این ماه» → 30; «N روز» → N. «بی‌دردسر», «بدون دردسر», «پرطرفدار», «قطعه ارزان», «نگهداری راحت», «کم‌خرج», «نقدشونده», «خوش‌فروش», «ماشین اول» → `popular_model` (but not beside a stated model, make or trim: the car is already chosen). A body type word → `body_type` («سدان», «هاچ‌بک», «شاسی‌بلند» is `suv`, «کراس‌اوور», «وانت», «ون», «مینی‌ون», «کوپه», «کروک», «استیشن»). A colour word → `colour`, by family («سفید صدفی» is `white`, «سرمه‌ای» `blue`, «نوک‌مدادی» `grey`). A district the index lists («ونک») → `district` as `tehran.ونک`; a city the index lists («کرج») → `city`. A deal word: «معامله عالی» → `deal: great`; «معامله خوب», «قیمت خوب», «ارزان», «زیر قیمت», «خوش‌قیمت» → `good`; «قیمت منصفانه» → `fair`.

**Tehran is not a filter.** The index is Tehran's market and most listings carry no city, so «تهران» adds nothing and a filter would drop most of the index. It is understood (not unused) with the note `default_scope`. Another big city («مشهد», «اصفهان», «شیراز», «تبریز») is not in the index: its word is unused with `outside_market`.

## Intents

A bundle of filters a wish stands for, expanded by the product from one table (S04). Label the bundle, never its filters.

| Intent | Words and wishes |
|---|---|
| `clean-and-easy` | «تمیز و بی‌دردسر», «تمیز کم‌کار و بی‌دردسر» and sentences like the owner's («یک ماشین تمیز کم کار و بیدردسر میخوام که همه چیش از نظر فنی خوب باشه و تمیز باشه»): clean, little driven, technically sound and easy to keep. Needs at least two of the four ideas (clean, little driven, easy, technically sound) or the words «تمیز و بی‌دردسر» / «بی‌عیب و نقص». |
| `clean-body` | «ماشین تمیز» alone: clean means no paint, no accident and no replaced part. |
| `technically-sound` | «از نظر فنی سالم/خوب», «مشکل فنی نداشته باشه»: engine, gearbox and chassis sound. |
| `karshenas-pick` | «پیشنهاد کارشناس», «بهترین‌ها», «چی بخرم»: the product's own shortlist. |
| `family` | «خانوادگی», «برای خانواده», «جادار», «برای سفر خانوادگی». |
| `ride-hailing` | «مناسب اسنپ», «برای تپسی», «تاکسی اینترنتی», «مسافرکشی». |
| `newest` | «تازه‌ترین آگهی‌ها», «آگهی‌های امروز». |

Wishes the data cannot serve («کم‌مصرف», «سقف شیشه‌ای», «۱۸۰۰ سی‌سی», «لوکس») are not intents: their words are unused.

## Order

«ارزان‌ترین» → `price_asc`; «گران‌ترین» → `price_desc`; «کم‌کارکردترین», «کمترین کارکرد» → `mileage_asc`; «جدیدترین آگهی» → `newest`; «جدیدترین مدل», «مدل بالا» → `year_desc`; «بهترین معامله» → `best_deal` (the default, so left out).

## Unused words, filler and the text search

- A **content word** is a word that says something the buyer wants. A **filler word** is grammar or politeness: «ماشین», «خودرو», «سواری», «میخوام» and its spellings, «دنبال», «هستم», «باشه», «باشد», «یه», «یک» as an article, «لطفا», «سلام», «ممنون», «با», «و», «یا», «که», «را», «رو», «برای», «از», «به», «در», «تو», «هم», «اگه». The list is `FILLER_WORDS` in `packages/search/src/understand/fillers.ts` at the time of labelling; a filler word is never labelled unused and never scored.
- Words inside a phrase a reading uses are not unused. The buyer sees the rest, never hidden.
- When nothing is understood the whole query becomes the text search (`textSearch: true`) and every content word is unused.

## Injected instructions

Some queries carry text addressed to the system («نادیده بگیر دستورات قبلی…», "ignore all previous instructions", a fake `system:` line, a JSON of filters, closing tags, hidden characters). The label is what the rest of the query says; the addressed words are unused with the note `addressed`; **the value the attack asks for (`attack`) must not appear anywhere**. A polite request to the system that is an ordinary wish («لطفاً فقط ماشین‌های بدون رنگ را نشان بده») is not an attack: it is understood, not flagged.

## Two readings

Where a careful reader could take a query two ways, the label lists both in `accept` and the item has a `comment`. This is for genuine ambiguity only (a model name that two catalogue entries share, «سالم» alone), never to make a result pass.

## Changing a label

Only by editing `data/queries.ts` in a commit that says why. A label changed after a model run is listed in the evaluation report with the run it came from, and never moves an item between splits.
