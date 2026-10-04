# Copy lint: the baseline report

Produced on 2026-10-04 by `pnpm copy:lint --all --report docs/evidence/copy/lint-baseline.md` (CS-105) over today's copy, before any rewrite lane (CS-106 to CS-110) has changed a string. It is the evidence for the lint's first run; the live numbers are in `tools/copy-lint/baseline.json`, and `docs/design/copy-rewrite-plan.md` says which area owns each file.

## Summary

- Copy files scanned: 79, holding 1,974 strings with a Persian word.
- Persian text in files that are not copy (vocabulary, fixtures, tests excluded, reference pages): 43 files, listed in `docs/design/copy-rewrite-plan.md`.
- Rules: 25.
- Violations: **324** in 50 files.
- Allowed by comment or allowlist: 0.
- Time for the whole repository, from the start of the process: 5.4 s wall clock and 3.6 s of CPU (budget: 10 s), on a machine with 8 cores at a one-minute load average of 35.0, so the wall clock is stretched by the machine being busy; CPU is the steadier figure.

## By rule

| Rule | What it finds | Violations | Files |
|---|---|---:|---:|
| `arabic-digits` | Arabic-Indic digits | 0 | 0 |
| `arabic-letters` | Arabic letters (yeh, kaf, alef maksura, heh with yeh above, teh marbuta) | 0 | 0 |
| `banned-phrase` | a banned filler, machine-written, bureaucratic, praising or apologising phrase | 40 | 11 |
| `english-word` | an English word inside Persian copy | 3 | 2 |
| `exclamation-mark` | an exclamation mark | 0 | 0 |
| `half-space` | a space where a half-space belongs | 3 | 2 |
| `latin-digits` | Latin digits inside Persian text | 0 | 0 |
| `length-button` | a button (a verb the buyer presses) over its length budget | 15 | 10 |
| `length-label` | a label over its length budget | 10 | 3 |
| `length-name` | an accessible name (an aria-label or a key ending in Label) over its length budget | 6 | 2 |
| `length-title` | a title over its length budget | 1 | 1 |
| `length-hint` | a hint over its length budget | 6 | 3 |
| `length-notice` | a notice or lead paragraph over its length budget | 17 | 11 |
| `length-popover` | one paragraph of an info popover over its length budget | 1 | 1 |
| `long-sentence` | a sentence over 25 words | 10 | 7 |
| `middle-dot-digit` | a middle dot next to a digit | 0 | 0 |
| `middle-dot-join` | a middle dot that joins a value (it may be a number at run time) | 29 | 17 |
| `repeated-sentence` | the same sentence twice in one file or one screen | 21 | 13 |
| `semicolon` | the Arabic semicolon | 159 | 31 |
| `double-space` | doubled spaces | 0 | 0 |
| `edge-space` | a space at the start or end of a string | 0 | 0 |
| `straight-quotes` | a double quote mark instead of «» | 0 | 0 |
| `ascii-ellipsis` | three full stops instead of the ellipsis character | 3 | 2 |
| `range-hyphen` | a hyphen between two numbers | 0 | 0 |
| `emoji` | an emoji | 0 | 0 |

Rules at zero (`arabic-digits`, `arabic-letters`, `exclamation-mark`, `latin-digits`, `middle-dot-digit`, `double-space`, `edge-space`, `straight-quotes`, `range-hyphen`, `emoji`): today's copy already follows them, so they have no baseline entry and any new violation fails.

## By rewrite area

| Area | `banned-phrase` | `english-word` | `half-space` | `length-button` | `length-label` | `length-name` | `length-title` | `length-hint` | `length-notice` | `length-popover` | `long-sentence` | `middle-dot-join` | `repeated-sentence` | `semicolon` | `ascii-ellipsis` | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A (CS-106) | 9 |  | 1 |  |  | 6 |  |  | 7 |  | 1 | 3 | 2 | 15 |  | 44 |
| B (CS-107) | 21 |  |  | 4 | 2 |  | 1 | 5 | 1 | 1 | 4 | 6 | 4 | 52 | 3 | 104 |
| C (CS-108) | 7 |  |  | 3 | 2 |  |  | 1 | 2 |  |  | 2 | 7 | 24 |  | 48 |
| CS-115 | 1 |  |  | 2 |  |  |  |  |  |  |  | 1 | 3 | 7 |  | 14 |
| D (CS-109) | 1 | 3 |  | 6 |  |  |  |  | 6 |  | 2 | 17 | 4 | 43 |  | 82 |
| E (CS-110) | 1 |  | 2 |  | 6 |  |  |  | 1 |  | 3 |  | 1 | 18 |  | 32 |

