# Copy lint: the baseline report

Produced on 2026-10-04 by `pnpm copy:lint --all --report docs/evidence/copy/lint-baseline.md` (CS-105) over today's copy, before any rewrite lane (CS-106 to CS-110) has changed a string. It is the evidence for the lint's first run; the live numbers are in `tools/copy-lint/baseline.json`, and `docs/design/copy-rewrite-plan.md` says which area owns each file.

## Summary

- Copy files scanned: 79, holding 1,974 strings with a Persian word.
- Persian text in files that are not copy (vocabulary, fixtures, tests excluded, reference pages): 43 files, listed in `docs/design/copy-rewrite-plan.md`.
- Rules: 19.
- Violations: **117** in 42 files.
- Allowed by comment or allowlist: 0.
- Time for the whole repository: 2.4 s wall clock, 3.1 s of CPU (budget: 10 s).

## By rule

| Rule | What it finds | Violations | Files |
|---|---|---:|---:|
| `arabic-digits` | Arabic-Indic digits | 0 | 0 |
| `arabic-letters` | Arabic letters (yeh, kaf, alef maksura, heh with yeh above, teh marbuta) | 0 | 0 |
| `banned-phrase` | a banned filler, machine-written, bureaucratic, praising or apologising phrase | 7 | 4 |
| `english-word` | an English word inside Persian copy | 3 | 2 |
| `exclamation-mark` | an exclamation mark | 0 | 0 |
| `half-space` | a space where a half-space belongs | 0 | 0 |
| `latin-digits` | Latin digits inside Persian text | 0 | 0 |
| `length-button` | a button (a verb the buyer presses) over its length budget | 15 | 10 |
| `length-label` | a label over its length budget | 10 | 3 |
| `length-name` | an accessible name (an aria-label or a key ending in Label) over its length budget | 6 | 2 |
| `length-title` | a title over its length budget | 1 | 1 |
| `length-hint` | a hint over its length budget | 6 | 3 |
| `length-notice` | a notice or lead paragraph over its length budget | 17 | 11 |
| `length-popover` | one paragraph of an info popover over its length budget | 1 | 1 |
| `middle-dot-digit` | a middle dot next to a digit | 0 | 0 |
| `middle-dot-join` | a middle dot that joins a value (it may be a number at run time) | 30 | 17 |
| `repeated-sentence` | the same sentence twice in one file or one screen | 21 | 13 |
| `double-space` | doubled spaces | 0 | 0 |
| `edge-space` | a space at the start or end of a string | 0 | 0 |

Rules at zero (`arabic-digits`, `arabic-letters`, `exclamation-mark`, `half-space`, `latin-digits`, `middle-dot-digit`, `double-space`, `edge-space`): today's copy already follows them, so they have no baseline entry and any new violation fails.

## By rewrite area

| Area | `banned-phrase` | `english-word` | `length-button` | `length-label` | `length-name` | `length-title` | `length-hint` | `length-notice` | `length-popover` | `middle-dot-join` | `repeated-sentence` | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A (CS-106) | 4 |  |  |  | 6 |  |  | 7 |  | 3 | 2 | 22 |
| B (CS-107) |  |  | 4 | 2 |  | 1 | 5 | 1 | 1 | 6 | 4 | 24 |
| C (CS-108) | 2 |  | 3 | 2 |  |  | 1 | 2 |  | 2 | 7 | 19 |
| CS-115 | 1 |  | 2 |  |  |  |  |  |  | 1 | 3 | 7 |
| D (CS-109) |  | 3 | 6 |  |  |  |  | 6 |  | 18 | 4 | 37 |
| E (CS-110) |  |  |  | 6 |  |  |  | 1 |  |  | 1 | 8 |

## By file

