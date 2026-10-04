# Copy rewrite, area D: the superadmin section (CS-109)

Written on 2026-10-04 by the CS-109 lane (branch `cs-109-copy-d`), the evidence for the task's first criterion: every string of the 14 Area D files (`docs/design/copy-rewrite-plan.md`) was read against the voice guide (`docs/design/product-voice.md`, ADR-0042), screen by screen as one set, and either rewritten or kept with a reason. The "before" is `pnpm copy:inventory --strings D` at `e109f5d` (593 strings); the "after" is the same command on this branch. Strings only: no component, prop or file was added, nothing moved, no copy constant was renamed (the few exceptions are listed under "Structure touched", with the reason).

## Result in numbers

| | Before | After |
|---|---:|---:|
| Strings with a Persian word, Area D | 593 | 592 |
| Lint violations (refuse rules) | 58 | 0 |
| Lint warnings (rules that ask a person) | 96 | 3, read and kept |
| Copy files (files that still hold a string) | 14 | 9 (five components held only a « · » or «؛» join, now «،» or a full stop) |
| « · » joins in the section (a dot beside a Persian digit reads as a zero) | 17 | 0 |

How the 593 strings were handled:

| | Strings |
|---|---:|
| Reviewed | 593 |
| Changed in place | 222 |
| Changed by merging into a shared sentence (6 old strings into 3 sentences written once in `admin-copy.ts`) | 6 |
| Deleted (an idea said elsewhere, a stale block, a dead key) | 6 |
| Kept, with a reason (K1 to K8 below) | 359 |

By screen (a string is counted on the screen that shows it first; the shared state and reason words sit with Sources):

| Screen | Reviewed | Changed | Deleted or merged | Kept |
|---|---:|---:|---:|---:|
| Dashboard | 20 | 11 | 2 | 7 |
| Sources | 34 | 17 | 3 | 14 |
| Worker and pipeline | 181 | 52 | 3 | 126 |
| Search files | 35 | 9 | 0 | 26 |
| Tracked models | 114 | 52 | 2 | 60 |
| Engine volume, origin and country | 108 | 36 | 0 | 72 |
| Model photos | 41 | 26 | 0 | 15 |
| Crawl requests | 60 | 19 | 2 | 39 |
| **Total** | **593** | **222** | **12** | **359** |

## How each screen was done

Each screen's strings were listed as one set (title, lead, hint, label, button, notice, popover, error), one idea to a string, then rewritten in the voice: plain standard verbs, «شما» unsaid, «ما» for what the product does, the answer first, a full stop where a «؛» was. The superadmin section keeps its operating words (خزش، توقف، صف، کارگر، پیمایش) where the owner acts on them (guide, section 5); the owner's own words of 2026-10-04 (fluff, not native Farsi, repetition, technical detail) were the test for each string.

