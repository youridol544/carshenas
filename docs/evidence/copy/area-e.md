# Copy rewrite E: shared definitions and info popovers (CS-110)

Evidence for CS-110, written on 2026-10-04 on branch `cs-110-copy-e`. Area E is the shared text that feeds many screens: the filter, catalogue and sort definitions of `@carshenas/search`, the builders of the info popovers, the mileage reading, the origin and country names and the locale's unit words. It was rewritten to the voice guide (`docs/design/product-voice.md`, ADR-0042) on the owner's feedback of the same day: too much technical information, fluff, repetition, sentences that are not native Farsi.

**Strings only.** Ids, keys, URL parameters, stored forms, option values and exported names are unchanged, so stored searches and search files keep working. Two builders changed their code a little, and one definition became a computed text; both are listed under «What is not only words».

## The result in numbers

| | Before | After |
|---|---:|---:|
| Strings the inventory finds in the 14 files (`pnpm copy:inventory --strings E`) | 287 | 271 |
| Copy lint violations (refuse rules) in these files | 10 | 0 |
| Copy lint warnings in these files | 39 | 0 |
| Longest paragraph of a definition or a popover | 49 words | 33 words |
| Words in the popover of the catalogue «تمیز و بی‌دردسر» (lead, conditions, order) | 158 | 109 |
| Words in the popover of the filter «کم‌کارکرد نسبت به سن» (description and rule) | 39, two different figures | 16, the one figure a buyer can check |

Whole repository: 140 violations and 370 warnings before, 130 and 330 after (only this area changed). The shared baseline file `tools/copy-lint/baseline/E.json` is not touched in this branch, as the coordinator asked; `pnpm copy:lint` says nothing is new or worse, and that five of its entries are now higher than the code.

### Reviewed, changed, kept, by file

Every string of the inventory was read against the guide. **Changed**: the text differs. **Removed**: a string that is gone (a popover row that said nothing a buyer can use). **Added**: a string that did not exist (one shared sentence, below). **Kept**: the same text, with the reason under «Kept, and why».

| File | Reviewed | Changed | Removed | Added | Kept | Now |
|---|---:|---:|---:|---:|---:|---:|
| `components/ui/scroll-rail-copy.ts` | 2 | 0 | 0 | 0 | 2 | 2 |
| `features/model/model-info.ts` | 28 | 6 | 15 | 0 | 7 | 13 |
| `lib/mileage-info.ts` | 3 | 1 | 0 | 0 | 2 | 3 |
| `locale/src/format-number.ts` | 1 | 0 | 0 | 0 | 1 | 1 |
| `locale/src/toman.ts` | 6 | 0 | 0 | 0 | 6 | 6 |
| `search/src/catalogues.ts` | 20 | 6 | 0 | 0 | 14 | 20 |
| `search/src/document.ts` | 2 | 0 | 0 | 0 | 2 | 2 |
| `search/src/explain.ts` | 1 | 1 | 0 | 0 | 0 | 1 |
| `search/src/filters.ts` | 162 | 59 | 2 | 0 | 101 | 160 |
| `search/src/kinds.ts` | 15 | 0 | 0 | 0 | 15 | 15 |
| `search/src/mileage-reading.ts` | 9 | 6 | 0 | 0 | 3 | 9 |
| `search/src/search.ts` | 3 | 0 | 0 | 0 | 3 | 3 |
| `search/src/sorts.ts` | 12 | 3 | 0 | 1 | 9 | 13 |
| `search/src/specs.ts` | 23 | 3 | 0 | 0 | 20 | 23 |
| **Total** | **287** | **85** | **17** | **1** | **185** | **271** |

The counts compare the text of each string before and after, so a string that was split or merged counts as changed, removed or added. `filters.ts` lost two strings: a unit word that sat in the deleted low-mileage figure and the separate origin sentence (it is now built from the three origin definitions). `sorts.ts` gained one: the sentence both price orders share, now written once.

## What is not only words

1. **`apps/web/src/features/search/info-content.ts` no longer gives a popover section a heading.** The guide (E39) forbids «معیار دقیق», «شرط‌ها», «گزینه‌ها»; the builder passed them from `SEARCH_COPY.info` (area B's file). The sections, their ids and rows are unchanged; for a ladder with no measured rule (the body's condition) the builder no longer lists the options best to worst, because the select already does and each chip says «یا بهتر». `model-info.ts` follows the same rule. The five keys `SEARCH_COPY.info.rule`, `options`, `conditions`, `order` and `bestToWorst` are dead now: area B can delete them (listed under «For other areas»).
2. **The origin filter's description is built from the three origin definitions** (`ORIGIN_DEFINITIONS.map(...)` in `filters.ts`), so what «ساخت مشترک» means is written once, in `specs.ts`, and read by the filter's popover and the superadmin's form hint alike. It was written twice before.
3. **`sorts.ts` has one shared constant, `WITHOUT_PRICE_LAST`**, the sentence the two price orders share («آگهی‌های توافقی و قسطی آخر.»): the lint refuses the same sentence twice in a file, and once is better.
4. **`catalogues.ts` computes the rating's band** for «معامله‌های عالی زیر ۱ میلیارد» from `DEAL_GAP_PCT.great` through `formatPercent`: the lead now says what «عالی» means beside the budget, and cannot drift from the rating.
5. **`model-info.ts` no longer imports the numbers of `model-rules.ts`** (the share of prices a range keeps, the points of a trend, the windows of a change): the popovers do not quote them. The constants stay; the queries use them.
6. **`mileage-reading.ts` no longer quotes `THOUSANDS_PRICE_BAND` and `MOST_ASSUMED_KM_PER_YEAR`**: the worker's valuation still decides with them (both stay exported), a buyer is no longer told them.
7. **`NORMAL_KM_PER_YEAR` (20 000 km a year) is now used by no production text.** It stays exported, with its note about S01 method 1; only a test refers to it.

## How a popover reads now (the whole text a buyer sees)

Title, then the paragraphs and rows, in the order the builder sets them out. «Before» is what the same builder produced from the old definitions (headings in brackets).

