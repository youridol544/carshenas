# Copy rewrite, area B: search, filters, understanding, the listing page and the cards (CS-107)

Written on 2026-10-04 on branch `cs-107-copy-b` for the owner’s copy feedback of that day, to the voice guide (`docs/design/product-voice.md`, CS-104) and with the lint of CS-105. Every string of the area was listed with `pnpm copy:inventory --strings B` (the "before") and read as part of its screen’s set; the tables below are generated from that list and from the files after the change, so every string is exact, half-spaces included. Strings only: no component, prop or file was added, nothing moved, no constant was renamed (the few edits that are not words are listed under «Code touched besides words»).

## In numbers

| | Count |
|---|---:|
| Strings reviewed (the inventory of area B, 20 files; 4 of them held only a « · » separator) | 408 |
| Kept: read again, reason below | 245 |
| Rewritten: the words changed (the first table of each screen) | 129 |
| Removed | 34: 31 that nothing in the repository reads, 2 popover headings, 1 line the page never showed |
| Strings after | 368: 245 kept and 123 rewritten (six rewritten ones were merged: five «understanding is limited» messages are one sentence now, two reasons share one) |
| Lint violations of the refuse rules | 20 → **0** |
| Lint warnings | 102 → **5**, each read and kept for a reason (below) |

Arithmetic: 245 + 129 + 34 = 408. The shared lint baseline (`tools/copy-lint/baseline/B.json`) is not touched: the coordinator regenerates it once after all merges (`pnpm copy:lint --update-baseline`); the lint says «nothing new or worse than the baseline».

## What was checked, and what was not

- `pnpm copy:lint --all --warnings` on the 20 files: 0 violations, 5 warnings (below). No allowlist entry and no ignore comment was added.
- The copy-fa review scan (`.claude/skills/copy-fa/references/review.md`) over the same files: four hits, all judged: the «هنوز» of the no-valuation verdict (kept, data that will exist) and three «دوباره امتحان کنید» sentences: `error.body` (only the home page renders it now, see «For other areas»), `ASK_FAILED_MESSAGE` (no retry button sits beside the box: its «جست‌وجو» button sends again) and the visitor-limit message (not shown today).
- `vitest` for `src/features/listing`, `src/features/search`, `src/features/search-understanding`, `src/features/check-link`, `src/features/home`, `src/components/ui` and `src/lib/search-sentence.test.ts`, after merging main: 310 tests in 41 files pass. Before the merge, 3 tests of `applied-chips.test.tsx` failed with «ResizeObserver is not defined» in jsdom, with or without my changes (checked with a stash); the jsdom stub of the CS-115 follow-up, now merged, fixed them.
- `node --test` for all of `packages/search/src` (132 tests, among them the understanding notes) pass; `tsc` for `apps/web` and for `packages/search` is clean.
- **Not run**, by the owner’s rule of 2026-10-04 (an overloaded machine: no Playwright, no build, no dev server, no whole-repo check): the e2e specs, `pnpm check`, the screenshots at 412 and 1440 of the acceptance criteria, and the `copy-reviewer` pass (an agent a lane cannot start). The coordinator runs them after the merges. The e2e files that quote words I changed were updated as code (the list is below) and never run.

## Method, for each screen

1. List every string of the screen with its element and the one idea it carries. 2. One string per idea: keep it in the highest element, delete or fold the rest (R5). 3. Cut what a buyer cannot check or act on: windows, thresholds, versions, method numbers, queue and crawler words (R7). 4. One word per idea, the glossary’s and the guide’s verbs (R6). 5. Plain standard Farsi, «ما» for what we did and never «من» (R9), a limit as a fact with the way forward (R8). 6. Written down: half-spaces copied from existing strings and written through a placeholder in a script, never typed free (R10). 7. Read each string aloud against the others of its screen.

## The search box and what the page says about the sentence

- The set: the box (its name, the example in it, the one button, a hint that appears when a link was typed, the clear control) and, under it, one quiet line for each thing we did with a word: a city outside the market, a make we do not have, a country nobody lists, a typo we read, a number no car has, a part we did not use, the words we left out (with «برگرداندن»), the suggestions, the reading line.
- What repeated: «we do not have X» was said four ways (with «ندارم», «فعلاً», «هنوز» and «جمع‌آوری»), always in «من» or about how we collect. It is now two shapes: «برای «X» فیلتری نگذاشتیم / آگهی نداریم» and «آگهی‌ای از «X» نداریم، پس نتیجه‌ای نمی‌بینید». The technical remainder («خطاب به سیستم», «نویسه‌ی نامرئی», «فهم هوشمند», the daily cap) is gone or said as what happened.
- Not shown today, rewritten anyway because they travel in the API answer and could be shown: the sentence `explanation`, the five «understanding is limited» messages, the chips’ reasons.

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `understand-route.ts` · TOO_LONG | این جمله خیلی بلند است؛ کوتاه‌ترش کنید. | این جمله از حد مجاز بلندتر است. آن را کوتاه‌تر کنید. | R4, V2: «؛» and the spoken «کوتاه‌ترش»; a limit, then the way forward |
| 2 | `search-copy.ts` · bar.linkHint | این یک لینک است؛ با «ارزیابی لینک» قیمتش را با ارزش بازار می‌سنجیم. | این یک لینک است. قیمتش را با «ارزیابی لینک» بسنجید. | R3, R4: the fact first, then the step (guide E30) |
| 3 | `search-copy.ts` · bar.clear | پاک کردن عبارت جست‌وجو | پاک کردن متن | R8: a button of at most 3 words |
| 4 | `search-copy.ts` · words.corrected | نتیجه‌ها برای «{…}» است؛ «{…}» در هیچ آگهی‌ای نبود. | نتایج برای «{…}» است. «{…}» در هیچ آگهی‌ای نبود. | R4, R6: «؛» to a full stop; «نتایج» |
| 5 | `search-copy.ts` · ignored.lead | بخشی از آدرس این جست‌وجو قابل‌استفاده نبود و نادیده گرفته شد: | این بخش‌های لینک جست‌وجو را نشناختیم و کنار گذاشتیم: | R6, R7: «آدرس», «قابل‌استفاده» → «لینک» and what we did (guide E33) |
| 6 | `merge.ts` · defaultScope | «{…}» را فیلتر نکردم؛ همه‌ی آگهی‌های کارشناس از بازار تهران است. | برای «{…}» فیلتری نگذاشتیم. همه‌ی آگهی‌ها از بازار تهران است. | R9: «نکردم» is «من»; «کارشناس» is a name, not a subject |
| 7 | `merge.ts` · outsideMarket | «{…}» را ندارم؛ فعلاً فقط بازار تهران در کارشناس است. | برای «{…}» آگهی نداریم. آگهی‌های ما فقط از بازار تهران است. | R9, R8: «ندارم» and «فعلاً»; the limit as scope |
| 8 | `merge.ts` · notTracked | آگهی‌های «{…}» هنوز در کارشناس جمع‌آوری نمی‌شود؛ نتیجه‌ای نمی‌بینید. | آگهی‌ای از «{…}» نداریم، پس نتیجه‌ای نمی‌بینید. | R7, R8: «جمع‌آوری» is how we work; what the buyer gets |
| 9 | `merge.ts` · noListings | فعلاً آگهی‌ای از «{…}» در کارشناس نیست؛ نتیجه‌ای نمی‌بینید. | آگهی‌ای از «{…}» نداریم، پس نتیجه‌ای نمی‌بینید. | R8, R9: «فعلاً» and «نیست در کارشناس» |
| 10 | `merge.ts` · addressed | بخشی از جمله خطاب به سیستم بود و نادیده گرفته شد. | بخشی از جمله را به کار نبردیم. | R7: «خطاب به سیستم» is internal; what we did |
| 11 | `merge.ts` · hidden | نویسه‌های نامرئی جمله حذف شد. | بخشی از جمله دیده نمی‌شد و کنار گذاشته شد. | R7, V6: «نویسه» and «حذف»; what happened |
| 12 | `merge.ts` · cut | فقط {…} نویسه‌ی اول جمله خوانده شد. | فقط {…} کاراکتر اول جمله را خواندیم. | R6, R9: «کاراکتر» (glossary), «ما» |
| 13 | `merge.ts` · typo | «{…}» را «{…}» خواندم. | «{…}» را «{…}» خواندیم. | R9: «خواندم» is «من» |
| 14 | `merge.ts` · explanation sentence | فهمیدم: {…}. | از جمله‌ی شما این فیلترها را گرفتیم: {…}. | R9: «فهمیدم» is «من» (carried in the API answer, not shown today) |
| 15 | `merge.ts` · explanation sentence | این‌ها را هم گذاشتم: {…}. | این فیلترها را هم گذاشتیم: {…}. | R9: «گذاشتم» is «من» |
| 16 | `merge.ts` · explanation sentence | برای «{…}» این‌ها را هم گذاشتم: {…}. | برای «{…}» این فیلترها را هم گذاشتیم: {…}. | R9: «گذاشتم» is «من» |
| 17 | `merge.ts` · explanation sentence | فیلتری از این جمله نساختم؛ آن را در متن آگهی‌ها جست‌وجو می‌کنم. | فیلتری از این جمله نساختیم. آن را در متن آگهی‌ها جست‌وجو می‌کنیم. | R9, R4: «نساختم / می‌کنم» are «من»; «؛» to a full stop |
| 18 | `merge.ts` · explanation sentence | فیلتر خاصی از این جمله نساختم. | فیلتر خاصی از این جمله نساختیم. | R9: «نساختم» is «من» |
| 19 | `understand.ts` · switched_off | فهم هوشمند جمله فعلاً خاموش است؛ فقط بخش ساده‌ی جمله را فهمیدیم. | فقط بخش ساده‌ی جمله را خواندیم. (one constant for all five) | R7, M2: «فهم هوشمند» and «فعلاً» out; what the buyer gets (not shown today) |
| 20 | `understand.ts` · unavailable | فهم هوشمند جمله فعلاً در دسترس نیست؛ فقط بخشی را که با قاعده فهمیدیم اعمال کردیم. | فقط بخش ساده‌ی جمله را خواندیم. (one constant for all five) | R7: the same sentence as the line above |
| 21 | `understand.ts` · visitor_limit | چند بار پشت‌سر‌هم پرسیدید؛ کمی بعد دوباره امتحان کنید. فعلاً فقط بخش ساده‌ی جمله را فهمیدیم. | چند بار پشت‌سرهم پرسیدید. کمی بعد دوباره امتحان کنید. {…} | R7, R8: «فهم هوشمند» and «فعلاً» out; the buyer’s own step stays (not shown today) |
| 22 | `understand.ts` · daily_cap | سقف امروزِ فهم هوشمند جمله پر شده؛ فردا دوباره کار می‌کند. فعلاً فقط بخش ساده‌ی جمله را فهمیدیم. | برای امروز بیشتر از این نمی‌خوانیم. {…} | R7: the daily cap is how we spend, not the buyer’s fact (not shown today) |
| 23 | `understand.ts` · busy | فهم هوشمند جمله الان شلوغ است؛ فقط بخش ساده‌ی جمله را فهمیدیم. | فقط بخش ساده‌ی جمله را خواندیم. (one constant for all five) | R7: the same sentence |
| 24 | `understand.ts` · timeout | فهم هوشمند جمله دیر شد؛ فقط بخش ساده‌ی جمله را فهمیدیم. | فقط بخش ساده‌ی جمله را خواندیم. (one constant for all five) | R7: the same sentence |
| 25 | `understand.ts` · invalid_answer | فهم هوشمند جمله این بار جواب درستی نداد؛ فقط بخش ساده‌ی جمله را فهمیدیم. | فقط بخش ساده‌ی جمله را خواندیم. (one constant for all five) | R7: the same sentence |

