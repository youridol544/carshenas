# Copy rewrite C: accounts, notifications and buyer tools (CS-108)

Evidence for CS-108, written 2026-10-04 in the lane `cs-108-copy-c`. The task rewrites the Farsi that a buyer reads on the sign-in and sign-up pages, the account pages, the mark control and the marked page, the notification inbox and every notification kind, the search files (list, save dialog, file page, alerts) and the crawl request card, to the voice guide (`docs/design/product-voice.md`, ADR-0042). `pnpm copy:inventory --strings C` printed the 385 strings of the area (the before); this file lists every one that changed or went, old and new side by side, grouped by screen, with a few words of why. A `{…}` is what a formatter fills in (a number, a date, a name): the file holds a placeholder. «Where» is the file and line before the rewrite (`e109f5d`).

## Result

| | Strings |
|---|---:|
| Reviewed (every string of area C, `pnpm copy:inventory --strings C`) | 385 |
| Rewritten | 142 |
| Deleted (a repeat, an internal detail, or no component read it) | 36 |
| Kept (right as they are, or kept for a reason named below) | 207 |

| File | Before | After | Rewritten | Deleted | Kept |
|---|---:|---:|---:|---:|---:|
| `apps/web/src/features/accounts/accounts-copy.ts` | 72 | 71 | 18 | 0 | 54 |
| `apps/web/src/features/marked-listings/components/marked-list.tsx` (1 separator) | 0 | 0 | 0 | 0 | 0 |
| `apps/web/src/features/marked-listings/marked-copy.ts` | 52 | 45 | 13 | 8 | 31 |
| `apps/web/src/features/marked-listings/marked-view.ts` | 1 | 1 | 0 | 0 | 1 |
| `apps/web/src/features/marks/marks-copy.ts` | 20 | 20 | 6 | 0 | 14 |
| `apps/web/src/features/notifications/notifications-copy.ts` | 32 | 29 | 10 | 3 | 19 |
| `apps/web/src/features/search-files/components/search-files-card.tsx` (1 separator) | 0 | 0 | 0 | 0 | 0 |
| `apps/web/src/features/search-files/search-file-name.ts` | 1 | 1 | 0 | 0 | 1 |
| `apps/web/src/features/search-files/search-files-copy.ts` | 118 | 105 | 53 | 14 | 51 |
| `apps/web/src/lib/crawl-requests-copy.ts` | 49 | 42 | 22 | 6 | 21 |
| `apps/web/src/lib/crawl-requests-rules.ts` | 4 | 0 | 0 | 4 | 0 |
| `packages/notifications/src/kinds.ts` | 36 | 35 | 20 | 1 | 15 |

The inventory counts a literal that a formatter wraps (`formatCountOf(n, 'آگهی')`) and the constants that now hold a sentence said in two places, so the «After» column is the inventory's number, not a count of what a buyer sees. Two files lost their last Persian string: `marked-list.tsx` and `search-files-card.tsx` held only a middle-dot separator between two facts, now «،» (guide, section 6), and `crawl-requests-rules.ts` held four sentences that nothing needed any more.

| Check | Before | After |
|---|---:|---:|
| `pnpm copy:lint` violations in the 12 files (refuse rules) | 20 | 0 |
| `pnpm copy:lint --warnings` warnings in the 12 files | 67 | 9 (read, each kept for a reason: see «Warnings read and kept») |
| New allowlist entries or ignore comments | | 0 |

Checks run, all targeted (the lane rules of 2026-10-04): `pnpm copy:lint` on the 12 files; `eslint --max-warnings 0` on the changed web files and on `packages/notifications`; `tsc --noEmit` for `apps/web` (with `next typegen`), `packages/notifications` and `e2e`; the notification package's node:test suites (14 tests, they render every kind); vitest for the folders of the area (8 files, 26 tests); prettier on every changed file. **Not run, by the same rules:** Playwright (no spec of `e2e/` was run, and no screenshot at 412 or 1440 was taken), the database tests, `pnpm check`, a build. The `copy-reviewer` agent cannot be started from a lane; the self-review with the `copy-fa` skill's scan is below. The shared baseline `tools/copy-lint/baseline/C.json` is untouched: 13 of its entries are now higher than the code, and the coordinator lowers them once after the merges.

## The calls I made

Where the guide left a choice or a glossary decision open (its appendix A), this is what I decided, and why. Each is also in the glossary or the guide's words table.

