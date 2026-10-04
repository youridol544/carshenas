# Copy lint: the baseline report

Produced on 2026-10-04 by `pnpm copy:lint --all --report docs/evidence/copy/lint-baseline.md` (CS-105) over today's copy, before any rewrite lane (CS-106 to CS-110) has changed a string. It is the evidence for the lint's first run; the live numbers are in `tools/copy-lint/baseline/` (one file per area), and `docs/design/copy-rewrite-plan.md` says which area owns each file.

Two levels, as the voice guide draws them (`docs/design/product-voice.md`, appendix B): a **refuse** rule fails the lint on a new violation, and its existing violations are the baseline; a **warn** rule asks a person to read the sentence, is listed with `pnpm copy:lint --warnings`, and never fails and never enters the baseline.

## Summary

- Copy files scanned: 79, holding 1,974 strings with a Persian word.
- Persian text in files that are not copy (vocabulary, fixtures, tests excluded, reference pages): 43 files, listed in `docs/design/copy-rewrite-plan.md`.
- Rules: 28 (22 refuse, 6 warn).
- Violations (refuse rules; the baseline): **139** in 42 files.
- Warnings (warn rules; never fail): **355** in 34 files.
- Allowed by comment or allowlist: 0.
- Time for the whole repository, from the start of the process: 2.1 s wall clock and 3.7 s of CPU (budget: 10 s), on a machine with 8 cores at a one-minute load average of 11.5, so the wall clock is stretched by the machine being busy; CPU is the steadier figure.

## By rule

| Rule | Level | What it finds | Hits | Files |
|---|---|---|---:|---:|
| `arabic-digits` | refuse | Arabic-Indic digits | 0 | 0 |
| `arabic-letters` | refuse | Arabic letters (yeh, kaf, alef maksura, heh with yeh above, teh marbuta) | 0 | 0 |
| `banned-phrase` | refuse | a banned phrase: filler, translated, machine-written, register slip, bureaucratic, praise, apology | 24 | 10 |
| `discouraged-phrase` | warn | a phrase the voice guide asks a person to reconsider (a warning: it never fails the lint) | 149 | 28 |
| `english-word` | refuse | an English word inside Persian copy | 3 | 2 |
| `exclamation-mark` | refuse | an exclamation mark | 0 | 0 |
| `half-space` | refuse | a space where a half-space belongs | 3 | 2 |
| `latin-digits` | refuse | Latin digits inside Persian text | 0 | 0 |
| `length-button` | refuse | a button (a verb the buyer presses) over its length budget | 15 | 10 |
| `length-label` | refuse | a label over its length budget | 10 | 3 |
| `length-name` | refuse | an accessible name (an aria-label or a key ending in Label) over its length budget | 6 | 2 |
| `length-title` | refuse | a title over its length budget | 1 | 1 |
| `length-hint` | refuse | a hint over its length budget | 6 | 3 |
| `length-notice` | refuse | a notice or lead paragraph over its length budget | 17 | 11 |
| `length-popover` | refuse | one paragraph of an info popover over its length budget | 1 | 1 |
| `long-sentence` | warn | a sentence over 25 words | 10 | 7 |
| `middle-dot-digit` | refuse | a middle dot next to a digit | 0 | 0 |
| `middle-dot-join` | refuse | a middle dot that joins a value (it may be a number at run time) | 29 | 17 |
| `parenthesis` | warn | a parenthesis for an aside | 31 | 15 |
| `repeated-phrase` | warn | a run of 8 words repeated in two strings of one screen | 6 | 4 |
| `repeated-sentence` | refuse | the same sentence twice in one file or one screen | 21 | 13 |
| `semicolon` | warn | the Arabic semicolon | 159 | 31 |
| `double-space` | refuse | doubled spaces | 0 | 0 |
| `edge-space` | refuse | a space at the start or end of a string | 0 | 0 |
| `straight-quotes` | refuse | a double quote mark instead of «» | 0 | 0 |
| `ascii-ellipsis` | refuse | three full stops instead of the ellipsis character | 3 | 2 |
| `range-hyphen` | warn | a hyphen between two numbers | 0 | 0 |
| `emoji` | refuse | an emoji | 0 | 0 |

Refuse rules at zero (`arabic-digits`, `arabic-letters`, `exclamation-mark`, `latin-digits`, `middle-dot-digit`, `double-space`, `edge-space`, `straight-quotes`, `emoji`): today's copy already follows them, so they have no baseline entry and any new violation fails.

## Violations by rewrite area

