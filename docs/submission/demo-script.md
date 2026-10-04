# The five-minute demo script

For the owner, who records once. The video shows the problem, the product and the important decisions (`docs/product/challenge.md`) in **at most five minutes**, in the order CS-75 asks for: the problem, a plain-Farsi search, a listing with its explanation and its similar listings, a pasted live link, how fresh the index is, the pipeline with its measured accuracy and valuation error, and the key decisions, **the data decision first**.

- **Scope is Divar only.** No second source and no duplicates across sites appear in the story, except as what was left out.
- **Two languages.** The narration is Farsi, written in the product's voice (`docs/design/product-voice.md`): calm, plain, no hype. Each scene has an English cue that says the same, for subtitles or an English cut.
- **`[[…]]`** marks a figure to read off the screen on the day. The 2026-10-04 value is in the brackets as an example; `numbers.md` says where each one comes from and which command prints it.
- **What is on screen** is in `shot-list.md`, with the exact sentences, links and listings.
- Practise with `pnpm e2e:demo` first (`recording-day.md`): it walks every scene and saves the screenshots.

## The clock

| Time | Scene | On screen | Words |
|---|---|---|---|
| 0:00 to 0:30 | 1. The problem | the home page | 63 |
| 0:30 to 1:10 | 2. A plain-Farsi search | the sentence, the chips, the ranked results | 61 |
| 1:10 to 2:05 | 3. A listing and its explanation | the gauge, the reasons, the comparables, a price drop, an unrated listing | 104 |
| 2:05 to 2:30 | 4. A pasted live link | the box, the answer | 35 |
| 2:30 to 3:00 | 5. How fresh the index is | `/status` | 55 |
| 3:00 to 4:00 | 6. The pipeline and its measured accuracy | the picture, `/status`, two commands | 119 |
| 4:00 to 4:45 | 7. The decisions, the data decision first | the decision records | 97 |
| 4:45 to 5:00 | 8. The close | the README | 27 |

About 560 words of narration (the lines that start with `>`). At 125 words a minute that is 4:30 of speech; the other 30 seconds are the pauses while the screen changes. Scenes 1, 2 and 7 are the fastest at 130 words a minute: read them first when rehearsing. Record each scene as its own take and cut them together: a mistake costs one scene, not five minutes.

## 1. The problem · 0:00 to 0:30

**On screen.** The home page: the Tehran photograph, the box. At 0:22 click the tab «ارزیابی لینک» and back.

**Say (Farsi).**

> قیمت خودروی کارکرده در ایران هر هفته عوض می‌شود. چیزی که بیشتر از کارکرد روی قیمت اثر دارد، یعنی رنگ‌شدگی بدنه، فقط لابه‌لای متن آگهی است. خریدار لینک یک آگهی دیوار را در دست دارد و می‌پرسد: این قیمت منصفانه است؟ کارشناس همین را جواب می‌دهد. ارزش بازار هر خودرو را حساب می‌کند، قیمت آگهی را با آن می‌سنجد و دلیلش را می‌نویسد.

**Cue (English).** Used-car prices in Iran move every week. What moves a price more than mileage, the paint work on the body, sits only in the ad's text. A buyer holds a Divar link and asks: is this price fair? Carshenas answers that: it works out each car's market value, measures the asking price against it, and writes the reason.

**Do not.** Show Divar's own page with an ad on it.

## 2. A plain-Farsi search · 0:30 to 1:10

**On screen.** Type `۲۰۶ تیپ ۲ بدون رنگ زیر ۱ میلیارد` in the hero's box and press Enter. The results page opens with four chips and the best deals first. Click the × on «بدون رنگ», watch the count change, press Back. For four seconds, the same search on a phone-sized window.

**Say (Farsi).**

> جمله را همان‌طور که می‌گویید می‌نویسید. فیلترهایی که از جمله درمی‌آید بالای نتیجه‌ها می‌آید و هر کدام را می‌شود برداشت. نتیجه‌ها از بهترین معامله شروع می‌شود. جمله را اول کد می‌خواند و فقط برای آنچه کد نمی‌فهمد سراغ مدل زبانی می‌رود. روی ۲۷۰ جمله‌ی برچسب‌خورده، کد به‌تنهایی ۹۵٪ را درست خوانده است؛ روی ۱۳۳ جمله‌ای که برای آزمون کنار گذاشتیم، ۹۲٪.