## The results list, its empty, error and limit states, the catalogues and chips

- The set: the title and description of the page, the catalogues strip, the chips, the count, the unknown-value notes, the list (the count line, the button, a failure, the end, the 120 limit), the no-results panel, the empty index, the error, the model notice, the ignored-address line.
- What repeated: a retry sentence beside each retry button (three), «نمایش داده شد» in the count line and the limit, the title and the body of the no-results panel for a words-only search, the title and the body of the error. The guide’s own wording was used for the empty states (E32 to E36).

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `page.tsx` · description | آگهی‌های خودروی کارکرده با ارزیابی قیمت و ارزش بازار، از بهترین معامله شروع می‌شود. | جست‌وجو در آگهی‌های خودروی کارکرده، با ارزش بازار و ارزیابی قیمت هر آگهی. | R2, R4: the old sentence said nothing («starts from the best deal»); now what the page is |
| 2 | `search-copy.ts` · results.listLabel | نتیجه‌های جست‌وجو | نتایج جست‌وجو | R6: «نتایج» is the word the rest of the product uses |
| 3 | `search-copy.ts` · results.engine_volume | {…} دیگر هم با بقیه‌ی شرط‌ها می‌خواند، اما حجم موتورش معلوم نیست و در این نتیجه نیامده است. | {…} دیگر با بقیه‌ی فیلترها می‌خواند، اما حجم موتور در آگهی نیامده و نشان داده نمی‌شود. | R6, R4: «فیلترها», not «شرط‌ها»; two glued clauses become one plain statement |
| 4 | `search-copy.ts` · results.country | {…} دیگر هم با بقیه‌ی شرط‌ها می‌خواند، اما کشور خودرویش معلوم نیست و در این نتیجه نیامده است. | {…} دیگر با بقیه‌ی فیلترها می‌خواند، اما کشور سازنده در آگهی نیامده و نشان داده نمی‌شود. | R6, R4: as above |
| 5 | `search-copy.ts` · results.origin | {…} دیگر هم با بقیه‌ی شرط‌ها می‌خواند، اما مبدأ خودرویش معلوم نیست و در این نتیجه نیامده است. | {…} دیگر با بقیه‌ی فیلترها می‌خواند، اما مبدأ در آگهی نیامده و نشان داده نمی‌شود. | R6, R4: as above |
| 6 | `search-copy.ts` · results.shown | {…} از {…} نمایش داده شد | {…} از {…} | R4: «نمایش داده شد» is a passive filler; a count line |
| 7 | `search-copy.ts` · results.moreFailed | آگهی‌های بعدی بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. | آگهی‌های بعدی بارگذاری نشد. | R5, R8: no retry sentence beside the retry button (guide E31) |
| 8 | `search-copy.ts` · results.limit | {…} اول نمایش داده شد. برای دیدن بقیه، جست‌وجو را با فیلتر یا عبارت محدودتر کنید. | فقط {…} اول نشان داده می‌شود. برای دیدن بقیه، فیلتر بیشتری بگذارید. | R8: the limit as a fact, then the way forward (guide E32) |
| 9 | `search-copy.ts` · noResults.onlyWords | برای این عبارت آگهی‌ای پیدا نشد. عبارت کوتاه‌تر یا نام دیگری را امتحان کنید. | عبارت کوتاه‌تر یا نام دیگری را امتحان کنید. | R5: the title already says nothing was found |
| 10 | `search-copy.ts` · emptyIndex.title | فعلاً آگهی تازه‌ای نداریم | آگهی تازه‌ای نیست | R8: «فعلاً» about a limit (guide E34) |
| 11 | `search-copy.ts` · emptyIndex.body | کارشناس فقط آگهی‌هایی را نشان می‌دهد که در {…} گذشته دیده شده باشند، تا هر آگهی‌ای که می‌بینید هنوز در بازار باشد. کمی بعد دوباره سر بزنید. | فقط آگهی‌هایی را نشان می‌دهیم که در {…} گذشته دیده شده‌اند. کمی بعد سر بزنید. | R9, R7: «کارشناس» is a name, not a subject; the reason «تا هر آگهی هنوز در بازار باشد» is ours |
| 12 | `search-copy.ts` · error.body | مشکلی در خواندن آگهی‌ها پیش آمد. دوباره امتحان کنید؛ اگر باز هم نشد، کمی بعد برگردید. | کمی بعد دوباره امتحان کنید. | R5: the title and the button say it; the search page no longer shows it, the home page still does (area A) |
| 13 | `search-copy.ts` · error.retry | دوباره امتحان کنید | تلاش دوباره | R6: «تلاش دوباره» is the table’s verb for a button |
| 14 | `search-copy.ts` · modelNotice.lead | {…} صفحه‌ی خودش را دارد: ارزش بازار، محدوده‌ی قیمت و روند قیمت. | ارزش بازار، محدوده‌ی قیمت و روند قیمت {…}. | R2, R5: «خودش را دارد» is cute and the link says the rest; a noun phrase of what is there |
| 15 | `search-route.ts` · INVALID_CURSOR | این فهرست از نو باز شد؛ ادامه‌ی فهرست قبلی دیگر در دسترس نیست. | فهرست در این فاصله تازه شد. | R7, R8: «در دسترس نیست» → what happened; the button says the step |
| 16 | `search-route.ts` · INVALID_LIMIT | تعداد نتیجه‌ها باید عددی بین ۰ و ۴۸ باشد. | تعداد نتایج باید عددی بین {…} و {…} باشد. | R10: a hand-typed number is a bug; the formatter writes both ends; «نتایج» |

## The filter panel, the phone sheet and the info controls