1. **A search file's state is «فعال» / «متوقف» / «بسته»**, not «در حال پایش» (appendix A.2 calls «پایش» jargon and points at «دنبال کردن»). I chose three adjectives over a verb phrase because a sentence can say «پرونده فعال است» and «پرونده‌ی «X» همین جست‌وجو را دارد و متوقف است», a group heading reads «فعال (۲)», and the toggle names the state it leads to: «متوقف کردن» / «فعال کردن». «دنبال می‌شود» would have needed a different sentence for each state. The glossary row changed with it.
2. **«سپردن به کارشناس»** for the button (the guide's E73), «سپرد/سپرده» for the verb everywhere in the dialogs; the glossary row changed with it.
3. **«اعلان», never «هشدار»**, for what a file sends: the inbox, the settings and the notification kinds already said «اعلان», while the file page said «هشدار» (R6). «هشدار قیمت» stays in the glossary for the planned Telegram form.
4. **«آخرین بازدید»** for the buyer's last visit (the guide's word), where the file pages said «آخرین دیدن».
5. **The site is «دیوار»**, not «سایت منبع» (guide, section 4: the site's name, else «منبع»; Divar is the only source for the demo). If a second source ever returns, the name has to come from the notification's payload: a follow-up below.
6. **«رد شد»** in the notification and the card, as the state's badge says it, not «پذیرفته نشد» (R6).
7. **A promise is made once.** «خبرتان می‌کنیم» was in nine strings of five screens; it is in two now, where the buyer decides: the mark control's popover and the marked page's empty state. The marked page's lead and popover, the expired and gone notifications and the inbox's lead lost it; the inbox's empty state says what arrives here, and the file page's alert line says «اعلان می‌گیرید» once, as the switch's consequence.
8. **Popovers are one to three short sentences, with the limits a buyer can meet** (guide, section 5): the marked page keeps its cap and two definitions; the alert popover keeps «حداکثر هر ۲ ساعت یک اعلان» and «در روز تا ۸ اعلان»; the request card keeps «کمتر از ۱۰ آگهی» and the two limits («۳ مدل» a file, «۱۰ درخواست» in waiting). What is gone is how it works: a five-minute job, a sweep, a queue, a daily budget, how the «تازه» count is made.
9. **A paused or closed file has no banner.** The badge, the toggle and the line under the alerts switch already say it (R5). Because an e2e test asserted the banner, it now asserts the alert line («پرونده متوقف است، پس اعلانی نمی‌آید.»), which carries the same fact.
10. **The 48-hour window left the file page's empty state** (R7). The search page says the rule once; a file page does not need to repeat it.
11. **Kept in the buyer's own voice:** «همه را خواندم» (the button that marks the inbox read): three words, it names the result, and a person says it that way. It is the one «من» form left in the area, and it is the buyer's, not the product's.

## Lines of markup removed with their strings

The rule is strings only: no new component, prop or file, nothing moved, no constant renamed. A string deleted because it repeated an idea took its one line of JSX with it; there is no other structural edit. Every such edit:

| File | What went |
|---|---|
| `app/(site)/account/notifications/page.tsx` | the lead paragraph |
| `app/(site)/account/marked/page.tsx` | the lead paragraph |
| `features/search-files/components/save-search-button.tsx` | the banner's body paragraph; the dialog's lead; the name field's hint with its id and its `aria-describedby` entry; the success body with its icon (the title and the two buttons remain) |
| `features/search-files/components/search-file-screen.tsx` | the paused and closed banners, and the local `Notice` component nothing used any more |
| `features/search-files/components/file-alerts.tsx` | two of the three info paragraphs |
| `features/search-files/components/request-card.tsx` | the info control's two headed sections (now one section of two sentences) |
| `features/marked-listings/components/marked-list.tsx`, `features/search-files/components/search-files-card.tsx` | the separator « · » between two facts is now «، » |
| `lib/crawl-requests-rules.ts` | `OFFER_RULE.sentences` (four sentences) and their import; `OFFER_RULE.fewMatchesBelow` stays |
| `packages/notifications/src/kinds.ts` | the digest's detail is joined as sentences (`parts.map(…).join(' ')`) instead of with «؛»; a relisted listing without a price has no detail (`undefined`, as a declined request without a reason already had) |
| `features/accounts/accounts-copy.ts`, `features/search-files/search-files-copy.ts`, `lib/crawl-requests-copy.ts` | a constant holds a sentence said in two places (`TAKEN`, `SIGN_IN`, `NO_FILTERS`, `TITLE`) so that the two cannot drift; the keys are unchanged |

Keys deleted because no component reads them (found with an alias-aware scan, not by eye): `MARKED_COPY.noPhoto`, `.view`, `.undo`, `.menuItem`, `.back`; `NOTIFICATIONS_COPY.menuItem`, `.accountCard.open`; `SEARCH_FILES_COPY.save.retry`, `.list.newestPhoto`, `.account.all`, `.account.menu`, `.file.notFoundTitle`, `.file.notFoundBody`; `CRAWL_REQUESTS_COPY.card.leadAnswered`, `.card.asked`. Keys deleted with their markup: `MARKED_COPY.lead`, `NOTIFICATIONS_COPY.lead`, `SEARCH_FILES_COPY.save.dialogLead`, `.save.nameHint`, `.save.createdBody`, `.banner.body`, `.file.pausedNotice`, `.file.closedNotice`, `.alerts.infoWhat`, `.alerts.infoBefore`, `CRAWL_REQUESTS_COPY.card.info.whenHeading`, `.limitsHeading`, `.when`. The shape of two keys changed: `CRAWL_REQUESTS_COPY.card.info.limits` was a list of two sentences and is one sentence; `MARKED_COPY.info.rows` lost its fourth row. No other key was added, split or renamed.

## By screen

### 1. Sign in and sign up

The two pages: fields, hints, the live checks, the errors and the throttle messages (`accounts-copy.ts`). Reviewed 59: rewritten 17, deleted 0, kept 42.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `accounts-copy.ts:26` forgotBody | فعلاً رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، روی کادر رمز عبور پیشنهادش می‌دهد؛ در غیر این صورت حساب کاربری جدید بسازید. | رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، در کادر رمز عبور پیشنهادش می‌دهد. وگرنه حساب تازه‌ای بسازید. | «فعلاً» says unfinished (V5); «؛» split (R4); «در غیر این صورت» is bookish; the guide’s E69 |
| `accounts-copy.ts:31` lead | برای استفاده از تمام قابلیت‌های اپ کارشناس، وارد حساب کاربری خود شوید. | آگهی‌ها را نشان کنید و جست‌وجوهایتان را به کارشناس بسپارید. | told a visitor to sign in on the sign-up page, called the product an «اپ» and promised «all features» (R2, V6); now says what an account is for |
| `accounts-copy.ts:35` recoveryNote | فعلاً رمز عبور فراموش‌شده بازیابی نمی‌شود؛ آن را در مرورگرتان ذخیره کنید. | رمز عبور فراموش‌شده بازیابی نمی‌شود. آن را در مرورگرتان ذخیره کنید. | «فعلاً» dropped (V5); «؛» becomes a full stop (R4) |
| `accounts-copy.ts:39` hint | فقط حروف انگلیسی، عدد و زیرخط (_)؛ `{…}` تا `{…}`، که با یک حرف شروع شود. | حروف انگلیسی، عدد و زیرخط. `{…}` تا `{…}`، با حرف شروع شود. | 15 words with «؛» and a parenthesis (R4, over the hint budget); «فقط» and «یک» cut |
| `accounts-copy.ts:43` takenLiveBeforeLink | گرفته شده؛ نام دیگری بنویسید یا | گرفته شده. نام دیگری بنویسید یا | «؛» becomes a full stop; the short form stays so that it fits one line of a 320 px phone |
| `accounts-copy.ts:45` cannotCheck | آزاد بودن نام هنگام ثبت‌نام بررسی می‌شود. | آزاد بودن نام هنگام ثبت‌نام معلوم می‌شود. | «بررسی می‌شود» is the system’s verb; now says when the buyer will know |
| `accounts-copy.ts:46` persianKeyboard | صفحه‌کلید فارسی است؛ آن را انگلیسی کنید. | صفحه‌کلید فارسی است. آن را انگلیسی کنید. | «؛» becomes a full stop (R4) |
| `accounts-copy.ts:50` hint | حداقل `{…}`؛ هرچه بلندتر، بهتر. | حداقل `{…}`. هرچه بلندتر، بهتر. | «؛» becomes a full stop (R4) |
| `accounts-copy.ts:51` show | نمایش رمز عبور | نمایش رمز | the pair «نمایش رمز» and «پنهان کردن رمز» is parallel, and the second is within the three words of a button name |
| `accounts-copy.ts:52` hide | پنهان کردن رمز عبور | پنهان کردن رمز | was four words (over the button budget); «رمز عبور» → «رمز», as the pair now says it |
| `accounts-copy.ts:53` shown | رمز عبور نمایش داده می‌شود | رمز عبور نمایش داده شد | parallel with «رمز عبور پنهان شد»: both announcements are past-tense facts |
| `accounts-copy.ts:55` persianKeyboard | فارسی تایپ شد؛ صفحه‌کلید را بررسی کنید. | صفحه‌کلید فارسی است. | the username and the password fields said it two ways (R6); now one fact, the keyboard is Persian |
| `accounts-copy.ts:82` usernameNotLatin | فقط حرف انگلیسی، عدد و _ بنویسید. | فقط حروف انگلیسی، عدد و _ بنویسید. | «حرف» → «حروف», as the hint and the other messages say |
| `accounts-copy.ts:90` passwordCommon | این رمز بسیار رایج است و زود حدس زده می‌شود. رمز دیگری انتخاب کنید؛ چند کلمه‌ی بی‌ربط کنار هم رمز خوبی می‌سازد. | این رمز خیلی رایج است. رمز دیگری انتخاب کنید، مثلاً چند کلمه‌ی بی‌ربط کنار هم. | two reasons and a tip in three clauses; now the fact, then the way forward with one example (NIST: say why and how to do better) |
| `accounts-copy.ts:98` after | خاموش. اگر حساب ندارید، ثبت‌نام کنید. | خاموش. | the line under the form already offers «ثبت‌نام کنید» (R5) |
| `accounts-copy.ts:100` busy | همین حالا نشد؛ چند ثانیه‌ی دیگر دوباره امتحان کنید. | تعداد درخواست‌ها الان زیاد است. چند ثانیه‌ی دیگر دوباره امتحان کنید. | «همین حالا نشد» had no subject (T8); says the cause in the buyer’s terms, then the step; «؛» split |
| `accounts-copy.ts:125` signUpThrottledMessage | ثبت‌نام‌های زیادی از این شبکه انجام شده است. `{…}` | از این شبکه ثبت‌نام‌های زیادی شده است. `{…}` | «انجام شده است» hid the verb (T8); «از این شبکه» stays: it is why a buyer who did little is held |

Kept: «کاراکتر»، «دقیقه‌ی»، «ورود»، «ورود به کارشناس»، «ورود»، «حساب ندارید؟»، «ثبت‌نام کنید»، «رمز عبور را فراموش کرده‌اید؟»، «ثبت‌نام»، «ثبت‌نام در کارشناس»، «ثبت‌نام»، «حساب دارید؟»، «وارد شوید»، «نام کاربری»، «این نام کاربری آزاد است.»، «این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا»، «وارد شوید»، «رمز عبور»، «رمز عبور پنهان شد»، «کلید»، «روشن است.»، «این موارد را درست کنید»، «خطا: »، «یک نام کاربری انتخاب کنید.»، «نام کاربری باید حداقل … باشد.»، «نام کاربری باید حداکثر … باشد.»، «نام کاربری را با حروف انگلیسی بنویسید.»، «نام کاربری باید با حرف انگلیسی شروع شود.»، «این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا وارد شوید.»، «یک رمز عبور انتخاب کنید.»، «رمز عبور باید حداقل … باشد.»، «رمز عبور باید حداکثر … باشد.»، «رمز عبور نباید از نام کاربری یا نام کارشناس ساخته شده باشد.»، «نام کاربری را وارد کنید.»، «رمز عبور را وارد کنید.»، «نام کاربری یا رمز عبور درست نیست.»، «صفحه‌کلید باید انگلیسی باشد و»، «اعلان خوانده‌نشده»، «… دیگر»، «کمتر از یک دقیقه‌ی دیگر دوباره امتحان کنید.»، «… دیگر دوباره امتحان کنید.»، «چند بار پشت سر هم ورود ناموفق بود. …».

### 2. The account menu and the account page

The header link, the account menu and the account page (`accounts-copy.ts`). The three cards on the account page are counted with their own screens. Reviewed 13: rewritten 1, deleted 0, kept 12.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `accounts-copy.ts:74` superadmin | این حساب مدیر کارشناس است. | این حساب مدیر است. | «کارشناس» was the name used as a possessive; the glossary word for the role is «مدیر» |

Kept: «ورود / ثبت‌نام»، «ورود»، «منوی حساب کاربری»، «حساب کاربری»، «آگهی‌های نشان‌شده»، «اعلان‌ها»، «پرونده‌های جست‌وجو»، «پنل مدیریت»، «خروج از حساب»، «حساب کاربری»، «نام کاربری»، «عضو از».

### 3. The mark control

`marks-copy.ts`: the button on a card and a listing page, the popover a visitor gets, the toasts. Reviewed 20: rewritten 6, deleted 0, kept 14.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `marks-copy.ts:17` body | آگهی‌های نشان‌شده در حساب شما می‌مانند. اگر قیمتشان کم شود یا فروخته شوند، همین‌جا خبرتان می‌کنیم. | آگهی‌های نشان‌شده در حساب شما می‌مانند. اگر قیمتشان کم شود یا فروخته شوند، در اعلان‌ها خبرتان می‌کنیم. | «همین‌جا» inside a popover pointed at nothing; says where (the inbox) |
| `marks-copy.ts:19` signUp | ساخت حساب | ثبت‌نام | «ساخت حساب» → «ثبت‌نام», the glossary’s word, as the dialogs of the search files already say it (R6) |
| `marks-copy.ts:24` mark | نشان کردن انجام نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | آگهی نشان نشد. | a retry sentence beside the toast’s retry button (R5); «انجام نشد» is T8 |
| `marks-copy.ts:25` unmark | برداشتن نشان انجام نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | نشان آگهی برداشته نشد. | as above, and now parallel with «نشان آگهی برداشته شد» |
| `marks-copy.ts:26` signedOut | از حساب خارج شده‌اید؛ دوباره وارد شوید. | از حساب خارج شده‌اید. دوباره وارد شوید. | «؛» becomes a full stop (R4) |
| `marks-copy.ts:28` missing | این آگهی دیگر در کارشناس نیست. | این آگهی دیگر وجود ندارد. | «در کارشناس» named the product as a place; says the fact the file page says too |

Kept: «نشان کردن»، «نشان‌شده»، «برداشتن نشان»، «نشان کردن آگهی …»، «آگهی نشان شد.»، «نشان آگهی برداشته شد.»، «آگهی برایتان نشان شد.»، «برای نشان کردن وارد شوید»، «ورود»، «بستن»، «بعد از ورود به همین صفحه برمی‌گردید و آگهی نشان‌شده است.»، «به سقف … آگهی نشان‌شده رسیده‌اید. نشان چند آگهی را بردارید و دوباره امتحان کنید.»، «تلاش دوباره»، «بستن».

### 4. The marked listings page

`marked-copy.ts`, `marked-view.ts`, and the account card. Reviewed 53: rewritten 13, deleted 8, kept 32.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `marked-copy.ts:11` count | `{…}` آگهی نشان‌شده | آگهی | the account card read «آگهی‌های نشان‌شده: ۳ آگهی نشان‌شده» (R5) |
| `marked-copy.ts:12` filtersLabel | کدام آگهی‌ها را ببینم | فیلتر آگهی‌ها | was the buyer’s question in the first person («ببینم»); a noun now |
| `marked-copy.ts:22` whenMarked | روز نشان کردن | قیمت روزی که نشان کردید | «روز نشان کردن» named a day above a price; says whose price it is |
| `marked-copy.ts:28` detailDown | `{…}` ارزان‌تر از روزی که نشانش کردید (`{…}`) | `{…}` (`{…}`) ارزان‌تر شده است. | the label above already says the day of marking (R5); the amount keeps its share, one pair of numbers |
| `marked-copy.ts:29` detailUp | `{…}` گران‌تر از روزی که نشانش کردید (`{…}`) | `{…}` (`{…}`) گران‌تر شده است. | as above |
| `marked-copy.ts:35` gone | از سایت منبع برداشته شد | از دیوار برداشته شد | «سایت منبع» is our word; the buyer knows «دیوار» |
| `marked-copy.ts:47` body | در جست‌وجو یا صفحه‌ی هر آگهی، «نشان کردن» را بزنید تا اینجا جمع شود. اگر قیمتش کم شود یا فروخته شود، خبرتان می‌کنیم. | در جست‌وجو یا صفحه‌ی آگهی، «نشان کردن» را بزنید. اگر قیمت آگهی نشان‌شده کم شود یا فروخته شود، در اعلان‌ها خبرتان می‌کنیم. | the way forward and the one promise of the page, where the buyer decides again; «تا اینجا جمع شود» was obvious |
| `marked-copy.ts:57` body | اتصال را بررسی کنید و دوباره امتحان کنید. آگهی‌های نشان‌شده‌تان سر جایشان هستند. | آگهی‌های نشان‌شده‌تان سر جایشان هستند. | the retry sentence beside a retry button (R5); the reassurance stays |
| `marked-copy.ts:58` retry | دوباره امتحان کنید | تلاش دوباره | «تلاش دوباره» is the guide’s button |
| `marked-copy.ts:68` title | نشان‌کردن چطور کار می‌کند | آگهی‌های نشان‌شده | «how marking works» is the machinery; the popover’s title is the control’s own name |
| `marked-copy.ts:72` text | هر حساب تا `{…}` آگهی را می‌تواند نشان کند؛ برای نشان‌کردن بیشتر، نشان چند آگهی را بردارید. | `{…}` آگهی برای هر حساب. | the cap as a fact; the way forward is said by the error that appears when it is hit |
| `marked-copy.ts:76` text | وقتی قیمت اعلام‌شده‌ی آگهی از آخرین قیمت اعلام‌شده‌اش کمتر شود؛ توافقی شدن یا قسطی شدن کاهش حساب نمی‌شود. | قیمت امروز از قیمت روزی که نشان کردید کمتر است. توافقی یا قسطی شدن کاهش حساب نمی‌شود. | it described the notification’s rule (the last stated price); the filter compares with the price on the day of marking |
| `marked-copy.ts:80` text | آگهی فروخته شده، منقضی شده یا دیگر در سایت منبع نیست. اگر برگردد، دوباره خبرتان می‌کنیم. | فروخته‌شده، منقضی‌شده یا برداشته‌شده. | four verbs for three states; the promise is not repeated here (R5) |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `marked-copy.ts:10` lead | آگهی‌هایی که نشان کرده‌اید، با قیمت امروزشان کنار قیمت روزی که نشانشان کردید. اگر قیمتی کم شود یا آگهی‌ای فروخته شود، در اعلان‌ها خبرتان می‌کنیم. | the rows label both prices (R5) and the promise belongs to the empty state and the mark control, where the buyer decides (guide, section 4) |
| `marked-copy.ts:41` noPhoto | بدون عکس | no component read it |
| `marked-copy.ts:42` view | دیدن آگهی | no component read it |
| `marked-copy.ts:44` undo | بازگرداندن | no component read it |
| `marked-copy.ts:82` label | زمان اعلان | how long the job takes (R7); E79 |
| `marked-copy.ts:82` text | هر تغییر یک‌بار در اعلان‌ها می‌آید، تا چند دقیقه بعد از دیده‌شدنش. | how long the job takes (R7); E79 |
| `marked-copy.ts:85` menuItem | آگهی‌های نشان‌شده | no component read it |
| `marked-copy.ts:86` back | حساب من | no component read it |

Kept: «آگهی‌های نشان‌شده»، «همه»، «در بازار»، «قیمتشان کم شده»، «از بازار رفته»، «قیمت امروز»، «آخرین قیمت»، «قیمت کم شد»، «قیمت بالا رفت»، «قیمت تغییر نکرده»، «همان قیمت روزی که نشانش کردید.»، «فروخته شد»، «منقضی شد»، «از کارشناس برداشته شد»، «از …»، «بدون ارزیابی»، «نشان‌شده در …»، «نشان برداشته شد.»، «هنوز آگهی‌ای نشان نکرده‌اید»، «جست‌وجوی خودرو»، «آگهی‌ای با این فیلتر ندارید»، «دیدن همه»، «در حال بارگذاری آگهی‌های نشان‌شده…»، «آگهی‌های نشان‌شده بارگذاری نشد»، «آگهی‌های نشان‌شده»، «هنوز آگهی‌ای نشان نکرده‌اید.»، «توضیح درباره‌ی آگهی‌های نشان‌شده»، «بستن»، «سقف»، «کاهش قیمت»، «از بازار رفته»، «…، مدل……».

### 5. The notification inbox and its settings

`notifications-copy.ts` and the account card. Reviewed 32: rewritten 10, deleted 3, kept 19.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `notifications-copy.ts:10` allRead | همه‌ی اعلان‌ها خوانده شده‌اند. | اعلان خوانده‌نشده‌ای ندارید. | the account card says the same state as «اعلان خوانده‌نشده‌ای ندارید»: one wording (R6) |
| `notifications-copy.ts:20` unknownKind | اعلانی که این نسخه‌ی کارشناس نمی‌تواند نشانش دهد. | این اعلان نمایش داده نمی‌شود. | «نسخه‌ی کارشناس» is a version (R7); the guide’s E80 |
| `notifications-copy.ts:23` body | وقتی قیمت آگهی‌ای که نشان کرده‌اید پایین بیاید، همین‌جا خبرتان می‌کنیم؛ بدون اینکه دوباره جست‌وجو کنید. | تغییر قیمت آگهی‌های نشان‌شده و آگهی‌های تازه‌ی پرونده‌های جست‌وجو را اینجا می‌بینید. | a benefit nobody asked for («بدون اینکه دوباره جست‌وجو کنید»); says what arrives here, once |
| `notifications-copy.ts:29` body | اتصال را بررسی کنید و دوباره امتحان کنید. اعلان‌هایتان سر جایشان هستند. | اعلان‌هایتان سر جایشان هستند. | the retry sentence beside a retry button (R5); the reassurance stays |
| `notifications-copy.ts:30` retry | دوباره امتحان کنید | تلاش دوباره | «تلاش دوباره» is the guide’s button |
| `notifications-copy.ts:33` heading | کدام اعلان‌ها را بگیرید | تنظیم اعلان‌ها | an imperative question → a noun phrase title |
| `notifications-copy.ts:34` lead | اعلانی که خاموش کنید دیگر ساخته نمی‌شود؛ اعلان‌هایی که گرفته‌اید می‌مانند. | اعلان خاموش‌شده دیگر نمی‌آید و اعلان‌های قبلی می‌مانند. | «ساخته نمی‌شود» is the system’s verb; «؛» split |
| `notifications-copy.ts:37` signedOut | از حساب خارج شده‌اید؛ دوباره وارد شوید. | از حساب خارج شده‌اید. دوباره وارد شوید. | «؛» becomes a full stop (R4) |
| `notifications-copy.ts:38` markRead | علامت خوانده‌شده ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | علامت خوانده‌شده ثبت نشد. | the retry sentence beside the toast’s retry button (R5) |
| `notifications-copy.ts:39` mute | تنظیم اعلان ذخیره نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | تنظیم اعلان ذخیره نشد. | the retry sentence beside the toast’s retry button (R5) |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `notifications-copy.ts:9` lead | هر تغییری در آگهی‌هایی که دنبال می‌کنید، اینجا خبرتان می‌کنیم. | restated the title and the settings below it, and promised again (R2, R5) |
| `notifications-copy.ts:43` menuItem | اعلان‌ها | no component read it |
| `notifications-copy.ts:47` open | دیدن اعلان‌ها | no component read it |

Kept: «اعلان‌ها»، «همه را خواندم»، «علامت خوانده‌شده»، «خوانده‌نشده»، «قیمت قبلی:»، «اعلان‌های قدیمی‌تر»، «برگشت به تازه‌ترین‌ها»، «در حال بارگذاری اعلان‌ها…»، «امروز»، «دیروز»، «هنوز اعلانی ندارید»، «جست‌وجوی خودرو»، «اعلان قدیمی‌تری نیست.»، «اعلان‌ها بارگذاری نشد»، «تلاش دوباره»، «بستن»، «اعلان‌ها»، «اعلان خوانده‌نشده‌ای ندارید.»، «اعلان خوانده‌نشده».

### 6a. What a notification says: a price drop

`kinds.ts`, kind `listing_price_drop`: title and detail from the stored payload, and the setting that switches it off. Reviewed 5: rewritten 3, deleted 0, kept 2.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `kinds.ts:88` detail | `{…}` (`{…}`) ارزان‌تر از قیمت قبلی. | `{…}` (`{…}`) ارزان‌تر شده است. | the inbox row shows «قیمت قبلی» right below (R5); the amount and its share stay |
| `kinds.ts:93` label | کاهش قیمت آگهی‌های نشان‌شده | کاهش قیمت | the description says «آگهی نشان‌شده» (R5) |
| `kinds.ts:94` description | وقتی آگهی‌ای که نشان کرده‌اید ارزان‌تر شود. | وقتی قیمت آگهی نشان‌شده‌ای کم شود. | says the event; the subject is a marked listing |

Kept: « مدل …»، «قیمت …… کم شد».

### 6b. What a notification says: new matches in a search file

`kinds.ts`, kind `search_file_matches`. Reviewed 11: rewritten 3, deleted 0, kept 8.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `kinds.ts:147` title | `{…}` تازه برای `{…}` | `{…}` تازه در `{…}` | «تازه برای» → «تازه در»: the quoted name is a file, not a purpose |
| `kinds.ts:153` label | آگهی‌های تازه‌ی پرونده‌های جست‌وجو | آگهی تازه در پرونده‌ها | the description says «پرونده» (R5); within four words |
| `kinds.ts:155` description | وقتی کارشناس برای پرونده‌ای که در حال پایش است آگهی تازه یا کاهش قیمت پیدا کند. هر پرونده را جداگانه هم می‌شود بی‌صدا کرد. | وقتی در پرونده‌ای که فعال است، آگهی تازه‌ای با قیمت خوب بیاید یا قیمتی کم شود. هر پرونده را جداگانه هم می‌شود خاموش کرد. | «کارشناس» as a subject, «پایش» (jargon), «بی‌صدا» for what the glossary calls «خاموش»; the job tells only of good prices and drops |

Kept: «همه‌شان قیمت خوب یا عالی دارند»، «… از آن‌ها قیمت خوب یا عالی دارد»، «آگهی»، «… هم ارزان‌تر شده»، «آگهی»، «آگهی»، «… در … ارزان‌تر شد»، «آگهی».

### 6c. What a notification says: the answer to a crawl request

`kinds.ts`, kind `crawl_request_decided`. Reviewed 6: rewritten 4, deleted 0, kept 2.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `kinds.ts:187` detail | این مدل در صف خواندن آگهی‌ها قرار گرفت و آگهی‌هایش پس از خوانده شدن به پرونده‌ی شما می‌آید. | آگهی‌های این مدل را می‌خوانیم تا در پرونده‌ی شما بیایند. | a queue (R7); the same sentence as the card’s note (R6); the guide’s E81 |
| `kinds.ts:192` title | درخواست شما برای `{…}` پذیرفته نشد | درخواست شما برای `{…}` رد شد | «رد شد» is the state’s word on the card (R6) |
| `kinds.ts:198` label | پاسخ به درخواست جست‌وجوی بیشتر | پاسخ درخواست جست‌وجوی بیشتر | was five words for a label; one word less, the glossary’s noun |
| `kinds.ts:199` description | وقتی کارشناس درخواست شما برای خواندن بیشتر آگهی‌های یک مدل را تأیید یا رد کند. | وقتی مدیر درخواست شما را تأیید یا رد کند. | «کارشناس» as a subject; the label says what is answered |

Kept: «درخواست شما برای … تأیید شد»، «دلیل: …».

### 6d. What a notification says: a marked listing left the market

`kinds.ts`, kind `listing_off_market`. Reviewed 9: rewritten 6, deleted 0, kept 3.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `kinds.ts:226` detail | فروشنده آن را فروخته‌شده اعلام کرده است. چند خودروی مشابه را ببینید. | فروشنده آن را فروخته‌شده اعلام کرده است. | the reason; the row already leads to the listing (R5) |
| `kinds.ts:230` detail | مهلت آگهی تمام شده است. اگر فروشنده دوباره آن را بگذارد، خبرتان می‌کنیم. | مهلت آگهی تمام شده است. | the reason; the promise to tell of a return belongs to the setting (R5) |
| `kinds.ts:233` title | آگهی `{…}` دیگر در سایت منبع نیست | آگهی `{…}` دیگر در دیوار نیست | «سایت منبع» → the site’s name (guide, section 4) |
| `kinds.ts:234` detail | یا فروخته شده یا فروشنده آن را برداشته است. اگر برگردد، خبرتان می‌کنیم. | یا فروخته شده یا فروشنده آن را برداشته است. | the reason; the promise as above |
| `kinds.ts:250` label | فروش یا برداشته‌شدن آگهی‌های نشان‌شده | از بازار رفتن آگهی | was five words; the filter’s word «از بازار رفته» |
| `kinds.ts:251` description | وقتی آگهی‌ای که نشان کرده‌اید فروخته شود، منقضی شود یا از سایت منبع برداشته شود. | وقتی آگهی نشان‌شده‌ای فروخته شود، منقضی شود یا از دیوار برداشته شود. | «سایت منبع» → «دیوار» |

Kept: « مدل …»، «آگهی … فروخته شد»، «آگهی … منقضی شد».

### 6e. What a notification says: a marked listing came back

`kinds.ts`, kind `listing_relisted`. Reviewed 5: rewritten 4, deleted 1, kept 0.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `kinds.ts:275` title | آگهی `{…}` دوباره آمد | آگهی `{…}` به بازار برگشت | where it came back; «دوباره آمد» had no place |
| `kinds.ts:279` detail | دوباره در فهرست است؛ قیمت: `{…}`. | قیمتش `{…}` است. | «؛» and a colon; says the price in a sentence |
| `kinds.ts:283` label | بازگشت آگهی‌های نشان‌شده | بازگشت آگهی به بازار | parallel with «از بازار رفتن آگهی» |
| `kinds.ts:284` description | وقتی آگهی‌ای که نشان کرده‌اید و از بازار رفته بود، دوباره بیاید. | وقتی آگهی نشان‌شده‌ای که از بازار رفته بود، دوباره بیاید. | the subject is a marked listing |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `kinds.ts:278` detail | دوباره در فهرست است. | repeated the title (R5): with no price a relisted row has no detail |

### 7. Search files: the list and the account card

`search-files-copy.ts` (title, lead, states, cards, empty and error), `search-file-name.ts`. Reviewed 32: rewritten 14, deleted 3, kept 15.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `search-files-copy.ts:20` watching | در حال پایش | فعال | «پایش» is jargon (guide, appendix A.2); an adjective composes in a sentence («پرونده فعال است») and pairs with «متوقف» |
| `search-files-copy.ts:27` lead | جست‌وجوهایی که به کارشناس سپرده‌اید. هر پرونده آگهی‌های مطابق جست‌وجوی خودش را نشان می‌دهد و می‌گوید از آخرین دیدن شما چه چیزی تازه آمده است. | هر پرونده نشان می‌دهد از آخرین بازدیدتان چند آگهی تازه آمده است. | two sentences for one idea, and «آخرین دیدن» is a calque; says what each card shows that the title does not |
| `search-files-copy.ts:74` emptyBody | جست‌وجویی را با فیلترهایتان بسازید و با «بسپارش به کارشناس» نگهش دارید. کارشناس برایتان می‌گوید چه چیزی تازه آمده است. | در جست‌وجو فیلترهایتان را بگذارید و «سپردن به کارشناس» را بزنید. | «نگهش دارید» and «کارشناس برایتان می‌گوید» (V6); one step |
| `search-files-copy.ts:75` emptyAction | رفتن به جست‌وجو | جست‌وجوی خودرو | one word for «go to search» on the three empty states (R6) |
| `search-files-copy.ts:76` errorTitle | پرونده‌ها خوانده نشد | پرونده‌ها بارگذاری نشد | «خوانده نشد» → «بارگذاری نشد»: one verb for a page that did not load (R6) |
| `search-files-copy.ts:77` errorBody | پایگاه داده پاسخ نداد. پرونده‌های شما سر جایشان هستند؛ کمی بعد دوباره امتحان کنید. | پرونده‌هایتان سر جایشان هستند. | «پایگاه داده» (R7) and the retry sentence (R5) go; the reassurance stays |
| `search-files-copy.ts:84` nothingNew | چیز تازه‌ای نیست | آگهی تازه‌ای نیست | «چیز» → «آگهی»; the guide’s «آگهی تازه‌ای نیست» |
| `search-files-copy.ts:86` unreadable | این پرونده با نسخه‌ی تازه سازگار نیست | فیلترهای این پرونده دیگر وجود ندارند. | «نسخه‌ی تازه» is a version (R7); says what happened to the file |
| `search-files-copy.ts:87` countFailed | شمارش آگهی‌ها ممکن نشد | تعداد آگهی‌ها معلوم نشد. | «ممکن نشد» is T12 |
| `search-files-copy.ts:88` viewed | آخرین دیدن: `{…}` | آخرین بازدید: `{…}` | «آخرین دیدن» is a calque; «آخرین بازدید» is the guide’s |
| `search-files-copy.ts:89` lastAlert | آخرین هشدار: `{…}` | آخرین اعلان: `{…}` | «هشدار» and «اعلان» named one thing; the inbox’s word is «اعلان» (R6) |
| `search-files-copy.ts:90` alertsMuted | هشدار خاموش | اعلان خاموش | as above |
| `search-files-copy.ts:91` open | باز کردن پرونده‌ی «`{…}`» | دیدن پرونده‌ی «`{…}`» | was four words for a link name; «دیدن» is the guide’s verb |
| `search-files-copy.ts:95` none | جست‌وجویی را به کارشناس بسپارید تا برایتان نگه دارد. | هنوز پرونده‌ای ندارید. | «سپردن … تا برایتان نگه دارد» repeated the page; says the buyer’s state, as the other two cards on the account page do |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `search-files-copy.ts:83` newestPhoto | عکس تازه‌ترین آگهی | no component read it |
| `search-files-copy.ts:98` all | همه‌ی پرونده‌ها | no component read it |
| `search-files-copy.ts:99` menu | پرونده‌های جست‌وجو | no component read it |

Kept: «جست‌وجوی خودرو»، «آگهی»، «پرونده»، «متوقف»، «بسته»، «پرونده‌های جست‌وجو»، «در حال بارگذاری پرونده‌ها…»، «هنوز پرونده‌ای ندارید»، «تلاش دوباره»، «بیش از …»، «آگهی مطابقی ندارد»، «بهترین معامله»، «… تازه»، «پرونده‌های جست‌وجو»، «… تازه».

### 8. Saving a search: the dialog and the banner

`search-files-copy.ts` `save.*` and `banner.*`. Reviewed 31: rewritten 13, deleted 5, kept 13.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `search-files-copy.ts:31` button | بسپارش به کارشناس | سپردن به کارشناس | «بسپارش» is a spoken form (V2); the guide’s E73 |
| `search-files-copy.ts:33` buttonFor | بسپارش «`{…}`» به کارشناس | سپردن «`{…}`» به کارشناس | as above |
| `search-files-copy.ts:39` searchLabel | جست‌وجوی این پرونده | جست‌وجو | before the file exists the chips are «the search», not «this file’s search» |
| `search-files-copy.ts:48` saved | ذخیره شد · مشاهده پرونده | دیدن پرونده | two actions in one label with a middle dot (R8); the check icon says it was saved; the guide’s E72 |
| `search-files-copy.ts:49` savedBefore | پرونده دارید · مشاهده پرونده | دیدن پرونده | as above |
| `search-files-copy.ts:52` existsBody | پرونده‌ی «`{…}`» (`{…}`) همین جست‌وجو را دارد. | پرونده‌ی «`{…}`» همین جست‌وجو را دارد و `{…}` است. | the state in a parenthesis → a clause the adjective states compose («و فعال است») |
| `search-files-copy.ts:53` limitTitle | پرونده‌ی تازه جا ندارید | به سقف پرونده‌ها رسیده‌اید | «جا ندارید» is a calque; the guide’s E74, as the marks’ own cap message says it |
| `search-files-copy.ts:55` limitAction | رفتن به پرونده‌ها | دیدن پرونده‌ها | «دیدن …» is the guide’s verb for going to a page of ours |
| `search-files-copy.ts:56` failed | پرونده ساخته نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | جست‌وجو سپرده نشد. دوباره امتحان کنید. | said «file made» when nothing was; the retry sentence (R5) goes, the retry step stays |
| `search-files-copy.ts:57` invalidName | نام پرونده باید از ۱ تا `{…}` نویسه باشد. | نام پرونده باید از `{…}` تا `{…}` باشد. | «نویسه» → «کاراکتر» (glossary); the digit «۱» was typed by hand, now from the formatter (R10) |
| `search-files-copy.ts:58` invalidSearch | این جست‌وجو را نمی‌شود نگه داشت. صفحه را تازه کنید و دوباره امتحان کنید. | این جست‌وجو را نمی‌شود سپرد. صفحه را تازه کنید و دوباره امتحان کنید. | «نگه داشت» → «سپرد»: one verb for handing a search over (R6) |
| `search-files-copy.ts:62` signedOutBody | پرونده‌ی جست‌وجو در حساب شما نگه داشته می‌شود. بعد از ورود یا ثبت‌نام، به همین جست‌وجو برمی‌گردید و پرونده را می‌سازید. | بعد از ورود یا ثبت‌نام، به همین جست‌وجو برمی‌گردید و پرونده را می‌سازید. | its first sentence was the system’s storage; the next step stays |
| `search-files-copy.ts:67` title | بگذارید کارشناس دنبال این ماشین بگردد | آگهی‌های تازه‌ی این جست‌وجو را جدا ببینید | «کارشناس» as a subject that «searches for a car» (V6); says the benefit in a fact |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `search-files-copy.ts:36` dialogLead | کارشناس این جست‌وجو را در یک پرونده برایتان نگه می‌دارد و هر بار که سر بزنید می‌گوید چه آگهی‌ای تازه آمده است. | the title and the page lead say it (R5); the guide’s E71 |
| `search-files-copy.ts:41` nameHint | برای پیدا کردنش در فهرست پرونده‌ها. | said what the label «نام پرونده» says (R2) |
| `search-files-copy.ts:44` createdBody | «`{…}`» در پرونده‌های جست‌وجوی شما نگه داشته می‌شود. | repeated the dialog’s title «پرونده ساخته شد»; the two buttons are the way forward |
| `search-files-copy.ts:59` retry | تلاش دوباره | no component read it |
| `search-files-copy.ts:68` body | این جست‌وجو را به کارشناس بسپارید؛ هر بار که برگردید، آگهی‌های تازه‌اش را جدا نشان می‌دهد. | repeated the title and the button (R5), with «؛» |

Kept: «این جست‌وجو را به کارشناس بسپارید»، «بستن»، «در حال آماده‌سازی…»، «نام پرونده»، «ساختن پرونده»، «پرونده ساخته شد»، «دیدن پرونده»، «ادامه‌ی جست‌وجو»، «این جست‌وجو را پیش‌تر سپرده‌اید»، «هر حساب تا … می‌تواند داشته باشد. برای ساختن این یکی، پرونده‌ای را که دیگر لازم ندارید پاک کنید.»، «برای سپردن جست‌وجو وارد شوید»، «ثبت‌نام»، «ورود».

### 9. A search file's page: controls, alerts and matches

`search-files-copy.ts` `file.*`, `alerts.*` and `actions.*`. Reviewed 56: rewritten 26, deleted 6, kept 24.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `search-files-copy.ts:107` createdOn | ساخته‌شده: `{…}` | ساخته‌شده در `{…}` | a label with a colon → «ساخته‌شده در», as the marked page says «نشان‌شده در» |
| `search-files-copy.ts:113` newSince | `{…}` تازه از آخرین دیدن شما (`{…}`) | `{…}` تازه از آخرین بازدیدتان در `{…}` | «آخرین دیدن شما» → «آخرین بازدیدتان»; the date after «در» instead of a parenthesis |
| `search-files-copy.ts:116` alertNote | آخرین هشدار: `{…}`. هشدار فقط برای آگهی با قیمت خوب یا برای کاهش قیمت می‌آید؛ شمار «تازه» همه‌ی آگهی‌های تازه را از آخرین دیدن شما می‌شمارد. | آخرین اعلان: `{…}` | 26 words with «؛»: it explained the difference between a notification and the «تازه» count, which the info control and the line under the switch say (R5) |
| `search-files-copy.ts:117` nothingNew | از آخرین دیدن شما (`{…}`) آگهی تازه‌ای نیامده است. | از آخرین بازدیدتان در `{…}` آگهی تازه‌ای نیامده است. | as newSince |
| `search-files-copy.ts:118` shownOf | `{…}` آگهی از `{…}` نمایش داده شد | `{…}` از `{…}` نمایش داده شد | said «آگهی» twice («۲۴ آگهی از ۱۲۰ آگهی») |
| `search-files-copy.ts:119` seeAll | دیدن همه‌ی `{…}` در جست‌وجو | دیدن همه‌ی `{…}` | was five words for a link; the total carries its noun |
| `search-files-copy.ts:121` emptyWatching | در `{…}` ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. پرونده نگه داشته می‌شود و هر آگهی مطابقی که بیاید همین‌جا می‌بینید. | هر آگهی مطابقی که بیاید، همین‌جا می‌بینید. | the 48-hour window is the search page’s rule, not this file’s (R7); the way forward stays |
| `search-files-copy.ts:122` emptyOther | در `{…}` ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. جست‌وجو را باز کنید و فیلترها را بازتر کنید. | فیلترها را بازتر کنید. | as above; the link «باز کردن در جست‌وجو» is in the column beside it |
| `search-files-copy.ts:126` unreadableTitle | این جست‌وجو با نسخه‌ی تازه سازگار نیست | آگهی‌های این پرونده نمایش داده نمی‌شود | «نسخه‌ی تازه» is a version (R7); says what the buyer sees |
| `search-files-copy.ts:128` unreadableBody | فیلترهای این پرونده دیگر وجود ندارند، پس آگهی‌هایش را نشان نمی‌دهیم تا چیز نادرستی نبینید. می‌توانید پرونده را پاک کنید و جست‌وجو را دوباره بسپارید. | فیلترهای این پرونده دیگر وجود ندارند. پرونده را پاک کنید و جست‌وجو را دوباره بسپارید. | «تا چیز نادرستی نبینید» defended the system; the fact and the step remain |
| `search-files-copy.ts:129` resultsFailedTitle | آگهی‌های پرونده خوانده نشد | آگهی‌های پرونده بارگذاری نشد | «خوانده نشد» → «بارگذاری نشد» (R6) |
| `search-files-copy.ts:130` resultsFailedBody | پایگاه داده پاسخ نداد. خود پرونده سر جایش است؛ کمی بعد دوباره امتحان کنید. | خود پرونده سر جایش است. | «پایگاه داده» (R7) and the retry sentence (R5) go |
| `search-files-copy.ts:135` label | هشدار آگهی تازه | اعلان این پرونده | «هشدار» → «اعلان»; it also covers price drops, not only new listings |
| `search-files-copy.ts:136` on | وقتی آگهی تازه یا کاهش قیمتی پیدا شود، در اعلان‌هایتان خبرتان می‌کنیم. | وقتی آگهی تازه‌ای با قیمت خوب بیاید یا قیمتی کم شود، اعلان می‌گیرید. | promised every new listing; the job tells of those with a good price or a price drop only |
| `search-files-copy.ts:137` off | هشدار این پرونده خاموش است. پرونده آگهی‌ها را همچنان پیدا می‌کند و تازه‌ها را همین‌جا می‌بینید. | آگهی‌های تازه را فقط همین‌جا می‌بینید. | two sentences for one fact; the switch already says it is off |
| `search-files-copy.ts:138` notWatching | پرونده پایش نمی‌شود، پس تا ادامه‌ی پایش هشداری نمی‌آید. | پرونده متوقف است، پس اعلانی نمی‌آید. | «پایش» (jargon) and a repeated «پایش»; says why in one clause |
| `search-files-copy.ts:139` infoLabel | توضیح درباره‌ی هشدار پرونده | توضیح درباره‌ی اعلان این پرونده | «هشدار» → «اعلان» (R6) |
| `search-files-copy.ts:141` infoTitle | هشدار پرونده چطور کار می‌کند؟ | اعلان این پرونده | the control’s own name, not «how it works» |
| `search-files-copy.ts:143` infoLimits | برای هر پرونده دست‌کم `{…}` ساعت میان دو اعلان می‌ماند و هر حساب در روز تا `{…}` اعلان پرونده می‌گیرد. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید. | برای هر پرونده حداکثر هر `{…}` ساعت یک اعلان می‌آید و در روز تا `{…}` اعلان می‌گیرید. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید. | two limits the buyer can meet, in one sentence: at most one every 2 hours, at most 8 a day |
| `search-files-copy.ts:146` failed | تغییر ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | تغییر ثبت نشد. | the retry sentence beside the toast’s retry button (R5) |
| `search-files-copy.ts:149` menu | کارهای پرونده | منوی پرونده | «کارها» (tasks) is a calque; «منوی حساب کاربری» is the pattern |
| `search-files-copy.ts:153` pause | توقف پایش | متوقف کردن | «پایش» is jargon; the button now names the state it leads to, as the badge does |
| `search-files-copy.ts:154` resume | ادامه‌ی پایش | فعال کردن | as above |
| `search-files-copy.ts:159` deleteBody | پرونده پاک می‌شود. آگهی‌ها دست‌نخورده می‌مانند و می‌توانید این جست‌وجو را دوباره بسپارید. | این جست‌وجو را هر وقت خواستید دوباره بسپارید. | repeated the title’s question and talked of listings staying untouched (nobody feared it); the one reassurance a buyer needs |
| `search-files-copy.ts:163` failed | تغییر ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | تغییر ثبت نشد. | the retry sentence beside the toast’s retry button (R5) |
| `search-files-copy.ts:164` signedOut | نشست شما پایان یافته است. دوباره وارد شوید. | از حساب خارج شده‌اید. دوباره وارد شوید. | «نشست» and «پایان یافته است» (T7); one wording for being signed out across the area (R6) |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `search-files-copy.ts:103` notFoundTitle | این پرونده پیدا نشد | no component read it (the route’s not-found page speaks) |
| `search-files-copy.ts:104` notFoundBody | یا پاک شده است یا از حساب دیگری است. پرونده‌های خودتان را در فهرست ببینید. | no component read it |
| `search-files-copy.ts:124` pausedNotice | این پرونده متوقف است و پایش نمی‌شود. آگهی‌های مطابق و تازه‌ها را همچنان می‌بینید؛ با «ادامه‌ی پایش» دوباره دنبال می‌شود. | the badge, the toggle and the line under the alerts switch say it (R5): a paused file sends nothing |
| `search-files-copy.ts:125` closedNotice | این پرونده بسته است. برای دنبال کردن دوباره، بازش کنید. | the badge and «باز کردن دوباره» say it; «بازش» is a spoken form (V2) |
| `search-files-copy.ts:142` infoWhat | کارشناس هر `{…}` دقیقه آگهی‌هایی را که تازه در جست‌وجو آمده‌اند یا قیمتشان کم شده با جست‌وجوی این پرونده می‌سنجد. اگر آگهی تازه‌ای با قیمت خوب یا عالی بیابد یا قیمت آگهی‌ای کم شده باشد، یک اعلان می‌فرستد، نه یک اعلان برای هر آگهی. آگهی‌های تازه‌ی دیگر فقط با نشان «تازه» در همین صفحه می‌آیند. | explained a five-minute job and a «sweep» (R7); the rule is the line under the switch (R5) |
| `search-files-copy.ts:145` infoBefore | آگهی‌هایی که پیش از ساخت پرونده در جست‌وجو بودند تازه حساب نمی‌شوند. با خاموش کردن هشدار هم چیزی پاک نمی‌شود. | how the count is made (R7) |

Kept: «پرونده‌های جست‌وجو»، «جست‌وجوی این پرونده»، «باز کردن در جست‌وجو»، «آگهی‌های مطابق»، «به ترتیب بهترین معامله»، «بیش از …»، «تازه»، «هنوز آگهی مطابقی ندارد»، «تلاش دوباره»، «در حال بارگذاری آگهی‌های پرونده…»، «بستن»، «تغییر نام»، «تغییر نام پرونده»، «ذخیره‌ی نام»، «بستن پرونده»، «باز کردن دوباره»، «پاک کردن پرونده»، «پرونده‌ی «…» پاک شود؟»، «پاک کردن»، «نگه داشتن»، «انصراف»، «این پرونده دیگر وجود ندارد.»، «بستن پیام»، «تلاش دوباره».

### 10. The crawl request card on a file page

`crawl-requests-copy.ts` and `crawl-requests-rules.ts` (shared with the superadmin screen, which reads only the state labels). Reviewed 53: rewritten 22, deleted 10, kept 21.

| Where (before) | Before | After | Why |
|---|---|---|---|
| `crawl-requests-copy.ts:32` title | از کارشناس بخواهید بیشتر بگردد | درخواست جست‌وجوی بیشتر | a verb phrase with «کارشناس» as a subject (V6); the glossary’s noun, as the list label and the setting say it (R6) |
| `crawl-requests-copy.ts:33` infoLabel | توضیح درباره‌ی «از کارشناس بخواهید بیشتر بگردد» | توضیح درباره‌ی درخواست جست‌وجوی بیشتر | follows the title |
| `crawl-requests-copy.ts:34` infoClose | بستن توضیح | بستن | one «بستن» for every info control |
| `crawl-requests-copy.ts:36` what | کارشناس آگهی‌ها را مدل‌به‌مدل و در اندازه‌ی ظرفیت روزانه‌ی خواندن می‌خواند. اگر مدل پرونده‌ی شما هنوز کامل خوانده نمی‌شود، می‌توانید درخواست بدهید و مدیر درباره‌اش تصمیم می‌گیرد. | بعضی مدل‌ها را کامل نمی‌خوانیم. اگر کمتر از `{…}` آگهی مطابق پرونده‌ی شما باشد، درخواست بدهید تا مدیر تصمیم بگیرد. | «ظرفیت روزانه‌ی خواندن» and «مدل‌به‌مدل» are the crawler (R7); the guide’s E82, with the one number a buyer can check |
| `crawl-requests-copy.ts:41` limits | هر پرونده تا `{…}` (یا تیپ) می‌تواند بخواهد. | هر پرونده تا `{…}` و هر حساب تا `{…}` در انتظار پاسخ دارد. | the two limits a buyer can meet, in one sentence; «(یا تیپ)» was a parenthesis |
| `crawl-requests-copy.ts:47` lead | هیچ آگهی‌ای با این پرونده نمی‌خواند. اگر کارشناس این مدل را کامل‌تر بخواند، آگهی‌های بیشتری پیدا می‌شود. | آگهی مطابق این پرونده نداریم. | «با این پرونده می‌خواند» is odd Farsi; «کارشناس … بخواند» (V6) and the benefit that the title and the info control say (R5) |
| `crawl-requests-copy.ts:48` lead | فقط `{…}` با این پرونده می‌خواند. اگر کارشناس این مدل را کامل‌تر بخواند، آگهی‌های بیشتری پیدا می‌شود. | فقط `{…}` مطابق این پرونده داریم. | as above |
| `crawl-requests-copy.ts:55` addModel | باز کردن جست‌وجو و انتخاب مدل | انتخاب مدل در جست‌وجو | two actions in one link; says where it goes |
| `crawl-requests-copy.ts:57` needsModel | برای درخواست، در جست‌وجو یک مدل یا تیپ را مشخص کنید. آگهی‌ها مدل‌به‌مدل خوانده می‌شوند، پس برای یک برند تنها نمی‌شود درخواست داد. | برای درخواست، در جست‌وجو یک مدل یا تیپ را مشخص کنید. | the second sentence explained that reading is model by model (R7) |
| `crawl-requests-copy.ts:58` tooMany | این پرونده بیش از `{…}` دارد. پرونده‌ای با مدل‌های کمتر بسازید تا بتوانید درخواست بدهید. | این پرونده بیش از `{…}` دارد. برای درخواست، پرونده‌ای با مدل‌های کمتر بسازید. | the purpose clause was obvious; the step first |
| `crawl-requests-copy.ts:60` pendingJoin | کس دیگری پیش‌تر درخواست داده و منتظر پاسخ است؛ با ثبت درخواست، شما هم خبر می‌گیرید. | کس دیگری پیش‌تر درخواست داده و منتظر پاسخ است. با ثبت درخواست، پاسخ را شما هم می‌گیرید. | «؛» split; says what the buyer gets |
| `crawl-requests-copy.ts:61` pending | مدیر هنوز تصمیم نگرفته است. پاسخ را در اعلان‌ها می‌بینید. | پاسخ را در اعلان‌ها می‌بینید. | the badge says «در انتظار تأیید» (R5); the note keeps where the answer comes |
| `crawl-requests-copy.ts:63` approvedPaused | در صف خواندن است. خواندن آگهی‌ها اکنون متوقف است؛ تا از سر گرفته شود چیزی خوانده نمی‌شود و به محض شروع، نوبت این مدل می‌رسد. | آگهی‌های این مدل با تأخیر در پرونده‌ی شما می‌آیند. | queue and crawler (R7); the guide’s E83: the effect a buyer sees |
| `crawl-requests-copy.ts:64` approved | در صف خواندن آگهی‌هاست و آگهی‌هایش پس از خوانده شدن به پرونده‌ی شما می‌آید. | آگهی‌های این مدل را می‌خوانیم تا در پرونده‌ی شما بیایند. | a queue (R7); one sentence for the card and the notification (the guide’s E81) |
| `crawl-requests-copy.ts:66` fulfilled | خوانده شده است و آگهی‌هایش در جست‌وجو هست. | حالا آگهی‌های این مدل را در جست‌وجو می‌بینید. | the badge says «خوانده شد»; the note keeps what it means for the buyer |
| `crawl-requests-copy.ts:67` tracked | کارشناس این مدل را از پیش به‌طور کامل می‌خواند؛ برای آن درخواستی لازم نیست. | برای این مدل درخواستی لازم نیست. | the badge says «از پیش خوانده می‌شود»; the note keeps the step, none |
| `crawl-requests-copy.ts:71` tooMany | این پرونده بیش از حد مجاز مدل دارد. | این پرونده بیش از `{…}` دارد. | «حد مجاز» is bureaucratic; says the number |
| `crawl-requests-copy.ts:72` fileLimit | هر پرونده تا `{…}` می‌تواند بخواهد. | هر پرونده تا `{…}` مدل یا تیپ می‌تواند درخواست بدهد. | «می‌تواند بخواهد» → «درخواست بدهد»; a model or a trim, as the card says |
| `crawl-requests-copy.ts:73` accountLimit | تا `{…}` در انتظار پاسخ دارید. پس از پاسخ، می‌توانید درخواست تازه بدهید. | حداکثر `{…}` در انتظار پاسخ دارید. درخواست تازه را بعد از پاسخ ثبت کنید. | «می‌توانید» → the step in the imperative (T4) |
| `crawl-requests-copy.ts:75` failed | درخواست ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید. | درخواست ثبت نشد. | the retry sentence beside the toast’s retry button (R5) |
| `crawl-requests-copy.ts:76` signedOut | نشست شما پایان یافته است. دوباره وارد شوید. | از حساب خارج شده‌اید. دوباره وارد شوید. | one wording for being signed out across the area (R6); «نشست» and T7 |
| `crawl-requests-copy.ts:85` count | ، `{…}` درخواست | برای `{…}` مدل | a leading comma beside a badge; says how many models |

Deleted:

| Where (before) | Before | Why |
|---|---|---|
| `crawl-requests-copy.ts:37` whenHeading | این کارت چه وقت نشان داده می‌شود | headings in a popover; each condition is said by the card where it applies (R5) |
| `crawl-requests-copy.ts:39` limitsHeading | محدودیت‌ها | a heading in a popover |
| `crawl-requests-copy.ts:42` limits | هر حساب تا `{…}` در انتظار پاسخ دارد. | merged into the sentence above |
| `crawl-requests-copy.ts:49` leadAnswered | درخواست شما برای این پرونده این‌طور پیش رفته است. | no component read it |
| `crawl-requests-copy.ts:53` asked | درخواست ثبت شد. وقتی مدیر تصمیم بگیرد، در اعلان‌ها به شما خبر می‌دهیم. | no component read it |
| `crawl-requests-copy.ts:65` declined | مدیر آن را نپذیرفت. | a decline without a reason has nothing to add to its badge «رد شد» (R5) |
| `crawl-requests-rules.ts:32` sentences | کمتر از `{…}` آگهی با این پرونده می‌خواند. | the four conditions are said by the card where each applies, and the info control only says what a request is (R5) |
| `crawl-requests-rules.ts:33` sentences | پرونده خودرو را تا مدل (یا تیپ) مشخص کرده است، چون خواندن آگهی‌ها مدل‌به‌مدل انتخاب می‌شود. | as above (also «مدل‌به‌مدل», R7) |
| `crawl-requests-rules.ts:34` sentences | کارشناس این مدل را هنوز به‌طور کامل نمی‌خواند. | as above (also «هنوز» about the crawler, V5) |
| `crawl-requests-rules.ts:35` sentences | پیش‌تر درخواستی از شما برای آن مدل رد نشده است. | as above |

Kept: «در انتظار تأیید»، «تأیید شد»، «رد شد»، «خوانده شد»، «درخواست نشده»، «از پیش خوانده می‌شود»، «مدل»، «درخواست»، «آگهی»، «ثبت درخواست»، «وقتی مدیر تصمیم بگیرد، در اعلان‌ها خبردار می‌شوید.»، «ثبت درخواست برای …»، «مدل‌های این پرونده»، «دلیل: …»، «درخواست این مدل پیش‌تر رد شده است.»، «درخواست»، «این پرونده دست‌کم … آگهی دارد و نیازی به درخواست نیست.»، «این پرونده دیگر وجود ندارد.»، «بستن پیام»، «تلاش دوباره»، «درخواست جست‌وجوی بیشتر».

## Kept, and why

Most kept strings are glossary nouns and short controls that already follow the guide («ورود», «ثبت‌نام», «نام کاربری», «رمز عبور», «حساب کاربری», «خروج از حساب», «پنل مدیریت», «اعلان‌ها», «نشان کردن», «برداشتن نشان», «تأیید شد», «رد شد»). The ones that needed a decision:

| String | Why it stays |
|---|---|
| «نام کاربری یا رمز عبور درست نیست.» | the guide keeps it (section 3); it names neither field on purpose |
| «به سقف ۲۰۰ آگهی نشان‌شده رسیده‌اید. نشان چند آگهی را بردارید و دوباره امتحان کنید.», «هر حساب تا ۳۰ پرونده می‌تواند داشته باشد. …» | the guide keeps both (a limit as a fact, then the way forward) |
| «این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا وارد شوید.» | ADR-0020's sentence, word for word; now built from one constant that the live check's short form shares |
| «چند بار پشت سر هم ورود ناموفق بود. …», «کمتر از یک دقیقه‌ی دیگر دوباره امتحان کنید.» | they say nothing about whether the account exists, and there is no retry button beside them |
| «این موارد را درست کنید», «خطا: » | the error summary and the title prefix are one pattern for both forms (GOV.UK); a field error and its summary link say the same words on purpose |
| «ورود / ثبت‌نام» | the glossary's header link |
| «همه را خواندم», «علامت خوانده‌شده» | the buyer's own voice, short, naming the result; the check button's name is the pair of the visible one |
| «اعلان‌های قدیمی‌تر», «برگشت به تازه‌ترین‌ها» | links that say where they go |
| «قیمت تغییر نکرده», «همان قیمت روزی که نشانش کردید.» | never shown: an unchanged price gets no badge, but `priceChangeOf` returns them and its unit test reads them |
| «در بازار», «از بازار رفته», «قیمتشان کم شده» | the filters of the marked page, and the words the notification settings now reuse |
| «در انتظار تأیید», «تأیید شد», «رد شد», «خوانده شد», «از پیش خوانده می‌شود» | the glossary's states of a crawl request; the superadmin screen reads the same constants |
| «کلید Caps Lock روشن است.» | the Latin name is isolated in markup; a plain fact |
| «ورود به کارشناس», «ثبت‌نام در کارشناس» | the name of the product as a place, in a heading, as the guide allows |

## Warnings read and kept

`pnpm copy:lint --warnings` on the 12 files shows 9, none of them a violation:

- **«هنوز» ×6**: «هنوز آگهی‌ای نشان نکرده‌اید» (the marked page's title and the account card), «هنوز اعلانی ندارید», «هنوز پرونده‌ای ندارید» (the list's title and the account card), «هنوز آگهی مطابقی ندارد». Each is the buyer's own state or data that will exist, and the next step follows (guide, section 3).
- **A parenthesis ×3**: «۲۰ میلیون تومان (۳٪) ارزان‌تر شده است.» on the marked row (up and down) and in the inbox row of a price drop. The percent is the same quantity in a second unit, not an aside, and no sentence says it shorter.

## Self-review with the `copy-fa` scan

The skill's scan (`references/review.md`) over the 12 files flags the «R8» candidates («هنوز», the six read above) and the «R5» candidates for a retry sentence, and each of those is a message with no retry button beside it: the throttle and busy messages of the sign-in and sign-up forms, the dialog's «جست‌وجو سپرده نشد. دوباره امتحان کنید.», «صفحه را تازه کنید و دوباره امتحان کنید.», and the guide's own «به سقف … رسیده‌اید». No T, M or V pattern is left, no «من» verb is the product's, «کارشناس» is never a subject, no string carries a number typed by hand, and every word that appears nowhere else in the repository was checked for its half-spaces (11 words, all right). Every screen's strings were read as a set; the repeats that surfaced and were cut are in the tables above (for instance «خبرتان می‌کنیم» was in nine strings and is in two).

## Tests changed

None was weakened. Three assertions needed more than a word and are explained in the third bullet.

- `packages/notifications/src/kinds.test.ts`: the new wording of the five kinds, plus assertions for the three off-market details and for a relisted listing without a price. The package's 14 tests pass.
- `apps/worker/src/jobs/marks.db.test.ts`, `search-match.db.test.ts`: two regular expressions follow the new titles («دیگر در دیوار نیست», «تازه در «»).
- `e2e/fixtures/marks.ts`, `e2e/fixtures/notifications.ts`, and the specs `accounts`, `marks`, `notifications`, `search-files`, `search-file-alerts`, `crawl-requests`, `button-labels`: the retyped words follow the new ones (the e2e package keeps its own copy tables and imports nothing from the app). Three assertions needed more than a word: (1) the alert popover's `toContainText('۵ دقیقه')` became `not.toContainText('دقیقه')`, because how often the job runs is no longer said (R7), with the two limits still asserted from the job's numbers; (2) the paused file's `getByRole('note')` became the line under the alerts switch, which now carries the fact; (3) the superadmin's row keeps «در حال پایش» through its own constant `adminWatching`, because that screen is area D's.
- The unit tests that import the copy constants (`marked-view.test.ts`, `inbox-days.test.ts`, `search-file-name.test.ts`) pass untouched.
- **No e2e spec was run** (the lane rules of 2026-10-04): the coordinator's single run after the merges is the check. Specs most likely to need a second look: `marks.spec.ts` (the count line is now matched by its shape, `/^[۰-۹]+\sآگهی$/`), `search-files.spec.ts` (state words, toggle names), `search-file-alerts.spec.ts`.

## For other areas

- **Area D (CS-109)**: `admin-copy.ts` (`states.watching`, the heading «پایش پرونده‌ها» of the matching runs) and `crawl-requests-admin-copy.ts` (`stateOfFile.watching`) still say «در حال پایش» for the state the glossary now calls «فعال». Follow the glossary, then update `adminWatching` in `e2e/tests/app/search-files.spec.ts` and the heading in `search-file-alerts.spec.ts`. D's buyer-facing counterpart of the request card is untouched: the shared state labels did not change.
- **Area B (CS-107) and area A (CS-106)**: only comments mention «بسپارش به کارشناس» (`features/search/components/search-screen.tsx`, `app/(site)/search/page.tsx`, `features/home/components/catalogue-row.tsx`); the button words come from `SEARCH_FILES_COPY`, so the screens are right.
- **Area E (CS-110)**: the assumed-mileage note that `withAssumption` appends to the marked row's mileage still holds a «؛» (`packages/search/src/mileage-reading.ts`, `lib/mileage-info.ts`).
- **The guide**: appendix A.2 («پایش») and A.3 («بسپارش») are settled by this task, and A.8 (the « · » join) is done for the two files of area C; four rows were added to the words table of section 4.
- **If a second source returns**: «دیوار» in `kinds.ts` and `marked-copy.ts` is the only source today; with another source its name has to come from the notification's payload (a payload key would be a new key, so it is a follow-up and not part of this task).
- **The coordinator**: lower `tools/copy-lint/baseline/C.json` once after the merges (13 entries are above the code now).

## Left for you to check

Taste, brand feel and whether a line lands are yours (guide, section 9). The ones I am least sure of:

1. «فعال» / «متوقف» / «بسته» for a file's state, against «دنبال می‌شود».
2. «آگهی‌های تازه‌ی این جست‌وجو را جدا ببینید» as the banner's one line.
3. «درخواست جست‌وجوی بیشتر» as the card's title: the glossary's term, but it names the request, not the offer.
4. «به بازار برگشت» for a relisted car, beside «دیگر در دیوار نیست» for one that left.
5. The marked page and the inbox have no lead now (their rows, labels and empty states say what the old leads said); the deleted leads are in the tables above if a first-time buyer needs one back.
