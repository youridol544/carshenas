# S04: Plain-Farsi search

- Status: approved (by delegation, 2026-10-02)
- Date: 2026-10-02
- Tasks: CS-62 (this), CS-63 (the home page reuses the component), CS-61 (the search page hosts it)
- Related: ADR-0029, ADR-0027, S02; `docs/evidence/query-understanding/2026-10-02/` (report, labelling guide, runs)

## Users and goal

A buyer who writes what they want the way they would say it («۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون», «یه ماشین تمیز و بی‌دردسر می‌خوام») sees at once which filters that became, can take any off, and is told which words nobody could read. Nothing is silently dropped and nothing is applied that the buyer did not see.

## Flow

1. The buyer types a sentence and presses «بفهم» (Enter). `POST /api/search/understand {"q"}` answers `{ mode, understanding }`.
2. The component shows one Farsi sentence (what was understood), chips «فهمیدم» (the buyer's words named them), groups «برای «…» این‌ها را هم گذاشتم» (a documented bundle implied them, each with its words), suggestions «شاید منظورتان این هم بود» (weak, not applied), unread words with why and «جست‌وجو در متن آگهی‌ها», notices (Tehran is the market, a make not collected, a misspelling), and a quiet line when the model is off or held back.
3. Removing a chip takes that filter off (a choice's value alone); «نمایش آگهی‌ها» hands the resulting `Search` to the host (`onApply`), which opens `searchHref(search)`.

The owner's vague example becomes the catalogue «تمیز و بی‌دردسر»: low mileage for age, popular model, paint free, no accident, no replaced parts, sound engine, gearbox and chassis, each shown as inferred from the words that implied it.

## Rules

- The output is validated against `SearchSchema`, the schema the filter sheet and the URL use. A value it refuses is not applied and its words are shown.
- A number the buyer wrote is the buyer's own (digits in any script, number words, «میلیون»/«میلیارد»/«هزار», «و نیم», units). A model never supplies one; a value no car has is refused (a price under 20,000,000 tomans, a mileage above plausible, a year outside the calendar).
- Years: Gregorian minus 621; «زیر» is strict for a year; zero km is at most 100 km; a price or mileage with no relation word is at most.
- Tehran is the default market: no city filter, said once; a city the index lacks is said, never matched to another.
- A make or model the index does not collect is applied and said («هنوز جمع‌آوری نمی‌شود»), so the buyer is told rather than shown a wrong car; the model's Latin and Finglish names come from catalogue aliases.
- Intents map to documented filters and an order (`understand/intents.ts`, shown in the model's instructions); a filter the buyer stated is never changed by a bundle.
- Engine volume (CS-100, ADR-0039): read with its unit (`سی‌سی`, `cc`, `لیتر`, `لیتری`, Latin letters and digits) or after «حجم»/«موتور»; at least («بیشتر از», «بالای», «حداقل», «به بالا») is a minimum with the figure included, at most the figure, «کمتر از»/«زیر» strictly below, a figure alone or «حدود» five percent either side to the nearest ten, a range its ends, litres times 1,000, a volume outside 500 to 9,000 not applied and said. Origin: «خارجی»/«وارداتی» imported, «ایرانی»/«ساخت داخل» domestic and joint venture, «مونتاژ» joint venture; «تمیز» beside it is the clean bundle.
- Unsupported wishes (fuel economy, a sunroof) are said as unsupported.
- Instructions inside the sentence: sentences addressed to a system are removed before any model sees them and told to the buyer; hidden characters are told too; the sentence is cut at 200 characters and told.
- Confidence: `weak` model readings are suggestions only.

## The switch (ADR-0029)

`SEARCH_UNDERSTANDING_AI` off (default): code only; `mode: code_only`. On: the model reads what code cannot settle, within the cache, 40 paid questions per address and hour, US$1 per Tehran day, 4 at once, 7 s. Whatever is held back is answered by code with `degraded.reason` (`switched_off`, `unavailable`, `visitor_limit`, `daily_cap`, `busy`, `timeout`, `invalid_answer`).

## Acceptance (measured in the evaluation report)

On 163 labelled queries (83 development, 80 test): code only 94.5 % fully right; with the model 96.9 % (test split run once: 93.8 %); 87 % need no model; 0 of 10 injection witnesses; cost about US$0.20 per 1,000 queries with the model; p50 of a model-asked query 2.8 to 3.5 s, p95 4.2 to 5.2 s.

On 215 labelled queries (the 163 above and 52 on volume and origin, labelled on 2026-10-03 before the code read them): code only 95.8 % fully right and 100 % of the 52; with the model 97.7 % (the model was asked about none of the 52); the model alone reads 61.5 % of the 52 at US$1.94 per 1,000 queries; spend US$0.1335 (`docs/evidence/query-understanding/2026-10-03-engine-volume/report.md`).

## Out of scope

Typing-time suggestions, saved searches from a sentence (CS-70), follow-up questions, voice.