- The set: the panel title, each field’s name and ends, the quick picks, the problems, the show-more verbs, the sheet’s apply button, its «none» state with its hint and its count-failed line, and the headings inside the info controls.
- The popover headings could not be removed without a change in `info-content.ts` (the builder), so only their words were made plainer; the guide (E39) asks for no headings: a follow-up for area E.

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `search-copy.ts` · sheet.countFailed | شمارش آگهی‌ها انجام نشد؛ می‌توانید باز هم فیلترها را اعمال کنید. | تعداد آگهی‌ها معلوم نشد، اما فیلترها را می‌توانید اعمال کنید. | R4, T8: «انجام نشد» is a hidden verb; the cause as a fact (guide E36) |
| 2 | `search-copy.ts` · panel.outside | بین {…} و {…} باشد. | عدد باید بین {…} و {…} باشد. | R4: a fragment becomes a sentence |
| 3 | `search-copy.ts` · info.rule | معیار دقیق | معیار | R2: «دقیق» is filler |
| 4 | `search-copy.ts` · info.conditions | شرط‌ها | فیلترها | R6: the product says «فیلتر» |
| 5 | `search-copy.ts` · info.order | ترتیب نمایش | ترتیب | R2: the shorter heading |

## The result card

- The set: price words, the rating badge and the gap, the reason a priced listing has no rating, the market value line, the condition chips (three at most), the facts line, the place, the source line, the model-page link, the thin-card hint.
- The three «why not rated» sentences are the guide’s E37 and E38 and one new one; «دیدن آگهی در دیوار» became «رفتن به آگهی در دیوار» (the table’s verb for leaving).

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `search-copy.ts` · card.unratedWithValue | ارزش بازار برآورد شده، اما قیمت این آگهی با آن مقایسه نمی‌شود. | قیمت این آگهی را با ارزش بازار نمی‌سنجیم. | R4, R6: two clauses and «برآورد شده» → one verb (guide E38) |
| 2 | `search-copy.ts` · card.unratedOutlier | قیمت نامعمول است و با ارزش بازار فاصله‌ی بسیار دارد؛ احتمالاً اشتباه تایپی یا قیمت نمایشی است. | قیمت با ارزش بازار خیلی فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد. | R4, R5: «؛» out, one hedge (guide E37) |
| 3 | `search-copy.ts` · card.unratedShowroom | قیمت خودروی صفر نمایشگاه‌ها اغلب نمایشی است؛ ارزیابی نشد. | قیمت خودروی صفر در نمایشگاه‌ها اغلب نمایشی است و ارزیابی نمی‌شود. | R4, T8: «ارزیابی نشد» is a hidden verb |
| 4 | `search-copy.ts` · card.unratedNoValue | برای این خودرو ارزش بازار قابل‌اعتمادی نداریم. | برای این خودرو ارزش بازار نداریم. | R2: «قابل‌اعتماد» promises more than we know |
| 5 | `search-copy.ts` · card.viewOn | دیدن آگهی در {…} | رفتن به آگهی در {…} | R6: leaving for the source is «رفتن به» |
| 6 | `search-copy.ts` · card.modelPageOf | صفحه‌ی مدل {…}: قیمت و روند | صفحه‌ی مدل {…} | R5: the accessible name adds the object and nothing else |
| 7 | `search-copy.ts` · card.thinHint | قیمت و مشخصات را در آگهی {…} ببینید | قیمت و مشخصات را در آگهی {…} ببینید. | R10: a sentence ends with a full stop |

## The listing page: header, price, click-out, freshness and off-market

- The set: back, share, the model links, the photos, the price and its caption, the click-out and its note, the freshness line and the request line, the off-market banner and the similar listings, the not-found page.
- What repeated, and what was cut: the freshness request said it three ways («در صف», «درخواست شما ثبت شد», «هر وقت … خوانده شود»); the banner said «don’t rely» twice; the off-market similar title said «هنوز».

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `listing-copy.ts` · model.page | صفحه‌ی {…}: قیمت و روند | صفحه‌ی مدل {…} | R8: a link names where it goes; «قیمت و روند» was a second idea |
| 2 | `listing-copy.ts` · share.copied | پیوند کپی شد | لینک کپی شد | R6: «لینک», never «پیوند» |
| 3 | `listing-copy.ts` · share.failed | پیوند کپی نشد؛ آن را از نوار آدرس بردارید. | لینک کپی نشد. آن را از نوار آدرس بردارید. | R6, R4: «لینک»; the «؛» is a full stop |
| 4 | `listing-copy.ts` · price.downPaymentNote | قیمت خودرو در آگهی نیامده؛ مبلغ بالا فقط پیش‌پرداخت است. | قیمت کامل خودرو در آگهی نیامده. | R5: «مبلغ بالا» said again what the caption «پیش‌پرداخت» says; only the new fact stays |
| 5 | `listing-copy.ts` · action.openOn | دیدن آگهی در {…} | رفتن به آگهی در {…} | R6: leaving for the source is «رفتن به»; «دیدن» stays on Carshenas |
| 6 | `listing-copy.ts` · action.note | برای دیدن توضیحات کامل، گفت‌وگو با فروشنده و عکس‌های بیشتر، به آگهی در منبع بروید. | توضیحات کامل، گفت‌وگو با فروشنده و عکس‌های بیشتر را در آگهی اصلی می‌بینید. | R4, T-pattern: an imperative with a hidden «منبع» becomes a fact about the original listing |
| 7 | `listing-copy.ts` · state.offHint | قیمت و مشخصات زیر آخرین چیزی است که از آگهی دیده‌ایم. بدون ارزیابی تازه، به آن‌ها تکیه نکنید. | قیمت و مشخصات زیر مربوط به پیش از آن تاریخ است. | R5, R7: «don’t rely» is the banner’s own point; the hint says what the numbers are |
| 8 | `listing-copy.ts` · state.since | از {…} | از {…} دیده نشده است | R3: the banner says when it was last seen, with no «از ...» fragment |
| 9 | `listing-copy.ts` · state.similarTitle | آگهی‌های مشابهی که هنوز روی بازارند | آگهی‌های مشابه روی بازار | R8: «هنوز» about a limit; a noun phrase for a title |
| 10 | `listing-copy.ts` · state.similarNone | آگهی مشابه فعالی پیدا نکردیم. | آگهی مشابهی روی بازار نیست. | R7, R3: «فعال» and «پیدا نکردیم» are system words; a fact |
| 11 | `listing-copy.ts` · freshness.seen | آخرین بار در فهرست منبع: {…} | آخرین بار دیده شد: {…} | R7: «فهرست منبع» is how we read; the buyer’s fact: last seen |
| 12 | `listing-copy.ts` · freshness.requesting | در حال ثبت درخواست بررسی مجدد… | در حال ثبت درخواست بررسی… | R6: «مجدد» is implied |
| 13 | `listing-copy.ts` · freshness.queued | بررسی مجدد در صف است | درخواست بررسی ثبت شد | R7: «صف» is internal; the buyer’s fact: the request is recorded |
| 14 | `listing-copy.ts` · freshness.queuedHint | درخواست شما ثبت شد؛ هر وقت صفحه‌ی آگهی دوباره خوانده شود، اطلاعات این صفحه به‌روز می‌شود. | بعد از بررسی، اطلاعات این صفحه به‌روز می‌شود. | R5, R7: said once; no «هر وقت … خوانده شود» |
| 15 | `listing-copy.ts` · freshness.failed | درخواست بررسی مجدد ثبت نشد. | درخواست بررسی ثبت نشد. | R6: as above |
| 16 | `listing-copy.ts` · freshness.busy | صف بررسی مجدد فعلاً پر است؛ کمی بعد دوباره سر بزنید. | درخواست‌های بررسی زیاد است. کمی بعد دوباره سر بزنید. | R7, R8: «صف» and «فعلاً» out; what the buyer can do stays |
| 17 | `listing-copy.ts` · states.notFoundBody | شاید نشانی را اشتباه وارد کرده‌اید یا آگهی از کارشناس حذف شده است. | شاید نشانی را اشتباه وارد کرده‌اید یا آگهی برداشته شده است. | R6: «حذف» becomes «برداشته»; «از کارشناس» out |

## The listing page: the price analysis, the gauge and the explanation

