# Copy rewrite A (CS-106): public pages and the shell

Evidence for the acceptance criteria of CS-106, written 2026-10-04 on the branch `cs-106-copy-a`. The voice is the guide's (`docs/design/product-voice.md`, ADR-0042): a calm, direct expert friend, «شما» usually unsaid, nothing a buyer cannot check or act on. The files are the ones `docs/design/copy-rewrite-plan.md` assigns to area A; the check-a-link feature is CS-115's and is not in here.

How the work was done, per screen: every string of the screen was written down as one set with its element (title, lead, hint, label, button, notice) and the one idea it carries; a second string with the same idea was deleted (R5); a detail a buyer can neither check nor act on was cut (R7); every noun and verb was set against the glossary and the guide's words table (R6); the sentences were read aloud against the others of their screen. The change was made by a script that writes the half-space from a placeholder and refuses to replace a text that is not in the file exactly once; every added word was then compared with how the repository already spells it. The Farsi in this file is copied from the files, not retyped.

## 1. The numbers

The unit is what `pnpm copy:inventory --strings A` counts: one piece of text a person could read; a template with holes is several units. «Rewritten» means the unit's text is new; «deleted» means the idea is gone (a repeat, a detail, or a string nobody renders); «added» is the one key the rewrite needed. A unit is counted under the screen that shows it (the popular models row of the home page is defined in `model-copy.ts`, the footer in `home-copy.ts`).

| Screen | Reviewed | Kept as it was | Rewritten | Deleted | Added |
|---|---:|---:|---:|---:|---:|
| Home page | 76 | 45 | 25 | 6 | 0 |
| Header, footer and credits | 20 | 16 | 2 | 2 | 0 |
| Models index | 16 | 11 | 4 | 1 | 0 |
| Model pages | 146 | 86 | 38 | 22 | 1 |
| Status page | 101 | 51 | 38 | 12 | 0 |
| Error and not-found pages | 18 | 7 | 9 | 2 | 0 |
| Photo alt texts | 6 | 0 | 6 | 0 | 0 |
| **Total** | **383** | **216** | **122** | **45** | **1** |

Check: 383 reviewed − 45 deleted + 1 added = 339 strings now (`pnpm copy:inventory --strings A` prints 339, in 17 files: the four files that only joined text with « · » are not copy files any more).

| The lint, over the 21 files of the area | Before | After |
|---|---:|---:|
| Violations (refuse rules) | 24 | 0 |
| Warnings (warn rules; a person reads them) | 50 | 8, each kept on purpose (section 4) |
| Longest notice, in words | 33 | 25 or fewer |

`tools/copy-lint/baseline/A.json` is not touched: the coordinator regenerates it once after the merges (`pnpm copy:lint --update-baseline`); today `pnpm copy:lint` says «9 baseline entries are higher than the code now». No allowlist entry and no `copy-lint-ignore` comment was added.

## 2. What changed, screen by screen

### 2.1 Home page