| Screen | The set | What decided it |
|---|---|---|
| Dashboard | Seven cards (title, lead, link) and a block of "sections that will be added". | Three links repeated their card's title (R5): each link now says the act («دیدن پرونده‌ها», «مدیریت مدل‌ها», «تأیید یا رد درخواست‌ها»). Leads that listed what the page shows were cut to what it adds. The "sections to come" block promised tracked models, which has had a card since CS-53: deleted. |
| Sources | Title, lead, four state badges, the stop notice (title, time, reason, advice), pause and resume, the history, a status line, the error fallback. | The badge «متوقف به دست خزنده» is literary: «توقف خودکار». «خزیده نمی‌شود» was a calque: «بدون خزش». A history line is named like its button («توقف خزش»), so the status line keeps the sentence (R5 and the lint's repeated sentence). The «no answer» and «incomplete request» sentences were shared with the worker screen: written once. |
| Worker and pipeline | Lead, window switcher, stopped summary, worker status with its processes, jobs (queues, failures, abandoned jobs, changes), crawl per source (budget, runs, outcomes), listings with the freshness chart, problems per source. | «پایگاه داده» and «pg-boss» are out; thresholds and intervals (40 seconds, 15 seconds, 10 minutes) are out except where a word cannot say it. «در حال استراحت» (a joke about a lane) became «وقفه‌ی خزش»; «کنارگذاشته» became «رهاشده». The chart column and plot title wrote one sentence twice (lint). Every « · » is «،». |
| Search files | Lead, table heads, three file states, totals, the matching runs. | The lead listed the table's columns and a phone-number clause: both cut. The matching lead pointed at the list below: cut. «نامعتبر» (lint), « · » out. |
| Tracked models | Title, lead, the paused banner, summary tiles, two popovers, cards (origin, spec line, progress with a popover, seven facts, priority, controls, history), recent changes, the models not covered with a search and the cover form. | The lead, the popover, the priority popover and the progress popover said the daily cap four ways: the lead says the cap once, the popover says its effect. «حذف» is «برداشتن», «رتبه» is «ارزیابی», «نسخه» is «تیپ», «پوشش بده» (singular imperative) is «پوشش دادن». The banner says «خزش» as the sources screen does and stays honest: queued, nothing sent. |
| Engine volume, origin and country | Heading with a three-part popover, coverage tiles and their split, makes without a country, a search, model cards (facts, coverage sentences, editors, trims, history). | The lead went from 70 words and four ideas to 24 words. The popover no longer defines the three origins (the origin list owns them, area E). Parentheses became sentences; «پاک کردن» and «برداشتن» named one act two ways: «برداشتن». |
| Model photos | Lead, a three-paragraph popover, one card per model (badge, who set it, preview, link field, hint, errors, buttons, results). | «نشانی» is «لینک» (the glossary); «سرور» and «https» as a Latin word in a sentence are out. The rule "no preview, no save" is said once (the popover); the failing preview says only what to do. |
| Crawl requests | Lead, paused banner, the demand strip, state filter, request cards, the decline form (label, hint, error), results, the models read now. | The decline form said "the buyer reads the reason" three times (label, hint, error): once, in the hint. The lead went from 34 words to 23. «به تفکیک» is «برای هر». The banner uses «خزش» as the other screens do. |

## Words settled (for the guide's section 4 and the glossary, applied by the coordinator after the merges)

| Idea | Written | Was |
|---|---|---|
| A source the crawler stopped (badge) | «توقف خودکار» | «متوقف به دست خزنده» |
| A source with no crawl | «بدون خزش» | «خزیده نمی‌شود» |
| The link back to the dashboard | «پنل مدیریت» | «بازگشت به پنل مدیریت» |
| A list of the latest items / one latest value | «… اخیر» (اجراهای اخیر، تغییرهای اخیر) / «آخرین …» (آخرین ضربان) | both forms for lists |
| A job given up after all attempts (dead letter) | «کارهای رهاشده» | «کارهای کنارگذاشته» |
| A stored copy of a listing page (run count) | «رونوشت» | «نسخه» (also the worker's version) |
| A trim | «تیپ» | «نسخه» |
| The address of a photo | «لینک» | «نشانی» |
| The rating | «ارزیابی» | «رتبه» |
| The daily request limit | «سقف روزانه» | «ظرفیت» |
| Take a model off the covered list | «برداشتن» | «حذف» |
| Cover a model (button) | «پوشش دادن» | «پوشش بده» |
| A listing the site took down (HTTP 410) | «برداشته‌شده» | «حذف‌شده» |
| Who did it, in a history line | «… توسط ali، ۷ مهر ۱۴۰۵» | «افزوده‌ی ali»، «ثبت‌شده‌ی ali» |
| Length unit of a field | «کاراکتر» | «نویسه» |
| The act of reading new listings (crawl kind) | «یافتن آگهی‌های تازه» | «کشف …» |
| Median time since the last check | «میانه‌ی زمان از آخرین بررسی» on both screens | «میانه‌ی سن …» on one |

## Changed strings

Before and after are verbatim from the repository (`{…}` stands for a number or name a formatter fills). Rule codes are the voice guide's (R1 to R10, T, M, V); «lint» is a refuse rule of `pnpm copy:lint`.

### Dashboard (11)

| Where | Before | After | Why |
|---|---|---|---|
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.link` | «پرونده‌های جست‌وجو» | «دیدن پرونده‌ها» | R5: the link repeated the card title; it says the act |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.linkBody` | «جست‌وجوهای سپرده‌شده‌ی خریداران و تعداد آگهی‌های مطابقشان.» | «پرونده‌های همه‌ی خریداران، با تعداد آگهی‌های مطابق هر کدام.» | R5: no verb for handing a search over (area C is rewriting «سپردن»); the card says what is on the page |
| `admin-dashboard.tsx · ADMIN_COPY.manageSources` | «توقف و ازسرگیری خزش منبع‌ها» | «توقف و ازسرگیری خزش» | R5: «منبع‌ها» is the card title; the link says the act |
| `admin-dashboard.tsx · ADMIN_COPY.workerLead` | «زنده بودن کارگر، کارها و خطاهایشان، خزش هر منبع، آگهی‌های تازه و خارج‌شده، و مشکل‌های منبع.» | «کارها و خطاها، خزش هر منبع، آگهی‌های تازه و مشکل‌های منبع.» | R4 native: «زنده بودن کارگر» is a calque; the list is shorter and stands for the page |
| `admin-dashboard.tsx · ADMIN_COPY.openWorker` | «دیدن کارگر و خط پردازش» | «دیدن وضعیت کارگر» | R5: the link repeated the card title; it says what the page shows |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.link` | «درخواست‌های جست‌وجوی بیشتر» | «تأیید یا رد درخواست‌ها» | R5: the link repeated the card title; it says the act |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.linkBody` | «مدل‌هایی که خریداران می‌خواهند بیشتر خوانده شوند: تأیید یا رد، و تقاضا به تفکیک مدل.» | «مدل‌هایی که خریداران می‌خواهند بیشتر خوانده شوند، به ترتیب تقاضا.» | R4: «؛»/«:» list became the order that matters |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.link` | «عکس مدل‌های پرطرفدار» | «مدیریت عکس‌ها» | R5: the link repeated the card title; it says the act |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.linkBody` | «برای هر مدل پرطرفدار یک نشانی عکس https بگذارید تا در صفحه‌ی اصلی و فهرست مدل‌ها نشان داده شود.» | «لینک عکس هر مدل را برای صفحه‌ی اصلی و فهرست مدل‌ها بگذارید.» | R6 lint: «لینک», not «نشانی»; «https» is a Latin word (lint); the where is the only fact |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.link` | «مدل‌های پوشش‌داده‌شده» | «مدیریت مدل‌ها» | R5: the link repeated the card title; it says the act |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.linkBody` | «کدام مدل‌ها عمیق خوانده شوند: پوشش دادن، توقف، اولویت، و وضعیت همگام‌سازی هر مدل با پیشرفت خواندن جزئیات.» | «کدام مدل‌ها کامل خوانده شوند، با اولویت و پیشرفت هر کدام.» | native R4: «عمیق» and «همگام‌سازی» are calques; one short list |

### Sources (17)

| Where | Before | After | Why |
|---|---|---|---|
| `admin-copy.ts · CRAWL_STATE_LABEL.stopped_on_block` | «متوقف به دست خزنده» | «توقف خودکار» | native: «به دست» is literary; «توقف خودکار» is what software says; the notice below gives the cause |
| `admin-copy.ts · NOT_CRAWLED_LABEL` | «خزیده نمی‌شود» | «بدون خزش» | native: «خزیده نمی‌شود» is a calque; a badge is a noun phrase (R8) |
| `admin-copy.ts · STOP_REASON_LABEL.challenge` | «سایت به‌جای پاسخ، صفحه‌ی آزمون ضدربات نشان داد» | «سایت به‌جای پاسخ، آزمون ضدربات نشان داد» | R4: «صفحه‌ی» cut, the fact is the test |
| `admin-copy.ts · SOURCES_COPY.lead` | «خزش هر منبع را این‌جا متوقف کنید یا از سر بگیرید. هر تغییر با نام کاربری شما و زمانش ثبت می‌شود.» | «خزش هر منبع را متوقف کنید یا از سر بگیرید. هر تغییر با نام شما و زمانش ثبت می‌شود.» | R10: «این‌جا» is not the Academy's spelling (the word is gone: the screen is the where); the audit sentence stays, with «نام شما» |
| `admin-copy.ts · SOURCES_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `admin-copy.ts · SOURCES_COPY.empty` | «هنوز منبعی ثبت نشده است؛ هر منبع همراه خزنده‌ی خودش افزوده می‌شود.» | «منبعی ثبت نشده است.» | R4 R8: one fact; the second clause explained how sources arrive (not for the owner to act on); «هنوز» out |
| `admin-copy.ts · SOURCES_COPY.stopAdvice` | «پیش از ازسرگیری، درخواست ردشده را در گزارش کارگر بخوانید. اگر سایت هنوز ما را مسدود می‌کند، خزش را متوقف نگه دارید.» | «پیش از ازسرگیری، درخواست ردشده را در صفحه‌ی کارگر ببینید. تا وقتی سایت درخواست‌ها را رد می‌کند، خزش را از سر نگیرید.» | R4 R8: «گزارش کارگر» named the worker page; no «هنوز»; one imperative each |
| `admin-copy.ts · SOURCES_COPY.noChanges` | «هنوز کسی وضعیت این منبع را تغییر نداده است.» | «تغییری ثبت نشده است.» | R2 R8: say what is empty, without «هنوز» and a long subject |
| `admin-copy.ts · SOURCES_COPY.clearedStopFrom` | «توقف خزنده از» | «توقف خودکار از» | R6: the badge says «توقف خودکار», so does the line |
| `admin-copy.ts · SOURCES_COPY.noAnswer` | «پاسخی نرسید؛ شاید تغییر ثبت شده باشد.» | «پاسخی نرسید. شاید تغییر ثبت شده باشد.» | R4: «؛» to a full stop |
| `admin-copy.ts · CHANGE_LABEL.enabled` | «خزش از سر گرفته شد» | «ازسرگیری خزش» | R5 R6: a history line is named as its button (ازسرگیری خزش); the status line keeps the sentence |
| `admin-copy.ts · CHANGE_LABEL.paused` | «خزش متوقف شد» | «توقف خزش» | R5 R6: named as its button (توقف خزش); the status line keeps the sentence |
| `admin-copy.ts · CHANGE_LABEL.keptPaused` | «توقف پذیرفته شد و خزش متوقف ماند» | «توقف خزش پس از توقف خودکار» | native: «توقف پذیرفته شد» (accepted?) said nothing; the cleared-stop line below gives the detail |
| `admin-copy.ts · SOURCE_STATE_RESULT.unchanged.enabled` | «خزش همین حالا هم فعال است.» | «خزش از قبل فعال است.» | native: «همین حالا هم» is spoken padding; «از قبل» says it |
| `admin-copy.ts · SOURCE_STATE_RESULT.unchanged.paused` | «خزش همین حالا هم متوقف است.» | «خزش از قبل متوقف است.» | native: «همین حالا هم» is spoken padding; «از قبل» says it |
| `admin-copy.ts · SOURCE_STATE_RESULT.stale` | «وضعیت عوض شده بود؛ چیزی تغییر نکرد.» | «وضعیت عوض شده بود. تغییری ثبت نشد.» | R4 R8: «؛» to a full stop; says what was not done («تغییری ثبت نشد») |
| `admin-copy.ts · SOURCE_STATE_RESULT.not_crawled` | «این منبع خزیده نمی‌شود.» | «این منبع خزش ندارد.» | native: «خزیده نمی‌شود» calque |

### Worker and pipeline (52)

| Where | Before | After | Why |
|---|---|---|---|
| `admin-copy.ts · WORKER_COPY.lead` | «آنچه کارگر همین حالا می‌کند و آنچه در بازه‌ی انتخاب‌شده انجام داده است، از پایگاه داده. صفحه هر ۱۵ ثانیه تازه می‌شود.» | «کار جاری کارگر و کارهایی که در بازه‌ی انتخاب‌شده انجام داده است. صفحه هر چند ثانیه خودش تازه می‌شود.» | R7: «پایگاه داده» out (lint); R9: «آنچه… آنچه» to a plain noun phrase; the refresh stays without a number that can drift |
| `admin-copy.ts · WORKER_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `admin-copy.ts · WORKER_COPY.windows.1h` | «۱ ساعت» | «۱ ساعت» (`formatCountOf(1, 'ساعت')`) | R10: the same words; the number now comes from `formatCountOf`, which joins it to its unit with a no-break space |
| `admin-copy.ts · WORKER_COPY.windows.24h` | «۲۴ ساعت» | «۲۴ ساعت» (`formatCountOf(24, 'ساعت')`) | R10: the same words; the number now comes from `formatCountOf`, which joins it to its unit with a no-break space |
| `admin-copy.ts · WORKER_COPY.windows.7d` | «۷ روز» | «۷ روز» (`formatCountOf(7, 'روز')`) | R10: the same words; the number now comes from `formatCountOf`, which joins it to its unit with a no-break space |
| `admin-copy.ts · WORKER_COPY.status.never` | «هنوز اجرا نشده» | «هرگز اجرا نشده» | R8: «هنوز» out; the badge is a fact («هرگز اجرا نشده») |
| `admin-copy.ts · WORKER_COPY.statusAdvice.alive` | «آخرین ضربان در ۴۰ ثانیه‌ی گذشته رسیده است.» | «آخرین ضربان به‌تازگی رسیده است.» | R7: the 40-second threshold is the method; the owner reads «به‌تازگی» |
| `admin-copy.ts · WORKER_COPY.statusAdvice.silent` | «بیش از ۴۰ ثانیه ضربانی نرسیده است؛ کارگر از کار افتاده یا به پایگاه داده نمی‌رسد.» | «ضربانی نرسیده است. کارگر را بررسی کنید.» | R7 R8: «پایگاه داده» out (lint); the cause list became the step: check the worker |
| `admin-copy.ts · WORKER_COPY.statusAdvice.never` | «هیچ کارگری تا حالا در این پایگاه داده ضربان نفرستاده است.» | «هیچ کارگری ضربان نفرستاده است. کارگر را اجرا کنید.» | R7 R8: «پایگاه داده» out (lint); what happened, then what to do |
| `admin-copy.ts · WORKER_COPY.queuesCaption` | «کارها در هر صف، به تفکیک وضعیت» | «کارهای هر صف، بر اساس وضعیت» | native: «به تفکیک» is bureaucratic |
| `admin-copy.ts · WORKER_COPY.noJobs` | «صف خالی است؛ کارگر هنوز کاری نفرستاده یا pg-boss کارهای تمام‌شده را پاک کرده است.» | «صف خالی است. کارگر هنوز کاری نفرستاده یا کارهای تمام‌شده پاک شده‌اند.» | R7 R4: «pg-boss» out (lint); «؛» to a full stop; «هنوز» kept: data that will exist |
| `admin-copy.ts · WORKER_COPY.noFailures` | «کار ناموفقی در صف نیست.» | «کار ناموفقی نیست.» | R4: «در صف» is not needed under the card |
| `admin-copy.ts · WORKER_COPY.traceId` | «شناسه‌ی رد» | «شناسه‌ی ردیابی» | native: «شناسه‌ی ردیابی» is the standard translation of trace id |
| `admin-copy.ts · WORKER_COPY.noTraceId` | «بدون شناسه‌ی رد» | «بدون شناسه‌ی ردیابی» | native: same word as the label |
| `admin-copy.ts · WORKER_COPY.cancelQuestion` | «این کار لغو شود؟ از این صفحه نمی‌شود برش گرداند.» | «این کار لغو شود؟ لغو را از این صفحه نمی‌شود برگرداند.» | V2: «برش گرداند» is a spoken clitic; the full form |
| `admin-copy.ts · WORKER_COPY.cancelConfirm` | «بله، لغو شود» | «لغو کار» | R8: a button names the result («لغو کار»), not a yes |
| `admin-copy.ts · WORKER_COPY.cancelKeep` | «نه، بماند» | «انصراف» | R6: «انصراف» is the guide's word to stop before it happens |
| `admin-copy.ts · WORKER_COPY.cancelledHere` | «این کار در ۱۰ دقیقه‌ی گذشته لغو شد.» | «این کار به‌تازگی لغو شد.» | R10: a typed «۱۰» for a window the query owns; «به‌تازگی» cannot drift |
| `admin-copy.ts · WORKER_COPY.internalQueue` | «صف خودِ pg-boss؛ دستی تغییر داده نمی‌شود.» | «این صف داخلی است و دستی تغییر نمی‌کند.» | R7: «pg-boss» out (lint), «؛» to «و» |
| `admin-copy.ts · WORKER_COPY.stoppedSummary` | «منبعِ متوقف‌شده به دست خزنده» | «منبع با توقف خودکار» | R6: the noun after the count follows «توقف خودکار»; the kasra after a consonant is not standard |
| `admin-copy.ts · WORKER_COPY.noStopped` | «هیچ منبعی متوقف نیست.» | «توقف خودکاری در کار نیست.» | R6: it counts only the crawler's stops, so it says so, with the new word |
| `admin-copy.ts · WORKER_COPY.chartTable` | «اندازه‌گیری‌های ساعتی به‌صورت جدول» | «جدول اندازه‌گیری‌های ساعتی» | native: noun phrase first («جدول …») |
| `admin-copy.ts · WORKER_COPY.deadLetters` | «کارهای کنارگذاشته» | «کارهای رهاشده» | native: «کنارگذاشته» was written as one word; «رهاشده» (abandoned) is exact and plain |
| `admin-copy.ts · WORKER_COPY.deadLettersLead` | «کارهایی که همه‌ی تلاش‌هایشان ناموفق بود یا داده‌شان خواندنی نبود؛ خودِ کار ناموفق در صف خودش هم آمده است.» | «کارهایی که همه‌ی تلاش‌هایشان ناموفق بود یا داده‌شان خوانده نشد. در صف خودشان هم دیده می‌شوند.» | R4: «؛» to a full stop; «خودِ» (kasra) and «خواندنی نبود» simplified |
| `admin-copy.ts · WORKER_COPY.noDeadLetters` | «کار کنارگذاشته‌ای نیست.» | «کار رهاشده‌ای نیست.» | native: follows «رهاشده» |
| `admin-copy.ts · WORKER_COPY.noJobChanges` | «هنوز کسی کاری را دوباره نفرستاده یا لغو نکرده است.» | «کسی کاری را دوباره نفرستاده یا لغو نکرده است.» | R8: «هنوز» out |
| `admin-copy.ts · WORKER_COPY.noBudget` | «سقف روزانه تعیین نشده است» | «بدون سقف روزانه» | R8: a fact in a few words |
| `admin-copy.ts · WORKER_COPY.noRuns` | «در این بازه اجرایی نبوده است.» | «اجرایی نبوده است.» | R5: «در این بازه» is already in the heading above |
| `admin-copy.ts · WORKER_COPY.recentRuns` | «آخرین اجراها» | «اجراهای اخیر» | R6: a list of the latest is «… اخیر», one latest is «آخرین …» |
| `admin-copy.ts · WORKER_COPY.chartLead` | «هر نقطه اندازه‌گیری ساعتی است و ۲۴ ساعتِ پیش از خودش را می‌شمارد.» | «هر نقطه یک اندازه‌گیری ساعتی است و ۲۴ ساعت پیش از خودش را می‌شمارد.» (the «۲۴ ساعت» from `formatCountOf`) | R10: «۲۴ ساعت» through the formatter; «ساعتِ» (kasra) out; «یک اندازه‌گیری» |
| `admin-copy.ts · WORKER_COPY.chartAdded` | «تازه در ۲۴ ساعت» | «تازه در ۲۴ ساعت» (the «۲۴ ساعت» from `formatCountOf`) | R10: «۲۴ ساعت» through the formatter (no-break space) |
| `admin-copy.ts · WORKER_COPY.chartGone` | «خارج‌شده در ۲۴ ساعت» | «خارج‌شده در ۲۴ ساعت» (the «۲۴ ساعت» from `formatCountOf`) | R10: «۲۴ ساعت» through the formatter (no-break space) |
| `admin-copy.ts · WORKER_COPY.chartAge` | «میانه‌ی زمان از آخرین بررسی» | «زمان از آخرین بررسی» | lint: the same sentence was written for the table column; the plot title says «زمان از آخرین بررسی» (the chart caption says «میانه») |
| `admin-copy.ts · WORKER_COPY.noChart` | «هنوز اندازه‌گیری ساعتی‌ای در این بازه نیست.» | «اندازه‌گیری ساعتی‌ای در این بازه نیست.» | R8: «هنوز» out |
| `admin-copy.ts · WORKER_COPY.resumeOnSources` | «بررسی و ازسرگیری در صفحه‌ی منبع‌ها» | «ازسرگیری در صفحه‌ی منبع‌ها» | R5: the link says the act; the card above says why |
| `admin-copy.ts · WORKER_COPY.cooldown` | «مسیر این منبع در حال استراحت است تا» | «وقفه‌ی خزش تا» | R1: «در حال استراحت» is a joke about a lane; «وقفه‌ی خزش» is the fact |
| `admin-copy.ts · WORKER_COPY.cooldownReason.rate_limited` | «پاسخ «درخواست زیاد» (۴۲۹)» | «پاسخ «درخواست زیاد» با کد ۴۲۹» | R6 R10: no parenthesis; the status code is said as «با کد» |
| `admin-copy.ts · WORKER_COPY.noSources` | «هنوز منبعی خزیده نمی‌شود.» | «منبعی برای خزش ثبت نشده است.» | native R8: «خزیده نمی‌شود» calque, «هنوز» out |
| `admin-copy.ts · WORKER_COPY.underASecond` | «کمتر از ۱ ثانیه» | «کمتر از یک ثانیه» | R10: a hand-typed «۱»; a word is the natural form |
| `admin-copy.ts · DEAD_LETTER_QUEUE_LABEL` | «کارهای کنارگذاشته» | «کارهای رهاشده» | native: same word as the card heading |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.gone` | «حذف‌شده» | «برداشته‌شده» | R6: «حذف» is not the word for a listing taken down («برداشته‌شده») |
| `admin-copy.ts · CRAWL_KIND_LABEL.discovery` | «کشف آگهی‌های تازه» | «یافتن آگهی‌های تازه» | native: «کشف» is a calque of discovery; «یافتن» |
| `admin-copy.ts · RUN_STATUS_LABEL.stopped_on_block` | «متوقف با رد شدن» | «متوقف به‌خاطر رد درخواست» | native: «با رد شدن» also means passing by; the cause is a refused request |
| `admin-copy.ts · JOB_STATE_RESULT.unchanged.retry` | «کار همین حالا هم منتظر تلاش دوباره است.» | «کار از قبل منتظر تلاش دوباره است.» | native: «همین حالا هم» is spoken padding; «از قبل» |
| `admin-copy.ts · JOB_STATE_RESULT.unchanged.cancel` | «کار همین حالا هم لغو شده است.» | «کار از قبل لغو شده است.» | native: «همین حالا هم» is spoken padding; «از قبل» |
| `admin-copy.ts · JOB_STATE_RESULT.stale` | «کار عوض شده بود؛ چیزی تغییر نکرد.» | «کار عوض شده بود. تغییری ثبت نشد.» | R4 R8: «؛» to a full stop; says what was not done |
| `admin-copy.ts · RUN_COUNT_LABEL.snapshotsStored` | «نسخه‌ی ذخیره‌شده» | «رونوشت ذخیره‌شده» | R6: «نسخه» is the worker's version on this screen; a stored copy is «رونوشت» |
| `admin-copy.ts · RUN_COUNT_LABEL.snapshotsUnchanged` | «نسخه‌ی بی‌تغییر» | «رونوشت بی‌تغییر» | R6: «نسخه» is the worker's version on this screen; a stored copy is «رونوشت» |
| `admin-copy.ts · RUN_COUNT_LABEL.missingChecks` | «بررسی گم‌شده» | «آگهی گم‌شده برای بررسی» | native: «بررسی گم‌شده» (a lost check) said the opposite; the count is listings missing from a sweep and queued for a check (checked in `divar-freshness.ts`) |
| `admin-copy.ts · RUN_COUNT_LABEL.missingHeld` | «گم‌شده‌ی نگه‌داشته» | «آگهی گم‌شده‌ی معلق» | native: «نگه‌داشته» is a stem, not a participle; the count is missing listings held back as doubtful (checked in `divar-freshness.ts`) |
| `admin-copy.ts · RUN_COUNT_LABEL.slicesSplit` | «برش شکسته‌شده» | «برش تقسیم‌شده» | native: «شکسته‌شده» (broken) for a slice divided in two |
| `admin-copy.ts · RUN_COUNT_LABEL.roundsSkipped` | «دور ردشده» | «دور تکراری» | R6: «ردشده» already means a refused request; the round is skipped because one started a moment ago (checked in `divar.ts`): «تکراری» |

### Search files (9)

| Where | Before | After | Why |
|---|---|---|---|
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.lead` | «جست‌وجوهایی که خریداران به کارشناس سپرده‌اند: چه کسی، چه جست‌وجویی و چند آگهی مطابقش است. خریدار با نام کاربری‌اش شناخته می‌شود؛ حساب‌ها شماره‌ی تلفن ندارند.» | «پرونده‌های همه‌ی خریداران. خریدار فقط با نام کاربری دیده می‌شود.» | R5 R7: the columns were listed again; the privacy line shortened; the phone-number clause cut |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.empty` | «هنوز هیچ خریداری پرونده‌ای نساخته است.» | «هیچ خریداری پرونده‌ای نساخته است.» | R8: «هنوز» out |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.created` | «ساخته‌شده» | «تاریخ ساخت» | R8: a column head for a date says «تاریخ» |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.unreadable` | «جست‌وجوی نامعتبر» | «جست‌وجو خوانده نشد» | R7 R8: «نامعتبر» (lint); says what happened |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.countFailed` | «شمارش نشد» | «تعداد معلوم نشد» | T8: «شمارش نشد» hid the fact; the fact is that the count is unknown |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.shownLatest` | «{…} پرونده‌ی تازه‌تر از {…} نمایش داده شد.» | «{…} پرونده‌ی تازه‌تر از {…} نشان داده شد.» | R6: «نشان داده شد» is the guide's form |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.lead` | «کارشناس هر چند دقیقه آگهی‌های تازه‌ی جست‌وجو را با پرونده‌های در حال پایش می‌سنجد و برای هر پرونده یک اعلان می‌فرستد. اینجا آخرین اجراها را می‌بینید.» | «هر چند دقیقه، آگهی‌های تازه و قیمت‌های کم‌شده با پرونده‌های در حال پایش سنجیده می‌شوند و پرونده‌ای که خبر تازه دارد یک اعلان می‌گیرد.» | R5 R9: the sentence «اینجا آخرین اجراها را می‌بینید» pointed at the list below; «کارشناس» is not a subject; exact against the job: a file with news gets one notification, and price drops count (checked in `search-match.ts`) |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.empty` | «هنوز اجرایی ثبت نشده است. وقتی کارگر روشن باشد، هر چند دقیقه یک بار اجرا می‌شود و اجرای بعدی همین‌جا می‌آید.» | «اجرایی ثبت نشده است. وقتی کارگر روشن باشد، اجرای بعدی اینجا می‌آید.» | R5 R8: «هنوز» out; the cadence is in the lead |

### Tracked models (52)

| Where | Before | After | Why |
|---|---|---|---|
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.lead` | «مدل‌هایی که کارشناس عمیق می‌خواند: جزئیات آگهی‌ها، استخراج اطلاعات، ارزش بازار و نتایج جست‌وجو. بقیه‌ی مدل‌ها فقط از فهرست‌ها شمرده می‌شوند. ظرفیت روزانه‌ی خواندن محدود است؛ مدل‌های مهم‌تر را پوشش بدهید.» | «مدل‌هایی را که باید کامل خوانده شوند انتخاب کنید. به هر منبع در روز تعداد محدودی درخواست می‌فرستیم. مدل‌های مهم‌تر را اول بگذارید.» | R4 R5: 31 words that said what the popover says; the page lead names the act and the one limit |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.paused` | «خواندن آگهی‌ها اکنون متوقف است. پوشش دادن یک مدل آن را در صف می‌گذارد و هیچ درخواستی به هیچ سایتی نمی‌رود؛ خواندن جزئیات با از سرگرفتن خواندن شروع می‌شود.» | «خزش متوقف است. مدلی که پوشش دهید در صف می‌ماند و تا ازسرگیری خزش درخواستی به سایت‌ها نمی‌رود.» | R6 R4: «خزش» as on the sources screen; «اکنون» out; the honest effect kept (queued, nothing sent) |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.trackedEmpty` | «هنوز مدلی پوشش داده نمی‌شود. از فهرست پایین مدلی را انتخاب کنید؛ پرآگهی‌ترین‌ها اول هستند.» | «مدلی پوشش داده نمی‌شود. از فهرست پایین مدلی را انتخاب کنید.» | R5 R8: the order is said under the list; «هنوز» and «؛» out |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.title` | «پوشش مدل یعنی چه» | «پوشش مدل» | R8: a popover's title is the control's own name |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.what` | «برای مدل پوشش‌داده‌شده کارشناس جزئیات هر آگهی را می‌خواند و آن را شبانه دوباره می‌پیماید؛ استخراج اطلاعات از متن، ارزش بازار و رتبه‌ی قیمت هم برای همین آگهی‌ها محاسبه می‌شود. مدل‌های دیگر فقط از فهرست‌ها شمرده می‌شوند.» | «جزئیات آگهی‌های مدل پوشش‌داده‌شده را می‌خوانیم و فهرست این مدل را هر شب پیمایش می‌کنیم. اطلاعات متن آگهی، ارزش بازار و ارزیابی قیمت هم فقط برای این مدل‌ها ساخته می‌شود. مدل‌های دیگر فقط از فهرست‌ها شمرده می‌شوند.» | R9 R4: «کارشناس می‌خواند» (the name as a subject) to «ما»; «؛» out; «رتبه‌ی قیمت» to «ارزیابی» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.pause` | «مدل متوقف دیگر خوانده نمی‌شود، اما آخرین داده‌اش با تاریخ آن در صفحه‌ها می‌ماند. آگهی‌های آن با گذشت ۴۸ ساعت از نتایج جست‌وجو کنار می‌روند، چون تازه نمی‌شوند.» | «مدل متوقف دیگر خوانده نمی‌شود و آخرین داده‌اش با تاریخ آن می‌ماند. آگهی‌هایش بعد از ۴۸ ساعت از نتایج جست‌وجو کنار می‌روند، چون تازه نمی‌شوند.» (the «۴۸ ساعت» from `SEARCH_FRESHNESS_HOURS`) | R10 lint: the 48 hours come from the search freshness constant; 28 words to 24 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.removeHeading` | «حذف از فهرست» | «برداشتن از فهرست» | R6: «برداشتن», not «حذف» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.remove` | «مدل از فهرست برداشته می‌شود و داده‌اش می‌ماند. هر زمان می‌توانید دوباره پوشش بدهید.» | «مدل از فهرست برداشته می‌شود و داده‌اش می‌ماند. برای برگرداندنش دوباره پوشش بدهید.» | T4: «می‌توانید» stacked; the step is an imperative |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.budgetHeading` | «ظرفیت» | «سقف روزانه» | R6: «سقف روزانه» as on the worker screen |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.budget` | «هر منبع در روز ظرفیت محدودی دارد و خواندن به ترتیب اهمیت خرج می‌شود: آگهی‌های تازه، بررسی مجدد، پیمایش مدل‌های پوشش‌داده‌شده، و در آخر خواندن جزئیات آگهی‌های قدیمی‌تر. هرچه مدل بیشتر پوشش بدهید، نوبت هر کدام دیرتر می‌رسد.» | «هرچه مدل بیشتری را پوشش بدهید، هر مدل دیرتر خوانده می‌شود.» | R7 R5: the order the budget is spent in is the method; the lead already says the cap |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.priority.title` | «اولویت چه می‌کند» | «اولویت» | R8: a popover's title is the control's own name |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.priority.text` | «اولویت ترتیب پیمایش و خواندن جزئیات را تعیین می‌کند: مدل با اولویت بالا سهم بیشتری از صف خواندن می‌گیرد و زودتر می‌رسد. ظرفیت روزانه را بیشتر نمی‌کند.» | «مدل با اولویت بالا زودتر پیمایش و خوانده می‌شود و سهم بیشتری از صف می‌گیرد. سقف روزانه را بیشتر نمی‌کند.» | R4 R6: one idea per sentence; «سقف روزانه» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.seed` | «انتخاب مالک در آغاز» | «انتخاب اولیه‌ی مالک» | native: «در آغاز» is literary |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.superadmin` | «افزوده‌ی» | «افزوده‌شده توسط» | native: «افزوده‌ی» before a name reads as a typo; «… توسط» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.request` | «از درخواست خریداران؛ تأییدکننده» | «از درخواست خریداران، تأییدشده توسط» | R4: «؛» to a comma; «تأییدکننده» to the participle «تأییدشده توسط» like the line above |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.requestWaiting` | «تأییدشده و در صف خواندن» | «در صف خواندن» | R5: «تأییدشده» is already in the phrase before it |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.info` | «هر آگهی فعال فقط با قیمت و نام از فهرست آمده است تا صفحه‌اش خوانده شود. پس از خواندن، سال، کارکرد، وضعیت و عکس‌ها هم ثبت می‌شود و آگهی در نتایج جست‌وجو و ارزش بازار می‌آید. جدیدترین آگهی‌ها اول خوانده می‌شوند و روزی تا ظرفیت خواندن پیش می‌روند.» | «هر آگهی از فهرست فقط با قیمت و نام می‌آید. با خواندن صفحه‌اش سال، کارکرد، وضعیت و عکس‌ها هم ثبت می‌شود و آگهی وارد نتایج جست‌وجو و ارزش بازار می‌شود.» | R7 R5: «روزی تا ظرفیت» is the budget (said in its own popover); «جدیدترین اول» is in the status line |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.value` | «{…} از {…} ({…})» | «{…} از {…}، {…}» | R10: no parenthesis; the share follows a comma |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.noListings` | «هنوز آگهی فعالی از این مدل دیده نشده است.» | «آگهی فعالی از این مدل دیده نشده است.» | R8: «هنوز» out |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.waitingPaused` | «{…} در صف خواندن است. خواندن اکنون متوقف است و با از سرگرفتن خواندن ادامه می‌یابد.» | «{…} در صف خواندن است و تا ازسرگیری خزش خوانده نمی‌شود.» | R6 R5: «خزش» as the banner; one sentence; honest: queued, not moving |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.waiting` | «{…} در صف خواندن است؛ جدیدترین‌ها اول، تا ظرفیت امروز.» | «{…} در صف خواندن است. جدیدترین‌ها اول خوانده می‌شوند.» | R7 R4: «تا ظرفیت امروز» is the budget; «؛» to a full stop |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.modelPaused` | «این مدل متوقف است؛ آخرین داده‌اش با تاریخ آن نمایش داده می‌شود.» | «آخرین داده‌ی این مدل با تاریخ آن نشان داده می‌شود.» | R5 lint: the same eight words as the popover; the badge says «متوقف» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.rated` | «دارای رتبه‌ی قیمت» | «دارای ارزیابی قیمت» | R6: «ارزیابی», not «رتبه» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.newInDay` | «جدید در ۲۴ ساعت» | «تازه در ۲۴ ساعت» (the «۲۴ ساعت» from `formatCountOf`) | R6 R10: «تازه» as the worker screen; «۲۴ ساعت» through the formatter |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.goneInDay` | «رفته در ۲۴ ساعت» | «خارج‌شده در ۲۴ ساعت» (the «۲۴ ساعت» from `formatCountOf`) | R6 R10: «خارج‌شده» as the worker screen; «۲۴ ساعت» through the formatter |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.medianAge` | «میانه‌ی سن آخرین بررسی» | «میانه‌ی زمان از آخرین بررسی» | R6: the same words as the worker screen |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.valuedOn` | «ارزش بازار» | «آخرین ارزش‌گذاری» | R6: «ارزش‌گذاری» is the guide's word for the daily act; the value is the date |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.valuedOnNone` | «هنوز محاسبه نشده» | «هنوز نشده» | R8: «محاسبه» to the same short form as the sweep |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.untrack` | «حذف از فهرست» | «برداشتن از فهرست» | R6: «برداشتن», not «حذف» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.confirm` | «بله، حذف شود» | «برداشتن» | R8: a button names the result, not a yes |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.blocked` | «درخواست خریداران برای این مدل تأیید شده و هنوز خوانده نشده است؛ تا خوانده نشود نه متوقف می‌شود و نه حذف. برای کنار گذاشتنش، درخواست را رد کنید.» | «درخواستی تأییدشده منتظر خواندن این مدل است، پس نه متوقف می‌شود و نه برداشته. برای متوقف کردن یا برداشتن، آن درخواست را رد کنید.» | R4 R8: 28 words, «؛»; the rule first, then the step |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.blockedLink` | «باز کردن درخواست‌ها» | «دیدن درخواست‌ها» | R6: «دیدن», not «باز کردن» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.changed.pause` | «متوقف شد. آخرین داده‌اش می‌ماند.» | «مدل متوقف شد.» | R5: «آخرین داده‌اش می‌ماند» is in the card and the popover |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.changed.resume` | «خواندن این مدل ادامه می‌یابد.» | «خواندن مدل از سر گرفته شد.» | T7: «ادامه می‌یابد» is formal; «از سر گرفته شد» as on the sources screen |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.changed.priority` | «اولویت ثبت شد.» | «اولویت تغییر کرد.» | R6: «ثبت» is for a request; the fact is a change |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.blocked` | «درخواست تأییدشده‌ای منتظر خواندن این مدل است؛ برای متوقف کردن یا برداشتنش آن درخواست را رد کنید.» | «تغییر ثبت نشد، چون درخواستی تأییدشده منتظر خواندن این مدل است. آن درخواست را رد کنید.» | R4 R8: «؛»; what happened, then what to do |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.failed` | «ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.» | «تغییر ثبت نشد. دوباره امتحان کنید.» | R7: «پایگاه داده» is out (lint); R8: what happened, then what to do |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.invalid` | «فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.» | «تغییر ثبت نشد. صفحه را تازه کنید.» | R7 R8: «نامعتبر» blamed the form (lint); now what happened and what to do |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.seeded` | «انتخاب مالک در آغاز» | «انتخاب اولیه‌ی مالک» | native: the same words as the origin line |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.resumed` | «ادامه یافت» | «از سر گرفته شد» | T7 R6: «ادامه یافت» is formal; «از سر گرفته شد» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.request_withdrawn` | «با ردِ درخواست برداشته شد» | «با رد درخواست برداشته شد» | R10: «ردِ» with a kasra is not standard |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.recent.heading` | «آخرین تغییرها» | «تغییرهای اخیر» | R6: a list of the latest is «… اخیر», one latest is «آخرین …» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.recent.lead` | «هر تغییر با نام کسی که انجامش داده و زمانش ثبت می‌شود و پاک نمی‌شود.» | «هر تغییر با نام انجام‌دهنده و زمانش ثبت می‌شود و پاک نمی‌شود.» | R4 native: a shorter subject («انجام‌دهنده») |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.recent.empty` | «هنوز تغییری ثبت نشده است.» | «تغییری ثبت نشده است.» | R8: «هنوز» out |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.lead` | «مدل‌هایی که آگهی فعال دارند و فقط از فهرست‌ها شمرده می‌شوند، پرآگهی‌ترین اول.» | «مدل‌هایی که آگهی فعال دارند، پرآگهی‌ترین اول.» | R5: «فقط از فهرست‌ها شمرده می‌شوند» is in the popover |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.shownOf` | «{…} نمایش داده شد؛ برای دیدن بقیه جست‌وجو کنید.» | «{…} نشان داده شد. برای دیدن بقیه جست‌وجو کنید.» | R4 R6: «؛» to a full stop; «نشان داده شد» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.track` | «پوشش بده» | «پوشش دادن» | V4: «پوشش بده» is a singular imperative; a button is an infinitive |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.trim` | «نسخه» | «تیپ» | R6: «تیپ» is the glossary's word for trim |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.allTrims` | «همه‌ی نسخه‌ها» | «همه‌ی تیپ‌ها» | R6: «تیپ» |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.errorTitle` | «مدل‌ها خوانده نشدند» | «مدل‌ها بارگذاری نشد» | R6: «بارگذاری نشد» is the guide's word; «خوانده نشد» reads as the crawl on these screens |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.errorBody` | «پایگاه داده پاسخ نداد. چیزی تغییر نکرده است؛ کمی بعد دوباره امتحان کنید.» | «چیزی تغییر نکرده است.» | R5 R7: the cause and the retry sentence go (the title and [تلاش دوباره] say it); the fact that nothing changed stays |

### Engine volume, origin and country (36)

| Where | Before | After | Why |
|---|---|---|---|
| `country-admin-copy.ts · COUNTRY_COPY.modelHint` | «فقط وقتی پر کنید که این مدل کشورش با برند فرق دارد.» | «فقط اگر کشور این مدل با برندش فرق دارد، انتخاب کنید.» | native R8: «پر کنید» for a list is «انتخاب کنید»; a full sentence with the condition first |
| `country-admin-copy.ts · COUNTRY_COPY.fromMake` | «{…} (از برند)» | «{…}، از برند» | R10: no parenthesis for an aside |
| `country-admin-copy.ts · COUNTRY_COPY.result.changed.save` | «ذخیره شد؛ جست‌وجو و صفحه‌ها تا یک دقیقه‌ی دیگر آن را می‌بینند.» | «ذخیره شد. تا یک دقیقه‌ی دیگر در جست‌وجو و صفحه‌ها دیده می‌شود.» | R4 R9: the lag in the owner's order of reading; «؛» to a full stop |
| `country-admin-copy.ts · COUNTRY_COPY.result.problem` | «یک کشور انتخاب کنید، یا برای پاک کردن «برداشتن» را بزنید.» | «کشوری انتخاب کنید یا «برداشتن» را بزنید.» | R6: «پاک کردن» and «برداشتن» named one act; the button's word only |
| `country-admin-copy.ts · COUNTRY_COPY.result.failed` | «ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.» | «ذخیره نشد. دوباره امتحان کنید.» | R7: «پایگاه داده» is out (lint); R8: what happened, then what to do |
| `country-admin-copy.ts · COUNTRY_COPY.result.invalid` | «فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.» | «ذخیره نشد. صفحه را تازه کنید.» | R7 R8: «نامعتبر» blamed the form (lint); now what happened and what to do |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.lead` | «کشور برند را بگذارید تا «ماشین ژاپنی» و مانند آن این آگهی‌ها را هم بیابد. برندهای دارای آگهی اول‌اند؛ برندهای دیگر را از جست‌وجوی نام مدل پیدا کنید.» | «با گذاشتن کشور برند، جست‌وجوی «ماشین ژاپنی» و مانند آن این آگهی‌ها را هم پیدا می‌کند. برندهای دارای آگهی اول آمده‌اند.» | R4 R5: «بیابد» to «پیدا می‌کند»; the search hint is said in the strings below |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.noneListed` | «همه‌ی برندهای دارای آگهی کشور دارند؛ {…} هنوز ندارند و از جست‌وجوی نام مدل پیدا می‌شوند.» | «همه‌ی برندهای دارای آگهی کشور دارند. برای {…} نام مدل را جست‌وجو کنید.» | R4 R8: «؛» and «هنوز» out; lint: the same eight words as «others» |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.others` | «{…} هم کشور ندارند؛ از جست‌وجوی نام مدل پیدا کنید.» | «{…} هم کشور ندارند و با جست‌وجوی نام مدل پیدا می‌شوند.» | R4: «؛» to one sentence |
| `country-admin-copy.ts · COUNTRY_COPY.history.describe.case` | «{…} برداشته شد (پیش‌تر {…})» | «{…} برداشته شد، پیش‌تر {…}» | R10: no parenthesis for an aside |
| `model-specs-admin-copy.ts · SOURCE_LABELS.seed` | «مقدار اولیه‌ی کارشناس؛ بررسی کنید» | «مقدار اولیه‌ی کارشناس. بررسی کنید.» | R4: «؛» to two short sentences |
| `model-specs-admin-copy.ts · SOURCE_LABELS.superadmin` | «ثبت‌شده‌ی» | «ثبت‌شده توسط» | native: «ثبت‌شده‌ی» followed by a name reads as a typo; «… توسط» |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.lead` | «خریداران با حجم موتور («بیشتر از ۲۰۰۰ سی‌سی»)، مبدأ («خارجی»، «ایرانی») و کشور («ژاپنی»، «آلمانی») جست‌وجو می‌کنند، اما آگهی‌ها معمولاً این‌ها را نمی‌نویسند. اینجا برای هر مدل، و در صورت لزوم هر تیپ، حجم موتور و مبدأ را بگذارید، و کشور را برای برند (یا برای یک مدل که با برندش فرق دارد) تا جست‌وجو و صفحه‌ها از آن استفاده کنند. هر تغییر با نام شما و زمانش ثبت می‌شود.» | «آگهی‌ها معمولاً حجم موتور، مبدأ و کشور را نمی‌نویسند. حجم و مبدأ را برای هر مدل یا تیپ بگذارید، و کشور را برای برند.» | R4 R5: 70 words, four ideas; the owner needs the gap and the act |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.label` | «توضیح درباره‌ی «حجم موتور و مبدأ»» | «توضیح درباره‌ی «مشخصات مدل‌ها»» | lint: six words over the budget of four; «مشخصات» is the word the card already uses |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.title` | «حجم موتور و مبدأ از کجا می‌آید» | «مشخصات مدل‌ها» | R8: a popover's title is the control's own name |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.inherit` | «هر آگهی ابتدا حجمی را که خودش در عنوان نوشته دارد، وگرنه مقدار تیپ خودش، وگرنه مقدار مدلش. مبدأ را از تیپ و سپس مدل می‌گیرد. جایی که چیزی نباشد، نامشخص می‌ماند و حدس زده نمی‌شود.» | «آگهی اول حجمی را می‌گیرد که در عنوانش نوشته شده، بعد مقدار تیپ، بعد مقدار مدل. مبدأ را از تیپ و بعد از مدل می‌گیرد. اگر چیزی نباشد، نامشخص می‌ماند.» | R4 R7: «حدس زده نمی‌شود» was defensive; the order of the sources is one sentence each |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.unknown` | «آگهی بدون حجم موتور معلوم در جست‌وجوی «حجم موتور» نمی‌آید و صفحه‌ی نتایج می‌گوید چند آگهی همین دلیل کنار رفته است. با پرکردن مدل‌هایی که اینجا بالا آمده‌اند، این عدد کم می‌شود.» | «آگهی بدون حجم موتور معلوم در جست‌وجوی «حجم موتور» نمی‌آید و صفحه‌ی نتایج تعداد آن‌ها را می‌گوید. با پر کردن مدل‌های بالای فهرست، این تعداد کم می‌شود.» | R4: the sentence about the count was clumsy («چند آگهی همین دلیل»); «پرکردن» spelled apart |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.valuesHeading` | «چه عددی بگذارم» | «مقدارهای مجاز» | M9: «چه عددی بگذارم» is the chatbot «من»; a noun phrase |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.values` | «حجم اسمی بر حسب سی‌سی، همان عددی که فروشنده و خریدار می‌نویسند (مثلاً {…} برای موتور ۱٫۶ لیتری)، از {…} تا {…}. مبدأ: ایرانی یعنی طراحی ایرانی، ساخت مشترک یعنی طراحی خارجی که در ایران ساخته می‌شود، وارداتی یعنی ساخت خارج. کشور مال برند است، هرجا مونتاژ شده باشد: پژوی مونتاژ ایران «فرانسه» است؛ «ژاپنی» همین کشور را می‌خواند و «خارجی» مبدأ وارداتی را.» | «حجم را بر حسب سی‌سی بنویسید، مثلاً {…} برای موتور ۱٫۶ لیتری، از {…} تا {…}. کشور مال برند است، هرجا مونتاژ شود: پژوی مونتاژ ایران «فرانسه» است.» | R5 R7: the origin definitions belong to the origin list (E owns them); the «ژاپنی/خارجی» search detail is how it works; three topics to two; no «؛» |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.bySource` | «از این‌ها: {…} با حجم نوشته‌ی خودش، {…} از مقدار تیپ، {…} از مقدار مدل (حدودی).» | «از حجم‌های معلوم، {…} از عنوان خود آگهی آمده، {…} از مقدار تیپ و {…} از مقدار مدل، که حدودی است.» | R10: no parenthesis; names what it splits («حجم‌های معلوم») |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.clear` | «نمایش مدل‌های دارای آگهی» | «پاک کردن جست‌وجو» | lint R6: four words over the button budget; the same act is «پاک کردن جست‌وجو» on the tracked screen |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.empty` | «هنوز مدلی آگهی ندارد. مدلی را از جست‌وجوی بالا پیدا کنید.» | «هیچ مدلی آگهی ندارد.» | R5: the hint under the field already says to search |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.hintAll` | «مدل‌هایی که آگهی دارند نشان داده می‌شوند؛ آن‌ها که مقدارشان ناقص است اول‌اند. هر مدل دیگری را از فهرست با جست‌وجوی نام پیدا کنید.» | «مدل‌های دارای آگهی نشان داده می‌شوند و آن‌ها که مقدارشان ناقص است اول می‌آیند. برای مدل‌های دیگر نامشان را جست‌وجو کنید.» | R4: «؛» to «و»; one clause each |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.shownOf` | «{…} نشان داده شد؛ جست‌وجو را دقیق‌تر کنید.» | «{…} نشان داده شد. جست‌وجو را دقیق‌تر کنید.» | R4: «؛» to a full stop |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.edit` | «ویرایش حجم موتور، مبدأ و کشور» | «ویرایش مشخصات» | R5 R6: the same word as «ویرایش مشخصات» on the tracked card |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.trims` | «تیپ‌ها: {…}، دارای مقدار: {…}» | «{…}، {…} با مقدار» | R4: labels with colons became a count phrase |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.inherits` | «اگر خالی بماند، مقدار مدل می‌رسد: {…}.» | «اگر خالی بماند، مقدار مدل را می‌گیرد: {…}.» | native: «می‌رسد» (arrives) is wrong for a value that applies |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.describe.case` | «{…}برداشته شد (پیش‌تر {…})» | «{…}برداشته شد، پیش‌تر {…}» | R10: no parenthesis for an aside |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.bySeed` | «پیش‌فرض کارشناس» | «کارشناس» | R5: the line already says «مقدار اولیه»; the actor is a name |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.volume` | «حجم موتور (سی‌سی)» | «حجم موتور به سی‌سی» | R10: no parenthesis for a unit |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.volumeHint` | «عدد صحیح، از {…} تا {…}؛ خالی یعنی نامشخص.» | «عدد صحیح از {…} تا {…}. خالی یعنی نامشخص.» | R4: «؛» to a full stop; two short sentences |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.problems.empty` | «حجم یا مبدأ را بگذارید، یا برای پاک کردن «برداشتن مقدارها» را بزنید.» | «حجم یا مبدأ را بگذارید، یا «برداشتن مقدارها» را بزنید.» | R6: «پاک کردن» and «برداشتن» named one act |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.changed.save` | «ذخیره شد؛ جست‌وجو و صفحه‌ها تا یک دقیقه‌ی دیگر آن را می‌بینند.» | «ذخیره شد. تا یک دقیقه‌ی دیگر در جست‌وجو و صفحه‌ها دیده می‌شود.» | R4 R9: the lag in the owner's order of reading; «؛» to a full stop |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.changed.remove` | «برداشته شد؛ مقدار از مدل می‌رسد.» | «برداشته شد.» | R5: the field note says what a trim falls back to |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.failed` | «ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.» | «ذخیره نشد. دوباره امتحان کنید.» | R7: «پایگاه داده» is out (lint); R8: what happened, then what to do |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.invalid` | «فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.» | «ذخیره نشد. صفحه را تازه کنید.» | R7 R8: «نامعتبر» blamed the form (lint); now what happened and what to do |

### Model photos (26)

| Where | Before | After | Why |
|---|---|---|---|
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.lead` | «کاشی هر مدل پرطرفدار در صفحه‌ی اصلی و فهرست مدل‌ها به‌طور پیش‌فرض عکس نمونه‌ی نوع بدنه را نشان می‌دهد. برای هر مدل نشانی یک عکس مناسب بگذارید؛ عکس از جای خودش بارگذاری می‌شود و ما آن را ذخیره یا دانلود نمی‌کنیم.» | «تا لینک عکسی نگذارید، هر مدل در صفحه‌ی اصلی و فهرست مدل‌ها عکس نمونه‌ی نوع بدنه را نشان می‌دهد.» | R4 R5: 41 words, three ideas; what the owner needs is the default and the act; «کاشی» went |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.title` | «عکس مدل چطور نشان داده می‌شود» | «عکس مدل» | R8: a popover's title is the control's own name |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.paragraphs.[0]` | «نشانی باید با {…} شروع شود و به یک عکس برسد. پیش‌نمایش زیر هر نشانی همان چیزی است که بازدیدکننده می‌بیند؛ تا عکس بارگذاری نشود، ذخیره نمی‌شود.» | «پیش‌نمایش زیر هر لینک همان چیزی است که بازدیدکننده می‌بیند. تا پیش‌نمایش بارگذاری نشود، لینک ذخیره نمی‌شود.» | R5 R6: the https rule is in the hint; «ذخیره» says which thing (the link); «لینک» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.paragraphs.[1]` | «عکس هرگز روی سرور ما نمی‌ماند: مرورگر بازدیدکننده آن را از سایت خودش می‌گیرد و هیچ نشانی صفحه‌ای همراهش فرستاده نمی‌شود.» | «خود عکس هرگز ذخیره نمی‌شود: مرورگر بازدیدکننده آن را از سایت خودش می‌گیرد.» | R7: «سرور» out (lint); the referrer detail is how it works |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.paragraphs.[2]` | «اگر عکس روزی از دسترس خارج شود، همان جا عکس نمونه‌ی نوع بدنه با برچسب «نمونه» نشان داده می‌شود. برچسب «نمونه» فقط روی عکس نمونه است.» | «اگر عکس روزی از دسترس خارج شود، به‌جایش عکس نمونه‌ی نوع بدنه با برچسب «نمونه» نشان داده می‌شود.» | R5: «برچسب «نمونه»» was said twice |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.empty` | «هنوز مدلی پرطرفدار نیست؛ وقتی آگهی‌های مدل‌ها خوانده شود، اینجا می‌آید.» | «مدل پرطرفداری نیست. وقتی آگهی مدل‌ها خوانده شود، اینجا می‌آیند.» | R4 R8: «؛» and «هنوز» out |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.field` | «نشانی عکس» | «لینک عکس» | R6: «لینک» (the glossary), not «نشانی» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.hint` | «با {…} شروع شود، تا {…} نویسه.» | «با {…} شروع شود و حداکثر {…} کاراکتر باشد.» | R6: «کاراکتر», not «نویسه»; a full clause |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.replace` | «جایگزین کردن عکس» | «عوض کردن عکس» | native: «جایگزین کردن» is formal; «عوض کردن» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.setByLabel` | «گذاشته‌ی» | «گذاشته‌شده توسط» | native: «گذاشته‌ی» (genitive of a participle) reads as a typo; «… توسط» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.notSet` | «عکسی گذاشته نشده است؛ عکس نمونه‌ی نوع بدنه نشان داده می‌شود.» | «عکسی گذاشته نشده است.» | R5: the lead says what the sample is; the card says what is the case |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.empty` | «نشانی را بنویسید تا پیش‌نمایش بیاید.» | «لینک را بنویسید تا پیش‌نمایش بیاید.» | R6: «لینک» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.invalid` | «پیش‌نمایش با نشانی معتبر می‌آید.» | «پیش‌نمایشی نیست.» | R5: the problem is told under the field; the slot says there is no preview |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.failed` | «عکس بارگذاری نشد. نشانی را بررسی کنید؛ تا بارگذاری نشود ذخیره نمی‌شود.» | «عکس بارگذاری نشد. لینک را بررسی کنید.» | R5: the «cannot save» rule is in the popover; says what happened and what to do |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.savedFailed` | «این نشانی دیگر بارگذاری نمی‌شود؛ بازدیدکنندگان عکس نمونه را می‌بینند.» | «این لینک دیگر بارگذاری نمی‌شود. بازدیدکنندگان عکس نمونه را می‌بینند.» | R4 R6: «؛» to a full stop; «لینک» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.problems.scheme` | «نشانی باید با {…} شروع شود.» | «لینک باید با {…} شروع شود.» | R6: «لینک», not «نشانی»; one clause that says what the link must be |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.problems.host` | «نشانی یک سایت واقعی لازم است، نه نشانی داخلی، {…} یا {…}، و بدون نام کاربری.» | «لینک باید به یک سایت واقعی برسد، نه به {…} یا {…}، و نام کاربری نداشته باشد.» | R6: «لینک», not «نشانی»; one clause that says what the link must be |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.problems.plain` | «نشانی نباید فاصله، نقل‌قول، نشانه‌های <>، یا نویسه‌ی نامرئی داشته باشد.» | «لینک نباید فاصله، نقل‌قول، علامت <> یا کاراکتر نامرئی داشته باشد.» | R6: «لینک», not «نشانی»; one clause that says what the link must be |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.problems.length` | «نشانی باید از ۱۲ تا {…} نویسه باشد.» | «لینک باید از ۱۲ تا {…} کاراکتر باشد.» | R6: «لینک», not «نشانی»; «کاراکتر», not «نویسه» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.changed.set` | «ذخیره شد؛ صفحه‌ی اصلی و فهرست مدل‌ها همین حالا آن را نشان می‌دهند.» | «ذخیره شد. صفحه‌ی اصلی و فهرست مدل‌ها آن را نشان می‌دهند.» | R4: «؛» to a full stop; «همین حالا» cut |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.changed.clear` | «برداشته شد؛ عکس نمونه‌ی نوع بدنه نشان داده می‌شود.» | «برداشته شد.» | R5: the card says «عکسی گذاشته نشده است» |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.failed` | «ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.» | «ذخیره نشد. دوباره امتحان کنید.» | R7: «پایگاه داده» is out (lint); R8: what happened, then what to do |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.invalid` | «فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.» | «ذخیره نشد. صفحه را تازه کنید.» | R7 R8: «نامعتبر» blamed the form (lint); now what happened and what to do |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.errorTitle` | «مدل‌ها خوانده نشدند» | «مدل‌ها بارگذاری نشد» | R6: «بارگذاری نشد» is the guide's word; «خوانده نشد» reads as the crawl on these screens |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.errorBody` | «پایگاه داده پاسخ نداد. چیزی تغییر نکرده است؛ کمی بعد دوباره امتحان کنید.» | «چیزی تغییر نکرده است.» | R5 R7: the cause and the retry sentence go (the title and [تلاش دوباره] say it); the fact that nothing changed stays |

### Crawl requests (19)

| Where | Before | After | Why |
|---|---|---|---|
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.lead` | «وقتی پرونده‌ی یک خریدار آگهی کمی دارد، می‌تواند بخواهد مدلش بیشتر خوانده شود. تأیید یا رد با شماست؛ ظرفیت روزانه‌ی خواندن محدود است. تأیید فقط مدل را در صف می‌گذارد و خودش چیزی نمی‌خواند.» | «خریدار وقتی پرونده‌اش آگهی کمی دارد، می‌تواند درخواست کند مدلش بیشتر خوانده شود. تأیید فقط مدل را در صف می‌گذارد و چیزی نمی‌خواند.» | R4 R5: 34 words, four ideas: two (who decides, the cap) were not for the lead; two stay |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.backToDashboard` | «بازگشت به پنل مدیریت» | «پنل مدیریت» | R8: a link names where it goes («پنل مدیریت», the glossary word); four words broke the lint budget |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.paused` | «خواندن آگهی‌ها اکنون متوقف است. تأیید یک درخواست مدل را در صف می‌گذارد و هیچ درخواستی به هیچ سایتی نمی‌فرستد؛ نوبت مدل با از سرگرفتن خواندن می‌رسد.» | «خزش متوقف است. تا ازسرگیری آن، مدل‌های تأییدشده در صف می‌مانند و درخواستی به سایت‌ها نمی‌رود.» | R4 R6: the crawl is «خزش» as on the sources screen; the effect (no request to any site) is one clause |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.demandHeading` | «تقاضا به تفکیک مدل» | «تقاضا برای هر مدل» | native: «به تفکیک» is bureaucratic |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.demandLead` | «هر مدل با تعداد خریداران و درخواست‌هایش، پرتقاضاترین اول.» | «پرتقاضاترین مدل اول.» | R5: the rows show the counts; only the order is left |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.requestsOrder` | «به ترتیب تقاضا: پرتقاضاترین اول؛ با تصمیم، جای درخواست عوض نمی‌شود.» | «به ترتیب تقاضا. تصمیم جای درخواست را عوض نمی‌کند.» | R4 R5: «؛» to a full stop; the order is not said twice |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.empty.all` | «هنوز هیچ خریداری درخواستی نداده است.» | «هیچ خریداری درخواستی نداده است.» | R8: «هنوز» out |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.reasonEmpty` | «دلیل رد را بنویسید؛ خریدار آن را می‌خواند.» | «دلیل رد را بنویسید.» | R5: «خریدار آن را می‌خواند» is in the hint; the error says what to do |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.errorTitle` | «درخواست‌ها خوانده نشد» | «درخواست‌ها بارگذاری نشد» | R6: «بارگذاری نشد» is the guide's word; «خوانده نشد» reads as the crawl on these screens |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.errorBody` | «پایگاه داده پاسخ نداد. چیزی تغییر نکرده است؛ کمی بعد دوباره امتحان کنید.» | «چیزی تغییر نکرده است.» | R5 R7: the cause and the retry sentence go (the title and [تلاش دوباره] say it); the fact that nothing changed stays |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.reasonField` | «دلیل رد (برای خریدار نوشته می‌شود)» | «دلیل رد» | R5: a label is a noun; who reads it is in the hint |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.reasonHint` | «تا {…} نویسه؛ خریدار آن را در اعلانش می‌خواند.» | «تا {…} کاراکتر. خریدار آن را در اعلانش می‌خواند.» | R6: «کاراکتر» (glossary), not «نویسه»; «؛» to a full stop |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.stale` | «این درخواست بین دیدن و فشردن تغییر کرده است. صفحه تازه شد؛ دوباره بسنجید.» | «این درخواست در این فاصله تغییر کرده است. صفحه تازه شد. دوباره تصمیم بگیرید.» | native: «بین دیدن و فشردن» is cute; «بسنجید» is not the verb for deciding |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.failed` | «ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.» | «تصمیم ثبت نشد. دوباره امتحان کنید.» | R7: «پایگاه داده» is out (lint); R8: what happened, then what to do |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.invalid` | «فرم نامعتبر بود. اگر دلیل رد را ننوشته‌اید، بنویسید.» | «تصمیم ثبت نشد. اگر دلیل رد را ننوشته‌اید، بنویسید.» | R7 R8: «نامعتبر» blamed the form (lint); now what happened and what to do |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedHeading` | «مدل‌هایی که اکنون خوانده می‌شوند» | «مدل‌های پوشش‌داده‌شده» | R6: the glossary's term, as the tracked-models screen calls it |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedLead` | «هر مدل با اینکه چگونه به فهرست آمده است: با انتخاب مالک، یا از درخواست یک خریدار که تأیید شد.» | «هر مدل با چگونگی ورودش به فهرست: انتخاب مالک یا درخواست تأییدشده‌ی خریدار.» | R4 native: «با اینکه چگونه … آمده است» is clumsy |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedManage` | «مدیریت مدل‌های پوشش‌داده‌شده» | «مدیریت مدل‌ها» | R5: shorter; the heading above names the models |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedEmpty` | «هنوز مدلی خوانده نمی‌شود.» | «مدلی خوانده نمی‌شود.» | R8: «هنوز» out |

### Merged into shared sentences, deleted and added

| Where | Before | After | Why |
|---|---|---|---|
| `admin-copy.ts · SOURCES_COPY.stopped` → `CRAWLER_STOPPED` | «خزنده این منبع را متوقف کرد» | «خزنده این منبع را متوقف کرد» | R6: one sentence for one fact on two screens (lint: the same sentence twice in one file); the past tense of the event, as on the sources screen |
| `admin-copy.ts · SOURCE_STATE_RESULT.failed` → `NO_ANSWER` | «پاسخی نرسید؛ وضعیت تازه را ببینید.» | «پاسخی نرسید. صفحه را تازه کنید.» | R4 R8: «؛» to a full stop; the step is the one that works (a fresh page shows the thing as it now is); written once for sources and jobs |
| `admin-copy.ts · SOURCE_STATE_RESULT.invalid` → `INCOMPLETE_REQUEST` | «درخواست ناقص رسید؛ صفحه را تازه کنید.» | «درخواست ناقص بود. صفحه را تازه کنید.» | native: «ناقص رسید» is odd Farsi; «بود»; written once for sources and jobs |
| `admin-copy.ts · WORKER_COPY.stopped` → `CRAWLER_STOPPED` | «خزنده این منبع را متوقف کرده است» | «خزنده این منبع را متوقف کرد» | R6: one sentence for one fact on two screens (lint: the same sentence twice in one file); the past tense of the event, as on the sources screen |
| `admin-copy.ts · JOB_STATE_RESULT.failed` → `NO_ANSWER` | «پاسخی نرسید؛ وضعیت تازه را ببینید.» | «پاسخی نرسید. صفحه را تازه کنید.» | R4 R8: «؛» to a full stop; the step is the one that works (a fresh page shows the thing as it now is); written once for sources and jobs |
| `admin-copy.ts · JOB_STATE_RESULT.invalid` → `INCOMPLETE_REQUEST` | «درخواست ناقص رسید؛ صفحه را تازه کنید.» | «درخواست ناقص بود. صفحه را تازه کنید.» | native: «ناقص رسید» is odd Farsi; «بود»; written once for sources and jobs |
| `admin-dashboard.tsx · ADMIN_COPY.comingTitle` | «بخش‌هایی که به این پنل اضافه می‌شوند» | (deleted) | R2: a promise of «sections that will be added» whose only item has had a card since CS-53; the block was removed from the component |
| `admin-dashboard.tsx · ADMIN_COPY.coming.[0]` | «مدل‌های پوشش‌داده‌شده» | (deleted) | R2: the item of the block above |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.buyerLabel` | «خریدار» | (deleted) | dead key: no component reads it |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.declineNotifies` | «خریداران دلیل را در اعلانشان می‌خوانند.» | (deleted) | dead key; the hint under the reason field says it (R5) |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.requestLink` | «درخواست‌ها» | (deleted) | dead key: no component reads it |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.valuedOnDate` | «برای {…}» | (deleted) | «برای» went with the label: «آخرین ارزش‌گذاری» takes the date alone (the function stays, returns the date) |

Added only as pieces of templates: the noun «ساعت» (six places: the numbers «۱»، «۲۴»، «۴۸» now come through `formatCountOf`, so the no-break space is there and no digit is typed), «تیپ» in the trims count, and «، به‌خاطر» in the cooldown line of `problems-section.tsx`.

## Separators and punctuation in the components (and one in `admin-copy.ts`)

| File | Before | After |
|---|---|---|
| `admin-copy.ts · matching.read` (1) | «۱۲ پرونده · ۹ آگهی تازه · ۲ کاهش قیمت» | «۱۲ پرونده، ۹ آگهی تازه، ۲ کاهش قیمت» |
| `crawl-section.tsx` (5) | kind · status; · average; kind · status; · seconds; · count | kind، status; ، average; kind، status; ، seconds; ، count |
| `jobs-section.tsx` (5) | queue · attempt 3 of 3 · time; queue · time; changed by · time; the phone row of states joined by « · » | the same, joined by «،» |
| `listings-section.tsx` (1) | the phone row of figures joined by « · » | joined by «،» |
| `problems-section.tsx` (3 and 2 «؛») | time · outcome · status · kind; «time؛ reason»; «cooldown time؛ reason» | time، outcome، status، kind; «time، reason»; «… تا time، به‌خاطر reason» |
| `search-files-screen.tsx` (1) | «totals · shown» | «totals. shown» |
| `source-card.tsx` (1 and 1 «؛») | «who · time»; «… برداشته شد؛ reason» | «who، time»; «… برداشته شد. دلیل: reason.» |
| `tracked-models-screen.tsx` (parenthesis) | «۱۲ از ۴۰ آگهی فعال (۳۰٪)» | «۱۲ از ۴۰ آگهی فعال، ۳۰٪» |

## Kept strings and why

Every other string passes the guide as it is. Codes:

- **K1**: a noun or state label: one idea, the glossary's or a plain word.
- **K2**: a sentence already in the voice: one idea, answer first, plain verbs, no filler.
- **K3**: a button or link that is a verb or action noun and names its result (guide, section 4).
- **K4**: a count noun the formatter joins to a number with a no-break space (R10).
- **K5**: an operating word the owner acts on (crawl, stop, queue, worker, sweep): allowed in this section (guide, section 5).
- **K6**: a name the glossary or another screen fixes («پنل مدیریت», «خریدار», «مدل پوشش‌داده‌شده», «در حال پایش»).
- **K7**: a template around a figure the formatters fill.
- **K8**: one of the worker's own counter names, shown as the owner reads it in the logs (the key is code).

Specific notes on kept strings a reviewer might question:

- «مدل‌های پوشش‌داده‌شده» (the title, the card badge, the headings) is the glossary's operating term for the tracked model and is allowed in this section (guide, appendix A item 7); it is not used in a sentence where a plainer verb says it.
- «در حال پایش» (the states of a buyer's file, in `states` and `stateOfFile`) is the buyer-side word today; the guide's appendix A item 2 proposes «دنبال کردن». Area C decides; when it does, these three places follow (listed under "For other areas").
- The filter labels of the crawl-request screen («در انتظار», «تأییدشده», «ردشده», «خوانده‌شده») are short adjectives of the same verbs as the buyer's badges (area C); a filter chip reads better short.
- «پیمایش فهرست», «ضربان», «پردازه», «صف», «رونوشت»: the owner's operating words, one idea each, used the same way everywhere on the section.
- The worker's counter names (`RUN_COUNT_LABEL`) are shown as the owner reads them in the logs; the English keys never reach the screen.
- The popover headings of the tracked-models and specs popovers («توقف», «برداشتن از فهرست», «سقف روزانه», «کدام مقدار به آگهی می‌رسد»…) are kept: they are short names of the topics, and removing them changes the component's sections (not a string change). Each paragraph under one is one or two sentences of at most 25 words.

| Where | Text | Code |
|---|---|---|
| `admin-copy.ts · CRAWL_STATE_LABEL.enabled` | «فعال» | K6 |
| `admin-copy.ts · CRAWL_STATE_LABEL.paused` | «متوقف» | K6 |
| `admin-copy.ts · STOP_REASON_LABEL.blocked` | «سایت درخواست را رد کرد» | K1 |
| `admin-copy.ts · STOP_REASON_LABEL.rate_limited` | «سایت در یک شبانه‌روز دو بار گفت درخواست‌ها زیاد است» | K1 |
| `admin-copy.ts · SOURCES_COPY.title` | «منبع‌ها» | K1 |
| `admin-copy.ts · SOURCES_COPY.stoppedAt` | «زمان توقف» | K1 |
| `admin-copy.ts · SOURCES_COPY.stopReason` | «دلیل» | K1 |
| `admin-copy.ts · SOURCES_COPY.pause` | «توقف خزش» | K3 |
| `admin-copy.ts · SOURCES_COPY.resume` | «ازسرگیری خزش» | K3 |
| `admin-copy.ts · SOURCES_COPY.changes` | «تغییرهای اخیر» | K1 |
| `admin-copy.ts · SOURCES_COPY.clearedStopLifted` | «برداشته شد» | K1 |
| `admin-copy.ts · SOURCES_COPY.showCurrentState` | «دیدن وضعیت تازه» | K3 |
| `admin-copy.ts · SOURCE_STATE_RESULT.changed.enabled` | «خزش از سر گرفته شد.» | K5 |
| `admin-copy.ts · SOURCE_STATE_RESULT.changed.paused` | «خزش متوقف شد.» | K5 |
| `admin-copy.ts · WORKER_COPY.title` | «کارگر و خط پردازش» | K5 |
| `admin-copy.ts · WORKER_COPY.window` | «بازه» | K1 |
| `admin-copy.ts · WORKER_COPY.worker` | «کارگر» | K5 |
| `admin-copy.ts · WORKER_COPY.status.alive` | «در حال کار» | K1 |
| `admin-copy.ts · WORKER_COPY.status.stopped` | «خاموش شد» | K1 |
| `admin-copy.ts · WORKER_COPY.status.silent` | «بی‌پاسخ» | K1 |
| `admin-copy.ts · WORKER_COPY.statusAdvice.stopped` | «کارگر خودش خاموش شد و کاری برنمی‌دارد تا دوباره اجرا شود.» | K5 |
| `admin-copy.ts · WORKER_COPY.version` | «نسخه» | K1 |
| `admin-copy.ts · WORKER_COPY.runningSince` | «در حال کار از» | K1 |
| `admin-copy.ts · WORKER_COPY.stoppedAt` | «خاموش شده در» | K1 |
| `admin-copy.ts · WORKER_COPY.lastBeat` | «آخرین ضربان» | K5 |
| `admin-copy.ts · WORKER_COPY.processes` | «پردازه‌های اخیر کارگر» | K5 |
| `admin-copy.ts · WORKER_COPY.jobs` | «کارها» | K1 |
| `admin-copy.ts · WORKER_COPY.queue` | «صف» | K5 |
| `admin-copy.ts · WORKER_COPY.failures` | «خطاهای اخیر» | K1 |
| `admin-copy.ts · WORKER_COPY.attempt` | «تلاش» | K1 |
| `admin-copy.ts · WORKER_COPY.of` | «از» | K1 |
| `admin-copy.ts · WORKER_COPY.retry` | «تلاش دوباره» | K3 |
| `admin-copy.ts · WORKER_COPY.cancel` | «لغو» | K3 |
| `admin-copy.ts · WORKER_COPY.noMessage` | «پیامی ثبت نشده» | K1 |
| `admin-copy.ts · WORKER_COPY.newFailures` | «خطای تازه» | K4 |
| `admin-copy.ts · WORKER_COPY.seeProblems` | «دیدن مشکل‌ها» | K3 |
| `admin-copy.ts · WORKER_COPY.chartTime` | «زمان» | K1 |
| `admin-copy.ts · WORKER_COPY.tracked` | «مدل» | K4 |
| `admin-copy.ts · WORKER_COPY.flowsCaption` | «آگهی‌های منبع و هر مدل پوشش‌داده‌شده» | K5 |
| `admin-copy.ts · WORKER_COPY.fromQueue` | «از صف» | K5 |
| `admin-copy.ts · WORKER_COPY.jobChanges` | «تلاش‌های دوباره و لغوهای اخیر» | K1 |
| `admin-copy.ts · WORKER_COPY.retried` | «دوباره فرستاده شد» | K1 |
| `admin-copy.ts · WORKER_COPY.cancelled` | «لغو شد» | K1 |
| `admin-copy.ts · WORKER_COPY.crawl` | «خزش» | K5 |
| `admin-copy.ts · WORKER_COPY.budget` | «درخواست‌های امروز» | K1 |
| `admin-copy.ts · WORKER_COPY.budgetOf` | «از سقف روزانه‌ی» | K1 |
| `admin-copy.ts · WORKER_COPY.runs` | «اجراها در این بازه» | K1 |
| `admin-copy.ts · WORKER_COPY.averageDuration` | «میانگین» | K1 |
| `admin-copy.ts · WORKER_COPY.runUnit` | «اجرا» | K4 |
| `admin-copy.ts · WORKER_COPY.outcomes` | «پاسخ‌ها در این بازه» | K1 |
| `admin-copy.ts · WORKER_COPY.running` | «در حال اجرا» | K1 |
| `admin-copy.ts · WORKER_COPY.listings` | «آگهی‌ها» | K1 |
| `admin-copy.ts · WORKER_COPY.wholeSource` | «همه‌ی آگهی‌های منبع» | K1 |
| `admin-copy.ts · WORKER_COPY.total` | «کل» | K1 |
| `admin-copy.ts · WORKER_COPY.active` | «فعال» | K6 |
| `admin-copy.ts · WORKER_COPY.added` | «تازه» | K1 |
| `admin-copy.ts · WORKER_COPY.changed` | «تغییر قیمت» | K1 |
| `admin-copy.ts · WORKER_COPY.gone` | «خارج از بازار» | K1 |
| `admin-copy.ts · WORKER_COPY.lastCheck` | «میانه‌ی زمان از آخرین بررسی» | K1 |
| `admin-copy.ts · WORKER_COPY.noActive` | «آگهی فعالی نیست» | K1 |
| `admin-copy.ts · WORKER_COPY.chart` | «آگهی‌های تازه و خارج‌شده، و میانه‌ی زمان از آخرین بررسی» | K1 |
| `admin-copy.ts · WORKER_COPY.problems` | «مشکل‌های منبع» | K1 |
| `admin-copy.ts · WORKER_COPY.cooldownReason.unavailable` | «پاسخ‌ندادن‌های پی‌درپی» | K1 |
| `admin-copy.ts · WORKER_COPY.rateLimitedAt` | «آخرین پاسخ «درخواست زیاد»» | K1 |
| `admin-copy.ts · WORKER_COPY.refused` | «درخواست‌های ردشده» | K1 |
| `admin-copy.ts · WORKER_COPY.noRefused` | «درخواست ردشده‌ای ثبت نشده است.» | K2 |
| `admin-copy.ts · WORKER_COPY.unparsed` | «مقدارهایی که خوانده نشدند» | K1 |
| `admin-copy.ts · WORKER_COPY.noUnparsed` | «همه‌ی مقدارها خوانده شده‌اند.» | K2 |
| `admin-copy.ts · WORKER_COPY.listingsWithIt` | «آگهی» | K4 |
| `admin-copy.ts · WORKER_COPY.seconds` | «ثانیه» | K4 |
| `admin-copy.ts · WORKER_COPY.minutes` | «دقیقه» | K4 |
| `admin-copy.ts · WORKER_COPY.hours` | «ساعت» | K4 |
| `admin-copy.ts · WORKER_COPY.days` | «روز» | K4 |
| `admin-copy.ts · JOB_STATE_LABEL.created` | «در انتظار» | K1 |
| `admin-copy.ts · JOB_STATE_LABEL.retry` | «منتظر تلاش دوباره» | K3 |
| `admin-copy.ts · JOB_STATE_LABEL.active` | «در حال اجرا» | K1 |
| `admin-copy.ts · JOB_STATE_LABEL.completed` | «انجام‌شده» | K1 |
| `admin-copy.ts · JOB_STATE_LABEL.cancelled` | «لغوشده» | K1 |
| `admin-copy.ts · JOB_STATE_LABEL.failed` | «ناموفق» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.ok` | «پاسخ درست» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.not_modified` | «بدون تغییر» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.not_found` | «پیدا نشد» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.blocked` | «ردشده» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.rate_limited` | «درخواست زیاد» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.challenge` | «آزمون ضدربات» | K1 |
| `admin-copy.ts · FETCH_OUTCOME_LABEL.error` | «خطا» | K1 |
| `admin-copy.ts · CRAWL_KIND_LABEL.detail` | «صفحه‌ی آگهی» | K5 |
| `admin-copy.ts · CRAWL_KIND_LABEL.measure` | «اندازه‌گیری» | K1 |
| `admin-copy.ts · CRAWL_KIND_LABEL.sweep` | «پیمایش فهرست» | K5 |
| `admin-copy.ts · CRAWL_KIND_LABEL.check` | «بررسی خروج از بازار» | K1 |
| `admin-copy.ts · CRAWL_KIND_LABEL.recheck` | «بررسی دوباره برای خریدار» | K1 |
| `admin-copy.ts · RUN_STATUS_LABEL.running` | «در حال اجرا» | K1 |
| `admin-copy.ts · RUN_STATUS_LABEL.succeeded` | «موفق» | K1 |
| `admin-copy.ts · RUN_STATUS_LABEL.failed` | «ناموفق» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.model_year` | «سال ساخت» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.mileage_km` | «کارکرد» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.fuel` | «سوخت» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.gearbox` | «گیربکس» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.insurance_months_left` | «مهلت بیمه» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.price` | «قیمت» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.accepts_swap` | «معاوضه» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.accepts_installments` | «اقساط» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.seller_type` | «نوع فروشنده» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.body_condition` | «وضعیت بدنه» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.engine_condition` | «وضعیت موتور» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.gearbox_condition` | «وضعیت گیربکس» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.chassis_condition` | «وضعیت شاسی» | K1 |
| `admin-copy.ts · UNPARSED_FIELD_LABEL.colour` | «رنگ» | K1 |
| `admin-copy.ts · JOB_STATE_RESULT.changed.retry` | «کار دوباره به صف رفت.» | K3 |
| `admin-copy.ts · JOB_STATE_RESULT.changed.cancel` | «کار لغو شد.» | K3 |
| `admin-copy.ts · RUN_COUNT_LABEL.rows` | «ردیف خوانده‌شده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.newListings` | «آگهی تازه» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.changedListings` | «آگهی تغییرکرده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.lateListings` | «آگهی دیررس» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.detailsNew` | «جزئیات تازه» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.detailsChanged` | «جزئیات تغییرکرده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.priceEvents` | «تغییر قیمت» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.attributesChanged` | «مشخصات تغییرکرده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.photosChanged` | «عکس‌های تغییرکرده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.photosSkipped` | «عکس ردشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.unparsedValues` | «مقدار خوانده‌نشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.unknownLabels` | «برچسب ناشناخته» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.unknownSections` | «بخش ناشناخته» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.sightings` | «دیده‌شدن» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.fresh` | «تازه‌خوانده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.offMarket` | «خارج از بازار» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.notFound` | «پیدا نشد» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.notSent` | «فرستاده‌نشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.slices` | «برش» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.markedExpired` | «منقضی‌شده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.measured` | «اندازه‌گیری‌شده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.queued` | «در صف» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.requests` | «درخواست» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.pageLimit` | «رسیدن به سقف صفحه» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.priceUnread` | «قیمت خوانده‌نشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.postedAtUnread` | «زمان انتشار خوانده‌نشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.notACar` | «غیرخودرو» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.derivationsRefused` | «استخراج ردشده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.alreadyMeasured` | «پیش‌تر اندازه‌گیری‌شده» | K8 |
| `admin-copy.ts · RUN_COUNT_LABEL.fields` | «فیلد» | K8 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.title` | «پرونده‌های جست‌وجو» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.buyer` | «خریدار» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.search` | «جست‌وجو» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matches` | «آگهی مطابق» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.state` | «وضعیت» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.list` | «پرونده‌ها» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.states.watching` | «در حال پایش» | K6 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.states.paused` | «متوقف» | K6 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.states.closed` | «بسته» | K6 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.totals` | «{…} از {…}» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.totals` | «پرونده» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.totals` | «خریدار» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matchesOf` | «بیش از {…}» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.newOf` | «{…} تازه» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.newOf` | «آگهی» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.heading` | «پایش پرونده‌ها» | K1 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.notified` | «{…} فرستاده شد» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.notified` | «اعلان» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.read` | «پرونده» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.read` | «آگهی تازه» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.read` | «کاهش قیمت» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.deferred` | «{…} به بعد موکول شد» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.deferred` | «پرونده» | K4 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.took` | «{…} میلی‌ثانیه» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.matching.took` | «{…} ثانیه» | K7 |
| `admin-copy.ts · SEARCH_FILES_ADMIN_COPY.fileRequests` | «درخواست‌های جست‌وجوی بیشتر» | K1 |
| `admin-dashboard.tsx · ADMIN_COPY.title` | «پنل مدیریت» | K6 |
| `admin-dashboard.tsx · ADMIN_COPY.signedInAs` | «وارد شده با» | K1 |
| `admin-dashboard.tsx · ADMIN_COPY.accounts` | «حساب‌ها» | K1 |
| `admin-dashboard.tsx · ADMIN_COPY.buyers` | «خریدار» | K4 |
| `admin-dashboard.tsx · ADMIN_COPY.superadmins` | «مدیر» | K6 |
| `admin-dashboard.tsx · ADMIN_COPY.sources` | «منبع‌ها» | K1 |
| `admin-dashboard.tsx · ADMIN_COPY.worker` | «کارگر و خط پردازش» | K5 |
| `model-specs-section.tsx · ModelCard().<li>.<dl>.<div>.<dt>` | «آگهی» | K4 |
| `country-admin-copy.ts · COUNTRY_COPY.label` | «کشور» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.makeLabel` | «کشور برند» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.modelLabel` | «کشور این مدل» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.makeEmpty` | «نامشخص» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.modelEmpty` | «همان کشور برند» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.save` | «ذخیره» | K3 |
| `country-admin-copy.ts · COUNTRY_COPY.clear` | «برداشتن» | K3 |
| `country-admin-copy.ts · COUNTRY_COPY.unknown` | «نامشخص» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.result.changed.remove` | «برداشته شد.» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.result.unchanged` | «پیش‌تر همین‌طور بود.» | K2 |
| `country-admin-copy.ts · COUNTRY_COPY.result.missing` | «این برند یا مدل دیگر در فهرست نیست. صفحه تازه شد.» | K5 |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.heading` | «برندهای بدون کشور» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.withListings` | «آگهی فعال» | K4 |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.none` | «همه‌ی برندها کشور دارند.» | K2 |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.noneListed` | «برند بدون آگهی» | K4 |
| `country-admin-copy.ts · COUNTRY_COPY.missingMakes.others` | «برند بدون آگهی» | K4 |
| `country-admin-copy.ts · COUNTRY_COPY.history.describe.prefix` | «کشور برند» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.history.describe.prefix` | «کشور این مدل» | K1 |
| `country-admin-copy.ts · COUNTRY_COPY.history.describe.case` | «{…}: مقدار اولیه، {…}» | K7 |
| `country-admin-copy.ts · COUNTRY_COPY.history.describe.case` | «{…}: از {…} به {…}» | K7 |
| `crawl-requests-admin-copy.ts · FILTER_LABELS.pending` | «در انتظار» | K1 |
| `crawl-requests-admin-copy.ts · FILTER_LABELS.approved` | «تأییدشده» | K1 |
| `crawl-requests-admin-copy.ts · FILTER_LABELS.declined` | «ردشده» | K1 |
| `crawl-requests-admin-copy.ts · FILTER_LABELS.fulfilled` | «خوانده‌شده» | K1 |
| `crawl-requests-admin-copy.ts · FILTER_LABELS.all` | «همه» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.title` | «درخواست‌های جست‌وجوی بیشتر» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.filterLabel` | «وضعیت درخواست‌ها» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.demandRow` | «خریدار» | K4 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.demandRow` | «درخواست» | K4 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.requestsHeading` | «درخواست‌ها» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.empty.pending` | «درخواست در انتظاری نیست.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.empty.approved` | «درخواست تأییدشده‌ای نیست.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.empty.declined` | «درخواست ردشده‌ای نیست.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.empty.fulfilled` | «درخواست خوانده‌شده‌ای نیست.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.demand` | «خریدار» | K4 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.filesOf` | «پرونده» | K4 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.asked` | «اولین درخواست: {…}» | K7 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.decidedLabel` | «تصمیم» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.reasonLabel` | «دلیل» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.filesLabel` | «پرونده‌های وابسته» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.moreFiles` | «+{…} پرونده‌ی دیگر» | K7 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.approve` | «تأیید» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.approveNotifies` | «خریداران خبردار می‌شوند.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.shownOf` | «نمایش {…} از {…}» | K7 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.loading` | «در حال بارگذاری درخواست‌ها…» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.retry` | «تلاش دوباره» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.decline` | «رد با دلیل» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.reconsider` | «تأیید دوباره» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.declineSubmit` | «رد کردن درخواست» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.cancel` | «انصراف» | K3 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.changed.approved` | «تأیید شد و خریداران خبردار شدند.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.changed.declined` | «رد شد و خریداران خبردار شدند.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.unchanged.approved` | «پیش‌تر تأیید شده بود.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.result.unchanged.declined` | «پیش‌تر رد شده بود.» | K2 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedOwner` | «انتخاب مالک» | K1 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.trackedRequest` | «از درخواست تأییدشده، {…}، {…}» | K7 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.stateOfFile.watching` | «در حال پایش» | K6 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.stateOfFile.paused` | «متوقف» | K6 |
| `crawl-requests-admin-copy.ts · CRAWL_REQUESTS_ADMIN_COPY.stateOfFile.closed` | «بسته» | K6 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.title` | «عکس مدل‌های پرطرفدار» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.label` | «توضیح درباره‌ی «عکس مدل»» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.info.close` | «بستن توضیح» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.listHeading` | «مدل‌ها» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.onHome` | «صفحه‌ی اصلی» | K5 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.onIndexOnly` | «فهرست مدل‌ها» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.save` | «ذخیره‌ی عکس» | K3 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.clear` | «برداشتن عکس» | K3 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.label` | «پیش‌نمایش» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.loading` | «در حال بارگذاری پیش‌نمایش…» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.preview.loaded` | «پیش‌نمایش آماده است.» | K2 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.unchanged` | «پیش‌تر همین‌طور بود.» | K2 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.result.missing` | «این مدل دیگر در فهرست نیست. صفحه تازه شد.» | K5 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.loading` | «در حال بارگذاری مدل‌ها…» | K1 |
| `model-photos-admin-copy.ts · MODEL_PHOTOS_COPY.retry` | «تلاش دوباره» | K3 |
| `model-specs-admin-copy.ts · UNKNOWN` | «نامشخص» | K1 |
| `model-specs-admin-copy.ts · SOURCE_LABELS.catalogue` | «از نام تیپ در فهرست» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.heading` | «حجم موتور، مبدأ و کشور مدل‌ها» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.close` | «بستن توضیح» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.inheritHeading` | «کدام مقدار به آگهی می‌رسد» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.info.unknownHeading` | «نامشخص یعنی چه» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.volume` | «حجم موتور معلوم» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.origin` | «مبدأ معلوم» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.country` | «کشور معلوم» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.missing` | «مدل‌هایی که مقدارشان کامل نیست» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.of` | «{…} از {…}» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.of` | «آگهی فعال» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.bySource` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.bySource` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.bySource` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.coverage.noneMissing` | «همه‌ی مدل‌های دارای آگهی کامل‌اند.» | K2 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.label` | «جست‌وجوی مدل در فهرست» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.placeholder` | «نام مدل یا برند، مثلاً سورنتو» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.submit` | «جست‌وجو» | K3 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.emptyQuery` | «مدلی با «{…}» در فهرست پیدا نشد.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.hintQuery` | «مدل‌های فهرست که «{…}» در نامشان هست، پرآگهی‌ترین‌ها اول.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.search.shownOf` | «مدل» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.tracked` | «پوشش‌داده‌شده» | K6 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.listings` | «بدون آگهی فعال» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.listings` | «آگهی فعال» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.volumeCovered` | «حجم موتور برای {…} از {…} معلوم است.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.volumeCovered` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.countryCovered` | «کشور برای {…} از {…} معلوم است.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.countryCovered` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.originCovered` | «مبدأ برای {…} از {…} معلوم است.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.originCovered` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.missingBadge` | «ناقص» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.wholeModel` | «کل مدل» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.trimListings` | «بدون آگهی» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.trimListings` | «آگهی» | K4 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.model.inheritsNothing` | «اگر خالی بماند، مقدارش نامشخص است.» | K2 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.heading` | «تغییرها» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.empty` | «تغییری ثبت نشده است.» | K2 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.describe.case` | «{…}مقدار اولیه: {…}» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.describe.case` | «{…}افزوده شد: {…}» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.history.describe.case` | «{…}از {…} به {…}» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.volumePlaceholder` | «مثلاً ۱۶۰۰» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.origin` | «مبدأ» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.save` | «ذخیره» | K3 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.form.clear` | «برداشتن مقدارها» | K3 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.problems.volume_not_number` | «حجم را فقط با رقم بنویسید، مثلاً ۱۶۰۰.» | K2 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.problems.volume_range` | «حجم موتور باید از {…} تا {…} سی‌سی باشد.» | K7 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.unchanged` | «پیش‌تر همین‌طور بود.» | K2 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.result.missing` | «این مدل یا تیپ دیگر در فهرست نیست. صفحه تازه شد.» | K5 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.card.specLabel` | «مشخصات» | K1 |
| `model-specs-admin-copy.ts · MODEL_SPECS_COPY.card.editLink` | «ویرایش مشخصات» | K3 |
| `tracked-models-admin-copy.ts · PRIORITY_LABELS.high` | «بالا» | K1 |
| `tracked-models-admin-copy.ts · PRIORITY_LABELS.normal` | «معمولی» | K1 |
| `tracked-models-admin-copy.ts · PRIORITY_LABELS.low` | «کم» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.title` | «مدل‌های پوشش‌داده‌شده» | K6 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.tracking` | «در حال خواندن» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.queued` | «در صف خواندن» | K5 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.paused` | «متوقف» | K6 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.details` | «جزئیات خوانده‌شده» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.detailsOf` | «{…} از {…}» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.detailsOf` | «آگهی فعال» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.summary.none` | «بدون آگهی» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.trackedHeading` | «مدل‌هایی که پوشش داده می‌شوند» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.label` | «توضیح درباره‌ی «پوشش مدل»» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.close` | «بستن توضیح» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.info.pauseHeading` | «توقف» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.priority.label` | «اولویت» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.priority.infoLabel` | «توضیح درباره‌ی «اولویت»» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.state.tracking` | «در حال خواندن» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.state.queued` | «در صف» | K5 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.state.paused` | «متوقف» | K6 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.origin.requestFulfilled` | «خوانده‌شده» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.label` | «جزئیات آگهی‌ها» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.infoLabel` | «توضیح درباره‌ی «جزئیات آگهی‌ها»: {…}» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.infoTitle` | «پیشرفت خواندن جزئیات» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.complete` | «جزئیات همه‌ی آگهی‌های فعال خوانده شده است.» | K2 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.waitingPaused` | «آگهی» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.progress.waiting` | «آگهی» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.active` | «آگهی فعال» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.lastSweep` | «آخرین پیمایش» | K5 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.lastSweepNone` | «هنوز نشده» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.facts.medianAgeNone` | «بدون آگهی فعال» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.group` | «تغییر این مدل» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.pause` | «توقف خواندن» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.resume` | «ادامه‌ی خواندن» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.confirmUntrack` | ««{…}» از فهرست پوشش برداشته شود؟ دیگر خوانده نمی‌شود و داده‌اش با تاریخ آن می‌ماند.» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.controls.cancel` | «انصراف» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.changed.track` | «مدل پوشش داده شد.» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.changed.untrack` | «از فهرست برداشته شد.» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.unchanged` | «پیش‌تر همین‌طور بود.» | K2 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.result.missing` | «این مدل دیگر در فهرست نیست. صفحه تازه شد.» | K5 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.heading` | «تاریخچه‌ی تغییرها» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.empty` | «تغییری ثبت نشده است.» | K2 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.tracked` | «پوشش داده شد، اولویت {…}» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.from_request` | «از درخواست تأییدشده پوشش داده شد» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.paused` | «متوقف شد» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.priority_changed` | «اولویت از {…} به {…}» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.history.untracked` | «از فهرست برداشته شد» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.heading` | «مدل‌هایی که پوشش داده نمی‌شوند» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.search` | «جست‌وجوی مدل» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.searchPlaceholder` | «مثلاً پژو یا ۴۰۵» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.searchSubmit` | «جست‌وجو» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.searchClear` | «پاک کردن جست‌وجو» | K3 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.empty` | «مدلی با آگهی فعال پیدا نشد.» | K2 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.emptyAll` | «همه‌ی مدل‌های دارای آگهی پوشش داده می‌شوند.» | K2 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.emptyQuery` | «مدلی با «{…}» پیدا نشد.» | K7 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.active` | «آگهی فعال» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.shownOf` | «مدل» | K4 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.untracked.priority` | «اولویت» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.loading` | «در حال بارگذاری مدل‌ها…» | K1 |
| `tracked-models-admin-copy.ts · TRACKED_MODELS_COPY.retry` | «تلاش دوباره» | K3 |

## Structure touched, each with its reason

The task is strings only; these are the places where the words could not be changed without a tiny change beside them. None adds a component, a prop, a file or moves anything.

- `admin-copy.ts`: three module-private constants (`NO_ANSWER`, `INCOMPLETE_REQUEST`, `CRAWLER_STOPPED`) hold a sentence the sources screen and the worker screen both say, so it is written once (the lint refuses a sentence twice in one file). No exported name changed.
- `admin-copy.ts`, `tracked-models-admin-copy.ts`: `windows`, `chartLead`, `chartAdded`, `chartGone`, `facts.newInDay`, `facts.goneInDay` and `info.pause` build their numbers with `formatCountOf` (and `SEARCH_FRESHNESS_HOURS` for the 48 hours) instead of typing a digit: guide R10.
- `admin-dashboard.tsx`: the block «sections that will be added» (a title, a list and the `<Section>` around them) is removed: its one item, the tracked models, has a card above it.
- Dead keys removed: `CRAWL_REQUESTS_ADMIN_COPY.buyerLabel`, `.declineNotifies`, `TRACKED_MODELS_COPY.origin.requestLink`, `.facts.ratedValue` (no code or test reads them; `tsc` passes).
- `tracked-models-admin-copy.ts · facts.valuedOnDate` returns the date alone (it kept its name and parameter).
- The glue strings of the components in the section above (« · » to «،», «؛» to «.» or «،»), and one added word («به‌خاطر») in the cooldown line.

## Tests that match text

- `apps/web/src/features/admin/worker-format.test.ts` retyped «ثانیه»، «دقیقه»، «ساعت»، «روز» and «کمتر از ۱ ثانیه»: it now imports `WORKER_COPY`. Run: 2 tests pass.
- `apps/web/src/features/admin/components/source-state-form.test.tsx` already imports `SOURCES_COPY` and `SOURCE_STATE_RESULT`: unchanged, 3 tests pass.
- Playwright specs of the admin screens carry their own retyped wording (they cannot import the app's constants): `admin-sources.spec.ts`, `admin-worker.spec.ts`, `crawl-requests.spec.ts`, `model-photos.spec.ts`, `model-specs.spec.ts`, `tracked-models.spec.ts` and `search-files.spec.ts` (one added line: the dashboard link's name). Each assertion keeps its meaning and its strength; only the words follow the new copy. The links the specs click on the dashboard (`dashboardLink`, `adminLink`) are the new link texts. **They were not run** (the lane rules of 2026-10-04: no Playwright); the coordinator runs the suite once after the merges.
- `crawl-requests.spec.ts` line 208 asserts the buyer-side card (area C) and is untouched.

## Warnings read

`pnpm copy:lint --warnings apps/web/src/features/admin` gives 3, all «هنوز» in a state that will exist, which the guide allows (R8):

- `admin-copy.ts · WORKER_COPY.noJobs`: «کارگر هنوز کاری نفرستاده»: the worker has not sent a job yet, and one will come (the guide's own E96 keeps it).
- `tracked-models-admin-copy.ts · facts.lastSweepNone` and `facts.valuedOnNone`: «هنوز نشده»: the sweep and the valuation will happen.

The other 93 were fixed by the rewrite: «؛» (56) became full stops or commas, parentheses (10) became sentences or commas, the three sentences over 25 words were cut, and the 24 phrases to reconsider were replaced or cut («هنوز» about the product, «حذف», «می‌توانید», «این‌جا», the spoken «برش گرداند»).

## For other areas (strings in files this lane does not own)

- **C** `apps/web/src/lib/crawl-requests-copy.ts`: `card.info.what` says «ظرفیت روزانه‌ی خواندن» (jargon for a buyer, and the admin screens now say «سقف روزانه»); `notes.approvedPaused` says «خواندن آگهی‌ها اکنون متوقف است» where the admin says «خزش متوقف است» (a buyer need not know the word; the buyer-side sentence is C's); `REQUEST_STATE_LABELS` («در انتظار تأیید», «تأیید شد»…) and the admin filter's «در انتظار», «تأییدشده» name the same four states: C may want one set.
- **C** the file states («در حال پایش», «متوقف», «بسته») are written in `search-files-copy.ts` and again here, in `SEARCH_FILES_ADMIN_COPY.states`, `.matching.heading` and `CRAWL_REQUESTS_ADMIN_COPY.stateOfFile`: if C changes the word (appendix A item 2), these three follow.
- **A** `apps/web/src/features/data-status/data-status-copy.ts` (lines 6, 33, 142) uses «مدل پوشش‌داده‌شده» and «مرور» in text a buyer reads: both are operating words (appendix A item 7).
- **E** `packages/search/src/specs.ts`: the three origins have a `description` with examples that the superadmin form does not show; showing it as the origin list's hint would let the specs popover stay at one number and one rule.
- **Docs (the coordinator)** the glossary rows for the crawl state («متوقف به دست خزنده» to «توقف خودکار», «خزیده نمی‌شود» to «بدون خزش»), the tracked model and the search file, and section 4 of the guide (the table above).
- **Not copy** `apps/web/src/lib/model-photo-link-rules.ts`: the minimum link length (12) is typed in the photo problem sentence because the constant is not exported; exporting it would let the sentence use the formatter.

## Left for the owner to check (taste, not self-approved)

- «توقف خودکار» against the glossary's «متوقف به دست خزنده», and «بدون خزش» against «خزیده نمی‌شود».
- «کارهای رهاشده» for the dead-letter queue, «رونوشت» for a stored page copy, «وقفه‌ی خزش» for a lane's cooldown.
- «… توسط ali» in the who-did-it lines (four strings): «توسط» is plain, but the Academy prefers other forms.
- The dashboard links as acts («دیدن وضعیت کارگر», «مدیریت مدل‌ها», «مدیریت عکس‌ها»): the owner may prefer the old name-as-link.
- The three kept «هنوز» above, and the decision to keep the popover headings.

## Verification

| Check | Result |
|---|---|
| `pnpm copy:lint --all apps/web/src/features/admin` | 0 violations (58 before); 3 warnings, kept above |
| `pnpm copy:test` | 126 pass |
| prettier on the changed files | clean |
| `pnpm --filter @carshenas/web typecheck` (once, at the end) | clean |
| `vitest run --project unit` on `worker-format.test.ts` and `source-state-form.test.tsx` | 5 pass |
| The copy-fa review scan on the six copy files | hits read: M12 (operating words, allowed here), R5 retry sentences on forms with no retry button, R8 the kept «هنوز» |
| Not run, by the lane rules of 2026-10-04 | Playwright (the specs above), screenshots at 412 and 1440, `pnpm check`, the `copy-reviewer` agent (a lane cannot spawn it) |

The baseline file `tools/copy-lint/baseline/D.json` is not committed from this lane (the coordinator regenerates the baselines once after all merges); `pnpm copy:lint` says «23 baseline entries are higher than the code now».