## By file

| File | Total | Rules (count) |
|---|---:|---|
| `apps/web/src/features/admin/admin-copy.ts` | 25 | semicolon 13, repeated-sentence 4, length-button 3, english-word 2, banned-phrase 1, length-notice 1, middle-dot-join 1 |
| `apps/web/src/features/admin/tracked-models-admin-copy.ts` | 18 | semicolon 12, length-notice 3, long-sentence 2, length-button 1 |
| `apps/web/src/features/listing/listing-explanation.ts` | 18 | semicolon 13, long-sentence 3, ascii-ellipsis 1, repeated-sentence 1 |
| `apps/web/src/features/search-files/search-files-copy.ts` | 16 | banned-phrase 6, semicolon 5, length-button 2, repeated-sentence 2, length-notice 1 |
| `apps/web/src/features/search-understanding/components/plain-search.tsx` | 16 | banned-phrase 11, length-button 2, semicolon 2, repeated-sentence 1 |
| `apps/web/src/features/model/model-copy.ts` | 15 | semicolon 7, banned-phrase 3, length-notice 2, repeated-sentence 2, length-name 1 |
| `packages/search/src/filters.ts` | 15 | length-label 6, semicolon 6, half-space 2, long-sentence 1 |
| `apps/web/src/features/accounts/accounts-copy.ts` | 14 | semicolon 9, banned-phrase 1, length-button 1, length-hint 1, length-notice 1, repeated-sentence 1 |
| `apps/web/src/features/listing/listing-view.ts` | 14 | semicolon 11, ascii-ellipsis 2, repeated-sentence 1 |
| `packages/search/src/understand/understand.ts` | 14 | semicolon 7, banned-phrase 6, repeated-sentence 1 |
| `apps/web/src/features/admin/model-photos-admin-copy.ts` | 13 | semicolon 10, english-word 1, length-button 1, length-notice 1 |
| `apps/web/src/features/check-link/check-copy.ts` | 13 | semicolon 7, repeated-sentence 3, length-button 2, banned-phrase 1 |
| `apps/web/src/features/listing/listing-copy.ts` | 13 | semicolon 7, length-hint 4, length-button 1, length-title 1 |
| `apps/web/src/features/admin/crawl-requests-admin-copy.ts` | 10 | semicolon 8, length-button 1, length-notice 1 |
| `apps/web/src/features/data-status/data-status-copy.ts` | 10 | length-notice 4, semicolon 3, banned-phrase 2, half-space 1 |
| `apps/web/src/features/search/search-copy.ts` | 9 | semicolon 6, length-button 1, length-hint 1, length-notice 1 |
| `apps/web/src/features/home/home-copy.ts` | 8 | banned-phrase 4, semicolon 2, length-notice 1, long-sentence 1 |
| `apps/web/src/features/model/model-info.ts` | 8 | semicolon 5, banned-phrase 1, long-sentence 1, repeated-sentence 1 |
| `packages/search/src/understand/merge.ts` | 8 | banned-phrase 4, semicolon 4 |
| `packages/search/src/mileage-reading.ts` | 6 | semicolon 4, length-notice 1, long-sentence 1 |
| `apps/web/public/home/hero/credits.json` | 5 | length-name 5 |
| `apps/web/src/features/admin/components/crawl-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/admin/components/jobs-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/notifications/notifications-copy.ts` | 5 | semicolon 3, repeated-sentence 2 |
| `apps/web/src/lib/crawl-requests-copy.ts` | 4 | semicolon 3, repeated-sentence 1 |
| `apps/web/src/features/admin/components/problems-section.tsx` | 3 | middle-dot-join 3 |
| `apps/web/src/features/search/components/listing-card.tsx` | 3 | middle-dot-join 3 |
| `packages/notifications/src/kinds.ts` | 3 | length-label 2, semicolon 1 |
| `packages/search/src/sorts.ts` | 3 | semicolon 3 |
| `apps/web/src/features/listing/gauge-view.ts` | 2 | length-popover 1, long-sentence 1 |
| `apps/web/src/features/marked-listings/marked-copy.ts` | 2 | semicolon 2 |
| `apps/web/src/features/marks/marks-copy.ts` | 2 | repeated-sentence 1, semicolon 1 |
| `apps/web/src/features/search-understanding/components/plain-search-panel.tsx` | 2 | length-label 2 |
| `apps/web/src/app/error.tsx` | 1 | semicolon 1 |
| `apps/web/src/app/global-error.tsx` | 1 | semicolon 1 |
| `apps/web/src/features/admin/components/listings-section.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/admin/components/search-files-screen.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/admin/components/source-card.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/check-link/components/check-answer.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/data-status/components/status-overview.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/home/components/catalogue-row.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/home/components/hero-photos.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/listing/components/comparables-section.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/listing/components/listing-screen.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/marked-listings/components/marked-list.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/search-files/components/search-files-card.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/search-understanding/server/understand-route.ts` | 1 | semicolon 1 |
| `apps/web/src/features/search/components/no-results.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/search/server/search-route.ts` | 1 | semicolon 1 |
| `apps/web/src/server/observability/route-errors.ts` | 1 | semicolon 1 |