**Cue (English).** Write the sentence the way you would say it. The filters that come out of it appear above the results, and each can be taken off. Results start with the best deal. Code reads the sentence first and asks a language model only about what code cannot understand. On 270 labelled sentences code alone reads 95 % right; on the 133 we set aside for testing, 92 %.

**Numbers.** N21 (95.2 %, 92.5 %). With the model it is 96.7 % and 93.2 % (N22): say them only if there is time.

**Do not.** Say the model reads every sentence (it does not), or that 95 % is the accuracy of the ratings (it is the accuracy of reading a sentence).

## 3. A listing and its explanation · 1:10 to 2:05

**On screen.** The first result, a great deal: price, the badge, the gauge with its marker, «چرا این ارزیابی؟», the ten comparables. Then a listing with a price drop (the history). Then an instalment sale that is not rated, with the reason on the page.

**Say (Farsi).**

> این ۲۰۶ را [[۹۹۵]] میلیون تومان گذاشته‌اند. ارزش بازارش [[۱٬۱۵۰]] میلیون حساب شده، پس قیمت [[۱۴٪]] پایین‌تر است: «معامله‌ی عالی». زیر نمودار دلیلش نوشته شده: ارزش بازار از چند آگهی مشابه درآمده و سال ساخت و کارکرد چقدر اثر داشته. ده آگهی مشابه همین‌جا هست و قیمتشان را می‌بینید. این متن را الگو می‌سازد، نه مدل زبانی، و هر عددش از پایگاه داده می‌آید. ۲۸۱ جمله از ۲۸۱ جمله را در SQL دوباره حساب کردیم و همه درست بود. این آگهی [[۵٪]] ارزان شده و تاریخچه‌ی قیمتش پیداست. این یکی قسطی است و قیمتش مثل پیش‌پرداخت است، پس ارزیابی نمی‌کنیم و دلیلش را می‌نویسیم.

**Cue (English).** This 206 is listed at [[995]] million tomans. Its market value is worked out as [[1,150]] million, so the price is [[14 %]] under: a great deal. The reason is written under the gauge: the value comes from several similar listings, and the model year and mileage each moved it by so much. Ten similar listings are right here with their prices. Templates write this text, not a language model, and every number comes from the database. We recomputed all 281 sentences of 281 in SQL and every one was right. This ad dropped its price by [[5 %]], and its price history shows it. This one is an instalment sale priced like a down payment, so we do not rate it, and we write why.

**Numbers.** N26 (281 of 281, from a sample of 30 listings).

**Do not.** Open a listing whose line under the price says a re-check is queued without saying so: it is the product, and it is honest, but a viewer reads it as lag. Prefer a listing checked in the last six hours (`shot-list.md`).

## 4. A pasted live link · 2:05 to 2:30

**On screen.** The home page's tab «ارزیابی لینک» (or `/check`). Paste the link of an ad posted today. The answer: the car, the price, the verdict, the gauge, «آخرین بررسی» and the market value's date.

**Say (Farsi).**

> حالا لینک یک آگهی دیوار که امروز گذاشته‌اند. لینک را می‌چسبانیم و ارزیابی چند ثانیه بعد اینجاست. این جواب از داده‌های خود ما می‌آید. زمان آخرین بررسی آگهی و تاریخ ارزش بازار هم کنارش است.

**Cue (English).** Now the link of a Divar ad posted today. We paste it and the rating is here a few seconds later. The answer comes from our own data. The time of the ad's last check and the date of the market value are beside it.

**`TODO-08`.** When CS-117 lands, an ad we have not read is read at once through the crawler's own lane, and this scene may say so: «اگر آگهی را نخوانده باشیم، خزنده آن را با اولویت می‌خواند و جواب همین‌جا می‌آید.» Until then the live link must be an ad the index already holds (`shot-list.md`, scene 4).

**Do not.** Say the site fetches the ad when you paste: today it does not, and with CS-117 the worker does, not the site.