| Area | `banned-phrase` | `english-word` | `half-space` | `length-button` | `length-label` | `length-name` | `length-title` | `length-hint` | `length-notice` | `length-popover` | `middle-dot-join` | `repeated-sentence` | `ascii-ellipsis` | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A (CS-106) | 5 |  | 1 |  |  | 6 |  |  | 7 |  | 3 | 2 |  | 24 |
| B (CS-107) | 1 |  |  | 4 | 2 |  | 1 | 5 | 1 | 1 | 6 | 4 | 3 | 28 |
| C (CS-108) | 3 |  |  | 3 | 2 |  |  | 1 | 2 |  | 2 | 7 |  | 20 |
| CS-115 | 1 |  |  | 2 |  |  |  |  |  |  | 1 | 3 |  | 7 |
| D (CS-109) | 14 | 3 |  | 6 |  |  |  |  | 6 |  | 17 | 4 |  | 50 |
| E (CS-110) |  |  | 2 |  | 6 |  |  |  | 1 |  |  | 1 |  | 10 |

## Warnings by rewrite area

| Area | `discouraged-phrase` | `long-sentence` | `parenthesis` | `repeated-phrase` | `semicolon` | Total |
|---|---:|---:|---:|---:|---:|---:|
| A (CS-106) | 31 | 1 | 2 | 1 | 15 | 50 |
| B (CS-107) | 50 | 4 | 8 |  | 52 | 114 |
| C (CS-108) | 33 |  | 9 | 1 | 24 | 67 |
| CS-115 | 8 |  |  |  | 7 | 15 |
| D (CS-109) | 25 | 2 | 3 |  | 43 | 73 |
| E (CS-110) | 2 | 3 | 9 | 4 | 18 | 36 |

## Violations by file

| File | Total | Rules (count) |
|---|---:|---|
| `apps/web/src/features/admin/admin-copy.ts` | 15 | banned-phrase 4, repeated-sentence 4, length-button 3, english-word 2, length-notice 1, middle-dot-join 1 |
| `apps/web/src/features/data-status/data-status-copy.ts` | 8 | length-notice 4, banned-phrase 3, half-space 1 |
| `packages/search/src/filters.ts` | 8 | length-label 6, half-space 2 |
| `apps/web/src/features/admin/model-photos-admin-copy.ts` | 7 | banned-phrase 4, english-word 1, length-button 1, length-notice 1 |
| `apps/web/src/features/admin/tracked-models-admin-copy.ts` | 7 | banned-phrase 3, length-notice 3, length-button 1 |
| `apps/web/src/features/search-files/search-files-copy.ts` | 7 | banned-phrase 2, length-button 2, repeated-sentence 2, length-notice 1 |
| `apps/web/src/features/check-link/check-copy.ts` | 6 | repeated-sentence 3, length-button 2, banned-phrase 1 |
| `apps/web/src/features/listing/listing-copy.ts` | 6 | length-hint 4, length-button 1, length-title 1 |
| `apps/web/public/home/hero/credits.json` | 5 | length-name 5 |
| `apps/web/src/features/accounts/accounts-copy.ts` | 5 | banned-phrase 1, length-button 1, length-hint 1, length-notice 1, repeated-sentence 1 |
| `apps/web/src/features/admin/components/crawl-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/admin/components/jobs-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/admin/crawl-requests-admin-copy.ts` | 5 | banned-phrase 3, length-button 1, length-notice 1 |
| `apps/web/src/features/model/model-copy.ts` | 5 | length-notice 2, repeated-sentence 2, length-name 1 |
| `apps/web/src/features/search-understanding/components/plain-search.tsx` | 4 | length-button 2, banned-phrase 1, repeated-sentence 1 |
| `apps/web/src/features/admin/components/problems-section.tsx` | 3 | middle-dot-join 3 |
| `apps/web/src/features/home/home-copy.ts` | 3 | banned-phrase 2, length-notice 1 |
| `apps/web/src/features/listing/listing-view.ts` | 3 | ascii-ellipsis 2, repeated-sentence 1 |
| `apps/web/src/features/search/components/listing-card.tsx` | 3 | middle-dot-join 3 |
| `apps/web/src/features/search/search-copy.ts` | 3 | length-button 1, length-hint 1, length-notice 1 |
| `apps/web/src/features/listing/listing-explanation.ts` | 2 | ascii-ellipsis 1, repeated-sentence 1 |
| `apps/web/src/features/notifications/notifications-copy.ts` | 2 | repeated-sentence 2 |
| `apps/web/src/features/search-understanding/components/plain-search-panel.tsx` | 2 | length-label 2 |
| `packages/notifications/src/kinds.ts` | 2 | length-label 2 |
| `apps/web/src/features/admin/components/listings-section.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/admin/components/search-files-screen.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/admin/components/source-card.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/check-link/components/check-answer.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/data-status/components/status-overview.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/home/components/catalogue-row.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/home/components/hero-photos.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/listing/components/comparables-section.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/listing/components/listing-screen.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/listing/gauge-view.ts` | 1 | length-popover 1 |
| `apps/web/src/features/marked-listings/components/marked-list.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/marks/marks-copy.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/model/model-info.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/search-files/components/search-files-card.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/search/components/no-results.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/lib/crawl-requests-copy.ts` | 1 | repeated-sentence 1 |
| `packages/search/src/mileage-reading.ts` | 1 | length-notice 1 |
| `packages/search/src/understand/understand.ts` | 1 | repeated-sentence 1 |