**کم‌کارکرد نسبت به سن (the owner's example, 2026-10-01)**

| Before | After |
|---|---|
| خودرویی که کمتر از معمول بازار (حدود ۲۰٬۰۰۰ کیلومتر در سال) کار کرده است. آگهی‌های بدون کارکرد یا سال ساخت کنار می‌روند.<br>[معیار دقیق] حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو؛ خودروی کمتر از یک سال، نیم سال حساب می‌شود. | خودروهایی که کمتر از معمول بازار کار کرده‌اند.<br>حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو. |

**ارزیابی قیمت**

| Before | After |
|---|---|
| قیمت آگهی در مقایسه با ارزش بازار همان خودرو که کارشناس هر روز از آگهی‌های مشابه حساب می‌کند. آگهی‌های بدون ارزیابی کنار می‌روند.<br>[گزینه‌ها] قیمت آگهی دست‌کم ۱۰‏٪ کمتر از ارزش بازار همان خودرو باشد.<br>[گزینه‌ها] قیمت آگهی دست‌کم ۴‏٪ کمتر از ارزش بازار همان خودرو باشد.<br>[گزینه‌ها] قیمت آگهی کمتر از ۴‏٪ بالاتر از ارزش بازار همان خودرو باشد.<br>[گزینه‌ها] قیمت آگهی کمتر از ۱۰‏٪ بالاتر از ارزش بازار همان خودرو باشد.<br>[گزینه‌ها] کارشناس قیمت آگهی را با ارزش بازار همان خودرو سنجیده باشد. | قیمت آگهی در مقایسه با ارزش بازار همان خودرو.<br>معامله‌ی عالی: دست‌کم ۱۰‏٪ زیر ارزش بازار.<br>معامله‌ی خوب: دست‌کم ۴‏٪ زیر ارزش بازار.<br>قیمت منصفانه: کمتر از ۴‏٪ بالاتر از ارزش بازار.<br>گران: کمتر از ۱۰‏٪ بالاتر از ارزش بازار.<br>خیلی گران: همه‌ی آگهی‌های ارزیابی‌شده، با هر قیمتی. |

**تمیز و بی‌دردسر (161 words before, 109 after)**

| Before | After |
|---|---|
| بدون رنگ و تصادف، موتور و گیربکس و شاسی سالم، کم‌کارکرد نسبت به سن و از مدل‌های پرطرفدار که قطعه و تعمیرکارش همه‌جا هست.<br>[شرط‌ها] کم‌کارکرد نسبت به سن: حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو؛ خودروی کمتر از یک سال، نیم سال حساب می‌شود.<br>مدل پرطرفدار: یکی از ۱۵ مدلی که بیشترین آگهی فعال را در کارشناس دارند.<br>بدون رنگ: فروشنده بدنه را سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده یا متن آگهی گفته بی‌رنگ است، و نه فروشنده و نه متن هیچ رنگی، حتی یک لکه، نگفته‌اند.<br>وضعیت موتور: موتور سالم.<br>وضعیت گیربکس: گیربکس سالم.<br>وضعیت شاسی: شاسی سالم و پلمپ.<br>بدون تصادف: فروشنده بدنه را تصادفی یا اوراقی اعلام نکرده و متن آگهی از تصادف نگفته است.<br>بدون تعویض بدنه: متن آگهی از تعویض هیچ قطعه‌ای از بدنه (گلگیر، درب، کاپوت، سقف یا صندوق) نگفته است.<br>[ترتیب نمایش] بهترین معامله: آگهی‌هایی که بیشتر از همه زیر ارزش بازارند اول می‌آیند؛ آگهی‌های بدون ارزیابی آخر. | بدون رنگ و تصادف، با موتور و گیربکس و شاسی سالم، کم‌کارکرد و از مدل‌های پرطرفدار.<br>کم‌کارکرد نسبت به سن: حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو.<br>مدل پرطرفدار: یکی از ۱۵ مدلی که بیشترین آگهی را دارند.<br>بدون رنگ: در آگهی نوشته شده بدنه بی‌رنگ است و حتی یک لکه رنگ هم نیامده است.<br>وضعیت موتور: موتور سالم.<br>وضعیت گیربکس: گیربکس سالم.<br>وضعیت شاسی: شاسی سالم و پلمپ.<br>بدون تصادف: در آگهی از تصادف و اوراقی بودن بدنه چیزی نیامده است.<br>بدون تعویض بدنه: در متن آگهی از تعویض قطعه‌ی بدنه چیزی نیامده است.<br>بهترین معامله: اول آگهی‌هایی که بیشتر زیر ارزش بازارند. آگهی‌های بدون ارزیابی آخر. |

**پیشنهاد کارشناس (131 words before, 94 after)**

| Before | After |
|---|---|
| معامله‌های خوب و عالی با بدنه‌ی بدون رنگ، بدون تصادف و موتور، گیربکس و شاسی سالم.<br>[شرط‌ها] ارزیابی قیمت: قیمت آگهی دست‌کم ۴‏٪ کمتر از ارزش بازار همان خودرو باشد.<br>بدون رنگ: فروشنده بدنه را سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده یا متن آگهی گفته بی‌رنگ است، و نه فروشنده و نه متن هیچ رنگی، حتی یک لکه، نگفته‌اند.<br>وضعیت موتور: موتور سالم.<br>وضعیت گیربکس: گیربکس سالم.<br>وضعیت شاسی: شاسی سالم و پلمپ.<br>بدون تصادف: فروشنده بدنه را تصادفی یا اوراقی اعلام نکرده و متن آگهی از تصادف نگفته است.<br>بدون تعویض بدنه: متن آگهی از تعویض هیچ قطعه‌ای از بدنه (گلگیر، درب، کاپوت، سقف یا صندوق) نگفته است.<br>[ترتیب نمایش] بهترین معامله: آگهی‌هایی که بیشتر از همه زیر ارزش بازارند اول می‌آیند؛ آگهی‌های بدون ارزیابی آخر. | معامله‌ی خوب یا عالی، با بدنه‌ی بدون رنگ و تصادف و با موتور، گیربکس و شاسی سالم.<br>ارزیابی قیمت: دست‌کم ۴‏٪ زیر ارزش بازار.<br>بدون رنگ: در آگهی نوشته شده بدنه بی‌رنگ است و حتی یک لکه رنگ هم نیامده است.<br>وضعیت موتور: موتور سالم.<br>وضعیت گیربکس: گیربکس سالم.<br>وضعیت شاسی: شاسی سالم و پلمپ.<br>بدون تصادف: در آگهی از تصادف و اوراقی بودن بدنه چیزی نیامده است.<br>بدون تعویض بدنه: در متن آگهی از تعویض قطعه‌ی بدنه چیزی نیامده است.<br>بهترین معامله: اول آگهی‌هایی که بیشتر زیر ارزش بازارند. آگهی‌های بدون ارزیابی آخر. |

**کارکرد تخمینی, a mileage read in thousands (the line under the figure, then its popover)**

| Before | After |
|---|---|
| ۱۰۰ کیلومتر نوشته شده؛ با توجه به قیمت و سال، احتمالاً ۱۰۰٬۰۰۰ کیلومتر<br>(info) کارکرد نوشته‌شده و کارکرد تخمینی<br>برخی فروشنده‌ها کارکرد را به هزار کیلومتر می‌نویسند: «۱۰۰» یعنی ۱۰۰٬۰۰۰ کیلومتر. برای خودرویی که چند سال از ساختش گذشته، چند صد کیلومتر باورپذیر نیست، مگر آگهی بگوید.<br>آگهی نمی‌گوید خودرو صفر است، پس قیمت را با ارزش بازار سنجیدیم: اگر قیمت حداکثر ۱۵‏٪ بالاتر از ارزش خودرو با کارکرد هزارتایی باشد و ارزش با کارکرد نوشته‌شده دست‌کم ۱۵‏٪ بیشتر باشد، هزارتایی می‌خوانیم؛ بیش از ۴۰٬۰۰۰ کیلومتر در سال را هم نمی‌پذیریم.<br>ارزش بازار، رتبه و جست‌وجو با همین کارکرد تخمینی کار می‌کنند. | ۱۰۰ کیلومتر نوشته شده. از روی قیمت و سال، احتمالاً ۱۰۰٬۰۰۰ کیلومتر است.<br>(info) کارکرد نوشته‌شده و کارکرد تخمینی<br>برخی فروشنده‌ها کارکرد را به هزار کیلومتر می‌نویسند.<br>برای خودرویی که چند سال از ساختش گذشته، ۱۰۰ کیلومتر بعید است. قیمت و سال ساخت با ۱۰۰٬۰۰۰ کیلومتر می‌خواند.<br>ارزش بازار، ارزیابی و جست‌وجو از همین کارکرد استفاده می‌کنند. |

The catalogue and limit popovers are still lists: the unit tests (`info-content.test.ts`, `explain.test.ts`) and spec S02 say a catalogue shows its description, one line for each condition it applies and its order, and a limit one line for each value it offers. The lines are short now, but the guide's «one or two sentences» is not reached for a catalogue of seven conditions. See «Left for you to decide».

## Every changed string, by definition

Texts are as the buyer reads them (numbers filled in by the formatters, from the same constants the SQL uses). The «why» is a few words; R1 to R10 are the guide's rules, E-numbers its section 8.

### Filters (`packages/search/src/filters.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| برند, description | سازنده‌ی خودرو، مثل پژو، ایران‌خودرو یا کیا. فقط برندهایی که آگهی فعال دارند نشان داده می‌شوند. | سازنده‌ی خودرو، مثل پژو، ایران‌خودرو یا کیا. | «آگهی فعال» is our word and the list itself shows the brands that have listings (R7). |
| مدل, description | مدل خودرو، مثل ۲۰۶، دنا پلاس یا کوییک. «مدل ۱۴۰۰» در آگهی‌ها معمولاً سال ساخت است؛ آن را در سال ساخت بگذارید. | مدل خودرو، مثل ۲۰۶، دنا پلاس یا کوییک. «مدل ۱۴۰۰» در آگهی‌ها معمولاً سال ساخت است. برای آن «سال ساخت» را انتخاب کنید. | Kept in substance: «مدل ۱۴۰۰» means a year. A full stop where the «؛» was, and the instruction names the control it points to. |
| تیپ, description | تیپ یا نسخه‌ی مدل، مثل «تیپ ۲» یا «پلاس». آگهی‌هایی که تیپشان را نگفته‌اند با این فیلتر کنار می‌روند. | نسخه‌ی مدل، مثل «تیپ ۲» یا «پلاس». آگهی‌هایی که تیپ را ننوشته‌اند نشان داده نمی‌شوند. | No restating of the title. «نشان داده نمی‌شوند» is now the one verb for a listing a filter leaves out (it was «کنار می‌روند»). |
| نوع بدنه, description | سدان، هاچ‌بک، شاسی‌بلند و بقیه، از روی مدل هر خودرو. فقط نوع‌هایی که آگهی فعال دارند نشان داده می‌شوند. | سدان، هاچ‌بک، شاسی‌بلند و مانند آن‌ها. نوع بدنه از روی مدل خودرو معلوم می‌شود. | The list shows the types that exist («آگهی فعال» cut); what stays is where the type comes from. |
| سال ساخت, description | سال ساخت به تقویم شمسی. سال میلادی خودروهای وارداتی به شمسی برگردانده شده است. | سال ساخت به تقویم شمسی. سال میلادی خودروهای وارداتی به شمسی تبدیل شده است. | Same facts; «تبدیل شده» is the plainer verb. |
| حداکثر عمر, description | خودروهایی که از سال ساختشان حداکثر این چند سال گذشته است؛ با گذشت سال خودش جلو می‌رود. | خودروهایی که حداکثر این چند سال از سال ساختشان گذشته است. | One sentence. That the age moves with the calendar is not something a buyer decides with. |
| حداکثر عمر, value 5, rule | سال ساخت خودرو حداکثر ۵ سال پیش از امسال باشد (به تقویم شمسی). | سال ساخت از ۵ سال پیش تا امسال. | The row beside «حداکثر N سال عمر» no longer repeats «حداکثر»; no parenthesis and no «باشد»; the range is exactly what the SQL keeps (from N years ago to this year). |
| کارکرد, description | کیلومتری که فروشنده اعلام کرده است. آگهی‌های بدون کارکرد یا با کارکرد «نامشخص» کنار می‌روند. | کیلومتری که فروشنده نوشته است. آگهی‌هایی که کارکرد را ننوشته‌اند نشان داده نمی‌شوند. | «اعلام کرده» is a clerk's verb. One verb for a listing left out. |
| کم‌کارکرد نسبت به سن, description | خودرویی که کمتر از معمول بازار (حدود ۲۰٬۰۰۰ کیلومتر در سال) کار کرده است. آگهی‌های بدون کارکرد یا سال ساخت کنار می‌روند. | خودروهایی که کمتر از معمول بازار کار کرده‌اند. | The guide (E3): two figures, 20 000 and 12 000, stood in one popover. The market's norm is the model's, not a buyer's; the rule carries the figure they can check. |
| کم‌کارکرد نسبت به سن, rule | حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو؛ خودروی کمتر از یک سال، نیم سال حساب می‌شود. | حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو. | The owner's own example sentence. The half-year edge for a car under a year old is a detail of the code (E3). |
| مدل پرطرفدار, description | مدلی که آگهی‌های زیادی در بازار دارد: قطعه و تعمیرکارش همه‌جا پیدا می‌شود و زودتر فروش می‌رود. | مدلی که آگهی‌های زیادی دارد. قطعه و تعمیرکارش راحت پیدا می‌شود و زودتر فروش می‌رود. | Two short sentences; «همه‌جا» (everywhere) was an absolute claim. |
| مدل پرطرفدار, rule | یکی از ۱۵ مدلی که بیشترین آگهی فعال را در کارشناس دارند. | یکی از ۱۵ مدلی که بیشترین آگهی را دارند. | «فعال» and «در کارشناس» are ours. The number stays: it is the rule. |
| قیمت, description | قیمتی که آگهی نوشته است، به تومان. آگهی‌های توافقی و قسطی قیمت نقد ندارند و با این فیلتر کنار می‌روند. | قیمتی که آگهی نوشته است، به تومان. آگهی‌های توافقی و قسطی قیمت نقدی ندارند و نشان داده نمی‌شوند. | One verb for a listing left out; «نقدی» is the adjective of the price. |
| ارزیابی قیمت, description | قیمت آگهی در مقایسه با ارزش بازار همان خودرو که کارشناس هر روز از آگهی‌های مشابه حساب می‌کند. آگهی‌های بدون ارزیابی کنار می‌روند. | قیمت آگهی در مقایسه با ارزش بازار همان خودرو. | The guide (E40): how the market value is made is said once, where the value is explained; an unrated listing cannot match a rating anyway. |
| ارزیابی قیمت, option «معامله‌ی عالی», rule | قیمت آگهی دست‌کم ۱۰‏٪ کمتر از ارزش بازار همان خودرو باشد. | دست‌کم ۱۰‏٪ زیر ارزش بازار. | The band in percent is the number a buyer can check, written as the phrase of the guide's own example (section 5) instead of a «باشد» sentence. |
| ارزیابی قیمت, option «معامله‌ی خوب», rule | قیمت آگهی دست‌کم ۴‏٪ کمتر از ارزش بازار همان خودرو باشد. | دست‌کم ۴‏٪ زیر ارزش بازار. | The band in percent is the number a buyer can check, written as the phrase of the guide's own example (section 5) instead of a «باشد» sentence. |
| ارزیابی قیمت, option «قیمت منصفانه», rule | قیمت آگهی کمتر از ۴‏٪ بالاتر از ارزش بازار همان خودرو باشد. | کمتر از ۴‏٪ بالاتر از ارزش بازار. | The band in percent is the number a buyer can check, written as the phrase of the guide's own example (section 5) instead of a «باشد» sentence. |
| ارزیابی قیمت, option «گران», rule | قیمت آگهی کمتر از ۱۰‏٪ بالاتر از ارزش بازار همان خودرو باشد. | کمتر از ۱۰‏٪ بالاتر از ارزش بازار. | The band in percent is the number a buyer can check, written as the phrase of the guide's own example (section 5) instead of a «باشد» sentence. |
| ارزیابی قیمت, option «خیلی گران», rule | کارشناس قیمت آگهی را با ارزش بازار همان خودرو سنجیده باشد. | همه‌ی آگهی‌های ارزیابی‌شده، با هر قیمتی. | «کارشناس» was the subject (R9). Says what the choice keeps. |
| گیربکس, description | دنده‌ای یا اتوماتیک، همان‌طور که آگهی نوشته است. | دنده‌ای یا اتوماتیک، به گفته‌ی آگهی. | One phrase, «به گفته‌ی …», for «as the seller says», in every definition. |
| سوخت, description | نوع سوخت. دوگانه‌سوز شرکتی را کارخانه نصب کرده و دوگانه‌سوز دستی را بعداً نصب کرده‌اند. | دوگانه‌سوز شرکتی را کارخانه نصب کرده است و دوگانه‌سوز دستی را بعداً نصب کرده‌اند. | The first fragment restated the title. The difference between the two dual-fuels stays. |
| حجم موتور, description | حجم موتور بر حسب سی‌سی، از عنوان آگهی یا از مشخصات تیپ و مدل در کارشناس (نه از فروشنده). آگهی‌ای که حجمش معلوم نیست در این فیلتر نمی‌آید و صفحه می‌گوید چند آگهی به همین دلیل کنار رفته است. | حجم موتور به سی‌سی، از عنوان آگهی یا از مشخصات مدل. آگهی‌هایی که حجمشان معلوم نیست نشان داده نمی‌شوند. | Where the figure comes from, in a clause. The page itself says how many listings the volume left out, so the popover need not (R5). |
| مبدأ خودرو, description | ایرانی، ساخت مشترک (طراحی خارجی که در ایران ساخته می‌شود) یا وارداتی. مبدأ را کارشناس برای هر مدل و تیپ ثبت کرده است، نه فروشنده؛ آگهی‌ای که مبدأش معلوم نیست در این فیلتر نمی‌آید. | ایرانی: طراحی و ساخت ایران، مثل پراید، سمند، دنا و کوییک. ساخت مشترک: طراحی خارجی و ساخت ایران، مثل پژو ۲۰۶ و ۴۰۵. وارداتی: ساخت خارج از ایران، مثل تویوتا کرولا یا بی‌ام‌و. | Built from the three origin definitions (below), so the words are written once. Says what each origin means, with examples. The catalogue is ours, and the page counts the listings of unknown origin. |
| کشور سازنده, description | کشوری که برند خودرو از آنجاست، مهم نیست کجا ساخته یا مونتاژ شده باشد: پژوی مونتاژ ایران «فرانسوی» است. کشور را کارشناس برای هر برند و مدل ثبت کرده است، نه فروشنده؛ آگهی‌ای که کشورش معلوم نیست در این فیلتر نمی‌آید. «خارجی» یعنی وارداتی و فیلتر مبدأ را ببینید. | کشوری که برند خودرو از آنجاست، حتی اگر در ایران ساخته یا مونتاژ شده باشد. مثلاً پژو ۲۰۶ ساخت ایران «فرانسوی» است. اگر منظورتان از «خارجی» وارداتی است، «مبدأ خودرو» را ببینید. | 49 words, 33 now. Who keeps the catalogue of countries is ours, and the page counts the listings without a country. The pointer from «خارجی» to the origin filter stays (CS-103). |
| رنگ, description | خانواده‌ی رنگ؛ مثلاً «سفید» سفید صدفی را هم می‌آورد و «خاکستری» نوک‌مدادی و طوسی را. | رنگ‌های نزدیک به هم یک گروه‌اند. مثلاً «سفید» سفید صدفی را هم می‌گیرد و «خاکستری» نوک‌مدادی و طوسی را. | «خانواده‌ی رنگ» was a calque. One idea per sentence. |
| بدون رنگ, description | بدنه‌ای که فروشنده سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده، یا متن آگهی گفته بی‌رنگ است. اگر متن حتی یک لکه رنگ بگوید کنار می‌رود. | بدنه‌ای که سالم است یا فقط خط‌وخش جزئی یا صافکاری بی‌رنگ دارد. | Says what «بدون رنگ» covers. How it is decided moved to the rule, so the two no longer say one thing. |
| بدون رنگ, rule | فروشنده بدنه را سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده یا متن آگهی گفته بی‌رنگ است، و نه فروشنده و نه متن هیچ رنگی، حتی یک لکه، نگفته‌اند. | در آگهی نوشته شده بدنه بی‌رنگ است و حتی یک لکه رنگ هم نیامده است. | 31 words and a double negative, 14 now. Both halves of the code's rule stay: the ad says unpainted, and no paint is named anywhere, a spot included. |
| وضعیت بدنه, description | بدنه همان‌طور که فروشنده در آگهی انتخاب کرده است؛ ادعای فروشنده است، نه نتیجه‌ی کارشناسی. | وضعیت بدنه را فروشنده گفته است، نه بازدید خودرو. | The honest limit, a seller's claim and no inspection, in one sentence. «کارشناسی» is also the name of our inspection service. |
| وضعیت بدنه, option «سالم و بی‌خط‌وخش», label | سالم و بی خط و خش | سالم و بی‌خط‌وخش | Lint: a space where a half-space belongs. The project already spells it «خط‌وخش» (listing-explanation.ts). |
| وضعیت بدنه, option «سالم و بی‌خط‌وخش», chip | بدنه‌ی سالم و بی خط و خش | بدنه‌ی سالم و بی‌خط‌وخش | Same. |
| وضعیت بدنه, option «خط‌وخش جزئی», label | خط و خش جزئی | خط‌وخش جزئی | Same spelling. |
| وضعیت بدنه, option «خط‌وخش جزئی», chip | بدنه: خط و خش جزئی یا بهتر | خط‌وخش جزئی یا بهتر | Lint: a label over four words. «یا بهتر» is the wording of the deal chips, and these terms only apply to a body. |
| وضعیت بدنه, option «صافکاری بی‌رنگ», chip | بدنه: صافکاری بی‌رنگ یا بهتر | صافکاری بی‌رنگ یا بهتر | Lint: a label over four words. «یا بهتر» is the wording of the deal chips, and these terms only apply to a body. |
| وضعیت بدنه, option «رنگ‌شدگی», chip | بدنه: رنگ‌شدگی یا بهتر | رنگ‌شدگی یا بهتر | Lint: a label over four words. «یا بهتر» is the wording of the deal chips, and these terms only apply to a body. |
| وضعیت بدنه, option «دوررنگ», chip | بدنه: دوررنگ یا بهتر | دوررنگ یا بهتر | Lint: a label over four words. «یا بهتر» is the wording of the deal chips, and these terms only apply to a body. |
| وضعیت بدنه, option «تمام رنگ», chip | بدنه: تمام رنگ یا بهتر | تمام رنگ یا بهتر | Lint: a label over four words. «یا بهتر» is the wording of the deal chips, and these terms only apply to a body. |
| وضعیت بدنه, option «اوراقی», chip | بدنه: همه‌ی وضعیت‌های اعلام‌شده | بدنه: همه‌ی وضعیت‌ها | «اعلام‌شده» is a clerk's word; the description now says the condition is the seller's. |
| وضعیت موتور, description | موتور همان‌طور که فروشنده اعلام کرده است. | وضعیت موتور را فروشنده گفته است، نه بازدید خودرو. | The same honest limit as the body's, said the same way. |
| وضعیت گیربکس, description | گیربکس همان‌طور که فروشنده اعلام کرده است. | وضعیت گیربکس را فروشنده گفته است، نه بازدید خودرو. | Same. |
| وضعیت شاسی, description | سالم یعنی فروشنده هر دو شاسی جلو و عقب را سالم و پلمپ اعلام کرده، یا فقط متن آگهی گفته شاسی سالم است. آسیب یا رنگ هر کدام از دو شاسی، در فیلد یا متن، همان وضعیت را می‌گیرد. | سالم یعنی هر دو شاسی جلو و عقب سالم و پلمپ‌اند، به گفته‌ی آگهی. اگر یکی آسیب دیده یا رنگ شده باشد، همان وضعیت حساب می‌شود. | «فیلد» is English. The three states a buyer can pick stay, with what decides between them. |
| بدون تصادف, description | آگهی‌هایی که فروشنده بدنه را تصادفی یا اوراقی زده یا در متن از تصادف گفته کنار می‌روند. نگفتن تصادف به معنی نداشتن آن نیست. | آگهی‌هایی که تصادف در آن‌ها نوشته شده نشان داده نمی‌شوند. ننوشتن تصادف به معنی نداشتن آن نیست. | The honest limit stays: not writing an accident is not having none. One verb for «written». |
| بدون تصادف, rule | فروشنده بدنه را تصادفی یا اوراقی اعلام نکرده و متن آگهی از تصادف نگفته است. | در آگهی از تصادف و اوراقی بودن بدنه چیزی نیامده است. | The same condition in one clause: «در آگهی» covers what the seller chose and what the text says. |
| بدون تعویض بدنه, description | آگهی‌هایی که در متنشان تعویض گلگیر، درب، کاپوت یا قطعه‌ی دیگری از بدنه آمده کنار می‌روند. | آگهی‌هایی که تعویض گلگیر، درب، کاپوت، سقف یا صندوق در آن‌ها نوشته شده نشان داده نمی‌شوند. | The parts are listed once, here, so the rule that a catalogue repeats stays short. |
| بدون تعویض بدنه, rule | متن آگهی از تعویض هیچ قطعه‌ای از بدنه (گلگیر، درب، کاپوت، سقف یا صندوق) نگفته است. | در متن آگهی از تعویض قطعه‌ی بدنه چیزی نیامده است. | No parenthesis, no list (it moved to the description). The same «چیزی نیامده است» as the other «not stated» rules. |
| بدون سابقه‌ی تاکسی اینترنتی, label | کار نکرده در تاکسی اینترنتی | بدون سابقه‌ی تاکسی اینترنتی | Lint: a label over four words. «بدون سابقه‌ی …» is how the sibling filters are named. |
| بدون سابقه‌ی تاکسی اینترنتی, description | آگهی‌هایی که در متنشان گفته‌اند خودرو در اسنپ، تپسی یا تاکسی کار کرده کنار می‌روند. | آگهی‌هایی که سابقه‌ی تاکسی اینترنتی را نوشته‌اند نشان داده نمی‌شوند. | Description and rule were one sentence twice: now the first says what is left out, the second what is checked. |
| بدون سابقه‌ی تاکسی اینترنتی, rule | متن آگهی نگفته که خودرو در اسنپ، تپسی یا تاکسی کار کرده است. | در متن آگهی از کار در اسنپ، تپسی یا تاکسی چیزی نیامده است. | The same «چیزی نیامده است». |
| بیمه‌ی شخص ثالث, description | دست‌کم این چند ماه بیمه‌ی شخص ثالث باقی‌مانده، همان‌طور که آگهی اعلام کرده است. | خودروهایی که دست‌کم این چند ماه از بیمه‌ی شخص ثالثشان مانده است، به گفته‌ی آگهی. | A sentence with a subject; «به گفته‌ی آگهی» as in the other definitions. |
| بیمه‌ی شخص ثالث, value 6, rule | دست‌کم ۶ ماه از بیمه‌ی شخص ثالث خودرو باقی مانده باشد، همان‌طور که آگهی اعلام کرده است. | بیمه‌ی شخص ثالث دست‌کم ۶ ماه دیگر اعتبار دارد. | The limit «as the ad says» is said once, in the description; this says what the number means. |
| معاوضه, description | فروشنده، در فیلد آگهی یا در متن، گفته است خودرو یا ملک را معاوضه می‌کند. | آگهی‌هایی که فروشنده در آن‌ها معاوضه با خودرو یا ملک را قبول کرده است. | «فیلد» is English. Description and rule were one sentence twice: now what is kept and how it is known. |
| معاوضه, rule | فروشنده در فیلد آگهی یا در متن آن گفته معاوضه می‌کند. | در آگهی معاوضه آمده است. | «در آگهی» covers the site's field and the text. |
| فروش قسطی, description | فروشنده امکان خرید قسطی یا با چک گذاشته است، یا قیمت آگهی پیش‌پرداخت است. | آگهی‌هایی که خرید قسطی یا با چک دارند. | Description and rule were one sentence twice; the down-payment case lives in the rule. |
| فروش قسطی, rule | فروشنده امکان خرید قسطی یا با چک گذاشته، یا قیمت آگهی پیش‌پرداخت است. | در آگهی خرید قسطی یا با چک آمده است، یا قیمت آگهی فقط پیش‌پرداخت است. | The fact a buyer must know stays: a price that is only a down payment counts. |
| بدون پلاک منطقه‌ی آزاد, label | بدون پلاک منطقه آزاد | بدون پلاک منطقه‌ی آزاد | The ezafe after a silent «ه» is «ه‌ی» (the guide, appendix A item 9). |
| بدون پلاک منطقه‌ی آزاد, description | خودروهای پلاک منطقه آزاد بازار جدایی دارند و بیرون از منطقه تردد محدود دارند؛ آگهی‌هایی که متنشان پلاک منطقه آزاد گفته کنار می‌روند. | پلاک منطقه‌ی آزاد بازار جدایی دارد و تردد خارج از منطقه محدود است. آگهی‌هایی که این پلاک را نوشته‌اند نشان داده نمی‌شوند. | The guide's own rewrite (E42). |
| بدون پلاک منطقه‌ی آزاد, rule | متن آگهی پلاک منطقه آزاد نگفته است. | در متن آگهی از پلاک منطقه‌ی آزاد چیزی نیامده است. | Ezafe, and the same «چیزی نیامده است». |
| محله, description | محله‌ای که آگهی نام برده است، در شهر خودش: نام محله‌ها در شهرهای مختلف تکرار می‌شود. | محله‌ای که آگهی نوشته است. | That district names repeat across cities is how the list is built, not something a buyer decides with. |
| فروشنده, description | نمایشگاه یا فروشنده‌ی شخصی، همان‌طور که منبع آگهی مشخص کرده است. | نمایشگاه یا فروشنده‌ی شخصی، همان‌طور که در آگهی آمده است. | «منبع آگهی مشخص کرده» meant the site; a buyer reads the ad. |
| زمان انتشار, value 3, rule | آگهی در ۳ روز گذشته منتشر شده باشد. | آگهی در ۳ روز گذشته منتشر شده است. | A statement, like the other rules. |

The age, insurance and posted-within filters offer several values (6, 5 and 4); one row stands for all of them, because only the number differs. The popover row of every body-condition option (the «explained» text, used when a catalogue applies the ranking) changed with the sentence below.

| Definition | Before | After | Why |
|---|---|---|---|
| Ranked filter without a rule (explain.ts), shown for the body's condition | فروشنده یکی از این‌ها را اعلام کرده باشد: سالم و بی خط و خش، خط و خش جزئی. | به گفته‌ی فروشنده، یکی از این‌ها: سالم و بی‌خط‌وخش، خط‌وخش جزئی. | «اعلام کرده باشد» is a clerk's phrase; «به گفته‌ی فروشنده» as in the definitions. |

### Origins (`packages/search/src/specs.ts`; the filter's own popover is in the table above)

| Definition | Before | After | Why |
|---|---|---|---|
| origin «ایرانی», description | طراحی خودروساز ایرانی و ساخت داخل، مثل پراید، سمند، دنا و کوییک. | طراحی و ساخت ایران، مثل پراید، سمند، دنا و کوییک. | Shorter and parallel with the other two; it is also the hint of the superadmin's form. |
| origin «ساخت مشترک», description | طراحی خارجی که در ایران با مجوز یا مشارکت ساخته می‌شود، مثل پژو ۲۰۶ و ۴۰۵. | طراحی خارجی و ساخت ایران، مثل پژو ۲۰۶ و ۴۰۵. | What a buyer needs: foreign design, built here. The legal arrangement («مجوز یا مشارکت») is not theirs to decide with. |
| origin «وارداتی», description | ساخت خارج از ایران و وارد‌شده، مثل تویوتا کرولا یا بی‌ام‌و. | ساخت خارج از ایران، مثل تویوتا کرولا یا بی‌ام‌و. | «وارداتی» is the label; the description says where it is built. |

### Catalogues (`packages/search/src/catalogues.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| catalogue «پیشنهاد کارشناس», lead | معامله‌های خوب و عالی با بدنه‌ی بدون رنگ، بدون تصادف و موتور، گیربکس و شاسی سالم. | معامله‌ی خوب یا عالی، با بدنه‌ی بدون رنگ و تصادف و با موتور، گیربکس و شاسی سالم. | «بدون تصادف و موتور» read as «without accident and engine»; the three sound parts now follow their own «با». |
| catalogue «معامله‌های عالی زیر ۱ میلیارد», lead | آگهی‌هایی که کارشناس «معامله‌ی عالی» ارزیابی کرده، با قیمت تا ۱ میلیارد تومان. | آگهی‌هایی که دست‌کم ۱۰‏٪ زیر ارزش بازارند. | It restated the title (the budget is in the title). Now it says what «عالی» means: the rating's own band, from `DEAL_GAP_PCT`. «کارشناس» as a subject is out (R9). |
| catalogue «تمیز و بی‌دردسر», lead | بدون رنگ و تصادف، موتور و گیربکس و شاسی سالم، کم‌کارکرد نسبت به سن و از مدل‌های پرطرفدار که قطعه و تعمیرکارش همه‌جا هست. | بدون رنگ و تصادف، با موتور و گیربکس و شاسی سالم، کم‌کارکرد و از مدل‌های پرطرفدار. | 24 words, 16 now: why a popular model is trouble-free is the popular-model filter's own popover. |
| catalogue «خانوادگی», lead | سدان، کراس‌اوور، شاسی‌بلند، مینی‌ون و استیشن با حداکثر ۱۰ سال عمر و موتور، گیربکس و شاسی سالم. | سدان، کراس‌اوور، شاسی‌بلند، مینی‌ون و استیشن، حداکثر ۱۰ سال عمر، با موتور و گیربکس و شاسی سالم. | «عمر و موتور» read as one pair; each condition now stands apart. |
| catalogue «دنده‌اتوماتیک», title | دنده‌اتوماتیک | گیربکس اتوماتیک | The glossary's word is «گیربکس» (the filter and its options use it); «دنده‌اتوماتیک» was a joined spelling that is not standard Farsi. |
| catalogue «مناسب کار در تاکسی اینترنتی», lead | مدل‌های پرطرفدار با قطعه‌ی ارزان، حداکثر ۱۰ سال عمر و موتور و گیربکس سالم. شرایط هر سرویس را جداگانه ببینید. | مدل‌های پرطرفدار که حداکثر ۱۰ سال عمر دارند و موتور و گیربکسشان سالم است. هر سرویس شرایط خودش را دارد. | «قطعه‌ی ارزان» was a claim, not a condition. The instruction became the fact it points to. |

### Sorts (`packages/search/src/sorts.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| sort «بهترین معامله», description | آگهی‌هایی که بیشتر از همه زیر ارزش بازارند اول می‌آیند؛ آگهی‌های بدون ارزیابی آخر. | اول آگهی‌هایی که بیشتر زیر ارزش بازارند. آگهی‌های بدون ارزیابی آخر. | A full stop where a «؛» was (R4), and «از همه» and «می‌آیند» cut: 11 words, one phrase like the other orders («X اول»). |
| sort «ارزان‌ترین», description | کمترین قیمت اول؛ آگهی‌های توافقی و قسطی آخر. | کمترین قیمت اول. آگهی‌های توافقی و قسطی آخر. | A full stop where a «؛» was (R4). The sentence both price orders share is written once. |
| sort «گران‌ترین», description | بیشترین قیمت اول؛ آگهی‌های توافقی و قسطی آخر. | بیشترین قیمت اول. آگهی‌های توافقی و قسطی آخر. | A full stop where a «؛» was (R4). The sentence both price orders share is written once. |

### The mileage reading (`packages/search/src/mileage-reading.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| popover and line: info paragraph 1 (all) | برخی فروشنده‌ها کارکرد را به هزار کیلومتر می‌نویسند: «{…}» یعنی {…}. برای خودرویی که چند سال از ساختش گذشته، چند صد کیلومتر باورپذیر نیست، مگر آگهی بگوید. | برخی فروشنده‌ها کارکرد را به هزار کیلومتر می‌نویسند. | The lint's last violation (27 words). The example repeated the two figures of the line just above the control; why a few hundred kilometres is unlikely moved to the sentence about the price. |
| popover and line: info paragraph 2 (thousands in the text) | متن این آگهی کارکرد را هزارتایی گفته (مثلاً {…} هزار)؛ همان را می‌پذیریم. | متن این آگهی هم کارکرد را هزار کیلومتر گفته است. | No parenthesis, no «؛»; says plainly what the text said. |
| popover and line: info paragraph 2 (thousands by the price) | آگهی نمی‌گوید خودرو صفر است، پس قیمت را با ارزش بازار سنجیدیم: اگر قیمت حداکثر {…} بالاتر از ارزش خودرو با کارکرد هزارتایی باشد و ارزش با کارکرد نوشته‌شده دست‌کم {…} بیشتر باشد، هزارتایی می‌خوانیم؛ بیش از {…} در سال را هم نمی‌پذیریم. | برای خودرویی که چند سال از ساختش گذشته، {…} بعید است. قیمت و سال ساخت با {…} می‌خواند. | The guide, section 5: the 15 % and the 40 000 km a year are thresholds of our method, not figures a buyer can check. The reason a buyer can follow stays. 43 words and a «؛» became two short sentences. |
| popover and line: info paragraph 3 (all) | ارزش بازار، رتبه و جست‌وجو با همین کارکرد تخمینی کار می‌کنند. | ارزش بازار، ارزیابی و جست‌وجو از همین کارکرد استفاده می‌کنند. | «رتبه» is not our word for the rating (R6: ارزیابی). |
| popover and line: line (thousands in the text) | {…} نوشته شده؛ متن آگهی آن را هزار کیلومتر می‌داند: {…} | {…} نوشته شده. طبق متن آگهی، {…} است. | Two sentences instead of «؛» and a colon; says what the text says. |
| popover and line: line (thousands by the price) | {…} نوشته شده؛ با توجه به قیمت و سال، احتمالاً {…} | {…} نوشته شده. از روی قیمت و سال، احتمالاً {…} است. | «با توجه به» is the English clause order (T9). The one honest hedge, «احتمالاً», stays. |

### The info popovers of the model page (`apps/web/src/features/model/model-info.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| rangeInfo, what | قیمتی که بیشتر آگهی‌های این مدل در آن می‌گنجند. فقط آگهی‌هایی که قیمت نقدی نوشته‌اند شمرده می‌شوند؛ توافقی و قسطی کنار می‌روند. | بیشتر آگهی‌های این مدل قیمتی در این محدوده دارند. | One sentence with a subject; the negotiable and instalment listings moved to the paragraph with the other things left out. |
| rangeInfo, rule | {…} ارزان‌ترین و {…} گران‌ترین قیمت‌ها کنار گذاشته می‌شود تا یک آگهی بسیار ارزان یا بسیار گران محدوده را بی‌جهت باز نکند؛ می‌ماند {…} میانی. | ارزان‌ترین و گران‌ترین قیمت‌ها حساب نمی‌شوند، تا یک قیمت غیرعادی محدوده را بی‌جهت بزرگ نکند. آگهی توافقی و قسطی هم حساب نمی‌شود. | The guide (E57): the 10 % and the 80 % are the method's share, not something a buyer checks. The reason for leaving the ends out stays. |
| marketValueInfo, what | قیمت آگهی در مقایسه با ارزش بازار همان خودرو که کارشناس هر روز از آگهی‌های مشابه حساب می‌کند. آگهی‌های بدون ارزیابی کنار می‌روند. | ارزش بازار هر خودرو از روی آگهی‌های مشابه حساب می‌شود و سال ساخت، کارکرد و وضعیتش در آن اثر دارد. با میانه‌ی قیمت آگهی‌ها فرق دارد. | It explained the rating, not the market value (it reused the deal filter's description). Now it answers what the control is for; the second sentence says how the value differs from the median of prices beside it. |
| marketValueInfo, rule | ارزش بازار هر آگهی برای خودروی همان آگهی حساب می‌شود (سال ساخت، کارکرد، وضعیت). این‌جا میانه‌ی آن ارزش‌ها را می‌بینید: ارزش خودروی معمولیِ آگهی‌شده، نه قیمت درخواستیِ فروشنده‌ها. | (merged into the paragraph above) | Merged above: the sentence repeated the stat's own help line, «میانه‌ی ارزش خودروهای آگهی‌شده». |
| trendInfo, what | روند قیمت از ثبت‌های روزانه‌ی خود کارشناس ساخته می‌شود: هر روز آگهی‌های ارزیابی‌شده‌ی یک سال ساخت از این مدل را می‌شمارد و میانه‌ی قیمتشان را نگه می‌دارد. از تاریخ ثبت آگهی‌ها حساب نمی‌شود، چون آگهی‌های فروش‌رفته در آن نیستند و نمودار را گمراه می‌کردند. | هر روز میانه‌ی قیمت آگهی‌های ارزیابی‌شده‌ی هر سال ساخت را ثبت می‌کنیم. | The guide (E58): 58 words and the reason the chart ignores listing dates are our method. «کارشناس» was a subject. One sentence says where the line comes from. |
| trendInfo, rows «نقطه، نوار، روز و هفته، نمودار، تغییر» | هر روز دست‌کم {…} ارزیابی‌شده از آن سال ساخت لازم است؛ با آگهی کمتر نقطه‌ای نمی‌گذاریم. / {…} میانیِ قیمت‌ها، از {…} تا {…} ردیف قیمت‌ها. / تا {…} تاریخچه هر نقطه یک روز است؛ بیشتر از آن هر نقطه یک هفته (از شنبه) است. / دست‌کم {…} لازم است؛ پیش از آن می‌گوییم تاریخچه هنوز کوتاه است. / تغییر {…} پیش فقط وقتی گفته می‌شود که ثبتی نزدیک به همان روز (با {…} اختلاف) داشته باشیم. | (deleted) | The guide (E59): five rows of thresholds, windows and tolerances. The chart's legend says what a point and the band are, and the page says when the history is short. |
| dealsOrderInfo, section heading | ترتیب نمایش | (deleted) | The guide (E39): a heading above a one-sentence popover. |
| factsInfo, what | شمارش آگهی‌های این مدل بر پایه‌ی آنچه فروشنده نوشته یا از متن آگهی خوانده شده است. آگهی‌ای که چیزی درباره‌ی موردی ننوشته در شمارش آن مورد نیست. | هم گزینه‌هایی که فروشنده انتخاب کرده و هم آنچه از متن آگهی می‌خوانیم شمرده می‌شود. آگهی‌ای که موردی را ننوشته باشد، در شمارش آن مورد نمی‌آید. | The section's lead already says «only what the listings wrote»; the popover says what that covers and what a silent listing does. |
| yearsInfo, what | میانه‌ی قیمت آگهی‌هایی که قیمت نقدی نوشته‌اند، در هر سال ساخت (شمسی). میانه یعنی نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از آن هستند. | میانه‌ی قیمت آگهی‌هایی که قیمت نقدی دارند، در هر سال ساخت. | The meaning of «میانه» is the hero stat's own help line on the same page (R5); «شمسی» is what «سال ساخت» means here. |

### The popover builders and the mileage control (`info-content.ts`, `mileage-info.ts`)

| Definition | Before | After | Why |
|---|---|---|---|
| MILEAGE_INFO_CLOSE, value | بستن توضیح کارکرد | بستن | The guide, section 4: «بستن» closes a popover. The object, the mileage, is already the title. |
| info builders, section headings «معیار دقیق», «شرط‌ها», «گزینه‌ها», «ترتیب  | معیار دقیق / شرط‌ها / گزینه‌ها / ترتیب نمایش / از بهترین به بدترین | (no headings; for a ranked filter without rules the list of options best to worst is not shown) | The guide (E39): no headings in a popover, no list where a sentence will do. The builder no longer reads those five keys; they are dead in search-copy.ts (area B). |

## Kept, and why

| Strings | Why kept |
|---|---|
| Filter names (33 of 35): برند، مدل، تیپ، نوع بدنه، سال ساخت، حداکثر عمر، کارکرد، کم‌کارکرد نسبت به سن، مدل پرطرفدار، قیمت، ارزیابی قیمت، گیربکس، سوخت، حجم موتور، مبدأ خودرو، کشور سازنده، رنگ، بدون رنگ، وضعیت بدنه، وضعیت موتور، وضعیت گیربکس، وضعیت شاسی، بدون تصادف، بدون تعویض بدنه، بیمه‌ی شخص ثالث، معاوضه، فروش قسطی، شهر، محله، فروشنده، منبع، عکس‌دار، زمان انتشار | Names. Each is a plain noun of the glossary within the four-word budget; ids, URL parameters, e2e specs, search files and the buyer's own words depend on them. The other two changed (above). |
| Option names: the five ratings (معامله‌ی عالی، معامله‌ی خوب، قیمت منصفانه، گران، خیلی گران), gearbox (دنده‌ای، اتوماتیک), the seven fuels, the fifteen colours, the body ladder from صافکاری بی‌رنگ to اوراقی, موتور/گیربکس سالم، نیازمند تعمیر، تعویض‌شده, the three chassis states, فروشنده‌ی شخصی، نمایشگاه | Plain nouns the market uses (Divar's own words for the ladder); they are the buyer's vocabulary, and the values behind them are stored. |
| Chips: حداکثر N سال عمر، دست‌کم N ماه بیمه، آگهی‌های N روز گذشته، کشور N، فقط معامله‌ی عالی، معامله‌ی خوب یا بهتر، قیمت منصفانه یا بهتر، به‌جز خیلی گران، همه‌ی آگهی‌های ارزیابی‌شده، بدنه: به‌جز اوراقی | Within the four-word budget and plain; the deal chips are pinned by e2e and the search tests. «یا بهتر» is the pattern the new body chips follow. |
| Range chips (kinds.ts, search.ts): تا، از، تا، حداقل، مدل، کارکرد، حجم موتور before a figure; تومان | Short, correct and pinned by e2e (the volume chip reads «حداقل ۲٬۰۰۰ سی‌سی»). One observation for the owner: «از» (year, kilometres), «حداقل» (volume) and «دست‌کم» (rules) are three ways to say «at least» (see «Left for you to decide»). |
| Group names (6): خودرو، قیمت و معامله، بدنه و فنی، شرایط فروش، مکان و فروشنده، آگهی | Plain headings of the filter sheet within the budget. |
| Sort names (6): بهترین معامله، ارزان‌ترین، گران‌ترین، کم‌کارکردترین، جدیدترین آگهی، جدیدترین مدل; and the three one-line descriptions کمترین کارکرد اول، تازه‌ترین آگهی‌ها اول، بالاترین سال ساخت اول | The names of the select's options (one superlative each, so they read as a set); the descriptions are already one plain phrase. |
| Catalogue titles (9): پیشنهاد کارشناس، معامله‌های عالی زیر N، تمیز و بی‌دردسر، خانوادگی، کم‌کارکرد، گیربکس اتوماتیک، مناسب کار در تاکسی اینترنتی، فروش قسطی، تازه‌ترین آگهی‌ها | Names the home page, the search page, the search files, the tests and the buyer's own words use. One changed (above). |
| Four catalogue leads: «خودروهایی که نسبت به سنشان کمتر از معمول بازار کار کرده‌اند.» (کم‌کارکرد), «خودروهای اتوماتیک با قیمت منصفانه یا بهتر، برای ترافیک شهر.», «آگهی‌هایی که خرید قسطی یا با چک دارند، یا قیمتشان پیش‌پرداخت است.», «آگهی‌های N ساعت گذشته، تازه‌ترین اول.» | One plain sentence each that adds to the title; the first carries no number (its figure is the filter's own popover), the last is built from the posted-within chip. |
| Origin names (3) and the 17 countries (ایران … تایوان) | Proper nouns and the three words of CS-99/CS-103; the country adjectives buyers type live in the vocabulary, not here. |
| Five short descriptions: «شهری که آگهی در آن ثبت شده است.», «سایتی که آگهی در آن منتشر شده است.», «فقط آگهی‌هایی که عکس دارند.» with its rule «آگهی دست‌کم یک عکس دارد.», «آگهی‌هایی که در این چند روز اخیر منتشر شده‌اند.» | One plain clause each, nothing technical. The photo filter's two sentences are a minimal pair a buyer sees together; a single sentence would need a structural change. |
| Unit and scale words: کیلومتر (locale, three places), تومان (locale, kinds), « تا », میلیارد، میلیون، هزار, ساعت، روز، سال، ماه (the units the formatters join to a number) | The words of a number's unit; they are not sentences and every formatter and test relies on them. |
| The popover titles of the model page (7): محدوده‌ی قیمت، ارزش بازار، ارزیابی قیمت آگهی‌ها، روند قیمت، ترتیب بهترین معامله‌ها، آگهی‌ها چه می‌گویند، قیمت به تفکیک سال ساخت | The names of the controls; they match the section titles next to them and the e2e specs. |
| Mileage: the popover title «کارکرد نوشته‌شده و کارکرد تخمینی», the card's «N نوشته شده», the sentence for a mileage that is really that low «طبق متن آگهی، کارکرد واقعاً N است.», the control's name «توضیح درباره‌ی کارکرد تخمینی» and the hedge «احتمالاً» | Plain, one fact each. «احتمالاً» before an assumed figure is the one honest hedge the guide allows (M10). The popover pattern «توضیح درباره‌ی …» is the same for every control. |
| «قابل جست‌وجو» and «دیده‌شده» (document.ts) | Labels written into the facet table as bookkeeping rows; no page shows them (a superadmin screen reads other rows of that table). |
| «قبلی» and «بعدی» (scroll-rail-copy.ts) | The two controls of a row that scrolls sideways; each sits in a row with its own name, and the file says so. Not changed in this task: the structure is CS-112's. |

## Tests changed (none weakened; Playwright was not run)

| File | Change | Why |
|---|---|---|
| `packages/search/src/explain.test.ts` | The assertion that the low-mileage description holds the model's norm (20 000) became its opposite; a new assertion that the «عالی» catalogue quotes the rating's band from `DEAL_GAP_PCT` and the budget; a flag's description and rule must differ. | The old assertion pinned the two-figure popover the owner objected to. The new ones pin the new contract and are stricter, not looser. |
| `packages/search/src/definitions.test.ts` | `WRONG_CHARACTERS` no longer lists the right-to-left mark U+200F alone; it refuses it unless a percent sign follows. | The catalogue lead now states a rating's band, and `formatPercent` writes the mark before the sign on purpose (locale/format-number.ts). A stray mark anywhere else is still refused. |
| `packages/search/src/mileage-reading.test.ts` | The two expected lines have the new wording. The assertions that the explanation quotes «۱۵» and «۴۰٬۰۰۰» became «states ۱۰۰٬۰۰۰ and does not quote ۱۵ or ۴۰٬۰۰۰». | The owner's feedback and the guide (section 5): a threshold of our method is not shown to a buyer. The explanation still gives the figure a buyer can check. |
| `apps/web/src/features/search/info-content.test.ts` | Two new tests: no section of any filter or catalogue popover has a heading; a ladder with no measured rule (the body's condition) is explained by its description alone. | Pins the guide's popover pattern (E39) so a heading cannot come back. |
| `apps/web/src/features/search/components/filter-panel.test.tsx` | The hint under the deal select is looked up as the definition's own `rule` instead of a regular expression of retyped Persian. | The old regular expression matched the old sentence. Tests import the definition, never retype it. |
| `e2e/tests/app/search.spec.ts` | The catalogue popover must show a condition («وضعیت شاسی») and the order («بهترین معامله») and not the heading «شرط‌ها»; the low-mileage popover must say «کمتر از معمول بازار» and not «معیار دقیق»; the deal popover says «زیر ارزش بازار». The `exactRule` constant went. | The headings are gone by the guide. Not run (no Playwright, 2026-10-04); the coordinator runs it once after the merges. |
| `e2e/tests/app/home.spec.ts` | The catalogue popover on the home page must show the row «مدل پرطرفدار» instead of the heading «شرط‌ها». | Same. Not run. |
| `e2e/tests/app/model-page.spec.ts` | The trend popover is found by «هر روز میانه‌ی قیمت»; the test that the popovers state the numbers of the queries (10 %, 80 %, 8 listings, 3 points) became one that they state none of them and say what is left out. | The guide (E57, E59) removes those numbers. Not run. |
| `e2e/tests/app/assumed-mileage.spec.ts` | The expected line has the new wording; the popover must no longer contain «۱۵٪» or «۴۰٬۰۰۰» and must say «بعید است». | Same as the unit test. Not run. |

## Words settled here (for the guide's section 4 and the glossary, in the coordinator's hands)

- **«به گفته‌ی فروشنده» / «به گفته‌ی آگهی»** for a claim the data cannot confirm (bodies, engine, gearbox, chassis, insurance, gearbox type); «نوشتن» for what an ad states («تصادف نوشته شده»، «ننوشته‌اند»), with «چیزی نیامده است» for «not stated». One phrase for each idea across the definitions.
- **«نشان داده نمی‌شوند»** for a listing a filter leaves out. «کنار می‌روند» (our own idiom) is gone from every definition.
- **«بازدید»** for a physical inspection of a car (not «کارشناسی», which is also our product's name, glossary row «inspection»).
- **«گیربکس اتوماتیک»** is the catalogue's title (the glossary word), not «دنده‌اتوماتیک».
- **«خط‌وخش»** (half-spaces) for scratches, as `listing-explanation.ts` already spells it; **«منطقه‌ی آزاد»** with the ezafe the project writes after a silent «ه» (the guide, appendix A item 9). The glossary row for «plate» still says «منطقه آزاد».
- **«بستن»** for closing a popover: `MILEAGE_INFO_CLOSE` follows the guide's verb table («بستن توضیح کارکرد» became «بستن»).

## For other areas

- **Area B, `search-copy.ts`: the five keys `info.rule`, `info.options`, `info.conditions`, `info.order`, `info.bestToWorst` are dead** (only the two builders of this area read them, and they no longer do). Delete them in your pass (guide E39). `info.close` («بستن توضیح») should be «بستن» (guide section 4; the model page and now the mileage control already say «بستن»), and `catalogues.summaryOrder` is unused.
- **Area B, `gauge-view.ts`:** its popover shows `deal.description` («قیمت آگهی در مقایسه با ارزش بازار همان خودرو.», changed here) and then its own heading «پنج رده، از ارزان‌ترین» and «چه وقت ارزیابی نمی‌کنیم؟»: the guide (E43) wants those headings and the thresholds gone too. Its band rows say «دست‌کم ۱۰٪ زیر ارزش بازار» in the same words as the deal filter's options now; keep them one wording.
- **Area B, `listing-view.ts`:** «پلاک منطقه‌ی آزاد» (E55) already carries the ezafe; the filter's name is now «بدون پلاک منطقه‌ی آزاد», the same. The mileage note under a figure (`mileageNoteView`) is now two short sentences; the listing page shows it as it comes.
- **Area A, `model-copy.ts`:** the help line of the range («۸۰٪ میانیِ N آگهی», E56) and the short-history body («نه از حدس», E60) still quote the shares and points the popovers no longer do; the guide gives the rewrites. The popover «محدوده‌ی قیمت» now says «بیشتر آگهی‌های این مدل قیمتی در این محدوده دارند»: if your help line says the same, keep one of them.
- **Glossary (coordinator):** the «plate» row writes «منطقه آزاد» (appendix A item 9); the «search file» row still says «بسپارش به کارشناس» (E73, area C).
- **`packages/notifications/src/kinds.ts` (area C)** was not touched: the plan gives the whole file, settings texts included, to C.

## Left for you to decide

- **Catalogue and limit popovers are still lists.** The guide asks for one or two sentences, but `info-content.test.ts`, `explain.test.ts` and spec S02 require a catalogue popover to show its description, one line for each condition and its order, and a limit popover one line for each value it offers (6 lines for the age, 83 words in all; 5 for the insurance, 80; 4 for the posting time, 57). The lines are short now, but «تمیز و بی‌دردسر» is the lead, eight conditions and the order, 109 words (down from 158). A later task could drop the lines the lead already says («وضعیت موتور: موتور سالم.»), keep only the ones that define a number, and let a limit popover state its rule once («حداکثر ۵ سال عمر یعنی سال ساخت از ۵ سال پیش تا امسال.», 23 words with the description); that changes a test the owner's request of 2026-10-01 produced, so it is yours to decide.
- **«At least» has three forms:** «از ۶۰٬۰۰۰ کیلومتر» (a year or kilometres chip), «حداقل ۲٬۰۰۰ سی‌سی» (the volume chip, pinned by e2e) and «دست‌کم ۱۰٪» (the rules). One word per idea suggests «دست‌کم» for sentences and «حداقل» only for a field's label; the chips are another area's and e2e's.
- **«مبدأ خودرو»** (the origin filter's name) is a literary word; buyers say «ایرانی / وارداتی / ساخت مشترک» and nothing for the group. It is the owner's CS-99 decision and pinned by e2e, so it was kept.
- **The body-condition chips** now read «خط‌وخش جزئی یا بهتر» without the word «بدنه:» (the lint's four-word budget); the two ends, «بدنه: به‌جز اوراقی» and «بدنه: همه‌ی وضعیت‌ها», keep it because alone they say nothing. If you prefer a prefix on every chip, the budget is the thing to change.
- **Taste, not checked by a native reader:** the sentences «در آگهی نوشته شده بدنه بی‌رنگ است و از هیچ رنگی، حتی یک لکه، چیزی نیامده است.» (بدون رنگ), «سال ساخت از ۵ سال پیش تا امسال.» (age rows), «قیمت و سال ساخت با ۱۰۰٬۰۰۰ کیلومتر می‌خواند.» (mileage popover) and the origin popover that joins three definitions with colons.

## Checks that were run, and not run

- `pnpm copy:lint` over the 14 files with `--all --warnings`: 0 violations, 0 warnings (was 10 and 39). Whole repository: nothing new or worse than the baseline (130 violations, 330 warnings). No allowlist entry and no ignore comment was added; the baseline file was not changed.
- `packages/search`: the unit tests of `src` (`node --test`), 132 of 132 pass; `tsc --noEmit` is clean.
- `apps/web`: the unit tests that touch these modules (info-content, filter-panel, filter-panel-model, gauge-view, listing-view, listing-card-view, info-popover, search-params), 72 of 72 pass.
- The copy-fa skill's review scan over the area's files finds nothing but the vocabulary word «نسخه» in a `words` list (not copy). A fresh-context `copy-reviewer` pass was not possible from this lane (no sub-agent); the coordinator runs it.
- **Not run, by the owner's rule of 2026-10-04:** Playwright (the four specs above were edited as code only), `pnpm check`, any build or dev server, and screenshots at 412 and 1440 px: the criteria that need them are left unchecked on the task.