- The set: the title and its info control, the verdict, the gauge and its two figures, the reason box, the explanation («چرا این ارزیابی؟»: what the value was made from, the features that move it, how accurate it is) and the collapsed method.
- The number test (R7): a number stays when the buyer can compare it or check it on the page: the gap, the count of similar listings and the years they span, the nearest ones’ range, the size of each adjustment, the accuracy. It goes when it is the method’s: the 30-day window, the 20 000 km yearly norm, the method number, «۸ آگهی», «۳ آگهی در ۲ سال», «۱۵٪», «۲۰٪», «۳ برابر». Each `figure()` call whose number is no longer written was removed with it, so the figures still recorded are exactly the numbers a buyer reads; the faithfulness check (every digit in the text is a recorded figure) holds, and two unit tests that asserted the removed numbers were changed (below).
- The market value and its date are not said again in the sentences: they stand in the box right above (the gauge’s figures), and the price card.

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `gauge-view.ts` · paragraphs | فقط وقتی ارزیابی می‌کنیم که برای آن مدل دست‌کم {…} آگهی مشابه داشته باشیم، دست‌کم {…} تا از آن‌ها با فاصله‌ی حداکثر {…} سال از این خودرو باشند و خطای معمول برآورد برای آن مدل از {…} بیشتر نباشد. آگهی توافقی و قسطی هم ارزیابی نمی‌شود. | اگر آگهی مشابه کافی نداشته باشیم یا برآورد ما برای آن مدل دقیق نباشد، قیمت را ارزیابی نمی‌کنیم. آگهی توافقی و قسطی هم ارزیابی نمی‌شود. | R7: the thresholds (8 listings, 3 within 2 years, 15 %) go; the two causes a buyer can understand stay (guide E43) |
| 2 | `listing-copy.ts` · analysis.notValued | ارزش بازار هر روز برای آگهی‌های خوانده‌شده حساب می‌شود؛ این آگهی هنوز در آن نیست. | ارزش بازار هر روز حساب می‌شود. | R5, R7: «not yet» is said once (the verdict); this adds only that it is daily |
| 3 | `listing-copy.ts` · analysis.adjustments | تعدیل‌ها | ویژگی‌های اثرگذار | R6, R7: «تعدیل» is jargon; the list is the features that move the value |
| 4 | `listing-explanation.ts` · body_painted_around | دورِ رنگ بودن | دوررنگ بودن | R10: the filters’ spelling; a stray ezafe mark removed |
| 5 | `listing-explanation.ts` · reason: unmatched_model | این خودرو را با مدل‌های فهرست کارشناس تطبیق نداده‌ایم، پس برایش ارزش بازار حساب نمی‌شود. | مدل این آگهی را نشناخته‌ایم، پس ارزش بازارش را حساب نمی‌کنیم. | R7, R9: «تطبیق» and «فهرست کارشناس» are how we work; what we did, in «ما» |
| 6 | `listing-explanation.ts` · reason: missing_attributes | سال ساخت، کارکرد یا نوع گیربکس در آگهی نیست یا معتبر نیست؛ بدون آن‌ها ارزش بازار حساب نمی‌شود. | سال ساخت، کارکرد یا نوع گیربکس در آگهی نیامده یا معلوم نیست. بدون آن‌ها ارزش بازار حساب نمی‌شود. | R4: «؛» out; «معتبر» is a validation word → «معلوم نیست» |
| 7 | `listing-explanation.ts` · reason: excluded_condition | وضعیتی که فروشنده اعلام کرده (تصادفی، تمام‌رنگ، تعویض یا نیاز به تعمیر موتور و گیربکس، یا شاسی ضربه‌خورده) با آگهی‌های هم‌ردیف قابل مقایسه نیست، پس قیمتش را نمی‌سنجیم. | وضعیتی که فروشنده اعلام کرده، مثل تصادف یا تمام‌رنگی، با آگهی‌های مشابه قابل مقایسه نیست. | R4, R7: a 28-word sentence with a parenthesis and the method’s list; an example and the effect |
| 8 | `listing-explanation.ts` · reason: too_few_comparables | برای این مدل آگهی مشابه کافی نداریم؛ دست‌کم {…} آگهی لازم است. | برای این مدل آگهی مشابه کافی نداریم. | R7: «دست‌کم ۸ آگهی لازم است» is the method’s threshold (guide E51) |
| 9 | `listing-explanation.ts` · reason: too_few_comparables (with the count) | برای این مدل فقط {…} آگهی مشابه داریم؛ دست‌کم {…} آگهی لازم است. | برای این مدل آگهی مشابه کافی نداریم. | R7: the count and the threshold go; the same sentence as above |
| 10 | `listing-explanation.ts` · reason: uncertain_segment | برآورد ما برای این مدل هنوز به اندازه‌ی کافی دقیق نیست (خطای مجاز تا {…}). | برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نیست. | R7, R8: «هنوز» and «خطای مجاز تا ۱۵٪» out |
| 11 | `listing-explanation.ts` · reason: uncertain_segment (with the error) | برآورد ما برای این مدل معمولاً حدود {…} خطا دارد و این بیشتر از {…} است؛ برای همین قیمت‌ها را برای این مدل ارزیابی نمی‌کنیم. | برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نیست. | R7: the error and its limit go (guide E52); the same sentence as above |
| 12 | `listing-explanation.ts` · reason: year_out_of_range | آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم (دست‌کم {…} آگهی با فاصله‌ی حداکثر {…} سال لازم است). | آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم. | R7: «دست‌کم ۳ آگهی با فاصله‌ی حداکثر ۲ سال» is the rule (guide E53) |
| 13 | `listing-explanation.ts` · reason: unknown_price | قیمت این آگهی هنوز خوانده نشده است. | قیمت این آگهی معلوم نیست. | R7, R8: «هنوز خوانده نشده» is the crawler’s word |
| 14 | `listing-explanation.ts` · reason: no_asking_price | قیمت این آگهی توافقی است؛ ارزش بازار را می‌گوییم، اما قیمتی برای سنجیدن نیست. | قیمت این آگهی توافقی است و چیزی برای سنجیدن نیست. | R4, R5: «ارزش بازار را می‌گوییم» is on the page already; «؛» out |
| 15 | `listing-explanation.ts` · reason: placeholder_price | قیمت نوشته‌شده در آگهی قیمت واقعی خودرو نیست؛ نمایشی است. | قیمت نوشته‌شده در آگهی نمایشی است، نه قیمت خودرو. | R6, R4: «قیمت واقعی» promises a sold price we never know; «قیمت نمایشی» is the word |
| 16 | `listing-explanation.ts` · reason: installment_price (a down payment) | قیمت این آگهی پیش‌پرداخت یک فروش قسطی است، نه قیمت خودرو؛ آن را با ارزش بازار نمی‌سنجیم. | قیمت این آگهی پیش‌پرداخت یک فروش قسطی است، نه قیمت خودرو. | R5, R4: «آن را با ارزش بازار نمی‌سنجیم» is the verdict above; «؛» out |
| 17 | `listing-explanation.ts` · reason: installment_price (a price far below the value) | این آگهی فروش قسطی هم دارد و قیمتش {…} یا بیشتر زیر ارزش بازار است؛ چنین قیمتی اغلب پیش‌پرداخت یا قسط اول است، پس آن را ارزیابی نمی‌کنیم. | قیمت این آگهی خیلی زیر ارزش بازار است و فروش قسطی هم دارد. چنین قیمتی اغلب پیش‌پرداخت است. | R7, R4: the 20 % threshold goes; 28 words become two sentences; the consequence is the verdict’s |
| 18 | `listing-explanation.ts` · reason: dealer_new_car | نمایشگاه‌ها قیمت خودروی صفر را اغلب به‌صورت پیش‌فروش، پیش‌پرداخت یا «از ...» می‌نویسند؛ برای همین آن را ارزیابی نمی‌کنیم. | نمایشگاه‌ها قیمت خودروی صفر را اغلب به‌صورت پیش‌فروش، پیش‌پرداخت یا قیمت شروع می‌نویسند. | R10, R4: an ASCII «از ...»; «؛» out; the consequence is the verdict’s |
| 19 | `listing-explanation.ts` · reason: price_outlier | قیمت آگهی بیش از {…} برابر با ارزش بازار فاصله دارد؛ شاید اشتباه تایپی یا قیمت طعمه باشد، پس آن را ارزیابی نمی‌کنیم. | قیمت این آگهی خیلی با ارزش بازار فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد. | R7, R6: «بیش از ۳ برابر» is the rule; «طعمه» → «نمایشی» (guide E54) |
| 20 | `listing-explanation.ts` · verdict | ارزش بازار این خودرو را برآورد کرده‌ایم، اما قیمت این آگهی را ارزیابی نمی‌کنیم. | ارزش بازار این خودرو را حساب کرده‌ایم، اما قیمت این آگهی را ارزیابی نمی‌کنیم. | R6: «حساب کردن» is the word for valuing (guide section 4) |
| 21 | `listing-explanation.ts` · value line | ارزش بازار این خودرو {…} است؛ آن را در {…} از آگهی‌های مشابه {…} حساب کرده‌ایم. | ارزش بازار این خودرو را از آگهی‌های مشابه {…} حساب کرده‌ایم. | R5: the value and its date stand in the box above; this line says what it was made from |
| 22 | `listing-explanation.ts` · basis line | این برآورد بر پایه‌ی {…} آگهی مشابه با مدل {…} است. | این حساب بر پایه‌ی {…} آگهی مشابه با مدل {…} است. | R6, R4: «حساب» for the act; one idea |
| 23 | `listing-explanation.ts` · basis line (nearest) |  نزدیک‌ترین {…} آگهی (مدل {…}، کارکرد {…}) را پایین همین صفحه می‌بینید. |  نزدیک‌ترین {…} آگهی را پایین همین صفحه می‌بینید. مدل آن‌ها {…} و کارکردشان {…} است. | R4: a parenthesis becomes two short sentences |
| 24 | `listing-explanation.ts` · age line | مدل {…}: {…} با هر سال کهنه‌تر شدن حدود {…} {…}. | مدل {…}: ارزش {…} با هر سال عمر حدود {…} {…} می‌شود. | R6, R4: «کهنه‌تر شدن» is a spoken calque; «هر سال عمر» is the phrase the filters use |
| 25 | `listing-explanation.ts` · age line | از ارزشش را از دست می‌دهد | کم | follows the age line |
| 26 | `listing-explanation.ts` · age line | ارزشمندتر می‌شود | زیاد | follows the age line |
| 27 | `listing-explanation.ts` · mileage line | کارکرد {…}{…} است، {…} {…} از کارکرد معمول ({…} در سال)؛ {…}. | کارکرد {…}{…} است، {…} {…} از کارکرد معمول. {…}. | R7: the yearly norm (20 000 km) is the method’s, not a number on the page; «؛» to a full stop |
| 28 | `listing-explanation.ts` · accuracy line | برآورد ما برای {…} معمولاً حدود {…} با قیمت واقعی فاصله دارد (میانه‌ی خطا روی آگهی‌های همین مدل). | برآورد ما برای {…} معمولاً حدود {…} با قیمت آگهی‌ها فرق دارد. | R7: «میانه‌ی خطا» and «قیمت واقعی» out (guide E49) |
| 29 | `listing-explanation.ts` · method | هر روز، از آگهی‌های {…} که در {…}{…}روز گذشته روی بازار بوده‌اند، قیمت هر خودرو را بر پایه‌ی سال ساخت، کارکرد (در برابر {…} در سال)، وضعیت بدنه و شاسی، گیربکس، سوخت و رنگ برآورد می‌کنیم (روش شماره‌ی {…}). | هر روز، از آگهی‌های همین مدل، ارزش بازار هر خودرو را حساب می‌کنیم. سال ساخت، کارکرد، بدنه، شاسی، گیربکس، سوخت و رنگ هر خودرو در آن اثر دارند. | R7: the 30-day window, the 20 000 km norm and the method number go; one plain sentence (guide E50) |
| 30 | `listing-explanation.ts` · method | آگهی‌های توافقی، قسطی و آگهی‌های تصادفی، تمام‌رنگ یا نیازمند تعمیر در این حساب نمی‌آیند، و قیمت‌های بسیار دور از بقیه کنار گذاشته می‌شوند. | آگهی‌های توافقی، قسطی، تصادفی و تمام‌رنگ در این حساب نمی‌آیند. | R7, R4: the exclusion list shrinks to the listings a buyer can recognise |
| 31 | `listing-explanation.ts` · method | ارزیابی راهنماست، نه تضمین قیمت: بازدید و کارشناسی خودرو را جایگزین نمی‌کند. | ارزیابی راهنماست و بازدید و کارشناسی خودرو را جایگزین نمی‌کند. | R4: «؛» out; one sentence |