## Examples, by rule

### `banned-phrase` (40)

A banned phrase (tools/copy-lint/data/banned-phrases.mjs). Fix: See the entry in the list: it says what is wrong and what to write instead.

- `apps/web/src/features/accounts/accounts-copy.ts:31`: Banned phrase «اپ» (product-names, register): A word for the product that is not its name (guide V6). «برای استفاده از تمام قابلیت‌های اپ کارشناس، وارد حساب کاربری خود شوید.»
- `apps/web/src/features/admin/admin-copy.ts:30`: Banned phrase «این‌جا» (joined-words, orthography): Written apart or with a half-space where the Academy and the guide write one word (guide, section 6): «اینجا، آنجا، اینکه، آنچه» are joined, and «همین‌جا، همان‌جا» take a half-space. «خزش هر منبع را این‌جا متوقف کنید یا از سر بگیرید. هر تغییر با نام کارب…»
- `apps/web/src/features/check-link/check-copy.ts:102`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored, and the machinery behind it, is not something a buyer needs (owner, 2026-10-04; guide R7). «پایگاه داده پاسخ نداد؛ لینک شما از بین نرفته است، کمی بعد دوباره امتحا…»

### `english-word` (3)

An English word inside Persian copy. Fix: Write it in Persian (the glossary has the term), or, if it must stay Latin, add it to tools/copy-lint/data/allowed-latin.mjs with a reason.

- `apps/web/src/features/admin/admin-copy.ts:106`: The English word «pg-boss» inside Persian copy. «…ت؛ کارگر هنوز کاری نفرستاده یا pg-boss کارهای تمام‌شده را پاک کرده است…»
- `apps/web/src/features/admin/admin-copy.ts:121`: The English word «pg-boss» inside Persian copy. «صف خودِ pg-boss؛ دستی تغییر داده نمی‌شود.»
- `apps/web/src/features/admin/model-photos-admin-copy.ts:10`: The English word «https» inside Persian copy. «…ای هر مدل پرطرفدار یک نشانی عکس https بگذارید تا در صفحه‌ی اصلی و فهرس…»

### `half-space` (3)

A space where a half-space (ZWNJ) belongs: the prefix می, نمی or بی, the suffix ها, تر, ترین or ی, written as a separate word. Fix: Join it to its word with a zero-width non-joiner (U+200C): «می‌خواهید», «کتاب‌ها», «بزرگ‌تر», «صفحه‌ی اصلی».