- The hero says what we do in one line (the owner's wording), the box asks one question and the three chips are sentences a buyer would write, in the make-first order a buyer uses.
- The three steps say what we do in turn: read, value, rate. The rating's reason is said once (in the third step), not in the intro, the description and the title.
- The figures under them are in buyer's words and say «today»; no database, no model, no internal term for a field.
- The closing call is a title and a button. The body-type section has a title and the tiles; the tiles are links, so no sentence tells the buyer to press one.

| Where | Before | After | Why |
|---|---|---|---|
| `home-copy.ts` · description | آگهی‌های خودروی کارکرده از سایت‌های آگهی، با ارزش بازار هر خودرو و ارزیابی قیمت: بفهمید قیمت منصفانه است یا نه، و چرا. | آگهی‌های خودروی کارکرده با ارزش بازار و ارزیابی قیمت. ببینید قیمت منصفانه است یا نه. | One idea per sentence; the reason is said once, in the three steps (R4 R5) |
| `home-copy.ts` · hero.intro | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، ارزش بازار هر ماشین را حساب می‌کنیم و می‌گوییم قیمتش منصفانه است یا نه، با دلیل. | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم و ارزش‌گذاری می‌کنیم. | The owner's wording: what we do in one line; the verdict and its reason belong to the steps below (R2 R4 R5) |
| `home-copy.ts` · hero.searchLabel | چه ماشینی می‌خواهید؟ به زبان خودتان بنویسید | چه ماشینی می‌خواهید؟ | The second sentence is what the example chips under the box already show (R5) |
| `home-copy.ts` · hero.examplesLabel | نمونه‌ی جمله | نمونه‌های جست‌وجو | Name of the list of chips: they are searches, not sentences about something (R6) |
| `home-copy.ts` · hero.examples[0] | ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون | پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون | Written the way a buyer writes it: the make comes first (same filters) |
| `home-copy.ts` · hero.examples[1] | یک ماشین تمیز، کم‌کارکرد و بی‌دردسر | یه ماشین تمیز و بی‌دردسر می‌خوام | A sentence a person would type, not three adjectives in a row (the buyer's own spoken form stays: guide section 2) (M4) |
| `home-copy.ts` · hero.examples[2] | خانوادگی زیر ۱ میلیارد | ماشین خانوادگی زیر یک میلیارد | A need and a budget in a buyer's words |
| `home-copy.ts` · hero.modes.label | راه ورود به کارشناس | شروع کار | Name of the two tabs, as a short noun phrase (it was a calque of "entry point") (R8) |
| `home-copy.ts` · hero.photoBy | عکس: | عکس از | Same words as the credits list in the footer (R6) |
| `home-copy.ts` · hero.pause | توقف نمایش تصاویر | توقف نمایش عکس‌ها | One word for a photo: «عکس» (R6) |
| `home-copy.ts` · hero.play | ادامه‌ی نمایش تصاویر | ادامه‌ی نمایش عکس‌ها | One word for a photo: «عکس» (R6) |
| `home-copy.ts` · bodyTypes.title | بر اساس شکل خودرو | نوع بدنه | The filter and the model page call it «نوع بدنه»; two words for one idea were on the same site (R6) |
| `home-copy.ts` · bodyTypes.lead | یکی را بزنید تا آگهی‌های همان نوع را ببینید. | (deleted) | The tiles are links: the instruction is made by the control (R5) |
| `home-copy.ts` · how.steps[0].body | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، نام و تیپ هر خودرو را از میان نوشته‌های پراکنده درمی‌آوریم و آگهی‌ها را یک‌جا کنار هم می‌گذاریم. | نام، تیپ و وضعیت هر خودرو را از متن آگهی درمی‌آوریم. | Its first half was the hero line again; the title says we read, the body says what we get out of it (R5 R4) |
| `home-copy.ts` · how.steps[1].body | هر روز، از خودروهای مشابه همان روز، ارزش بازار هر خودرو را برآورد می‌کنیم؛ با تیپ، سال، کارکرد و وضعیت بدنه. | از روی آگهی‌های همان مدل حساب می‌شود، با توجه به تیپ، سال، کارکرد و وضعیت بدنه. هر روز تازه می‌شود. | One idea per sentence; «حساب کردن» for the daily act, «برآورد» is not our word (R4 R6) |
| `home-copy.ts` · how.steps[2].title | قیمت را ارزیابی می‌کنیم و دلیلش را می‌گوییم | قیمت را ارزیابی می‌کنیم | The reason is said once, in the body (R5) |
| `home-copy.ts` · how.steps[2].body | قیمت هر آگهی را با ارزش بازار می‌سنجیم، از «معامله‌ی عالی» تا «خیلی گران»، و کنارش می‌نویسیم چرا. | از «معامله‌ی عالی» تا «خیلی گران». دلیل هر ارزیابی کنارش نوشته شده است. | The title says we rate; the body says the scale and that the reason is beside each rating (R5 R4) |
| `home-copy.ts` · how.trustTitle | اعداد این صفحه، از خود پایگاه داده | امروز در کارشناس | No database for a buyer: the figures are today's (R7) |
| `home-copy.ts` · how.searchable | آگهی قابل‌جست‌وجو | آگهی در جست‌وجو | «قابل‌جست‌وجو» is a calque; plain: listings in the search (T) |
| `home-copy.ts` · how.rated | آگهی ارزیابی قیمت گرفت | آگهی ارزیابی‌شده | A noun phrase under a number, in the rating's own word (R6) |
| `home-copy.ts` · how.reading | واقعیت درست خوانده شد | مورد درست خوانده شد | «واقعیت» was the model's internal term for a field (R7) |
| `home-copy.ts` · how.readingHint | ارزیابی خواندن متن آگهی‌ها | از متن آگهی‌ها | «ارزیابی» is the price rating's word; the hint only says where the items come from (R7 R6) |
| `home-copy.ts` · how.errorTitle | عددها خوانده نشد | عددها بارگذاری نشد | «خواندن» is how we read the sites; a page that fails to load is «بارگذاری نشد» (R6) |
| `home-copy.ts` · how.errorBody | پایگاه داده پاسخ نداد؛ کمی بعد دوباره امتحان کنید. | (deleted) | The title says what happened and the button says what to do; «پایگاه داده» is ours (R5 R7) |
| `home-copy.ts` · cta.title | ماشین بعدی‌تان را با اطمینان بخرید | از بهترین معامله‌ها شروع کنید | «با اطمینان» could sit on any page; this says what the next click shows (the search opens on the best deals) (R2) |
| `home-copy.ts` · cta.body | همه‌ی آگهی‌ها را با ارزش بازار و ارزیابی قیمت ببینید و از بهترین معامله شروع کنید. | (deleted) | The three steps above said it; title and button are enough (R5) |
| `model-copy.ts` · home.lead (models row) | قیمت و روند هر مدل: ارزش بازار، محدوده‌ی قیمت و بهترین معامله‌ها. | قیمت و روند هر مدل. | The list of what a model page holds is on the models index; here the row says what the tiles open (R5) |
| `layout.tsx` · description (default) | آگهی‌های خودروی کارکرده از سایت‌های مختلف، با ارزش بازار و ارزیابی قیمت هر آگهی. | آگهی‌های خودروی کارکرده، با ارزش بازار و ارزیابی قیمت هر آگهی. | «از سایت‌های مختلف» is filler (R2) |

### 2.2 Header, footer and credits

- The header was already two plain destinations (kept). The footer links name their pages exactly as the pages name themselves.
- The two credit lists use one word for the source of a photo («منبع»); a photographer is credited on every line, the changes are said in full sentences, and why a credit is shown (the licence's business) is gone.
- The credit line of the photograph on the hero and the footer list now read the same: «عکس از Name، licence», with a comma instead of the middle dot that reads as a zero beside a digit.

| Where | Before | After | Why |
|---|---|---|---|
| `home-copy.ts` · footer.credits | اعتبار عکس‌های صفحه‌ی اصلی | منبع عکس‌های صفحه‌ی اصلی | «اعتبار عکس» is a calque of "photo credits" and can read as «validity»; the other list says «منبع» (R6) |
| `home-copy.ts` · footer.creditsLead | عکس‌های بالای صفحه از تهران است و از همین سایت نمایش داده می‌شود. | (deleted) | Where the photos are shown from is how it works; the list under the summary says the rest (R2 R5 R7) |
| `home-copy.ts` · footer.requiresCredit | ذکر نام عکاس لازم است | (deleted) | The photographer is credited on every line anyway; why is the licence's business (R7) |
| `body-type-credits.tsx` · body-type-credits summary | منبع عکس‌ها | منبع عکس‌های نمونه | The tiles call them «عکس نمونه»; and the other list in the footer is the home page's photos (R6) |

### 2.3 Models index

- A title, one line that says what each model page holds, the popular models, and every model by make. The failure is a title and a retry; the empty state says when the list fills.

| Where | Before | After | Why |
|---|---|---|---|
| `model-copy.ts` · index.lead | هر مدل یک صفحه دارد: ارزش بازار، محدوده‌ی قیمت، روند قیمت و بهترین معامله‌های همان مدل. | ارزش بازار، محدوده‌ی قیمت، روند و بهترین معامله‌های هر مدل. | What each model page holds, without the sentence that announces it (R2 R5) |
| `model-copy.ts` · index.allTitle | همه‌ی مدل‌ها به تفکیک سازنده | همه‌ی مدل‌ها | «به تفکیک» is the formal register; the makes are the headings of the groups (T) |
| `model-copy.ts` · index.empty.body | وقتی آگهی‌ها خوانده شوند، مدل‌ها همین‌جا فهرست می‌شوند. | وقتی آگهی تازه‌ای بیاید، مدل‌ها همین‌جا فهرست می‌شوند. | «وقتی آگهی‌ها خوانده شوند» is the crawler; the same sentence as on the model page (R7 R6) |
| `model-copy.ts` · index.error | فهرست مدل‌ها خوانده نشد \| خواندن فهرست به مشکل خورد. صفحه را دوباره باز کنید. | فهرست مدل‌ها بارگذاری نشد | The title says what happened, the button what to do; «خواندن» is how we read the sites and «به مشکل خورد» is spoken (R5 R6 V2) |

### 2.4 Model pages

- The numbers did not change and every one still comes from the formatters and the rule constants. What went is the method (the 80 % band, eight listings a day, the week's last day, a hand-typed «سه»), the instructions the controls already give (choose a year, press a tile), and every failure body that repeated its retry button.
- One word each: «بارگذاری نشد» for a section that failed to load («خواندن» is how we read the sites), «روند» for the trend, the same pattern for the name of every info control.
- The trims section had no failure words of its own and showed the deals' («بهترین معامله‌ها بارگذاری نشد»): it has its own now (the one added key).

| Where | Before | After | Why |
|---|---|---|---|
| `model-copy.ts` · notFoundBody | نشانی این مدل در فهرست خودروهای کارشناس نیست. | (deleted) | The title says it is not found and the two links say where to go (the page has no description now) (R5) |
| `model-copy.ts` · breadcrumb.home | خانه | صفحه‌ی اصلی | One name for the home page: the footer and the error pages say «صفحه‌ی اصلی» (R6) |
| `model-copy.ts` · hero.photoCaption | عکس نمونه از بدنه‌ی {…}؛ خودروی همین مدل نیست | عکس نمونه از بدنه‌ی {…} است، نه خودروی همین مدل. | A sentence instead of a semicolon (R4) |
| `model-copy.ts` · stats.rangeHelp | {…} میانیِ {…} | از {…} با قیمت نقدی، بیشترشان در این محدوده‌اند. | «۸۰٪ میانی» is the method; the buyer needs to know what the range holds: most of the listings with a cash price (R7) |
| `model-copy.ts` · stats.valueHelp | میانه‌ی ارزش خودروهای آگهی‌شده، تا {date} | میانه‌ی ارزش خودروهای آگهی‌شده، برای {date} | «تا ۱۰ مهر» reads as «until»; the status page says «برای» a date (R6) |
| `model-copy.ts` · stats.valueNone | ارزش بازار برای این آگهی‌ها هنوز حساب نشده است | هنوز حساب نشده است | The label above is already «ارزش بازار»; «هنوز» kept: data that will exist (R5) |
| `model-copy.ts` · stats.none | بدون قیمت | معلوم نیست | It is shown for the mileage and the years too, where «بدون قیمت» is wrong (R6) |
| `model-copy.ts` · info.*Label (the 8 names of the info controls) | توضیح درباره‌ی محدوده‌ی قیمت<br>توضیح درباره‌ی ارزش بازار<br>توضیح درباره‌ی روند قیمت<br>توضیح درباره‌ی ارزیابی آگهی‌ها<br>توضیح درباره‌ی ترتیب بهترین معامله‌ها<br>توضیح درباره‌ی مدل پرطرفدار<br>توضیح درباره‌ی نکته‌های آگهی‌ها<br>توضیح درباره‌ی قیمت به تفکیک سال | توضیح درباره‌ی «محدوده‌ی قیمت»<br>توضیح درباره‌ی «ارزش بازار»<br>توضیح درباره‌ی «روند قیمت»<br>توضیح درباره‌ی «ارزیابی قیمت آگهی‌ها»<br>توضیح درباره‌ی «ترتیب بهترین معامله‌ها»<br>توضیح درباره‌ی «مدل پرطرفدار»<br>توضیح درباره‌ی «آگهی‌ها چه می‌گویند»<br>توضیح درباره‌ی «قیمت هر سال ساخت» | The same pattern as the search page («توضیح درباره‌ی «…»») and the exact title of the section each one explains (R6) |
| `model-copy.ts` · years.allChip | همه‌ی سال‌ها ({…}) | همه‌ی سال‌ها، {…} | A comma between facts, not a parenthesis (R10) |
| `model-copy.ts` · years.navLabel | نمایش بر پایه‌ی سال ساخت | انتخاب سال ساخت | The name of the navigation says the action; the visible label above already says «سال ساخت» (R8) |
| `model-copy.ts` · years.pick | برای دیدن فقط یک سال ساخت، آن را انتخاب کنید. | (deleted) | The chips are links: the instruction is made by the control (R5) |
| `model-copy.ts` · years.chip | {…} ({…}) | {…}، {…} | A comma between facts, not a parenthesis (R10) |
| `model-copy.ts` · trend.cohortNote | روند برای {…} حساب شده، چون بیشترین آگهی را دارد. سال دیگری را بالا انتخاب کنید. | روند برای {…} است، چون بیشترین آگهی را دارد. | Which year is drawn and why, once; the chips above are the way to another year (R5) |
| `model-copy.ts` · trend.weekly | هر نقطه یک هفته است (آخرین روزِ هفته که ارزیابی شده). | هر نقطه یک هفته است. | Which day of the week a point is taken on is the method (R7) |
| `model-copy.ts` · trend.chartLabel | نمودار میانه‌ی قیمت {…}، از {…} تا {…}: از {…} به {…} | نمودار میانه‌ی قیمت {…}: {…} در {…}، {…} در {…} | Under the 10 words of an accessible name, and it reads as a sentence: the first and the last median with their dates (R4) |
| `model-copy.ts` · trend.scope | اعداد بالای صفحه از همه‌ی آگهی‌های قیمت‌دار امروز حساب شده؛ روند فقط از آگهی‌های ارزیابی‌شده‌ی این سال ساخت. | اعداد بالای صفحه از همه‌ی آگهی‌های قیمت‌دار امروز است. روند فقط از آگهی‌های ارزیابی‌شده‌ی این سال ساخت است. | Two sentences, one idea each: why the numbers at the top differ from the trend (R4) |
| `model-copy.ts` · trend.defaultYear | نمایش‌داده‌شده: {…}، پرآگهی‌ترین سال | (deleted) | The badge said which year is drawn; the note under the title says it with the reason (R5) |
| `model-copy.ts` · trend.short.tomorrow | نمودار از وقتی سه روز ثبت داشته باشیم کشیده می‌شود. | (deleted) | The body says how many days the chart needs; a hand-typed «سه» (R5 R10) |
| `model-copy.ts` · trend.short.body | کارشناس قیمت هر مدل را هر روز ثبت می‌کند و روند فقط از ثبت‌های خودش ساخته می‌شود، نه از حدس. برای رسم نمودار دست‌کم {…} ثبت لازم است؛ برای این مدل {…}. | برای رسم نمودار دست‌کم {…} ثبت لازم است. برای این مدل {…}. | The name as a subject, «نه از حدس» and the semicolon go; what remains is the limit and where this model stands (R4 R7 R9 M10) |
| `model-copy.ts` · trend.none.title | برای این سال ساخت هنوز روندی نداریم | روندی برای این سال ساخت نداریم | A fact, without the softener «هنوز» (R8) |
| `model-copy.ts` · trend.none.body | برای هر روز دست‌کم {…} ارزیابی‌شده از این سال ساخت لازم است تا میانه‌ی قیمتش درست باشد. با آگهی‌های بیشتر یا سال ساخت دیگر دوباره نگاه کنید. | آگهی ارزیابی‌شده‌ی این سال ساخت کافی نیست. سال ساخت دیگری را ببینید. | «۸ آگهی در هر روز» is the method's threshold; the effect is that there are too few rated listings, and the way forward is another year (R7) |
| `model-copy.ts` · trend.error.title | روند قیمت خوانده نشد | روند قیمت بارگذاری نشد | «خواندن» is how we read the sites; the section failed to load (R6) |
| `model-copy.ts` · trend.error.body | خواندن تاریخچه‌ی قیمت به مشکل خورد. صفحه را دوباره باز کنید. | (deleted) | The title says what happened, the button what to do; «به مشکل خورد» is spoken (R5 V2) |
| `model-copy.ts` · deals.lead | ارزان‌تر از ارزش بازار، از همین مدل؛ هر آگهی با قیمت و ارزیابی خودش. | آگهی‌هایی که از ارزش بازار ارزان‌ترند. | «از همین مدل» is the title again, «هر آگهی با قیمت …» is what a card shows (R4 R5) |
| `model-copy.ts` · deals.error.title | بهترین معامله‌ها خوانده نشد | بهترین معامله‌ها بارگذاری نشد | «خواندن» is how we read the sites; the section failed to load (R6) |
| `model-copy.ts` · deals.error.body | خواندن آگهی‌ها به مشکل خورد. صفحه را دوباره باز کنید. | (deleted) | The title says what happened, the button what to do; «به مشکل خورد» is spoken (R5 V2) |
| `model-copy.ts` · ratings.lead | ارزیابی {…} این مدل نسبت به ارزش بازار | سهم هر ارزیابی در {…} این مدل. | The title said «ارزیابی … آگهی‌ها» already; the lead says what the bar shows and out of how many (R5) |
| `model-copy.ts` · ratings.chartLabel | سهم هر ارزیابی از آگهی‌های این مدل | تعداد آگهی‌ها در هر ارزیابی | The name of the list under the bar must add to the visible lead: here it says what the list counts (R5) |
| `model-copy.ts` · byYear.title | قیمت به تفکیک سال ساخت | قیمت هر سال ساخت | «به تفکیک» is the formal register (the guide, section 7) (T) |
| `model-copy.ts` · byYear.lead | میانه‌ی قیمت آگهی‌ها در هر سال ساخت؛ برای دیدن آن سال انتخابش کنید. | میانه‌ی قیمت آگهی‌های هر سال ساخت. | The rows are links: the instruction is made by the control (R5 R4) |
| `model-copy.ts` · trims.lead | آگهی‌هایی که تیپ را نوشته‌اند یا از متن آگهی خوانده شده. | تیپ، همان‌طور که در آگهی آمده است. | The trim is what the listing says; how we read it from the text is ours (R7) |
| `model-copy.ts` · facts.lead | از {…} این مدل؛ فقط آنچه آگهی‌ها نوشته‌اند | از {…} این مدل. | «فقط آنچه آگهی‌ها نوشته‌اند» is the title («آگهی‌ها چه می‌گویند») and the note again; the lead gives the base (R5 R4) |
| `model-copy.ts` · facts.of | {…} از {…} که این را نوشته‌اند | {…} از {…} که درباره‌اش نوشته‌اند | «آگهی» twice in one phrase; and the base is the listings that wrote anything about the item (R4) |
| `model-copy.ts` · facts.note | این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها؛ پیش از خرید خودرو را کارشناسی کنید. | این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها. پیش از خرید، خودرو را کارشناسی کنید. | Two ideas, two sentences; a comma so «خرید خودرو» does not read as one phrase (R4) |
| `model-copy.ts` · empty.body | آگهی‌های این مدل از بازار رفته‌اند یا هنوز خوانده نشده‌اند. وقتی آگهی تازه بیاید، قیمت و روندش همین‌جا دیده می‌شود. | وقتی آگهی تازه‌ای بیاید، قیمت و روند این مدل را همین‌جا می‌بینید. | The first sentence repeated the title and told the crawler's state; «روندش» pointed at one listing (R5 R7) |
| `model-copy.ts` · year.emptyBody | این سال ساخت الان آگهی ندارد. همه‌ی سال‌ها را ببینید. | (deleted) | The title says there is none and the button says where to go (R5) |
| `model-copy.ts` · year.emptyAction | همه‌ی سال‌ها | دیدن همه‌ی سال‌ها | A button is a verb (R8) |
| `model-copy.ts` · retry | دوباره امتحان کنید | تلاش دوباره | «تلاش دوباره» is the guide's word for the button (section 4) (R6) |
| `model-copy.ts` · trims.error.title (new key) | (the deals' failure title was shown) | تیپ‌ها بارگذاری نشد | The trims section borrowed the failure words of the deals («بهترین معامله‌ها بارگذاری نشد»), which named the wrong section (R6) |

### 2.5 Status page

- The page is the one buyer page about the system, so it says how fresh the data is and how accurate the market values are, in the buyer's units, and never how the crawler works: the request budget, the spacing, the order lists are read in, the tiers of the crawl, the defence against instructions hidden for a model, «پایگاه داده», «هوش مصنوعی», «پوشش‌داده‌شده», «خطای میانه» are gone.
- The three promises are «هدف‌ها» (not «تعهد»), each with its measured value and a verdict in a fact («به هدف رسیده / نرسیده»), not a softener («هنوز نه»).
- «How listings stay fresh» keeps the two steps that tell a buyer something the goals do not (new listings arrive within hours; an opened listing is checked again if it is old). The other three described the crawler or repeated the goals.

| Where | Before | After | Why |
|---|---|---|---|
| `data-status-copy.ts` · lead | کارشناس آگهی‌ها را خودش از سایت‌های آگهی می‌خواند و نگه می‌دارد؛ جست‌وجوی شما هیچ درخواستی به آن سایت‌ها نمی‌فرستد. این صفحه نشان می‌دهد این داده‌ها چقدر تازه و ارزش‌های بازار چقدر دقیق‌اند. | ببینید آگهی‌ها چقدر تازه‌اند و ارزش بازار چقدر دقیق است. | How the sites are read and that a search sends no request is the crawler; the lead says what the page shows (R4 R7 R9) |
| `data-status-copy.ts` · leadNumbers | همه‌ی عددهای این صفحه از پایگاه داده‌ی کارشناس خوانده می‌شوند و هر دقیقه تازه می‌شوند. | (deleted) | A database and a cache lifetime (R7) |
| `data-status-copy.ts` · loading | در حال خواندن وضعیت داده‌ها… | در حال بارگذاری وضعیت داده‌ها… | «خواندن» is how we read the sites; the page is loading (R6) |
| `data-status-copy.ts` · noData | هنوز آگهی‌ای خوانده نشده است. | هنوز آگهی‌ای نداریم. | What the buyer lacks, not what the crawler has not done (a state that will change) (R7) |
| `data-status-copy.ts` · checkAgeHint | میانه، در نتایج جست‌وجو | میانه‌ی آگهی‌های نتایج جست‌وجو | Said as a phrase: what the median is of (R3) |
| `data-status-copy.ts` · targetsTitle | تعهدهای تازگی | هدف‌های تازگی | «تعهد» is our own jargon (the guide: «هدف‌های تازگی») (R6 R7) |
| `data-status-copy.ts` · targetsLead | کارشناس این سه تعهد را داده است و هر ساعت اندازه می‌گیرد که به آن‌ها رسیده یا نه. | هر ساعت می‌سنجیم که به این هدف‌ها رسیده‌ایم یا نه. | «ما» for what we do, not «کارشناس» as a subject; no hand-typed number of goals (R6 R9) |
| `data-status-copy.ts` · shownOfTracked | آگهیِ فعالِ مدل‌های پوشش‌داده‌شده در {window} گذشته دیده یا بررسی شده‌اند و در نتایج می‌آیند. | آگهی فعال مدل‌هایی که کامل می‌خوانیم، در {window} گذشته دیده یا بررسی شده‌اند. | «مدل پوشش‌داده‌شده» is a superadmin word; the buyer's word is the models we read fully (R7) |
| `data-status-copy.ts` · sourceBudget | سقف درخواست روزانه | (deleted) | The crawler's daily request budget (R7) |
| `data-status-copy.ts` · sourceNotUpdating.before | فعلاً خوانده نمی‌شود؛ آخرین داده‌هایش از | به‌روز نمی‌شود. آخرین داده‌هایش از | «فعلاً» about what the product cannot do; a full stop where a semicolon was (R8 R4) |
| `data-status-copy.ts` · sourceNotUpdating.after | است و آگهی‌هایش با همین تاریخ نشان داده می‌شوند. | است. | «آخرین داده‌ها از …» already says the listings are as old as that date (R2) |
| `data-status-copy.ts` · sourceDelayed.before | با تأخیر به‌روز می‌شود؛ آخرین داده‌هایش از | با تأخیر به‌روز می‌شود. آخرین داده‌هایش از | A full stop where a semicolon was (R4) |
| `data-status-copy.ts` · noSources | هنوز منبعی خوانده نمی‌شود. | هنوز منبعی نداریم. | What the buyer lacks, not what the crawler has not done (R7) |
| `data-status-copy.ts` · chartLeadSince | از نخستین اندازه‌گیری ساعتی تا اکنون. | از نخستین اندازه‌گیری تا اکنون. | The measurement's rhythm is a method; the chart already shows its points (R7) |
| `data-status-copy.ts` · noChart | در {window} گذشته اندازه‌گیری ساعتی‌ای ثبت نشده است. | در {window} گذشته اندازه‌گیری‌ای ثبت نشده است. | The rhythm of the measurement is a method (R7) |
| `data-status-copy.ts` · valuationLead | ارزش بازار هر خودرو هر روز از خودروهای مشابه همان روز حساب می‌شود و ارزیابی قیمت هر آگهی از مقایسه‌ی قیمتش با این ارزش می‌آید. | ارزش بازار هر خودرو از روی خودروهای مشابه حساب می‌شود. ارزیابی قیمت هم از مقایسه‌ی قیمت آگهی با همین ارزش می‌آید. | Two sentences; «هر روز» is already the third goal (R4 R5) |
| `data-status-copy.ts` · valued | آگهی ارزش‌گذاری شد | آگهی ارزش‌گذاری‌شده | A noun phrase under a number, not a sentence (R6) |
| `data-status-copy.ts` · rated | آگهی ارزیابی قیمت گرفت | آگهی ارزیابی‌شده | The rating's own word, as on the home page (R6) |
| `data-status-copy.ts` · accuracyLead | هر خودروی مشابه یک بار بدون خودش ارزش‌گذاری شد و ارزشش با قیمت آگهی‌اش مقایسه شد. عدد هر مدل خطای میانه است: نیمی از ارزش‌ها کمتر از این با قیمت آگهی فاصله داشتند. | عدد هر مدل نشان می‌دهد ارزش بازار معمولاً چقدر با قیمت آگهی‌ها فرق دارد. هر چه کمتر، دقیق‌تر. | The method (leave one out) and «میانه‌ی خطا» are ours; what the figure means for a buyer is the gap (R7 R4) |
| `data-status-copy.ts` · accuracyRangeFrom | خطای میانه از | فرق معمول از | «خطای میانه» is the method's word (R7) |
| `data-status-copy.ts` · accuracyScale | خطای میانه | فرق معمول | Same word as the range line (R7) |
| `data-status-copy.ts` · noValuation | هنوز ارزش بازاری حساب نشده است. | ارزش بازار هنوز حساب نشده است. | «ارزش بازاری» reads as an adjective; «هنوز» kept: it is data that will exist (R8) |
| `data-status-copy.ts` · extractionLead | هوش مصنوعی از متن آگهی فقط واقعیت‌ها را برمی‌دارد: رنگ‌شدگی، قطعه‌ی تعویضی، شاسی، توافقی یا اقساطی بودن قیمت. هر عددی که می‌بینید از پایگاه داده است، نه از متن مدل. | رنگ‌شدگی، قطعه‌ی تعویضی، وضعیت شاسی و توافقی یا قسطی بودن قیمت را از متن می‌خوانیم. | No «هوش مصنوعی», no database, no model: what is read and that we read it (R7 R4) |
| `data-status-copy.ts` · fieldsRight | واقعیت درست خوانده شد | مورد درست خوانده شد | «واقعیت» was the model's term for a field (R7) |
| `data-status-copy.ts` · itemsRight | آگهی بی هیچ خطا | آگهی بدون خطا | A space where a half-space belonged; plainer (R10) |
| `data-status-copy.ts` · injectedHeld | آگهیِ دارای دستور پنهان برای هوش مصنوعی، برای بازبینی انسانی کنار گذاشته شد | (deleted) | A defence against instructions hidden for a model: how it works, not something a buyer can check or use (R7) |
| `data-status-copy.ts` · extractionOn | ارزیابی روی آگهی‌های برچسب‌خورده‌ای که در نوشتن دستورها دیده نشده بودند، | مقایسه با بررسی دستی آگهی‌ها در | The set was held out of the prompts: a method. What a buyer can use: it was compared with a hand check, on this date (R7) |
| `data-status-copy.ts` · noExtraction | هنوز ارزیابی‌ای منتشر نشده است. | هنوز اندازه‌گیری‌ای نداریم. | «ارزیابی» is the price rating's word; «هنوز» kept: it is data that will exist (R6 R8) |
| `data-status-copy.ts` · errorTitle | وضعیت داده‌ها خوانده نشد | وضعیت داده‌ها بارگذاری نشد | «خواندن» is how we read the sites; the page failed to load (R6) |
| `data-status-copy.ts` · errorBody | پایگاه داده پاسخ نداد. کمی بعد دوباره امتحان کنید. | (deleted) | The title says what happened, the button what to do; «پایگاه داده» is ours (R5 R7) |
| `data-status-copy.ts` · INDEX_STATE_HEADLINE.not_updating | خواندن تازه از منبع فعلاً متوقف است | آگهی تازه‌ای نمی‌رسد | A fact about what the buyer gets; the line under it gives the date of the latest data (R7 R8) |
| `data-status-copy.ts` · SOURCE_STATE_LABEL.not_updating | فعلاً خوانده نمی‌شود | به‌روز نمی‌شود | Parallel to «به‌روز» and «با تأخیر»; no «فعلاً» (R8) |
| `data-status-copy.ts` · TARGET_COPY.newListing.body | از انتشار آگهی در منبع تا رسیدنش به کارشناس، میانه: | از انتشار آگهی در منبع تا رسیدنش به ما، میانه: | «کارشناس» after «به» can read as an expert (R9) |
| `data-status-copy.ts` · TARGET_COPY.valuationDaily.title | ارزش بازار هر روز از نو | ارزش بازار هر روز از نو حساب می‌شود | A title with a verb, like the other two goals (R4) |
| `data-status-copy.ts` · TARGET_COPY.valuationDaily.body | روز آخرین محاسبه: | آخرین محاسبه: | The value after it is a date: «روز» adds nothing (R2) |
| `data-status-copy.ts` · TARGET_STATUS_LABEL.met | برآورده | به هدف رسیده | The goal is «هدف»; «برآورده» is stiff (R6) |
| `data-status-copy.ts` · TARGET_STATUS_LABEL.missed | هنوز نه | به هدف نرسیده | A fact, without the softener «هنوز» (R8) |
| `data-status-copy.ts` · HOW_STEPS.discover.body | فهرست آگهی‌های هر منبع، از تازه‌ترین، چند بار در هر ساعت خوانده می‌شود تا آگهی تازه زود برسد. | فهرست آگهی‌های هر منبع چند بار در هر ساعت خوانده می‌شود تا آگهی تازه زود برسد. | The order a list is read in is a crawler detail (R7) |
| `data-status-copy.ts` · HOW_STEPS.sweep | مرور همه‌ی بازار: آگهی‌های مدل‌های پوشش‌داده‌شده هر روز و بقیه‌ی بازار هر هفته از روی فهرست‌ها مرور می‌شوند: قیمت‌های تازه ثبت و آگهی‌های رفته از بازار پیدا می‌شوند. | (deleted) | «مرور» and «مدل پوشش‌داده‌شده» are superadmin words, the daily and weekly rhythm is the crawler's tiers; the gone listings are a figure on this page (R7 R6) |
| `data-status-copy.ts` · HOW_STEPS.polite | خواندن با ملاحظه: هر منبع سقف درخواست روزانه دارد و درخواست‌ها با فاصله فرستاده می‌شوند. اگر منبعی درخواست‌ها را رد کند، خواندنش متوقف می‌شود و آگهی‌هایش با تاریخ آخرین داده‌ها می‌مانند. | (deleted) | The request budget, the spacing and what happens on a refusal describe the crawler (the guide, E66) (R7) |
| `data-status-copy.ts` · HOW_STEPS.value | ارزش بازار روزانه: هر روز ارزش بازار هر خودرو از خودروهای مشابه همان روز از نو حساب می‌شود و همیشه با تاریخش نشان داده می‌شود. | (deleted) | The daily market value is already the third goal and the valuation section (R5) |
| `data-status-copy.ts` · HOW_STEPS.check.title | بررسی هر آگهی | بررسی دوباره | The step is only the recheck of an opened listing (R5) |
| `data-status-copy.ts` · HOW_STEPS.check.body | صفحه‌ی هر آگهیِ تازه یا تغییرکرده خوانده می‌شود، و آگهی‌ای که باز می‌کنید اگر چند ساعت از آخرین بررسی‌اش گذشته باشد دوباره بررسی می‌شود. | آگهی‌ای که باز می‌کنید، اگر چند ساعت از آخرین بررسی‌اش گذشته باشد، دوباره بررسی می‌شود. | Which pages the crawler reads is its business; opening a listing and the recheck is what a buyer sees (R7 R4) |
| `data-status-copy.ts` · lastRead | آخرین خواندن از منبع‌ها | آخرین داده‌ها از | One phrase for the date of the latest data in every state (the paused state already said «آخرین داده‌ها از») (R6) |
| `data-status-copy.ts` · sourceLastRead | آخرین خواندن | آخرین داده‌ها | The same phrase as the overview line above the sources: one word for the age of the latest data (R6) |

### 2.6 Error and not-found pages

- An error page is a title that says what happened, the reference code, and two buttons that are the way forward: no sentence repeats them. The 404 keeps one sentence, the cause (an address that changed or a listing taken down), because the three links are the way forward and the cause is the only thing they do not say.
- «مشکلی پیش آمد» is gone where more is known: a page that did not open says so, and a site that did not open says so.

| Where | Before | After | Why |
|---|---|---|---|
| `error.tsx` · description | این صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی ادامه دهید. | (deleted) | The title now says it did not open; «تلاش دوباره» and «صفحه‌ی اصلی» are the way forward and need no sentence (R5 R2) |
| `error.tsx` · <title> | مشکلی پیش آمد \| کارشناس | این صفحه باز نشد \| کارشناس | The document title says what the heading says (V5) |
| `error.tsx` · title | مشکلی پیش آمد | این صفحه باز نشد | «مشکلی پیش آمد» when more is known: the page did not open (V5 R2) |
| `error.tsx` · button | دوباره امتحان کنید | تلاش دوباره | The guide's word for the button (R6) |
| `global-error.tsx` · description | کارشناس باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، چند دقیقه بعد سر بزنید. | (deleted) | The title says what happened; the buttons say what to do; «چند دقیقه بعد» promised a time we do not know (R5) |
| `global-error.tsx` · <title> | مشکلی پیش آمد \| کارشناس | کارشناس باز نشد | The name is in the sentence already (V5) |
| `global-error.tsx` · title | مشکلی پیش آمد | کارشناس باز نشد | The whole site did not open: say that (V5) |
| `global-error.tsx` · button | دوباره امتحان کنید | تلاش دوباره | The guide's word for the button (R6) |
| `not-found.tsx` · description | شاید نشانی آن تغییر کرده یا آگهی آن حذف شده باشد. از صفحه‌ی اصلی دوباره جست‌وجو کنید. | شاید نشانی عوض شده یا آگهی برداشته شده باشد. | The three links are the way forward; «حذف» is not our word for a listing taken down (R5 R6) |
| `not-found.tsx` · link | بازگشت به صفحه‌ی اصلی | صفحه‌ی اصلی | One name for the home page, as the error pages and the model pages say it; a link says where it goes (R6) |
| `route-errors.ts` · ROUTE_ERROR_MESSAGE | مشکلی پیش آمد؛ دوباره امتحان کنید. | درخواست شما انجام نشد. دوباره امتحان کنید. | The generic answer of a failed request says what happened (the request) and what to do (V5 R4) |

### 2.7 Photo alt texts

- Six descriptions of what the photograph shows, each under ten words (the budget of an accessible name). The credit list shows the same text as the title of each item, so a sentence about colours and road names would be read twice.

| Where | Before | After | Why |
|---|---|---|---|
| `credits.json` · alt | غروب تهران: برج میلاد در آسمان نارنجی و بنفش و جریان خودروها روی بزرگراه | برج میلاد و ترافیک بزرگراه در غروب | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |
| `credits.json` · alt | خودروهای تهرانی در نور طلایی غروب روی بزرگراه حکیم | ترافیک بزرگراه حکیم در نور طلایی غروب | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |
| `credits.json` · alt | شب تهران: برج میلاد و رد نور خودروها روی بزرگراه‌های پیچ‌درپیچ | رد نور خودروها زیر برج میلاد در شب | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |
| `credits.json` · alt | خط افق تهران در غروب نارنجی با خورشید و برج میلاد | خط افق تهران و برج میلاد در غروب نارنجی | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |
| `credits.json` · alt | ترافیک شبانه‌ی میدان آزادی تهران، با برج آزادی در انتهای خیابان | ترافیک شب در میدان آزادی، با برج آزادی | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |
| `credits.json` · alt | نمای هوایی تهران در شب، با ماه کامل و رد نور خودروها روی بزرگراه | نمای هوایی تهران در شب، با ماه کامل | What the photograph shows in under 10 words; no colours of the sky, no road names beyond the one that places it (R4 R7) |

### 2.8 Unused strings deleted (17)

Nothing renders these: the copy files carried them from earlier designs (the same words for the model page links live in `search-copy.ts` and `listing-copy.ts`). Deleting them lowers what the next reader has to review.

| Where | Text |
|---|---|
| `home-copy.ts` · rows.label | مجموعه‌های آماده |
| `home-copy.ts` · how.unavailable | هنوز عددی برای نمایش نداریم. |
| `model-copy.ts` · home.openModel | صفحه‌ی {…} |
| `model-copy.ts` · siteTitle | کارشناس |
| `model-copy.ts` · hero.photoNote | عکس‌ها از آگهی‌های هر خودرو در صفحه‌ی خودش دیده می‌شود. |
| `model-copy.ts` · years.all | همه‌ی سال‌ها |
| `model-copy.ts` · trend.band | {…} میانی |
| `model-copy.ts` · trend.chartTitle | نمودار میانه‌ی قیمت آگهی‌ها به تفکیک روز |
| `model-copy.ts` · trend.yAxis | محور عمودی: قیمت به تومان |
| `model-copy.ts` · trend.change.label | تغییر میانه‌ی قیمت |
| `model-copy.ts` · trend.short.soFar | تا امروز |
| `model-copy.ts` · ratings.label | {…}: {…} |
| `model-copy.ts` · links (4 strings) | صفحه‌ی مدل / صفحه‌ی مدل {…}: قیمت و روند / بقیه‌ی آگهی‌های این مدل / روند قیمت {…} |
| `data-status-copy.ts` · howStep | گام |

## 3. Kept, with the reason

A string stays when it passes the ten rules read beside the others of its screen. The strings are grouped by the reason; the group's reason is the one-line reason of each string in it.

### 3.1 Home page (45)

**The name of the product.** (2)

- کارشناس `layout.tsx` · default
- کارشناس `home-copy.ts` · title

**The title template.** (1)

- %s \| کارشناس `layout.tsx` · template

**The names of the ten body types and of the car in each photograph, and the alt template** (21): data, in the glossary's words, from the catalogue. Types: سدان، هاچ‌بک، کراس‌اوور، شاسی‌بلند، وانت، ون، مینی‌ون، کوپه، کروک، استیشن. Cars: تویوتا کمری، فولکس‌واگن گلف، هیوندای توسان، تویوتا لندکروزر پرادو، تویوتا هایلوکس، تویوتا پروایس، کیا کارنیوال، هیوندای جنسیس کوپه، استون مارتین ونتیج رودستر، ولوو استیشن.

**A unit word or connector that a formatter joins to a number, a date or a name; one idea, no repeat** (3): «آگهی»، «دیدن همه‌ی {…}»، «از»

**The one headline of the home page: a promise tied to the price rating, said once, and nothing else on the page repeats it. Tone is the owner's call (section 7).** (1)

- ماشین درست را با قیمت درست بخرید `home-copy.ts` · motto

**The one button of the hero: a verb that names the result, the guide's word («جست‌وجو»).** (1)

- جست‌وجو `home-copy.ts` · submit

**The tab of the box that takes a sentence: the same word as its button.** (1)

- جست‌وجو `home-copy.ts` · search

**A link says where it goes, in the name the page gives itself.** (2)

- ارزیابی لینک `home-copy.ts` · paste
- همه‌ی مدل‌ها `model-copy.ts` · all

**The last tile mirrors the others (the type, then its count): the second line says all of what.** (2)

- همه `home-copy.ts` · label
- همه‌ی آگهی‌ها `home-copy.ts` · hint

**A verb that names the result (the guide, section 4).** (3)

- دیدن همه `home-copy.ts` · seeAll
- تلاش دوباره `home-copy.ts` · retry
- دیدن همه‌ی آگهی‌ها `home-copy.ts` · action

**A template whose numbers and dates a formatter fills; one idea per sentence.** (1)

- دیدن همه‌ی آگهی‌های «{…}» `home-copy.ts` · seeAllOf

**A title of a few words that names the section or says what is empty; its lead does not repeat it.** (5)

- مجموعه‌های دیگر `home-copy.ts` · title
- کارشناس چطور کار می‌کند؟ `home-copy.ts` · title
- آگهی‌ها را می‌خوانیم `home-copy.ts` · title
- ارزش بازار را حساب می‌کنیم `home-copy.ts` · title
- مدل‌های پرطرفدار `model-copy.ts` · title

**A label, caption or short fact in the glossary's words; one idea.** (2)

- ارزش‌های بازار برای `home-copy.ts` · valuedOn
- همه‌ی اعداد و تازگی داده‌ها `home-copy.ts` · status

### 3.2 Header, footer and credits (16)

**A link says where it goes, in the name the page gives itself.** (5)

- جست‌وجو `header-nav.tsx` · label
- ارزیابی لینک `header-nav.tsx` · label
- جست‌وجوی خودرو `home-copy.ts` · search
- تازگی داده‌ها `home-copy.ts` · status
- مدل‌های خودرو `home-copy.ts` · models

**The accessible name of a navigation: what it is, as a noun phrase.** (2)

- پیمایش اصلی `header-nav.tsx` · aria-label
- پایین صفحه `home-copy.ts` · label

**The name of the product.** (1)

- کارشناس `site-header.tsx` · BRAND_NAME

**A unit word or connector that a formatter joins to a number, a date or a name; one idea, no repeat** (3): «همه‌ی عکس‌ها از»، «و با پروانه‌ی»، «، عکس از»

**A label, caption or short fact in the glossary's words; one idea.** (5)

- پلاک‌ها محو شده‌اند `home-copy.ts` · plates
- برش و تغییر اندازه `home-copy.ts` · changes
- عکس از `home-copy.ts` · by
- تغییرها: `home-copy.ts` · changed
- پروانه: `home-copy.ts` · licence

### 3.3 Models index (11)

**A unit word or connector that a formatter joins to a number, a date or a name; one idea, no repeat** (4): «آگهی» ×3، «مدل»

**A title of a few words that names the section or says what is empty; its lead does not repeat it.** (2)

- مدل‌های خودرو `model-copy.ts` · title
- مدل‌های پرطرفدار `model-copy.ts` · popularTitle

**A meta description: one sentence that names what the page holds (it is shown beside a search result, apart from the page).** (1)

- قیمت و روند بازار هر مدل خودرو، از آگهی‌های امروز: ارزش بازار، محدوده‌ی قیمت و بهترین معامله‌ها. `model-copy.ts` · metaDescription

**One idea, answer first; not repeated by another string of its screen.** (1)

- مدل‌هایی که بیشترین آگهی را دارند. `model-copy.ts` · popularLead

**«هنوز» about data that will exist, with the next step on the screen (guide, section 3; `patterns.md`, R8): the lint's warning is read and kept.** (1)

- هنوز مدلی با آگهی نداریم `model-copy.ts` · title

**A label, caption or short fact in the glossary's words; one idea.** (2)

- عکس نمونه `model-copy.ts` · sample
- میانه‌ی قیمت `model-copy.ts` · median

### 3.4 Model pages (86)

**A unit word or connector that a formatter joins to a number, a date or a name; one idea, no repeat** (23): «{…} تا {…}» ×2، «{…} در بازار»، «آگهی» ×11، «دیدن {…}» ×2، «در {…}»، «{…} میانی»، «روز» ×4، «{…} داریم»

**A template whose numbers and dates a formatter fills; one idea per sentence.** (9)

- مدل{…}{…} `model-copy.ts` · modelYear
- دیدن {…} {…} `model-copy.ts` · seeAllOfYear
- بیشترین آگهی: {…} `model-copy.ts` · yearsHelp
- آگهی‌های {…} `model-copy.ts` · cohort
- {…} میانیِ قیمت‌ها `model-copy.ts` · legendBand
- تاریخچه از {…} است. `model-copy.ts` · sinceDay
- میانه و محدوده‌ی قیمت آگهی‌های {…} در هر روز `model-copy.ts` · tableCaption
- نسبت به {…} پیش `model-copy.ts` · over
- بهترین معامله‌های {…} `model-copy.ts` · titleOfYear

**A title of a few words that names the section or says what is empty; its lead does not repeat it.** (9)

- {…}، قیمت و روند بازار `model-copy.ts` · title
- این مدل پیدا نشد `model-copy.ts` · notFoundTitle
- روند قیمت `model-copy.ts` · title
- بهترین معامله‌های این مدل `model-copy.ts` · title
- ارزیابی قیمت آگهی‌ها `model-copy.ts` · title
- تیپ‌ها `model-copy.ts` · title
- آگهی‌ها چه می‌گویند `model-copy.ts` · title
- الان آگهی‌ای از این مدل نداریم `model-copy.ts` · title
- آگهی‌ای از {…} نداریم `model-copy.ts` · emptyTitle

**A meta description: one sentence that names what the page holds (it is shown beside a search result, apart from the page).** (1)

- ارزش بازار، محدوده‌ی قیمت و روند قیمت {…} از آگهی‌های امروز، با بهترین معامله‌های این مدل. `model-copy.ts` · description

**A link says where it goes, in the name the page gives itself.** (2)

- فهرست مدل‌ها `model-copy.ts` · allModels
- جست‌وجوی خودرو `model-copy.ts` · searchInstead

**The accessible name of a navigation: what it is, as a noun phrase.** (1)

- مسیر صفحه `model-copy.ts` · label

**A label, caption or short fact in the glossary's words; one idea.** (30)

- مدل‌ها `model-copy.ts` · models
- مدل پرطرفدار `model-copy.ts` · popular
- میانه‌ی قیمت آگهی‌ها `model-copy.ts` · median
- محدوده‌ی قیمت `model-copy.ts` · range
- ارزش بازار `model-copy.ts` · value
- کارکرد معمول `model-copy.ts` · mileage
- سال‌های ساخت `model-copy.ts` · years
- میانه‌ی قیمت آگهی‌ها `model-copy.ts` · median
- میانه‌ی قیمت آگهی‌ها `model-copy.ts` · legendLine
- هر نقطه یک روز است. `model-copy.ts` · daily
- جدول عددهای نمودار `model-copy.ts` · tableSummary
- تاریخ `model-copy.ts` · date
- تعداد آگهی `model-copy.ts` · count
- میانه‌ی قیمت `model-copy.ts` · median
- ارزش بازار `model-copy.ts` · value
- تقریباً بدون تغییر `model-copy.ts` · flat
- گران‌تر شده `model-copy.ts` · rise
- ارزان‌تر شده `model-copy.ts` · fall
- ثبت‌های تا امروز `model-copy.ts` · listed
- بدون ارزیابی `model-copy.ts` · unrated
- سال ساخت `model-copy.ts` · year
- میانه‌ی قیمت `model-copy.ts` · median
- کارکرد معمول `model-copy.ts` · mileage
- سال انتخاب‌شده `model-copy.ts` · current
- تیپ نامشخص `model-copy.ts` · unnamed
- میانه‌ی قیمت `model-copy.ts` · median
- بدون رنگ‌شدگی `model-copy.ts` · paintFree
- گیربکس اتوماتیک `model-copy.ts` · automatic
- فروشنده‌ی شخصی `model-copy.ts` · privateSeller
- در حال بارگذاری اطلاعات مدل `model-copy.ts` · loading

**A noun, one idea.** (3)

- قیمت این مدل امروز `model-copy.ts` · label
- سال ساخت `model-copy.ts` · label
- تیپ `model-copy.ts` · name

**One fact in a few words.** (2)

- نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از آن هستند. `model-copy.ts` · medianHelp
- میانه‌ی کارکرد اعلام‌شده `model-copy.ts` · mileageHelp

**A verb that names the result (the guide, section 4).** (3)

- بستن `model-copy.ts` · close
- دیدن همه‌ی آگهی‌ها `model-copy.ts` · seeAll
- دیدن آگهی‌های دیگر `model-copy.ts` · action

**«هنوز» about data that will exist, with the next step on the screen (guide, section 3; `patterns.md`, R8): the lint's warning is read and kept.** (2)

- برای {…} پیش هنوز تاریخچه نداریم `model-copy.ts` · notYet
- تاریخچه‌ی قیمت هنوز کوتاه است `model-copy.ts` · title

**One idea, answer first; not repeated by another string of its screen.** (1)

- آگهی‌ای از این مدل برای نمایش نداریم. `model-copy.ts` · empty

### 3.5 Status page (51)

**A title of a few words that names the section or says what is empty; its lead does not repeat it.** (10)

- تازگی داده‌ها `data-status-copy.ts` · title
- منبع‌ها `data-status-copy.ts` · sourcesTitle
- میانه‌ی زمان از آخرین بررسی، ساعت به ساعت `data-status-copy.ts` · chartTitle
- ارزش بازار `data-status-copy.ts` · valuationTitle
- دقت ارزش بازار، مدل به مدل `data-status-copy.ts` · accuracyTitle
- خواندن متن آگهی‌ها `data-status-copy.ts` · extractionTitle
- آگهی‌ها چطور تازه می‌مانند `data-status-copy.ts` · howTitle
- آگهی تازه در کمتر از یک ساعت `data-status-copy.ts` · title
- نتایج جست‌وجو تازه‌تر از یک روز `data-status-copy.ts` · title
- پیدا کردن آگهی‌های تازه `data-status-copy.ts` · title

**A label, caption or short fact in the glossary's words; one idea.** (21)

- زمان این گزارش: `data-status-copy.ts` · measuredAt
- آخرین داده‌ها از `data-status-copy.ts` · latestData
- جمع‌آوری آگهی‌ها از `data-status-copy.ts` · indexSince
- آگهی فعال `data-status-copy.ts` · active
- آگهی تازه `data-status-copy.ts` · posted
- زمان از آخرین بررسی `data-status-copy.ts` · checkAge
- آگهی‌ای در نتایج نیست `data-status-copy.ts` · noShown
- آگهی فعال `data-status-copy.ts` · sourceActive
- میانه‌ی زمان از آخرین بررسی `data-status-copy.ts` · sourceCheckAge
- خط‌چین: هدف نتایج جست‌وجو، کمتر از یک روز `data-status-copy.ts` · chartTarget
- عددهای نمودار `data-status-copy.ts` · chartTable
- میانه `data-status-copy.ts` · chartAge
- آگهی فعال `data-status-copy.ts` · chartActive
- ارزش‌های بازار برای `data-status-copy.ts` · valuationDate
- خودروی مشابه `data-status-copy.ts` · comparables
- خودروی مشابه `data-status-copy.ts` · modelComparables
- آگهی‌ها پیوسته از منبع تازه می‌شوند `data-status-copy.ts` · live
- تازه شدن آگهی‌ها کمی عقب است `data-status-copy.ts` · delayed
- به‌روز `data-status-copy.ts` · live
- با تأخیر `data-status-copy.ts` · delayed
- اندازه‌گیری نشده `data-status-copy.ts` · unmeasured

**One fact in a few words.** (1)

- اکنون روی بازار `data-status-copy.ts` · activeHint

**A unit word or connector that a formatter joins to a number, a date or a name; one idea, no repeat** (13): «در {…} گذشته» ×2، «است.»، «{…} پیش»، «اکنون»، «ساعت» ×3، «تا»، «، بسته به مدل.»، «از»، «دقیقه»، «روز»

**One idea, answer first; not repeated by another string of its screen.** (1)

- رفته از بازار `data-status-copy.ts` · gone

**A template whose numbers and dates a formatter fills; one idea per sentence.** (4)

- تازه در {…} گذشته `data-status-copy.ts` · sourcePosted
- رفته از بازار در {…} گذشته `data-status-copy.ts` · sourceGone
- در همه‌ی آگهی‌های فعال این منبع، در {…} گذشته. `data-status-copy.ts` · chartLead
- نتایج فقط آگهی‌هایی را نشان می‌دهند که در {…} گذشته دیده یا بررسی شده‌اند. میانه‌ی زمان از آخرین بررسی‌شان: `data-status-copy.ts` · body

**A verb that names the result (the guide, section 4).** (1)

- تلاش دوباره `data-status-copy.ts` · retry

### 3.6 Error and not-found pages (7)

**A link says where it goes, in the name the page gives itself.** (4)

- صفحه‌ی اصلی `error.tsx` · <ActionLink>
- صفحه‌ی اصلی `global-error.tsx` · <ActionLink>
- مدل‌های خودرو `not-found.tsx` · <ActionLink>
- جست‌وجوی خودرو `not-found.tsx` · <ActionLink>

**A title of a few words that names the section or says what is empty; its lead does not repeat it.** (2)

- صفحه پیدا نشد `not-found.tsx` · title
- این صفحه پیدا نشد `not-found.tsx` · title

**The glossary's word for the reference code (ADR-0016).** (1)

- کد پیگیری `error-reference.tsx` · ERROR_REFERENCE_LABEL

## 4. The warnings kept on purpose

`pnpm copy:lint --warnings` on the 21 files finds 8 warnings after the rewrite (50 before). All are «هنوز» about data that will exist, with the next step on the screen (guide, section 3; `patterns.md`, R8), and none describes what the product cannot do:

| Where | Text | Why it stays |
|---|---|---|
| `data-status-copy.ts` · noData | هنوز آگهی‌ای نداریم. | The first reading has not happened; the state ends by itself |
| `data-status-copy.ts` · noSources | هنوز منبعی نداریم. | The same |
| `data-status-copy.ts` · noValuation | ارزش بازار هنوز حساب نشده است. | The valuation runs every day |
| `data-status-copy.ts` · noExtraction | هنوز اندازه‌گیری‌ای نداریم. | No measurement is published yet; it will be |
| `model-copy.ts` · stats.valueNone | هنوز حساب نشده است | Under «ارزش بازار»: the daily valuation has not reached these listings |
| `model-copy.ts` · trend.change.notYet | برای {…} پیش هنوز تاریخچه نداریم | The history is as long as the days since the valuation began, and grows by a day |
| `model-copy.ts` · trend.short.title | تاریخچه‌ی قیمت هنوز کوتاه است | The body says how many days the chart needs and how many there are |
| `model-copy.ts` · index.empty.title | هنوز مدلی با آگهی نداریم | The body says what fills the list |

The `copy-fa` scan (`references/review.md`) over the changed lines has two more hits, both read and kept: **V1** on the hero chip «یه ماشین تمیز و بی‌دردسر می‌خوام» (a sentence the buyer types, shown as typed: guide, section 2, point 2, and the V1 exception) and **T8, R5** on `route-errors.ts` («درخواست شما انجام نشد. دوباره امتحان کنید.»: the generic answer of any failed request, where the person did not cause the failure and the next sentence says what to do; there is no retry button beside it to repeat).

## 5. Structure touched, and why

The brief is strings only. Deleting a string means its one rendering line goes with it, and a few strings are read by a shared component. Nothing is renamed, moved or added except the one key; every constant that a component or a test imports keeps its name.

| File | What | Why |
|---|---|---|
| `components/layout/status-screen.tsx` | `description` is optional; the paragraph renders only when there is one | The two error pages and the model not-found page say it in the title and the buttons (R5) |
| `features/model/components/section-boundary.tsx` | no `body` prop, no paragraph | Every failure of a section is its title and the retry button |
| `features/model/components/model-screen.tsx` | `Empty` takes an optional body; the failure calls lose their `body`; the trims section uses its own failure title | The empty year says it in the title and the button; the trims failure named the deals |
| `features/model/components/models-screen.tsx`, `trend-section.tsx`, `year-chips.tsx` | one `body`, one badge, one «tomorrow» line, one instruction line removed | Each repeated an idea of its own screen |
| `features/home/components/home-browse.tsx` | the body types lead and its placeholder line in the skeleton | The skeleton keeps the frame of the real page, so nothing moves |
| `features/home/components/closing-cta.tsx`, `trust-boundary.tsx`, `hero-photo-credits.tsx` | a body, a failure body, a lead and a «credit is required» parenthesis removed; `؛` became a full stop | R5, R7 |
| `app/(site)/status/page.tsx`, `features/data-status/components/data-status-boundary.tsx` | the «numbers» line and the failure body removed | R7, R5 |
| `features/data-status/components/source-card.tsx`, `extraction-section.tsx` | the request-budget fact and the figure of listings held back for hidden instructions removed | R7: the crawler's budget and a defence against attacks on the reader are not for a buyer. The strip stays three columns wide, as it already was when that figure was absent |
| `hero-photos.tsx`, `catalogue-row.tsx`, `status-overview.tsx` | « · » joiners became «،» | A middle dot beside a digit reads as a zero (the guide, section 6; the lint refused them) |
| `features/model/model-copy.ts` | one key added: `trims.error.title` | The trims section had no failure words and borrowed the deals' |

Not done, for the coordinator (they change the layout or other areas; section 8):

- The «how listings stay fresh» aside of the status page still repeats the goals above it, now in two steps. It would go entirely if the page lost the aside and its two-column grid.
- The data-status loaders still compute `dailyRequestBudget`, `injectedItems` and `injectedHeld`, which no screen shows now.
- `FigureStrip` has no two-column variant, so the extraction strip (two figures) has an empty third cell.
- The titles of the three freshness goals and the chart legend say their thresholds in words («یک ساعت», «یک روز»), as before; `data-status-rules.ts` holds the numbers. Building the titles from them (R10) needs phrases per unit, which is a structure change.

## 6. Tests

No test weakened, no timeout raised, no retry added.

- **Unit, changed**: `app/error.test.tsx`, `app/global-error.test.tsx` (also asserts the new title), `app/not-found.test.tsx`. The inline pages have no copy constant, so the tests carry the new wording (the half-space was written from a placeholder and checked).
- **Unit, run** (`vitest run` on the folders that import the copy constants: `src/app` error and not-found tests and the home page test, `features/home`, `features/data-status`, `features/model`, `features/body-types`, `server/observability/route-errors.test.ts`): 16 files, 63 tests, all pass (12.7 s). `pnpm copy:test` (the lint's own tests): 126 of 126 pass.
- **Typecheck**: `pnpm typecheck` in `apps/web` (`next typegen` and `tsc --noEmit`), run once after the last code edit: exit 0. `pnpm check` (the whole repository) was not run: the machine was loaded and the brief says one `pnpm check` at most, and only when it is not.
- **Browser specs, changed but not run** (the verification rules of 2026-10-04: no Playwright): `e2e/fixtures/smart-search.ts` (the hero chips and the name of their list, the shared mirror of `home-copy.ts`), `tests/app/home.spec.ts`, `data-status.spec.ts`, `model-page.spec.ts`, `scroll-rails.spec.ts`, `status-pages.spec.ts`, `listing.spec.ts`, `observability.spec.ts`, and `button-labels.spec.ts` (it still looked for the button «بفهم», which the one-step search of CS-111 already renamed «جست‌وجو»). `body-types.spec.ts` needs no change: its locator `منبع عکس‌ها` is a prefix of the new name «منبع عکس‌های نمونه», and that page has no other credit list.
- **Visual baseline**: `e2e/tests/app/__screenshots__/{desktop,mobile}/status-pages.spec.ts/not-found.png` changes with the 404 page (no description, one link renamed). Re-make it with `pnpm e2e:visual -u` in the official container.
- **Screenshots at 412 and 1440** (acceptance criterion 4) and the **Playwright pass on phone and desktop** (criterion 5) are not done here, by the same rule; the structure touches above are what can move a layout (the removed lines are all text paragraphs, the status strip keeps its columns).

## 7. Left for you to check (taste)

I judged none of these against a native ear; they are choices between correct wordings or tone calls:

1. The home headline **«ماشین درست را با قیمت درست بخرید»** is kept. It could sit on any dealer's page (R2), but it is the one promise of the page, tied to the price rating, and nothing repeats it; the guide kept it too.
2. The chip **«یه ماشین تمیز و بی‌دردسر می‌خوام»** is spoken on purpose: it is what a buyer types, and the label above it («چه ماشینی می‌خواهید؟») is the question it answers. If the page should never show a spoken form, «یک ماشین تمیز و بی‌دردسر می‌خواهم» works instead (checked: the code reads it into the same filters).
3. **«امروز در کارشناس»** (the guide's) against «اعداد امروز» above the figures.
4. **«کارشناس باز نشد»** on the page that replaces the whole site: the name as the subject of a failure, where the guide wants the name kept out of subject position. «سایت باز نشد» is the alternative.
5. **«فرق معمول»** for the market value's accuracy (it was «خطای میانه»), and **«مورد درست خوانده شد»** («مورد» is vague, but it was «واقعیت»).
6. **«به هدف رسیده / به هدف نرسیده»** as the verdict badges of the three freshness goals.
7. **«شروع کار»** as the name of the hero's two tabs; **«نوع بدنه»** as the title of the body-type tiles (the filter's own word) where it was «بر اساس شکل خودرو».
8. Three pages have no description under their title (both error pages and the model not-found page), and the home page's closing call has no body. If one feels bare, the sentence to add back is in the Before column.
9. «آگهی ارزیابی‌شده» and «آگهی ارزش‌گذاری‌شده» now stand near each other on the status page; they are two different figures (rated, valued), and the words differ by one syllable.

## 8. For other areas

Strings in files I may not edit, and what my area now does that they should match.

**B (CS-107)**

- `search-copy.ts` · `error` is also the failure of the home page's catalogues (`BrowseBoundary`): when its body goes (guide E35) the home failure becomes a title and a retry, like every other failure of this area. Its retry says «دوباره امتحان کنید»; the guide's button is «تلاش دوباره».
- `search-copy.ts` · `info.close` is «بستن توضیح», the model page's is «بستن» (R6; the guide says «بستن»).
- `search-copy.ts` and `listing-copy.ts` hold the same «صفحه‌ی مدل … : قیمت و روند» strings that `MODEL_COPY.links` had (unused there, deleted here).

**C (CS-108) and D (CS-109)**

- A page or section that fails to load says «… بارگذاری نشد» here, because «خواندن» is how we read the sites. `search-files-copy.ts` (`errorTitle`, `resultsFailedTitle`), `crawl-requests-admin-copy.ts`, `tracked-models-admin-copy.ts`, `model-photos-admin-copy.ts` still say «… خوانده نشد».
- «پایگاه داده پاسخ نداد …» is in `search-files-copy.ts`, in the admin copy and in `check-copy.ts` (CS-115, guide E28); the lint refuses it.

**E (CS-110)**

- `model-info.ts`: the title of the by-year popover is «قیمت به تفکیک سال ساخت»; the section it explains is «قیمت هر سال ساخت» now, and the button's name is `توضیح درباره‌ی «قیمت هر سال ساخت»`. The popovers still carry the method the guide cuts (E57 to E59: the 10 and 90 percent, the rows for a point, the band, days and weeks, the chart, a change).
- `catalogues.ts`: the home row prints «۴۲ آگهی، {description}», so a description that starts with «آگهی‌هایی که …» repeats the word, and «معامله‌ی عالی» «که کارشناس … ارزیابی کرده» puts the name in subject position.

**The coordinator**

- Run `pnpm copy:lint --update-baseline` and `pnpm copy:inventory` after the merges (this lane touched neither the baseline nor the plan).
- Add the words below to the guide's section 4 when the lanes are merged; the guide asks a rewrite task to add them in its own commit, which would make five lanes edit one table.
- The remaining structure follow-ups are in section 5.
- Where this lane can collide with the running ones: `features/model/components/` (CS-113 changes the tiles and the photos: this lane only removed text paragraphs and made `SectionBoundary` take a title alone), `home-copy.ts` and `e2e/fixtures/smart-search.ts` (the hero chips: if another lane changes an example, keep both sides' intent and the one rule that an example must be read whole by the code: run it through `understandQuery` with `fixtureLexicon()`), and `e2e/tests/app/home.spec.ts`.

## 9. Words settled by this lane (for section 4 of the guide)

| Idea | Write | Never |
|---|---|---|
| a page or a section that failed to load | «… بارگذاری نشد» and [تلاش دوباره] | «… خوانده نشد» («خواندن» is how we read the sites) |
| the home page, as a link or a crumb | «صفحه‌ی اصلی» | «خانه», «بازگشت به صفحه‌ی اصلی» |
| the body type | «نوع بدنه» | «شکل خودرو» |
| the credit of a photograph | «منبع عکس‌ها», «عکس از …» | «اعتبار عکس‌ها», «عکس:» |
| a freshness goal of the status page | «هدف», «به هدف رسیده / نرسیده» | «تعهد», «برآورده», «هنوز نه» |
| how far the market value is from the asking prices | «فرق معمول» (with the listing prices) | «خطای میانه» |
| an item read correctly from a listing text | «مورد درست خوانده شد» | «واقعیت درست خوانده شد» |
| a source that is not being read | «به‌روز نمی‌شود» | «فعلاً خوانده نمی‌شود» |
| a rated or valued listing under a number | «آگهی ارزیابی‌شده», «آگهی ارزش‌گذاری‌شده» | «آگهی ارزیابی قیمت گرفت» |
| the name of an info control | «توضیح درباره‌ی «{title of the section}»» | the same words without «», or a name that is not the title |
| a chip with a count | «۱۴۰۰، ۱۲ آگهی» | «۱۴۰۰ (۱۲ آگهی)» |

## 10. Self-review

Done with `.claude/skills/copy-fa/references/review.md` (the idea table per screen, the scan over the changed lines, the checklist), not by the `copy-reviewer` agent: a lane cannot start a reviewer (the brief), so that pass and its «no blocking finding» belong to the coordinator.

- **R1, R2, R7**: no «!»; none of «پایگاه داده», «سرور», «هوش مصنوعی», «پوشش‌داده‌شده», «تعهد», «مرور», «خزش», «ظرفیت», «سقف», «نسخه», «برآورد», «خطای میانه», «واقعیت», «برچسب», «فعلاً», «لطفاً», «متأسفانه», «ممکن است», «پیوند», «حذف», «مشاهده» is left in a buyer string of the area (a search over the 339 strings; «صف» only inside «صفحه»). Every figure still comes from a formatter or a rule constant: no number was typed except the buyer's own example queries in the hero chips.
- **R3, R4**: the answer comes first in every rewritten sentence; the longest sentence is under 20 words; the area has no «؛» and no parenthesis left in its strings.
- **R5**: each screen was written down as a set; the repeats found and cut are the rows with R5 in section 2 (the intro and the first step, the description and the intro, the lead of the status page and its «numbers» line, the retry sentence beside a retry button on seven failures, the badge and the note of the trend, the instruction beside the chips and the tiles, the three promises told again by the steps).
- **R6**: the words table above; «خواندن» now only means reading the sites or the listing text, «بارگذاری» means a page loading, «ارزیابی» only the price rating.
- **R8, R9**: buttons are verbs («تلاش دوباره», «دیدن …»); a limit is a fact with a way forward (the trend that is too short says how many days it needs); no «من», no «تو», no clerk's verbs; the one spoken form is the buyer's own typed words.
- **R10**: `pnpm copy:lint` finds 0 violations; every added word was compared with how the repository already spells it (no mismatch; the new words are listed in the scratch check and look right: «ارزان‌ترند», «ارزش‌گذاری‌شده», «اندازه‌گیری‌ای», «نمونه‌های», «هدف‌ها»).
- **Read aloud**: each screen as a set after the rewrite. The pairs that sound alike and are different are in section 7.