## The listing page: comparables, history, condition, risks and facts

- The set: the comparables (title, hint, column labels, the toggle), the price history, the condition (what the seller declared, what the text says with its quote), the risks (one sentence each), the facts.
- What repeated: a down payment was said six times on one page (caption, card note, bar, analysis, risk, chip); each place now says something the others do not: the caption what the figure is, the card note what is missing, the analysis why it is not rated, the risk what to do. The risks no longer repeat the analysis reasons; they say what to do. «مبلغ» (not our word) is «قیمت» everywhere.

| # | Where | Before | After | Why |
|---:|---|---|---|---|
| 1 | `listing-copy.ts` · comparables.title | آگهی‌های مشابهی که ارزش بازار از آن‌ها حساب شد | خودروهای مشابه | R8: a 9-word title becomes the glossary noun «خودروی مشابه» |
| 2 | `listing-copy.ts` · comparables.hint | نزدیک‌ترین آگهی‌ها به این خودرو در سال ساخت و کارکرد. «قیمت برای این خودرو» قیمت هر کدام است اگر مثل این خودرو بود. | آگهی‌هایی که سال و کارکردشان به این خودرو نزدیک است. | R5, R4: one sentence; the second one moved into the column label (row below) |
| 3 | `listing-copy.ts` · comparables.listLabel | آگهی‌های مشابه | خودروهای مشابه | R6: the same word as the title |
| 4 | `listing-copy.ts` · comparables.adjusted | قیمت برای این خودرو | قیمت اگر مثل این خودرو بود | R5: the label now says what the price is, so the hint needs no second sentence |
| 5 | `listing-copy.ts` · comparables.showAll | نمایش همه‌ی {…} آگهی | {…} آگهی دیگر | R8: a toggle states what opens: how many more (it passed all rows, now the hidden ones) |
| 6 | `listing-copy.ts` · comparables.none | آگهی مشابهی برای نمایش نداریم؛ ارزش بازار از کل آگهی‌های این مدل حساب شده است. | آگهی مشابهی برای نمایش نیست. ارزش بازار از آگهی‌های همین مدل حساب شده است. | R4, R6: «؛» to a full stop; «کل» is filler |
| 7 | `listing-copy.ts` · history.firstPriceUnknown | قیمت اولیه ثبت نشده | قیمت اول معلوم نیست | R7: «ثبت نشده» is the system’s word; the buyer’s: it is not known |
| 8 | `listing-copy.ts` · condition.declaredTitle | اعلام‌شده توسط فروشنده | گفته‌ی فروشنده | R6, T-pattern: «توسط» is a calque |
| 9 | `listing-copy.ts` · condition.textHint | جمله‌ی کوتاهی که هر مورد از آن خوانده شد زیر آن آمده است؛ اگر اشتباه است، به آگهی در منبع تکیه کنید. | زیر هر مورد، جمله‌ی آگهی آمده تا خودتان بسنجید. | R4, R3: one sentence saying what is under each item, and the buyer judges |
| 10 | `listing-copy.ts` · condition.none | فروشنده وضعیتی اعلام نکرده و متن آگهی هم چیزی نگفته است. | در این آگهی از وضعیت خودرو چیزی نیامده است. | R8: no double negative («نه … و نه …»); say what is |
| 11 | `listing-copy.ts` · risks.title | نکته‌های احتیاط | نکته‌های احتیاطی | R6, R10: «احتیاطی» is the adjective; «نکته‌ی احتیاط» is not Farsi |
| 12 | `listing-copy.ts` · risks.listLabel | نکته‌های احتیاط | نکته‌های احتیاطی | R6, R10: as the title |
| 13 | `listing-copy.ts` · facts.model | حدودی؛ طبق مدل | تقریبی، طبق مدل | R4: «؛» out; «تقریبی» is the plain word |
| 14 | `listing-view.ts` · condition chip (text) | مبلغ آگهی قیمت کامل است | قیمت آگهی کامل است | R6: «قیمت», not «مبلغ» (appendix A5) |
| 15 | `listing-view.ts` · condition chip (text) | مبلغ آگهی پیش‌پرداخت است | قیمت آگهی پیش‌پرداخت است | R6: as above |
| 16 | `listing-view.ts` · condition chip (text) | مبلغ آگهی «از ...» است | قیمت آگهی، قیمت شروع است | R7, R10: an ASCII «...» in the text; «قیمت شروع» is plain |
| 17 | `listing-view.ts` · risk flag | مبلغ نمایش‌داده‌شده ممکن است پیش‌پرداخت باشد، نه قیمت خودرو؛ قیمت کامل را در آگهی ببینید. | این قیمت ممکن است پیش‌پرداخت باشد، نه قیمت خودرو. قیمت کامل را در آگهی ببینید. | R6, R4: «قیمت»; «؛» to a full stop |
| 18 | `listing-view.ts` · risk flag | مبلغ نمایش‌داده‌شده «از ...» است؛ خودروی همین آگهی ممکن است گران‌تر باشد. | این قیمت، قیمت شروع است. خودروی همین آگهی ممکن است گران‌تر باشد. | R6, R10: as the chip |
| 19 | `listing-view.ts` · risk flag | این آگهی فروش قسطی هم دارد؛ قیمت نقد را از فروشنده بپرسید. | این آگهی فروش قسطی هم دارد. از فروشنده قیمت نقد را بپرسید. | R4: «؛» to a full stop |
| 20 | `listing-view.ts` · risk flag | قیمت این آگهی {…} یا بیشتر زیر ارزش بازار است و آگهی قسطی هم دارد؛ ارزیابی‌اش نکرده‌ایم، چون چنین قیمتی اغلب پیش‌پرداخت است. | این قیمت ممکن است پیش‌پرداخت باشد، چون خیلی زیر ارزش بازار است. قیمت نقد را از فروشنده بپرسید. | R7, R5: the 20 % threshold goes; the reason is in the analysis box, this keeps the action |
| 21 | `listing-view.ts` · risk flag | کارکرد در آگهی نیامده یا قابل‌اعتماد نیست؛ بدون آن ارزش بازار حساب نمی‌شود. کارکرد را از فروشنده بپرسید. | کارکرد در آگهی نیامده یا معلوم نیست، پس ارزش بازار حساب نشده است. آن را از فروشنده بپرسید. | R4, R7: «قابل‌اعتماد» and «؛» out; the step stays |
| 22 | `listing-view.ts` · risk flag | کارکرد «{…}» نوشته شده و معلوم نیست هزار کیلومتر است یا خودروی کم‌کارکرد؛ بدون آن ارزش بازار حساب نمی‌شود. کارکرد را از فروشنده بپرسید. | کارکرد «{…}» نوشته شده و معلوم نیست هزار کیلومتر است یا خودرو کم‌کارکرد است. ارزش بازار حساب نشده است، پس کارکرد را از فروشنده بپرسید. | R4: «؛» out; one hedge-free fact, then the step |
| 23 | `listing-view.ts` · risk flag | فروشنده بدنه را بدون رنگ‌شدگی ثبت کرده، اما متن آگهی از رنگ حرف می‌زند؛ پیش از خرید بدنه را بازدید کنید. | فروشنده بدنه را بدون رنگ‌شدگی اعلام کرده، اما متن آگهی از رنگ حرف می‌زند. پیش از خرید بدنه را از نزدیک ببینید. | R6, T8: «اعلام کرده» (the seller declared; «ثبت» is for sending a request), «بازدید کنید» → «از نزدیک ببینید» |
| 24 | `listing-view.ts` · risk flag | فروشنده شاسی را سالم ثبت کرده، اما متن آگهی از آسیب شاسی می‌گوید؛ این ناهمخوانی را از فروشنده بپرسید. | فروشنده شاسی را سالم اعلام کرده، اما متن آگهی از آسیب شاسی می‌گوید. این تفاوت را از فروشنده بپرسید. | R6, R4: «اعلام کرده»; «ناهمخوانی» → «تفاوت» |
| 25 | `listing-view.ts` · risk flag | متن آگهی از تصادف می‌گوید، اما بدنه سالم ثبت شده است. | متن آگهی از تصادف می‌گوید، اما فروشنده بدنه را سالم اعلام کرده است. | R6: «اعلام کرده» |
| 26 | `listing-view.ts` · risk flag | پلاک منطقه‌ی آزاد است و بازارش جداست؛ ارزش بازار ما این را از پلاک ملی جدا حساب نمی‌کند، پس گران‌تر از واقع نشان می‌دهد. | پلاک منطقه‌ی آزاد بازار جدایی دارد و معمولاً ارزان‌تر است. ارزش بازار برای پلاک ملی حساب شده است، پس برای این خودرو بالاتر است. | R7, R3: «ارزش بازار ما این را جدا حساب نمی‌کند» is the method; the effect for the buyer (guide E55) |
| 27 | `listing-view.ts` · risk flag | خودرو در تاکسی اینترنتی کار کرده؛ کارکرد روزانه‌اش بیشتر از معمول است. | خودرو در تاکسی اینترنتی کار کرده و کارکرد روزانه‌اش بیشتر از معمول است. | R4: «؛» to «و» |
| 28 | `listing-view.ts` · risk flag | قیمت آگهی با قیمت‌های بازار فاصله‌ی غیرعادی دارد؛ اشتباه تایپی یا قیمت طعمه را در نظر بگیرید. | قیمت این آگهی غیرعادی است. پیش از هر کاری آن را از فروشنده بپرسید. | R5, R7: the reason is in the analysis box; the risk says what to do; «قیمت طعمه» is not our word |