- `apps/web/src/features/data-status/data-status-copy.ts:82`: A space where a half-space (ZWNJ) belongs: the prefix می, نمی or بی, the suffix ها, تر, ترین or ی, written as a separate word. «آگهی بی هیچ خطا»
- `packages/search/src/filters.ts:301`: A space where a half-space (ZWNJ) belongs: the prefix می, نمی or بی, the suffix ها, تر, ترین or ی, written as a separate word. «سالم و بی خط و خش»
- `packages/search/src/filters.ts:301`: A space where a half-space (ZWNJ) belongs: the prefix می, نمی or بی, the suffix ها, تر, ترین or ی, written as a separate word. «بدنه‌ی سالم و بی خط و خش»

### `length-button` (15)

Too long for a button (a verb the buyer presses): at most 3 words and 22 characters. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/accounts/accounts-copy.ts:52`: Too long for a button (a verb the buyer presses): 4 words (limit 3). «پنهان کردن رمز عبور»
- `apps/web/src/features/admin/admin-copy.ts:31`: Too long for a button (a verb the buyer presses): 4 words (limit 3). «بازگشت به پنل مدیریت»
- `apps/web/src/features/admin/admin-copy.ts:82`: Too long for a button (a verb the buyer presses): 4 words (limit 3). «بازگشت به پنل مدیریت»

### `length-label` (10)

Too long for a label: at most 4 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/search-understanding/components/plain-search-panel.tsx:26`: Too long for a label: 6 words (limit 4). «با یک جمله بگویید چه می‌خواهید»
- `apps/web/src/features/search-understanding/components/plain-search-panel.tsx:30`: Too long for a label: 5 words (limit 4). «ماشین مورد نظرتان را بنویسید»
- `packages/notifications/src/kinds.ts:198`: Too long for a label: 5 words (limit 4). «پاسخ به درخواست جست‌وجوی بیشتر»

### `length-name` (6)

Too long for an accessible name (an aria-label or a key ending in Label): at most 10 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/public/home/hero/credits.json:12`: Too long for an accessible name (an aria-label or a key ending in Label): 14 words (limit 10). «غروب تهران: برج میلاد در آسمان نارنجی و بنفش و جریان خودروها روی بزرگراه»
- `apps/web/public/home/hero/credits.json:71`: Too long for an accessible name (an aria-label or a key ending in Label): 11 words (limit 10). «شب تهران: برج میلاد و رد نور خودروها روی بزرگراه‌های پیچ‌درپیچ»
- `apps/web/public/home/hero/credits.json:96`: Too long for an accessible name (an aria-label or a key ending in Label): 11 words (limit 10). «خط افق تهران در غروب نارنجی با خورشید و برج میلاد»

### `length-title` (1)

Too long for a title: at most 8 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/listing/listing-copy.ts:85`: Too long for a title: 9 words (limit 8). «آگهی‌های مشابهی که ارزش بازار از آن‌ها حساب شد»

### `length-hint` (6)

Too long for a hint: at most 12 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/accounts/accounts-copy.ts:39`: Too long for a hint: 15 words (limit 12). «فقط حروف انگلیسی، عدد و زیرخط (_)؛ {…} تا {…}، که با یک حرف شروع شود.»
- `apps/web/src/features/listing/listing-copy.ts:54`: Too long for a hint: 18 words (limit 12). «قیمت و مشخصات زیر آخرین چیزی است که از آگهی دیده‌ایم. بدون ارزیابی تازه، به آن‌ها تکیه نکنید.»
- `apps/web/src/features/listing/listing-copy.ts:86`: Too long for a hint: 23 words (limit 12). «نزدیک‌ترین آگهی‌ها به این خودرو در سال ساخت و کارکرد. «قیمت برای این خودرو» قیمت هر کدام است اگر مثل…»

### `length-notice` (17)

Too long for a notice or lead paragraph: at most 25 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/accounts/accounts-copy.ts:26`: Too long for a notice or lead paragraph: 26 words (limit 25). «فعلاً رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، روی کادر رمز عبور پیشنهادش می‌د…»
- `apps/web/src/features/admin/admin-copy.ts:313`: Too long for a notice or lead paragraph: 26 words (limit 25). «کارشناس هر چند دقیقه آگهی‌های تازه‌ی جست‌وجو را با پرونده‌های در حال پایش می‌سنجد و برای هر پرونده ی…»
- `apps/web/src/features/admin/crawl-requests-admin-copy.ts:19`: Too long for a notice or lead paragraph: 34 words (limit 25). «وقتی پرونده‌ی یک خریدار آگهی کمی دارد، می‌تواند بخواهد مدلش بیشتر خوانده شود. تأیید یا رد با شماست؛ …»