| File | Total | Rules (count) |
|---|---:|---|
| `apps/web/src/features/admin/admin-copy.ts` | 12 | repeated-sentence 4, length-button 3, english-word 2, middle-dot-join 2, length-notice 1 |
| `apps/web/src/features/search-files/search-files-copy.ts` | 7 | banned-phrase 2, length-button 2, repeated-sentence 2, length-notice 1 |
| `apps/web/src/features/check-link/check-copy.ts` | 6 | repeated-sentence 3, length-button 2, banned-phrase 1 |
| `apps/web/src/features/data-status/data-status-copy.ts` | 6 | length-notice 4, banned-phrase 2 |
| `apps/web/src/features/listing/listing-copy.ts` | 6 | length-hint 4, length-button 1, length-title 1 |
| `packages/search/src/filters.ts` | 6 | length-label 6 |
| `apps/web/public/home/hero/credits.json` | 5 | length-name 5 |
| `apps/web/src/features/admin/components/crawl-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/admin/components/jobs-section.tsx` | 5 | middle-dot-join 5 |
| `apps/web/src/features/model/model-copy.ts` | 5 | length-notice 2, repeated-sentence 2, length-name 1 |
| `apps/web/src/features/accounts/accounts-copy.ts` | 4 | length-button 1, length-hint 1, length-notice 1, repeated-sentence 1 |
| `apps/web/src/features/admin/tracked-models-admin-copy.ts` | 4 | length-notice 3, length-button 1 |
| `apps/web/src/features/admin/components/problems-section.tsx` | 3 | middle-dot-join 3 |
| `apps/web/src/features/admin/model-photos-admin-copy.ts` | 3 | english-word 1, length-button 1, length-notice 1 |
| `apps/web/src/features/home/home-copy.ts` | 3 | banned-phrase 2, length-notice 1 |
| `apps/web/src/features/search-understanding/components/plain-search.tsx` | 3 | length-button 2, repeated-sentence 1 |
| `apps/web/src/features/search/components/listing-card.tsx` | 3 | middle-dot-join 3 |
| `apps/web/src/features/search/search-copy.ts` | 3 | length-button 1, length-hint 1, length-notice 1 |
| `apps/web/src/features/admin/crawl-requests-admin-copy.ts` | 2 | length-button 1, length-notice 1 |
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
| `apps/web/src/features/listing/listing-explanation.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/listing/listing-view.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/marked-listings/components/marked-list.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/marks/marks-copy.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/model/model-info.ts` | 1 | repeated-sentence 1 |
| `apps/web/src/features/search-files/components/search-files-card.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/features/search/components/no-results.tsx` | 1 | middle-dot-join 1 |
| `apps/web/src/lib/crawl-requests-copy.ts` | 1 | repeated-sentence 1 |
| `packages/search/src/mileage-reading.ts` | 1 | length-notice 1 |
| `packages/search/src/understand/understand.ts` | 1 | repeated-sentence 1 |

## Examples, by rule

### `banned-phrase` (7)

A banned phrase (tools/copy-lint/data/banned-phrases.mjs). Fix: See the entry in the list: it says what is wrong and what to write instead.

- `apps/web/src/features/check-link/check-copy.ts:102`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored is not something a buyer needs (owner, 2026-10-04). «پایگاه داده پاسخ نداد؛ لینک شما از بین نرفته است، کمی بعد دوباره امتحا…»
- `apps/web/src/features/data-status/data-status-copy.ts:80`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored is not something a buyer needs (owner, 2026-10-04). «…ساطی بودن قیمت. هر عددی که می‌بینید از پایگاه داده است، نه از متن مدل.»
- `apps/web/src/features/data-status/data-status-copy.ts:92`: Banned phrase «پایگاه داده» (database-words, technical): How the data is stored is not something a buyer needs (owner, 2026-10-04). «پایگاه داده پاسخ نداد. کمی بعد دوباره امتحان کنید.»

### `english-word` (3)

An English word inside Persian copy. Fix: Write it in Persian (the glossary has the term), or, if it must stay Latin, add it to tools/copy-lint/data/allowed-latin.mjs with a reason.

- `apps/web/src/features/admin/admin-copy.ts:106`: The English word «pg-boss» inside Persian copy. «…ت؛ کارگر هنوز کاری نفرستاده یا pg-boss کارهای تمام‌شده را پاک کرده است…»
- `apps/web/src/features/admin/admin-copy.ts:121`: The English word «pg-boss» inside Persian copy. «صف خودِ pg-boss؛ دستی تغییر داده نمی‌شود.»
- `apps/web/src/features/admin/model-photos-admin-copy.ts:10`: The English word «https» inside Persian copy. «…ای هر مدل پرطرفدار یک نشانی عکس https بگذارید تا در صفحه‌ی اصلی و فهرس…»

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

### `middle-dot-join` (30)

A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. Fix: Separate the facts with «،» or put them in separate elements; never join a number with « · ».

- `apps/web/src/features/admin/admin-copy.ts:318`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. «{…} · {…} · {…}»
- `apps/web/src/features/admin/admin-copy.ts:318`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. «{…} · {…} · {…}»
- `apps/web/src/features/admin/components/crawl-section.tsx:75`: A middle dot that joins a value the file cannot see: at run time it may sit next to a number, and a dot next to a Persian digit reads as a zero. «{…} · {…}»

### `repeated-sentence` (21)

The same sentence is written twice. Fix: Say it once: keep it where the buyer needs it and remove the other, or point to one shared constant.

- `apps/web/src/features/accounts/accounts-copy.ts:85`: The same sentence is already written in this file (line 42). «این نام کاربری گرفته شده است.»
- `apps/web/src/features/admin/admin-copy.ts:64`: The same sentence is already written in this file (line 54). «خزش از سر گرفته شد.»
- `apps/web/src/features/admin/admin-copy.ts:162`: The same sentence is already written in this file (line 156). «میانه‌ی زمان از آخرین بررسی»