## Kept strings, with the reason

Each group is read again and left: the reason is one line for the group, the strings follow as «key: text».

**The ratings and their bands (`gauge-view.ts`)** (11). The five rating names are the glossary’s, imported by the check-a-link answer (CS-115): names and meaning unchanged. The band texts carry the one number that says what a rating means and that a buyer can check against the page («۱۰٪ یا بیشتر زیر ارزش بازار»).

> great: عالی | good: خوب | fair: منصفانه | high: گران | overpriced: خیلی گران | ratingLabel: بدون ارزیابی | text: {…} یا بیشتر زیر ارزش بازار | text: از {…} تا {…} زیر ارزش بازار | text: کمتر از {…} بالاتر یا پایین‌تر از ارزش بازار | text: از {…} تا {…} بالاتر از ارزش بازار | text: {…} یا بیشتر بالاتر از ارزش بازار

**Listing page: frame, gallery, share (`listing-copy.ts`)** (13). Plain nouns and verbs from the guide’s table; accessible names that add the object; nothing repeats on the screen.

> titleSuffix: قیمت و ارزیابی | label: مدل این خودرو | rest: بقیه‌ی آگهی‌های این مدل | back: بازگشت به جست‌وجو | label: اشتراک‌گذاری | label: عکس‌های آگهی | slide: عکس {…} از {…} | previous: عکس قبلی | next: عکس بعدی | thumbnails: عکس‌های کوچک آگهی | thumbnail: رفتن به عکس {…} | notFoundTitle: این آگهی پیدا نشد | backToSearch: رفتن به جست‌وجو

**Listing page: the price (`listing-copy.ts`, `price`, `action`)** (8). The glossary’s words for the kind of price; «در زبانه‌ی جدید باز می‌شود» is the accessible name of a link that leaves the page and is not a violation.

> negotiable: توافقی | unknown: قیمت نامشخص | installment: فروش قسطی | downPayment: پیش‌پرداخت | noFullPrice: قیمت کامل در آگهی نیامده | lastAsking: آخرین قیمت آگهی | asking: قیمت آگهی | opensInNewTab: در زبانه‌ی جدید باز می‌شود

**Listing page: off the market (`listing-copy.ts`, `state`)** (7). Facts about the listing, each said once; the verbs are the table’s («دیدن», «رفتن به»).

> off: این آگهی دیگر روی {…} نیست | sold: این خودرو فروخته شده است | expired: مهلت این آگهی تمام شده است | similarHint: همین مدل، با سال ساخت و قیمتی نزدیک. | similarAll: دیدن همه‌ی آگهی‌های این مدل | seeSimilar: دیدن آگهی‌های مشابه | lastOnSource: آخرین وضعیت آگهی در {…}

**Listing page: analysis labels (`listing-copy.ts`, `analysis`)** (10). Short noun and verb labels. «برآورد {date}» stays: patterns.md allows «برآورد» as the noun for a dated estimate. «چرا این ارزیابی؟» is a short natural question for the explanation, not a slogan.

> title: تحلیل قیمت | info: توضیح درباره‌ی ارزیابی قیمت | infoClose: بستن توضیح | thisPrice: قیمت این آگهی | marketValue: ارزش بازار | valuedOn: برآورد {…} | beyondCheap: خیلی ارزان‌تر از مقیاس | beyondDear: خیلی گران‌تر از مقیاس | why: چرا این ارزیابی؟ | method: روش محاسبه

**Listing page: comparables, history, condition, facts (`listing-copy.ts`)** (37). Column labels, row labels and facts in the glossary’s nouns; each states one thing, with no repeat inside its section (the days on market appear in the history and in the facts: recorded as a follow-up).

> asking: قیمت آگهی | offMarket: از بازار رفته | title: تاریخچه‌ی قیمت | listLabel: تغییرهای قیمت | daysOnMarket: روز روی بازار | totalChange: تغییر کل قیمت | noChange: قیمت از روز اول تغییر نکرده است | previousPrice: قیمت قبلی | published: آگهی منتشر شد | dropped: کاهش قیمت | raised: افزایش قیمت | priceSet: قیمت تعیین شد | lower: کمتر | higher: بیشتر | priceRemoved: قیمت از آگهی برداشته شد | title: وضعیت خودرو | textTitle: خوانده‌شده از متن آگهی | insurance: بیمه‌ی شخص ثالث: {…} باقی‌مانده | insurance: ماه | title: مشخصات | year: سال ساخت | mileage: کارکرد | gearbox: گیربکس | fuel: سوخت | engineVolume: حجم موتور | listing: طبق عنوان آگهی | trim: طبق مشخصات تیپ | origin: مبدأ | country: کشور سازنده | colour: رنگ | city: محل | seller: فروشنده | source: منبع | listed: تاریخ انتشار | daysOnMarket: روی بازار | zeroKm: صفر کیلومتر | checked: آخرین بررسی: {…}