## Warnings: the files with most

| File | Total | Rules (count) |
|---|---:|---|
| `apps/web/src/features/listing/listing-explanation.ts` | 27 | semicolon 13, parenthesis 7, discouraged-phrase 4, long-sentence 3 |
| `apps/web/src/features/admin/tracked-models-admin-copy.ts` | 26 | semicolon 12, discouraged-phrase 11, long-sentence 2, parenthesis 1 |
| `apps/web/src/features/admin/admin-copy.ts` | 25 | semicolon 13, discouraged-phrase 11, parenthesis 1 |
| `apps/web/src/features/search-files/search-files-copy.ts` | 22 | discouraged-phrase 13, semicolon 5, parenthesis 3, repeated-phrase 1 |
| `apps/web/src/features/model/model-copy.ts` | 19 | discouraged-phrase 10, semicolon 7, parenthesis 2 |
| `apps/web/src/features/listing/listing-copy.ts` | 17 | discouraged-phrase 10, semicolon 7 |
| `packages/search/src/understand/understand.ts` | 17 | discouraged-phrase 10, semicolon 7 |
| `apps/web/src/features/search-understanding/components/plain-search.tsx` | 16 | discouraged-phrase 14, semicolon 2 |
| `apps/web/src/features/check-link/check-copy.ts` | 15 | discouraged-phrase 8, semicolon 7 |
| `apps/web/src/features/data-status/data-status-copy.ts` | 15 | discouraged-phrase 12, semicolon 3 |
| `packages/search/src/filters.ts` | 14 | semicolon 6, parenthesis 4, repeated-phrase 3, long-sentence 1 |
| `apps/web/src/features/listing/listing-view.ts` | 13 | semicolon 11, discouraged-phrase 2 |
| `apps/web/src/features/model/model-info.ts` | 13 | semicolon 5, parenthesis 4, discouraged-phrase 2, long-sentence 1, repeated-phrase 1 |
| `apps/web/src/features/accounts/accounts-copy.ts` | 12 | semicolon 9, discouraged-phrase 2, parenthesis 1 |
| `apps/web/src/features/admin/crawl-requests-admin-copy.ts` | 11 | semicolon 8, discouraged-phrase 2, parenthesis 1 |

## Examples of violations, by rule

### `banned-phrase` (24)

A banned phrase (tools/copy-lint/data/banned-phrases.mjs). Fix: See the entry in the list: it says what is wrong and what to write instead.

- `apps/web/src/features/accounts/accounts-copy.ts:31`: Banned phrase «اپ» (product-names, register): A word for the product that is not its name (guide V6, appendix B). «برای استفاده از تمام قابلیت‌های اپ کارشناس، وارد حساب کاربری خود شوید.»
- `apps/web/src/features/admin/admin-copy.ts:81`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored, and the machinery behind it, is not something a buyer needs (owner, 2026-10-04; guide R7, appendix B). «…نتخاب‌شده انجام داده است، از پایگاه داده. صفحه هر ۱۵ ثانیه تازه می‌شود…»
- `apps/web/src/features/admin/admin-copy.ts:95`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored, and the machinery behind it, is not something a buyer needs (owner, 2026-10-04; guide R7, appendix B). «…انیه ضربانی نرسیده است؛ کارگر از کار افتاده یا به پایگاه داده نمی‌رسد.»

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

### `ascii-ellipsis` (3)

Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). Fix: Write «…» for «در حال خواندن…», or drop it.