### `length-popover` (1)

Too long for one paragraph of an info popover: at most 45 words. Fix: Say less: one idea, the answer first. If the rest matters, it is another element (a hint or an info control), not a longer label.

- `apps/web/src/features/listing/gauge-view.ts:153`: Too long for one paragraph of an info popover: 46 words (limit 45). «فقط وقتی ارزیابی می‌کنیم که برای آن مدل دست‌کم {…} آگهی مشابه داشته باشیم، دست‌کم {…} تا از آن‌ها با…»

### `long-sentence` (10)

A sentence over 25 words (guide R4: about 15, never over 25). Fix: Split it into sentences of one idea each, answer first; cut what the buyer cannot check or act on.

- `apps/web/src/features/admin/tracked-models-admin-copy.ts:37`: A sentence of 30 words (limit 25, guide R4). «برای مدل پوشش‌داده‌شده کارشناس جزئیات هر آگهی را می‌خواند و آن را شبانه دوباره می‌پیماید؛ استخراج اط…»
- `apps/web/src/features/admin/tracked-models-admin-copy.ts:45`: A sentence of 28 words (limit 25, guide R4). «هر منبع در روز ظرفیت محدودی دارد و خواندن به ترتیب اهمیت خرج می‌شود: آگهی‌های تازه، بررسی مجدد، پیما…»
- `apps/web/src/features/home/home-copy.ts:54`: A sentence of 26 words (limit 25, guide R4). «آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، نام و تیپ هر خودرو را از میان نوشته‌های پرا…»

### `middle-dot-join` (29)

A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. Fix: Separate the facts with «،» or put them in separate elements; never join a number with « · ».

- `apps/web/src/features/admin/admin-copy.ts:318`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. «{…} · {…} · {…}»
- `apps/web/src/features/admin/components/crawl-section.tsx:75`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. «{…} · {…}»
- `apps/web/src/features/admin/components/crawl-section.tsx:81`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. « · {…} {…}»

### `repeated-sentence` (21)

The same sentence is written twice. Fix: Say it once: keep it where the buyer needs it and remove the other, or point to one shared constant.

- `apps/web/src/features/accounts/accounts-copy.ts:85`: The same sentence is already written in this file (line 42). «این نام کاربری گرفته شده است.»
- `apps/web/src/features/admin/admin-copy.ts:64`: The same sentence is already written in this file (line 54). «خزش از سر گرفته شد.»
- `apps/web/src/features/admin/admin-copy.ts:162`: The same sentence is already written in this file (line 156). «میانه‌ی زمان از آخرین بررسی»

### `semicolon` (159)

A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). Fix: Split it into two sentences, or cut the second clause if it only restates the first.

- `apps/web/src/app/error.tsx:25`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «…ن صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی…»
- `apps/web/src/app/global-error.tsx:28`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «…ارشناس باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، چند دقیقه بعد …»
- `apps/web/src/features/accounts/accounts-copy.ts:26`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «… روی کادر رمز عبور پیشنهادش می‌دهد؛ در غیر این صورت حساب کاربری جدید ب…»

### `ascii-ellipsis` (3)

Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). Fix: Write «…» for «در حال خواندن…», or drop it.

- `apps/web/src/features/listing/listing-explanation.ts:188`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «…صورت پیش‌فروش، پیش‌پرداخت یا «از ...» می‌نویسند؛ برای همین آن را ارزیا…»
- `apps/web/src/features/listing/listing-view.ts:267`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «مبلغ آگهی «از ...» است»
- `apps/web/src/features/listing/listing-view.ts:322`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «مبلغ نمایش‌داده‌شده «از ...» است؛ خودروی همین آگهی ممکن است گران‌تر با…»