## 5. How fresh the index is · 2:30 to 3:00

**On screen.** `/status`: the state line, the four figures, the three targets, the hourly chart.

**Say (Farsi).**

> این صفحه برای همه باز است. اکنون [[۲۶ هزار]] آگهی فعال تهران روی بازار است؛ در ۲۴ ساعت گذشته [[بیش از هزار]] آگهی تازه آمده و [[۱۴]] آگهی رفته. هدف‌های تازگی را هر ساعت می‌سنجیم و به یکی هنوز نرسیده‌ایم: آگهی تازه باید در کمتر از یک ساعت برسد و میانه‌ی ما [[۳]] ساعت است.

**Cue (English).** This page is open to everyone. [[26 thousand]] active Tehran listings are on the market now; in the last 24 hours [[over a thousand]] new ones arrived and [[14]] left. We measure the freshness targets every hour, and one is still missed: a new listing should arrive in under an hour, and our median is [[3]] hours.

**Numbers.** N01 to N06. Say the miss as the page shows it: a target met and a target missed on the same screen is the proof that the page does not flatter.

**Do not.** Quote the line «… از … آگهیِ فعالِ مدل‌های پوشش‌داده‌شده … در نتایج می‌آیند» (`open-items.md`, F1).

## 6. The pipeline and its measured accuracy · 3:00 to 4:00

**On screen.** `docs/assets/architecture.svg`; then `/status` scrolled to the valuation accuracy and the reading of listing text; then two terminal commands, `pnpm --filter @carshenas/ai query-understanding:code-only` and the extraction re-score (`shot-list.md`, scene 6).

**Say (Farsi).**

> هر آگهی پنج مرحله را می‌گذراند: خواندن از دیوار، مرتب کردن، ارزش‌گذاری، رتبه‌بندی و توضیح. مدل زبانی فقط متن آگهی را می‌خواند: رنگ‌شدگی، قطعه‌ی تعویضی، شاسی، قسطی یا توافقی بودن. روی ۱۱۷ آگهی که با دست برچسب خورده، ۹۹٫۸٪ واقعیت‌ها درست خوانده شد؛ روی ۶۶ آگهی که برای آزمون کنار گذاشته بودیم، ۷۹۱ از ۷۹۲. یازده آگهی که به مدل دستور می‌دادند، همه برای بازبینی کنار گذاشته شد. خواندن هزار آگهی حدود ۳ دلار هزینه دارد. خطای میانه‌ی ارزش بازار روی آگهی‌هایی که بعد از تاریخ برش گذاشته شده‌اند [[۶٫۸٪]] است و بسته به مدل از ۴ تا ۸٪. این هنوز آزمونِ بازاری که حرکت کرده نیست، چون نمایه تازه است. هر عدد را با یک دستور دوباره می‌سازیم.

**Cue (English).** Every listing goes through five stages: read from Divar, sorted out, valued, ranked and explained. The language model reads only the ad's text: paint work, replaced parts, chassis, instalment or negotiable price. On 117 hand-labelled ads, 99.8 % of the facts were read right; on the 66 we had set aside for testing, 791 of 792. All eleven ads that gave the model instructions were held for a person. Reading a thousand ads costs about 3 dollars. The median market-value error on listings posted after the cut date is [[6.8 %]], and 4 to 8 % by model. That is not yet a test on a market that moved, because the index is new. Every number is rebuilt with one command.

**Numbers.** N16 to N20 (extraction), N13 and N12 (valuation).

**`TODO-04`, `TODO-11`.** CS-48's harness and a valuation run on the recording day replace N16 and N13 with newer reports; update the sentence to match.

**Do not.** Say the ratings were checked against what the market did next (CS-73 is not done) or against published price tables (CS-74 is not done).

## 7. The decisions · 4:00 to 4:45

**On screen.** The decision records, opened in turn: `0017`, `0008`, `0029`, `0030`, `0011`.

**Say (Farsi).**