- `apps/web/src/features/listing/listing-explanation.ts:188`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «…صورت پیش‌فروش، پیش‌پرداخت یا «از ...» می‌نویسند؛ برای همین آن را ارزیا…»
- `apps/web/src/features/listing/listing-view.ts:267`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «مبلغ آگهی «از ...» است»
- `apps/web/src/features/listing/listing-view.ts:322`: Three full stops: the ellipsis is the one character «…» and only for work in progress (guide, section 6). «مبلغ نمایش‌داده‌شده «از ...» است؛ خودروی همین آگهی ممکن است گران‌تر با…»

## Examples of warnings, by rule

### `discouraged-phrase` (149)

A phrase to reconsider (tools/copy-lint/data/banned-phrases.mjs). Fix: Read the sentence: the entry in the list says what is usually wrong and what to write instead.

- `apps/web/src/app/error.tsx:21`: Phrase to reconsider «مشکلی پیش آمد» (generic-error, register): A generic error (guide V5, appendix B): when more is known, say what happened. «مشکلی پیش آمد \| کارشناس»
- `apps/web/src/app/error.tsx:24`: Phrase to reconsider «مشکلی پیش آمد» (generic-error, register): A generic error (guide V5, appendix B): when more is known, say what happened. «مشکلی پیش آمد»
- `apps/web/src/app/global-error.tsx:24`: Phrase to reconsider «مشکلی پیش آمد» (generic-error, register): A generic error (guide V5, appendix B): when more is known, say what happened. «مشکلی پیش آمد \| کارشناس»

### `long-sentence` (10)

A sentence over 25 words (guide R4: about 15, never over 25). Fix: Split it into sentences of one idea each, answer first; cut what the buyer cannot check or act on.

- `apps/web/src/features/admin/tracked-models-admin-copy.ts:37`: A sentence of 30 words (limit 25, guide R4). «برای مدل پوشش‌داده‌شده کارشناس جزئیات هر آگهی را می‌خواند و آن را شبانه دوباره می‌پیماید؛ استخراج اط…»
- `apps/web/src/features/admin/tracked-models-admin-copy.ts:45`: A sentence of 28 words (limit 25, guide R4). «هر منبع در روز ظرفیت محدودی دارد و خواندن به ترتیب اهمیت خرج می‌شود: آگهی‌های تازه، بررسی مجدد، پیما…»
- `apps/web/src/features/home/home-copy.ts:54`: A sentence of 26 words (limit 25, guide R4). «آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، نام و تیپ هر خودرو را از میان نوشته‌های پرا…»

### `parenthesis` (31)

A parenthesis: an aside is a sentence of its own (guide, section 6). Fix: Write the aside as a sentence, or cut it when the buyer can neither check it nor act on it.

- `apps/web/src/features/accounts/accounts-copy.ts:39`: A parenthesis: an aside is a sentence of its own (guide, section 6). «فقط حروف انگلیسی، عدد و زیرخط (_)؛ {…} تا {…}، که با یک حرف شروع شود.»
- `apps/web/src/features/admin/admin-copy.ts:168`: A parenthesis: an aside is a sentence of its own (guide, section 6). «پاسخ «درخواست زیاد» (۴۲۹)»
- `apps/web/src/features/admin/crawl-requests-admin-copy.ts:59`: A parenthesis: an aside is a sentence of its own (guide, section 6). «دلیل رد (برای خریدار نوشته می‌شود)»

### `repeated-phrase` (6)

A run of 8 words is written again in another string of this screen. Fix: Say it once: keep the phrase where the buyer needs it, and shorten or drop the other.

- `apps/web/src/features/home/home-copy.ts:54`: A run of 8 words is already written in this file, line 18. «آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم،»
- `apps/web/src/features/model/model-info.ts:149`: A run of 8 words is already written on this screen (apps/web/src/features/model/model-copy.ts), line 42. «نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از»
- `apps/web/src/features/search-files/search-files-copy.ts:122`: A run of 8 words is already written in this file, line 121. «ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده»

### `semicolon` (159)

A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). Fix: Split it into two sentences, or cut the second clause if it only restates the first.

- `apps/web/src/app/error.tsx:25`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «…ن صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی…»
- `apps/web/src/app/global-error.tsx:28`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «…ارشناس باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، چند دقیقه بعد …»
- `apps/web/src/features/accounts/accounts-copy.ts:26`: A «؛»: one idea per sentence, a full stop where a «؛» was (guide R4). «… روی کادر رمز عبور پیشنهادش می‌دهد؛ در غیر این صورت حساب کاربری جدید ب…»