**The explanation templates that were already right (`listing-explanation.ts`)** (20). The adjustment names are the filters’ own words; «احتمالاً» before an assumed mileage is the one real hedge (patterns.md); the verdict for a rated listing is the gap and nothing else; «هنوز» in the no-valuation verdict is data that will exist (patterns.md); the ranges and the effect words are number and unit templates.

> zero_km: صفر کیلومتر بودن | body_minor: خط‌وخش جزئی بدنه | body_painted: رنگ‌شدگی بدنه | chassis_repainted: رنگ‌شدگی شاسی | gearbox_automatic: گیربکس اتوماتیک | dual_fuel_aftermarket: دوگانه‌سوز بودن با کیت غیرکارخانه‌ای | electrified: هیبریدی یا برقی بودن | off_colour: رنگی غیر از سفید، مشکی، نقره‌ای و خاکستری | verdict: برای این آگهی هنوز ارزش بازاری حساب نشده است. | text: قیمت این آگهی {…} است. | years: {…} تا {…} | nearYears: {…} تا {…} | nearKm: {…} تا {…} | effect: ارزش را حدود {…} {…} می‌کند | effect: کم | effect: زیاد | text: احتمالاً | text: بیشتر | text: کمتر | text: نسبت به آگهی‌های مشابه، ویژگی‌ای که ارزش را کم یا زیاد کند در این خودرو پیدا نکردیم.

**Listing page: titles, facts and the condition words (`listing-view.ts`)** (30). Condition words match the filters’ labels (the same chip in the card, the listing page and the panel); «، مدل ۱۴۰۰» is the project’s title shape everywhere (card, listing page, marked list); one idea per chip.

> text: {…}، مدل{…}{…} | text: {…}، مدل{…}{…} | value: روز | label: موتور تعمیرشده | label: گیربکس تعمیرشده | text: بدنه: {…} | text: شاسی جلو | text: شاسی عقب | text: بدون رنگ | text: لکه‌ی رنگ | text: رنگ‌شدگی چند قطعه | text: دوررنگ | text: تمام رنگ | text: بدون قطعه‌ی تعویضی | text: قطعه‌ی بدنه تعویض شده | text: شاسی سالم | text: شاسی آسیب‌دیده | text: بدون تصادف | text: تصادف کرده | text: در تاکسی اینترنتی کار کرده | text: در تاکسی اینترنتی کار نکرده | text: پلاک ملی | text: پلاک منطقه‌ی آزاد | text: معاوضه می‌کند | text: معاوضه ندارد | text: فروش قسطی دارد | text: فروش قسطی ندارد | text: قیمت توافقی است | text: قیمت قطعی است | text: {…} {…} از قیمت اول

**Understanding: shown lines that were already in the voice (`understanding-copy.ts`, `search-sentence.ts`)** (3). Written by CS-111 to the guide («ما», a fact, a way forward); read again and left.

> implausible: «{…}» را نادیده گرفتیم. این عدد برای خودرو معنی ندارد. | unsearched: این بخش‌های جمله را به کار نبردیم: {…}. | ASK_FAILED_MESSAGE: جمله‌ی شما خوانده نشد و همین‌جا مانده است. دوباره امتحان کنید.

**Understanding: `understand-route.ts` EMPTY, `intents.ts`, `merge.ts` reasons** (7). «جمله‌ی جست‌وجو را بنویسید.» is an instruction that names its object; the two bundles’ title and meaning are plain and are also read by the model prompt (`packages/ai`), so their words stay; «چون نوشتید «…»» and ««…» شاید یعنی همین» are facts with one real hedge and travel in the API answer.

> EMPTY: جمله‌ی جست‌وجو را بنویسید. | title: بدنه‌ی تمیز | meaning: بدون رنگ‌شدگی، بدون تصادف و بدون تعویض قطعه‌ی بدنه. | title: سالم از نظر فنی | meaning: موتور، گیربکس و شاسی‌ای که فروشنده سالم اعلام کرده است. | why: چون نوشتید «{…}» | why: «{…}» شاید یعنی همین

**Small templates (`figure-check.ts`, `filter-controls.tsx`, `listing-card-view.ts`)** (3). A range joiner («تا»), the noun «آگهی» beside a count, and the title shape «نام، مدل سال»: all from the formatters and the glossary.

> range: {…} تا {…} | ariaLabel: آگهی | text: {…}، مدل{…}{…}

**Search page: box, controls, catalogues, chips (`search-copy.ts`)** (29). Nouns and verbs from the guide’s table («جست‌وجو», «پاک کردن», «برداشتن», «بستن»); accessible names that add the object; «شاید منظورتان این هم بود» is a real suggestion with one real hedge.

> LISTING: آگهی | title: جست‌وجوی خودرو | label: جست‌وجو در آگهی‌ها | placeholder: چه ماشینی می‌خواهید؟ یا لینک آگهی دیوار | submit: جست‌وجو | checkLink: ارزیابی لینک | filters: فیلترها | sort: مرتب‌سازی | clearFilters: پاک کردن فیلترها | skipToResults: پرش به نتایج | close: بستن | filtersApplied: فیلترها، {…} فعال | filtersApplied: فیلتر | label: مجموعه‌های آماده | all: همه‌ی آگهی‌ها | info: توضیح درباره‌ی «{…}» | label: فیلترهای فعال | remove: برداشتن «{…}» | label: درباره‌ی جمله | dropped: آگهی‌ای با «{…}» پیدا نشد. بدون آن نشان می‌دهیم. | putBack: برگرداندن | putBackName: برگرداندن «{…}» | suggestions: شاید منظورتان این هم بود | add: اضافه کردن «{…}» | reading: در حال خواندن بقیه‌ی جمله… | unknown: «{…}» در هیچ آگهی‌ای نبود. | sort: مرتب‌سازی | catalogue: مجموعه | query: عبارت جست‌وجو

**Search page: results and their states (`search-copy.ts`)** (19). «به آخر فهرست رسیدید.» closes the list for a reader who cannot see the end (a unit test holds it); the count, loading and added lines are the table’s words; «آگهی‌ای با این فیلترها پیدا نشد» and «با برداشتن یکی از این‌ها نتیجه می‌بینید:» are the guide’s own empty-state wording; «پاک کردن همه‌ی فیلترها» stays distinct from the chip row’s «پاک کردن فیلترها» (a test finds one by name).

> count: بیش از {…} | more: نمایش بیشتر | loading: در حال بارگذاری آگهی‌ها… | loadingMore: در حال بارگذاری آگهی‌های بعدی… | added: {…} دیگر اضافه شد. | retry: تلاش دوباره | reopen: بارگذاری دوباره‌ی فهرست | end: به آخر فهرست رسیدید. | endCapped: برای دیدن بقیه، فیلترها را محدودتر کنید. | limit: آگهی | title: آگهی‌ای با این فیلترها پیدا نشد | lead: با برداشتن یکی از این‌ها نتیجه می‌بینید: | remove: برداشتن «{…}» | count: بیش از {…} | clearAll: پاک کردن همه‌ی فیلترها | body: ساعت | title: آگهی‌ها بارگذاری نشد | thisModel: این مدل | link: دیدن صفحه‌ی مدل

**Filter panel, sheet, info controls (`search-copy.ts`)** (28). Field names, units and quick picks are labels with a unit from the formatters; «بدون محدودیت» names the empty choice; «نمایش بیشتر / کمتر» is the table’s; the sheet’s hint says the one step.

> title: فیلترها | apply: نمایش {…} | none: آگهی‌ای پیدا نشد | noneHint: یکی از فیلترها را بردارید. | label: فیلترها | anyOption: بدون محدودیت | fromName: حداقل {…} | toName: حداکثر {…} | toman: تومان | km: کیلومتر | year: سال | cc: سی‌سی | typedFrom: از | typedTo: تا | quickPicks: پیشنهاد سریع | pickAtMost: تا {…} | pickAtLeast: از {…} | not_a_number: فقط عدد بنویسید. | order: حداقل بیشتر از حداکثر است. | showMore: نمایش بیشتر | showFewer: نمایش کمتر | searchWithin: جست‌وجو در {…} | noMatch: موردی پیدا نشد | appliedInGroup: {…} فعال | button: توضیح درباره‌ی «{…}» | close: بستن توضیح | options: گزینه‌ها | bestToWorst: از بهترین به بدترین

**Result card (`search-copy.ts`)** (20). Rating words and market-gap words are the glossary’s; the badge texts are one to three words; each says one thing.