> چند تصمیم، به این ترتیب. اول، داده. نمایه‌ی زنده‌ی آگهی‌های دیوار در تهران، نه یک نمونه‌ی ثابت. خزنده مؤدب است: هر بار یک درخواست، با ۳ ثانیه فاصله، حداکثر ۱۲ هزار در روز، و با اولین مسدودی می‌ایستد. اطلاعات شخصی فروشنده‌ها و عکس‌ها ذخیره نمی‌شود. شرایط استفاده‌ی دیوار ثبت شده، ولی برای این نمایش رعایت نمی‌شود؛ راه واقعی، فید همکار است. دوم، کد اول و مدل فقط برای آنچه کد نمی‌تواند. سوم، اگر مطمئن نیستیم، ارزیابی نمی‌کنیم و دلیلش را می‌گوییم. چهارم، یک پایگاه داده، PostgreSQL. و آنچه کنار گذاشتیم: منبع دوم و آگهی‌های تکراری میان سایت‌ها.

**Cue (English).** A few decisions, in this order. First, the data: a live index of Divar's Tehran listings, not a frozen sample. The crawler is polite: one request at a time, three seconds apart, at most 12 thousand a day, and it stops at the first block. Sellers' personal data and photos are not stored. Divar's terms are recorded and, for this demo, not followed; the real route is a partner feed. Second, code first, a model only for what code cannot do. Third, when we are not sure we do not rate, and we say why. Fourth, one database, PostgreSQL. And what we left out: a second source and duplicates across sites.

**Numbers.** N07 (12,000 a day, three seconds).

**The order is the point.** The data decision comes first because it is the one a reviewer can hold against the product; saying it plainly, with its limit and its way out, is what ADR-0008 and ADR-0017 record. The owner decided on 2026-09-28 not to follow the sources' terms and robots.txt for the demo; the video neither claims they are followed nor dwells on it. Delete the sentence «شرایط … رعایت نمی‌شود» only if the same fact is stated in the submission notes (`notes.md`).

**Do not.** Say the crawler follows robots.txt or the terms, that Divar agreed, or that an integration exists. Say «فید همکار» as the route, not as something built.

## 8. The close · 4:45 to 5:00

**On screen.** The README on GitHub, at its top.

**Say (Farsi).**

> ارزیابی روی قیمت آگهی است، نه قیمت معامله؛ هنوز نسنجیده‌ایم رتبه‌ها با رفتار بعدی بازار جور است یا نه. شواهد و دستور هر عدد در مخزن است.

**Cue (English).** The rating is of the asking price, not the sale price, and we have not yet checked the ratings against what the market did next. The evidence and the command for every number are in the repository.

## If there are 20 spare seconds

In order: the model page `/models/peugeot/206` (the price by year and the trend from our own daily valuations); a search file («سپردن به کارشناس») and its notification; the superadmin choosing which models are read in depth. None is in the clock above: each needs an account, and the account must be one made for the recording (`recording-day.md`).

## If the video runs long: cut in this order

1. The phone moment in scene 2.
2. The overpriced listing and the second listing in scene 3 (keep the price drop or the unrated one, not both).
3. The terminal command in scene 6, step 4 (keep step 5, the re-score).
4. The sentence about cost in scene 6.
5. The close's second sentence.

Never cut the data decision, the measured miss in scene 5, or the sentence that says what is not yet measured.

## If the reviewers ask

- **Why only Divar?** It is the largest source and the demo's scope. Sources are adapters (`ADR-0017` point 11): a second one is a parser and a policy check, and a partner feed would replace the crawler without touching the rest.
- **Why not Elasticsearch?** PostgreSQL's own search was measured first (`docs/evidence/search-api/`); a search engine is added only if a measured trigger fires (`ADR-0011`, `ADR-0028`).
- **Is the rating right?** It is the asking price against a regression on asking prices, with its error shown by model. It is not a transaction price, and it has not yet been checked against what the market did next (`docs/specs/S01-deal-ratings.md`, «Accuracy»).
- **Where does a language model decide something a buyer sees?** Nowhere on the demo path: sentences are read by code, explanations are templates, and the model only reads listing text into facts that code then validates.
- **How was it built?** AI-first, by one developer with Claude Code: tasks as files, a map in `AGENTS.md`, rules by path, read-only reviewers, and every task closed with evidence (`README.md`, «Built AI-first»).