> unknownPrice: قیمت نامشخص | negotiable: توافقی | installment: فروش قسطی | unrated: بدون ارزیابی | belowMarket: زیر ارزش بازار | aboveMarket: بالاتر از ارزش بازار | atMarket: نزدیک ارزش بازار | marketValue: ارزش بازار | noPhoto: بدون عکس | zeroKm: صفر کیلومتر | photos: عکس | viewPage: دیدن ارزیابی قیمت و جزئیات | opensInNewTab: در زبانه‌ی جدید باز می‌شود | modelPage: صفحه‌ی مدل | today: امروز منتشر شد | daysOnMarket: {…} روی بازار | daysOnMarket: روز | soundBoth: موتور و گیربکس سالم | paintedSomewhere: رنگ‌شدگی دارد | accident: تصادفی

## Removed

- **Nothing reads them (31).** `listing-copy.ts`: `share.copy`, `gallery.none`, `gallery.fromSource`, `state.gone`, `analysis.sectionLabel`, `gaugeLabel`, `unratedTitle`, `noValueTitle`, `markerNote`, `underBar`, `gapOnScale`, `history.firstSeen`, `condition.quote`, `declaredNone`, `risks.none`, `freshness.title`, `neverChecked`, `stale`, `retry`, `fresh` (21 strings: `stale` held two). `search-copy.ts`: `catalogues.allCount`, `summaryOrder`, `results.updated`, `noResults.withoutWords`, `sheet.counting`, `panel.featured`, `minimum`, `maximum`, `from`, `to`, `otherFilters` (10 strings; `allCount` held none the inventory counts). Found with an alias-aware search of the whole repository, tests and e2e included. If a parallel lane reads one of them, restore it from `main`.
- **By design (3).** The two headings of the rating info control («پنج رده، از ارزان‌ترین», «چه وقت ارزیابی نمی‌کنیم؟»: the guide asks for no headings in a popover); the explanation’s `not_valued` line, which the page never rendered (the analysis box says it in `analysis.notValued`).

## The five remaining warnings, read and kept

| Where | Warning | Why it stays |
|---|---|---|
| `listing-explanation.ts` · verdict without a valuation | «هنوز» | Data that will exist when the daily valuation reaches the listing: patterns.md lists exactly this sentence as right. |
| `listing-view.ts` · risk `down_payment` | «ممکن است» | A real hedge: the flag also fires on the text’s own words, which can be wrong. |
| `listing-view.ts` · risk `starting_from` | «ممکن است» | A real hedge: the price is a starting price, the car «may» cost more. |
| `listing-view.ts` · risk `installment_guard` | «ممکن است» | A real hedge: we rate nothing here because the price may be a down payment. |
| `search-copy.ts` · `sheet.countFailed` | «می‌توانید» | A real permission that is still true: the filters can be applied although the count failed. |

## Code touched besides words

- `results-error.tsx`: the paragraph that rendered `error.body` is gone (the title and the retry button say it, guide E35); the key stays because the home page (area A) still renders it.
- `comparables-section.tsx`: the toggle gets the number of rows it opens (`rest.length`) instead of all rows, so it can say «۲ آگهی دیگر».
- `listing-screen.tsx`, `comparables-section.tsx`, `listing-card.tsx`, `no-results.tsx`: the « · » that joined facts and counts is «،» (a middle dot beside a digit reads as a zero).
- `gauge-view.ts`: the two headings and the imports of the thresholds went; `listing-explanation.ts`: `reasonText` takes only the reason and the listing, the figures that are no longer written, the unused imports and the no-break-space constant went; `listing-view.ts`: one import; `search-route.ts`: the two API messages are written with the formatter; `understand.ts`: one shared sentence constant; `merge.ts`: `NOTE_TEXT` is exported so tests read the words from it.

## Tests and e2e that changed

- Unit: `listing-explanation.test.ts` (the ids no longer recorded; the guarded-instalment and method tests now say the numbers are not quoted), `gauge-view.test.ts` (the popover has no heading and no threshold), `merge.test.ts` and `sentence-search.test.ts` (they read the note words from `NOTE_TEXT`, not retyped Persian).
- e2e, as code and not run: `listing.spec.ts`, `search.spec.ts`, `plain-search.spec.ts`, `model-page.spec.ts`, `model-specs.spec.ts`, `check-link.spec.ts`, `home.spec.ts`, `range-filters.spec.ts`, `marks.spec.ts`, `search-files.spec.ts`, `search-file-alerts.spec.ts`, `engine-origin-search.spec.ts` and the fixture `smart-search.ts` (the words a screen says, the results list’s name «نتایج جست‌وجو»).

## Words this task settled (for the guide’s section 4, to be added once after the merges)

| Idea | Write | Never |
|---|---|---|
| the search results | نتایج | نتیجه‌ها (the status page already says «نتایج») |
| a filter | فیلتر | شرط (a catalogue’s filters are not «conditions») |
| what the seller wrote in the form | اعلام کرده | ثبت کرده («ثبت» is for sending a request) |
| a price that is only the start | قیمت شروع | مبلغ «از ...» |
| the original listing, when no site name is at hand | آگهی اصلی | آگهی در منبع |
| how many characters a limit allows | کاراکتر | نویسه |

## For other areas (strings I dislike and may not edit)

- **A, `browse-boundary.tsx`** renders `SEARCH_COPY.error.body` beside its retry button: delete the paragraph (R5, guide E35); then `error.body` can be removed. It now reads «کمی بعد دوباره امتحان کنید.» so that it is acceptable if kept.
- **E, `packages/search/src/mileage-reading.ts` and `apps/web/src/lib/mileage-info.ts`** (the assumed-mileage notes, which the plan assigns to B but live there): «رتبه» (the guide’s word is «ارزیابی»), «با توجه به قیمت و سال» (T9; «سال» means two things), a «؛», the thresholds (15 % and 40 000 km a year) in the popover (R7), and the long introduction.
- **E, `info-content.ts` and `explain.ts`**: the guide (E39) asks for no popover headings; the builder passes them (`heading:`). I changed their words only. The catalogue’s order line is built as «label: description» (`explain.ts`), which needs its heading to be understood.
- **E, `filters.ts`**: «دوررنگ» (also in `FACT_TEXT`) against the glossary’s «دور رنگ»; «شاسی آسیب‌دیده» against «شاسی ضربه‌خورده»; «پلاک منطقه آزاد» against «منطقه‌ی آزاد» (appendix A9); the `paintFree`, `plate` and `lowMileage` texts (guide E3, E41, E42). Whatever E picks, `listing-view.ts`’s `FACT_TEXT` (mine) must match: it matches today’s filter labels.
- **C, `marked-list.tsx`** (and D’s `jobs-section.tsx`, `listings-section.tsx`) still join facts that hold digits with « · » (appendix A8): join with «،», as `listing-card.tsx` and `listing-screen.tsx` do now.
- **The coordinator.** `e2e/tests/app/engine-origin-search.spec.ts` still drives the two-step flow CS-111 removed («بفهم», «نمایش آگهی‌ها»): stale at base; I changed only the two lines that quote notes. `figure-check.ts` (`RULE_FIGURES`, `expectedText`) and `listing-test-database.ts` (`expectedFigures`) still know ids the explanation no longer records (`market_value`, `run_date`, `window_days`, `method_norm`, `method_version`, `mileage_norm` and the six rule constants): dead now, harmless, to prune with the db tests in view. The baseline for area B needs `--update-baseline` after the merges.

## Follow-ups found, not done (they need a structure change)

- «روز روی بازار» is on the listing page twice (the history and the facts), and the market value three times (price card, gauge figures, and formerly the explanation): a layout decision, not words.
- The no-valuation note exists as `analysis.notValued` and as the explanation verdict: two strings for one idea in two components.
- The «کاراکترهای نامرئی» note (`merge.ts` · `hidden`) tells a buyer something he cannot see or act on (R7): drop the note, which needs a change in the logic and its test.
- The end-of-list line («به آخر فهرست رسیدید.») repeats the count line when the list is complete; a unit test holds it, so it was kept.

## Left for you to check (taste)

- «خودروهای مشابه» as the title of the comparables (the glossary’s noun) against the old, longer title.
- «ارزش بازار این خودرو را از آگهی‌های مشابه … حساب کرده‌ایم.» without the value: the value stands in the box above.
- The placeholder «چه ماشینی می‌خواهید؟ یا لینک آگهی دیوار» (kept: it names both inputs in 40 characters).
- «۲۴ از ۴۲ آگهی» as the count line, and «۲ آگهی دیگر» as the toggle.
- «قیمت اگر مثل این خودرو بود» as the comparables’ column label, in place of a second sentence in the hint.
- «نتایج» for «نتیجه‌ها» (the product used both).

