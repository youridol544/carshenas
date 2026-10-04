# The Carshenas voice: how every string a person reads is written

- Status: normative. Written 2026-10-04 with CS-104, on the owner's feedback of that day: the text is fluffy, repeats itself, carries technical detail a buyer does not need, and does not sound like native Farsi.
- Decision: [ADR-0042](../decisions/0042-product-copy-voice.md). Sources and measurements: [`docs/research/2026-10-04-product-copy-voice.md`](../research/2026-10-04-product-copy-voice.md).
- Covers every string a buyer or the superadmin reads: titles, labels, buttons, hints, errors, empty states, popovers, notifications, page titles and descriptions. Not code, logs, tests, docs or model prompts.
- Used by the `copy-fa` skill, the `.claude/rules/copy.md` rule and the `copy-reviewer` agent. The copy lint (CS-105) checks what a script can; this guide governs the rest. Nouns come from [`docs/product/glossary.md`](../product/glossary.md); type, digits and layout from [`design-language.md`](design-language.md) and the `ui-design` skill.
- Farsi examples sit in «». A real string carries its file and key (`home-copy.ts · hero.intro`); section 8 has 96 rewrites of real strings.

## 1. The ten rules

| # | Rule | In one line |
|---|---|---|
| R1 | Calm | Say it at the volume of the fact: no «!», no hype, no alarm, no joke. |
| R2 | A fact or nothing | A sentence that could sit on any product's page («با اطمینان بخرید») is cut or becomes a fact. |
| R3 | Answer first | The verdict, then the reason, then the step. |
| R4 | One idea per sentence | About 15 words, never over 25; a full stop where a «؛» was. |
| R5 | Once per screen | Title, lead, hint, button and notice are written as one set; an idea sits in one of them. |
| R6 | One word per idea | The glossary's nouns and section 4's verbs, everywhere. |
| R7 | Nothing a buyer cannot check or act on | No database, queue, threshold, method, version or window (section 5). |
| R8 | The patterns | A button is a verb, a label a noun, a title short; an error says what happened and what to do; a limit is a fact with a way forward; never an apology. |
| R9 | Address | «شما», usually unsaid; plain standard verbs; «ما» for what we did, never «من». |
| R10 | Written down | Persian digits through the formatters, half-spaces by the Academy's rules, «ه‌ی», «» for quoted words (section 6). |

When a string passes all ten and still sounds wrong, read it aloud: if a calm expert friend would not say it to a buyer across a table, rewrite it. Taste is the owner's call (section 9).

## 2. The voice

Carshenas (کارشناس) is **a calm, direct expert friend**. It tells you what it found, in the words you would use, and what to do next. The reader is a buyer on a phone, about to spend hundreds of millions of tomans; trust is the product (in NN/g's study, trustworthiness explained 52 % of how desirable a tone felt).

| Trait | It means | It never |
|---|---|---|
| Calm | the facts at the volume of the facts: a «گران» rating is a rating, not an alarm | «!», «هشدار», «فوق‌العاده», emoji, «فقط امروز» |
| Direct | the answer first, the next step named | a warm-up, «لازم به ذکر است», a hedge that hides the answer |
| Plain | the words a buyer says aloud, from the glossary | jargon, internal names, English, thresholds |
| Honest | says once what we do not know | an apology, «هنوز» or «فعلاً» about what we cannot do, false certainty |

In voice:

- «قیمت این آگهی ۸٪ بالاتر از ارزش بازار است.»
- «برای این مدل آگهی مشابه کافی نداریم، پس قیمت را نمی‌سنجیم.»
- «به سقف ۲۰۰ آگهی نشان‌شده رسیده‌اید. نشان چند آگهی را بردارید و دوباره امتحان کنید.» (`marks-copy.ts · failures.full`, kept as it is)

### Address and register

1. **«شما», usually unsaid.** The verb's ending says who: «ببینید», not «شما ببینید».
2. **Plain standard verbs.** «می‌خواهید», «ببینید», «بنویسید». Not the spoken forms in our own sentences («می‌خوای، می‌تونی، رو، یه، نمی‌ذاره، انتخابت»), not the clerk's («نمایید، گردید، می‌باشد، نمودن، بفرمایید، لطفاً»). What a buyer types is shown as typed («یه ماشین تمیز می‌خوام» stays in a query).
3. **Why not «تو».** Torob's store text, Tapsi and Jabama use it, and Tapsi and Jabama mix it with «شما» on one page. A mixed register is what reads machine-written. «تو» to a stranger about hundreds of millions of tomans, with families and older buyers among the readers, reads as presumption, and its spoken grammar (می‌تونی، رو، ـت) is where a writer, human or agent, slips without a lint to catch it. Friendliness comes from plain words and directness: Microsoft's Persian guide asks for a clear, friendly, conversational style, and its own samples keep «شما» and «کنید».
4. **Why not the formal written register.** «در اختیار شما قرار می‌دهد», «مورد استفاده قرار گرفت», «می‌باشد» are what translation and templates produce; Microsoft's Persian guide lists them as the classic forms to replace.
5. **Who speaks.** In a sentence: «ما» for what the product did or does («آگهی‌ها را می‌خوانیم»), or no subject at all («قیمت ۸٪ بالاتر است»). Never «من»: «فهمیدم، گذاشتم، نتوانستم، می‌گردم» is a chatbot, and it sits beside «ما» on the same panel. «کارشناس» is the name: a title, a link, a feature («بسپارش به کارشناس»), not a subject that «می‌گوید» and «می‌خواند».
6. **The polite plural imperative**, never the singular: «ببینید», not «ببین» or «بفهم».

## 3. A sentence, and each element

| Rule | Do | Not |
|---|---|---|
| One idea | «از روی آگهی‌های همان مدل حساب می‌شود، با توجه به تیپ، سال، کارکرد و وضعیت بدنه. هر روز تازه می‌شود.» | «هر روز، از خودروهای مشابه همان روز، ارزش بازار هر خودرو را برآورد می‌کنیم؛ با تیپ، سال، کارکرد و وضعیت بدنه.» (E7) |
| Answer first | «برای این مدل آگهی مشابه کافی نداریم.» | «برای این مدل فقط ۳ آگهی مشابه داریم؛ دست‌کم ۸ آگهی لازم است.» (E51) |
| A verb, not a noun that hides one | «بررسی شد» | «بررسی انجام شد», «اقدام به ثبت‌نام کنید» |
| Say what is | «بدنه سالم یا بی‌رنگ است.» | «نه فروشنده و نه متن هیچ رنگی نگفته‌اند.» |
| One hedge, only when it is real | «احتمالاً ۱۰۰٬۰۰۰ کیلومتر» | «ممکن است شاید احتمالاً گران‌تر باشد» |
| A full stop, not «؛» or a parenthesis | two sentences | «…؛ …» and «(…)» for an aside |
| After a cut, each sentence stands alone | every «آن، این، بقیه، همین، هر کدام» still points at something in the same string | «بقیه در اعلان بعدی می‌آید» (the rest of what?) |

| Element | Form | Write | Never |
|---|---|---|---|
| Page title (`h1`) | a noun phrase, up to 5 words, no full stop | «جست‌وجوی خودرو», «تحلیل قیمت» | a sentence, a slogan, a question (a FAQ excepted) |
| Section title | a noun phrase, up to 4 words | «آگهی‌های مشابه» | a verb phrase that repeats the lead |
| Lead (under a title) | one sentence of up to 20 words that adds what the title lacks, or nothing | «ببینید آگهی‌ها چقدر تازه‌اند و ارزش بازار چقدر دقیق است.» | the title again; two sentences |
| Button | a verb, 1 to 3 words: an infinitive («دیدن آگهی‌ها», «پاک کردن فیلترها») or an action noun («جست‌وجو», «تلاش دوباره»); it names the result | «جست‌وجو» | the mechanism or a mood («بفهم»), two actions in one label («ذخیره شد · مشاهده پرونده») |
| Link | where it goes | «دیدن همه‌ی آگهی‌ها» | «اینجا», «کلیک کنید» |
| Field label | a noun, above the field | «نام کاربری» | a sentence, a colon |
| Hint | an example, or the one rule that prevents an error | «حداقل ۸ کاراکتر» | what the label already says |
| Chip, badge | the value, up to 3 words | «بدون رنگ» | a sentence |
| Meta line | facts separated by «،» | «۲۷۰٬۰۰۰ کیلومتر، دنده‌ای، تهران» | « · » between facts |
| Confirmation | the past-tense fact, up to 4 words; an undo when it can be undone | «آگهی نشان شد.» [بازگرداندن] | «با موفقیت», «!» |
| Loading | «در حال» and the work, after the pending delay | «در حال خواندن آگهی…» | «لطفاً صبر کنید» |
| Notification | a title that names the event and the car, a detail that says what changed in one sentence | «قیمت پژو ۲۰۶ مدل ۱۴۰۰ کم شد» | a title that needs its detail to be understood |
| Accessible name | the action and its object, in Farsi | «نشان کردن آگهی پژو ۲۰۶» | the control's role («دکمه‌ی …»), a repeat of a visible label with nothing added |

**Error: what happened, then what to do.** In the buyer's terms, as a fact. If a retry button sits beside it the sentence does not say «retry» again. Name what is kept («لینک شما همین‌جا مانده است.»). Name a cause only when we know it and the buyer can act on it («اتصال برقرار نشد.»). No «مشکلی پیش آمد» when we know more, no «اتصال را بررسی کنید» as a default, no «نامعتبر», no apology. The reference code appears on error pages only.

- «آگهی‌ها بارگذاری نشد.» [تلاش دوباره]
- «این لینک آگهی دیوار نیست. لینک یک آگهی از دیوار را بچسبانید.»
- «نام کاربری یا رمز عبور درست نیست.» (`accounts-copy.ts · errors.signInFailed`, kept)

**Empty state: what is empty, then one way forward.** Three kinds, three wordings: first use, no results, all clear.

- «هنوز آگهی‌ای نشان نکرده‌اید.» «در جست‌وجو یا صفحه‌ی آگهی، «نشان کردن» را بزنید.»
- «آگهی‌ای با این فیلترها پیدا نشد.» «با برداشتن یکی از این‌ها نتیجه می‌بینید:»
- «آگهی تازه‌ای نیست.» (no button)

**Limit: the limit as a fact, then the way forward.** «فعلاً», «هنوز», «متأسفانه», «نمی‌توانیم» about what the product cannot do say «broken» or «unfinished». A product boundary reads as scope. «هنوز» stays for the buyer's own state or for data that will exist, when the next step follows: «هنوز آگهی‌ای نشان نکرده‌اید.»

- «ارزیابی لینک برای آگهی‌های دیوار است. لینک یک آگهی از دیوار را بچسبانید.»
- «هر حساب تا ۳۰ پرونده می‌تواند داشته باشد. برای ساختن این یکی، پرونده‌ای را که دیگر لازم ندارید پاک کنید.» (`search-files-copy.ts · save.limitBody`, kept)

**Popover** (the info control): section 5.

## 4. One idea, one place, one word

**Once per screen (R5).** The strings of a screen are written and reviewed as one set.

1. List every string with its element and the one idea it carries.
2. Two strings with one idea: keep the one in the higher element (title, then button, then lead, then hint, then notice), delete the other.
3. A string whose idea the control already makes («یکی را بزنید تا … را ببینید» above tiles) is deleted.
4. A promise («خبرتان می‌کنیم») is made once on a screen, and again on another only where the buyer decides again (the mark control, the marked page's empty state), not on every page around it. «با دلیل» (a rating comes with its reason) is said once, on the home page.
5. Allowed repeats: a field error and its summary link (the same words, so they match), an accessible name that adds the object («نشان کردن آگهی پژو ۲۰۶»), a page title and its `h1`.

**The words (R6).** The glossary rules the nouns; this table settles the ones the product writes two ways.

| Idea | Write | Never |
|---|---|---|
| listing | آگهی | اگهی، پست، آیتم |
| the car | «خودرو» in titles, labels and facts; «ماشین» only in a sentence to the buyer («چه ماشینی می‌خواهید؟») | اتومبیل، وسیله‌ی نقلیه |
| market value (the figure) | ارزش بازار | قیمت کارشناسی، ارزش واقعی |
| valuing (the daily act) | ارزش‌گذاری («ارزش بازار را حساب می‌کنیم») | برآورد، تخمین for the act |
| the rating | ارزیابی، «معامله‌ی عالی» … «خیلی گران» | رتبه، امتیاز، نمره، برچسب |
| the asking price | قیمت، «قیمت آگهی» (we only ever know asking prices) | مبلغ، بها، نرخ، «قیمت واقعی» |
| mileage | کارکرد (the unit «کیلومتر») | مسافت |
| search | جست‌وجو | جستجو، سرچ |
| turn words into a filter | «به فیلتر تبدیل شد» | «فیلتر شد» (in Iran it reads as «blocked») |
| the buyer's last visit | آخرین بازدید | آخرین دیدن (a calque); «آخرین بررسی» is our last reading of a listing, not the buyer's visit |
| link | لینک | پیوند، آدرس (unless the address itself is meant) |
| the person | «شما» | کاربر، کاربران گرامی، مشتری |
| us | «ما» in a verb; «کارشناس» as a name, in «» when a sentence could read as «an expert» | سیستم، سامانه، پلتفرم، اپ |
| the source | the site's name («در دیوار»), else «منبع» | سایت مرجع |
| an account | «حساب کاربری» (the page), «حساب» (a sentence) | پروفایل |

**The verbs of controls.**

| To … | Write | Not |
|---|---|---|
| search | جست‌وجو | بفهم، پیدا کن |
| try again | تلاش دوباره | دوباره امتحان کنید (as a button), مجدداً |
| close a panel, a popover, a message | بستن | خروج، لغو |
| stop before it happens | انصراف | لغو |
| confirm | تأیید | اوکی |
| save a form | ذخیره (keep «ثبت» for sending a request) | ثبت for saving |
| take one filter, mark or chip away | برداشتن | حذف |
| erase a file or everything of a kind | پاک کردن | حذف |
| go and see something on Carshenas | دیدن … | مشاهده |
| leave for the source | رفتن به آگهی در دیوار | دیدن آگهی (it stays here) |
| show more of this list | نمایش بیشتر، نمایش کمتر | بارگذاری بیشتر |
| copy a link | کپی لینک | کپی پیوند |
| mark a listing | نشان کردن | ذخیره، بوکمارک |

## 5. What a buyer never sees, and when a number is worth showing

**The test (R7).** A fact reaches a screen only if the buyer could decide differently with it, or could check it against what is in front of them. Otherwise it is ours, not theirs. Progressive disclosure means a deeper page, not a longer popover: until that page exists, the detail is not shown. R7 cuts how the system works, never what the buyer needs to know about what they see: that a rating is missing and why, in one plain clause; that a file is paused; that a reading is delayed.

| Kind | Real strings (file) | Instead |
|---|---|---|
| Infrastructure and process | «پایگاه داده پاسخ نداد» (check, home, search files), «صف بررسی مجدد فعلاً پر است», «به سرور نرسیدیم» | what the buyer lost and the step: «بارگذاری نشد» and [تلاش دوباره] |
| How the crawler works | «سقف درخواست روزانه», «هیچ درخواستی به دیوار نمی‌فرستیم», «ظرفیت روزانه‌ی خواندن», «خواندن آگهی‌ها اکنون متوقف است» (`crawl-requests-copy.ts`) | nothing, or the effect: «آگهی‌های این مدل را می‌خوانیم» |
| How the valuation works | «روش شماره‌ی ۱», «در ۳۰ روز گذشته», «کارکرد (در برابر ۲۰٬۰۰۰ در سال)», «میانه‌ی خطا», «۸۰٪ میانی», «دست‌کم ۸ آگهی مشابه», «خطای معمول … از ۱۵٪ بیشتر نباشد», «بیش از ۳ برابر» | the effect: «آگهی مشابه کافی نداریم»; a figure only when it is on the page |
| Model and AI internals | «هوش مصنوعی», «واقعیت درست خوانده شد», «دستور پنهان برای هوش مصنوعی», «خطاب به سیستم بود» | what was read: «رنگ‌شدگی را از متن آگهی می‌خوانیم» |
| Our own jargon | «تعهدهای تازگی», «مدل پوشش‌داده‌شده», «نوبت خواندن», «ظرفیت» | the buyer's word: «هدف‌های تازگی» |
| Versions and ids | «این نسخه‌ی کارشناس», enum names, English terms, «API» | nothing |

**What stays**, because a buyer can check or act on it: a rating's band in percent («دست‌کم ۱۰٪ زیر ارزش بازار»); what a filter keeps, in buyer's units («حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو»); a count of listings; the similar cars on the page and their range; a date or «۳ ساعت پیش» for freshness; a limit the buyer can hit (۲۰۰ نشان، ۸ اعلان در روز).

**Popovers.** An info control answers one question, «this means what for me?», in one or two plain sentences, 40 words at most. The title is the control's own name. No headings («معیار دقیق», «شرط‌ها», «گزینه‌ها»), no list where a sentence will do, at most one number and only a number the buyer can check. The owner's request of 2026-10-01 (say what a filter measures, with numbers) holds for that number and stops there.

**Numbers (R7).** Show one when it compares (a price, a gap against market, a mileage, a year), when it limits what the buyer can do, or when it supports the verdict and is checkable on the page (how many similar cars). Exact for a stated fact (a price to the toman), rounded for an estimate (three significant digits, a whole percent). One per sentence, joined to its unit. It comes from the database, never from model text. A figure the model needs to decide, never.

**The status page** (`/status`, CS-66) is the one buyer page about the system: it shows how fresh the data is and how accurate the market values are, in the buyer's units («۳ ساعت پیش»، «۸٪»), and never how it works (budgets, methods, queues, models).

**The superadmin section.** The reader acts on operations, so «خزش», «توقف», «صف» are allowed there, only where the owner acts on them. The voice and the rules on repetition, filler, apology and register are the same. A superadmin word never appears in a buyer string.

## 6. Written down

| Topic | Rule | Example |
|---|---|---|
| Digits | Persian digits in text, through the `@carshenas/locale` formatters; Latin only in URLs, codes and names; ranges with «تا»; percent through `formatPercent` | «۱۲٬۰۰۰ کیلومتر», «۳ تا ۵ سال» |
| Number and unit | joined by a no-break space (the formatters do it) | «۲ ساعت», «تیپ ۲», «مدل ۱۴۰۰» |
| Half-space (U+200C), Academy | «می‌» and «نمی‌» before a verb; the plural «ها» (always after a silent «ه»); «تر» and «ترین» (joined in «بهتر، بیشتر، کمتر»); «بی‌» and «هم‌» prefixes; compounds | «می‌خواهید، آگهی‌ها، خانه‌ها، ارزان‌ترین، بی‌دردسر، هم‌گروه، جست‌وجو، به‌روز» |
| Joined or half | «اینجا، آنجا، اینکه، آنچه» joined; «همین‌جا، همان‌جا» with a half-space | |
| Ezafe after a silent «ه» | «ه‌ی» (the project's choice, `design-language.md`; the Academy writes «ۀ»; never mix) | «صفحه‌ی اصلی، معامله‌ی عالی» |
| Letters | Persian «ی» and «ک»; never Arabic «ي» and «ك» | |
| Quoted words | «» for a word or control named in a sentence; never `""` or `''` | ««نشان کردن» را بزنید» |
| Full stop | ends a sentence; not a title, label, button, chip, meta line | |
| Comma, semicolon | «،» between items; «؛» is the exception (R4) | |
| Colon | before a list or an example; not after a label; not mid-sentence | |
| Parentheses | not for an aside: write a sentence | |
| Exclamation | never | |
| Ellipsis | the one character «…», only for work in progress; never mid-sentence | «در حال خواندن…» |
| Middle dot « · » | never between items beside a digit: a dot next to a Persian digit reads as a zero (۰); use «،» or separate lines | |
| Dash | no hyphen for ranges: «تا» | |
| Latin and emoji | names only (BMW, Caps Lock), isolated by markup; no emoji | |

A model types a half-space less reliably than a person: copy Farsi from existing strings, never retype a string in a test (tests import the constants), and let the copy lint (CS-105) say what slipped.

## 7. Machine-written and translated Farsi

Three families. T is translated or stiff Farsi: the classic forms Microsoft's Persian guide replaces, and calques. M is machine-written or promotional Farsi: the English tells in Wikipedia's field guide, Kobak et al. and Russell et al., carried across (my reading, not a source). V is this product's own register slips. Removing a tell does not fix a sentence that says nothing: the cure is a fact or a cut, not a synonym.

**T: translated or stiff**

| ID | Pattern | Write instead |
|---|---|---|
| T1 | «این امکان را به شما می‌دهد که …», «به شما اجازه می‌دهد …», «شما را قادر می‌سازد» | the verb itself: «قیمت را با ارزش بازار بسنجید.» |
| T2 | «در اختیار شما قرار می‌دهد», «ارائه می‌دهد», «فراهم می‌کند» (Snapp's store text: «امکانات متنوعی را در اختیار کاربرانش قرار می‌دهد») | «نشان می‌دهد», «می‌دهد», or the specific verb |
| T3 | «مورد استفاده قرار گرفت», «مورد بررسی قرار گرفت» | «استفاده شد», «بررسی شد» |
| T4 | stacked modal and pronoun: «شما می‌توانید فیلترها را ببینید» | «فیلترها را ببینید.» «می‌توانید» only for a real permission |
| T5 | «لازم به ذکر است», «شایان ذکر است», «توجه داشته باشید که» | delete; start with the fact |
| T6 | «در رابطه با», «در خصوص», «به منظور», «جهت», «از طریق» | «درباره‌ی», «برای», «با» |
| T7 | written-formal verbs: «نمودن، گردید، می‌باشد، نمایید، بفرمایید» | «کردن، شد، است، کنید» |
| T8 | hidden verbs: «انجام بررسی», «صورت می‌گیرد», «اقدام به X», «ممکن نشد» | «بررسی کنید», «می‌شود», «X کنید» |
| T9 | English clause order: «با توجه به اینکه X، Y», «در صورتی که X، Y», «تا زمانی که» | «چون X، Y», «اگر X، Y», «تا» |
| T10 | calqued fillers: «در حال حاضر», «لطفاً», «با موفقیت», «کلیک کنید» | delete; «بزنید», «انتخاب کنید» |
| T11 | three or more ezafe in a row: «تحلیل قیمت‌گذاری ارزش بازار آگهی‌های مشابه» | two phrases |
| T12 | «ممکن نیست», «امکان‌پذیر نیست», «قادر به … نیستیم» | what happened: «ثبت نشد» |

**M: machine-written or promotional**

| ID | Pattern | Write instead |
|---|---|---|
| M1 | filler openers and closers: «در دنیای امروز …», «همان‌طور که می‌دانید», «بی‌شک», «در نهایت» | delete |
| M2 | empty praise: «بی‌نظیر، حرفه‌ای، پیشرفته، هوشمند، جامع، متنوع، جذاب، ویژه», «کاربردی‌ترین», «معتبرترین», «با اطمینان» | a fact or nothing (R2) |
| M3 | doubled synonyms: «سریع و آسان», «دقیق و درست», «تازه و به‌روز», «بررسی و ارزیابی» | one word |
| M4 | triads: «سریع، دقیق و قابل‌اعتماد» | the one that is true and checkable |
| M5 | «نه‌تنها … بلکه …», «این فقط … نیست، بلکه …» | say the one thing |
| M6 | avoiding «است»: «نقش مهمی ایفا می‌کند», «به‌عنوان … عمل می‌کند», «محسوب می‌شود» | «است» |
| M7 | summary closers and moralising: «در مجموع», «به‌طور خلاصه», a last line that restates the section | delete |
| M8 | cute interjections and fake enthusiasm: «بفرمایید!», «آماده‌اید؟», «خب», emoji | none (R1) |
| M9 | the chatbot «من»: «فهمیدم», «گذاشتم», «نتوانستم», «می‌گردم» | «ما» or no subject (R9) |
| M10 | stacked or defensive hedges: «ممکن است … شاید … احتمالاً», «نه از حدس» | one hedge, or none |
| M11 | vague authority: «طبق بررسی‌ها», «کارشناسان معتقدند» | the source, or delete |
| M12 | explaining the machinery: thresholds, windows, methods | section 5 |

**V: register and voice slips**

| ID | Pattern | Write instead |
|---|---|---|
| V1 | two registers on one screen: «می‌خواهید» beside «می‌خوام»; «شما» beside «تو» | one register (R9) |
| V2 | spoken clitics in a polite sentence: «بسپارش», «برشان دارید», «به مشکل خورد» | the full form: «سپردن», «بردارید», «بارگذاری نشد» |
| V3 | the third person for the reader: «کاربران گرامی», «کاربر» | «شما» |
| V4 | the singular imperative: «ببین», «بفهم» | «ببینید», the verb the button means |
| V5 | a feeling instead of a fact: «متأسفانه», «خوشبختانه», «مشکلی پیش آمد» | the fact |
| V6 | a word for the product that is not its name: «اپ», «سیستم», «پلتفرم», «سامانه» | «ما» or «کارشناس» |

## 8. Rewrites of real strings

Before is verbatim from the repository at `4d980fd`. After is a proposal the rewrite tasks (CS-106 to CS-110) may improve, judged against section 1. Two passes by a second reader found 31 of the first 99 proposals and 16 of the 40 revised ones needing a fix (a pronoun left pointing at nothing, a fact dropped with the internals, a word with a second meaning, a plain claim narrower than the code): check a plain replacement against the code, and read every final screen again, ideally by a native speaker. A number in a before is an example of what a formatter fills in (the file holds a placeholder). «(delete)» means the idea lives in another string of the same screen.

### The owner's four

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E1 | `home-copy.ts · hero.intro` | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، ارزش بازار هر ماشین را حساب می‌کنیم و می‌گوییم قیمتش منصفانه است یا نه، با دلیل. | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم و ارزش‌گذاری می‌کنیم. | R2 R4 R5 |
| E2 | `plain-search.tsx` (the submit button) | بفهم | جست‌وجو | R8 V4 |
| E3 | `filters.ts · lowMileage` (description, rule) | خودرویی که کمتر از معمول بازار (حدود ۲۰٬۰۰۰ کیلومتر در سال) کار کرده است. آگهی‌های بدون کارکرد یا سال ساخت کنار می‌روند.<br>حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو؛ خودروی کمتر از یک سال، نیم سال حساب می‌شود. | حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو. (two different numbers, 20 000 and 12 000, were on one popover) | R7 |
| E4 | `check-copy.ts · problems.otherSite` | فعلاً فقط آگهی‌های دیوار را ارزیابی می‌کنیم. «bama.ir» را هنوز نمی‌خوانیم. | این لینک آگهی دیوار نیست. لینک یک آگهی از دیوار را بچسبانید. | R8 V5 |

### Home

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E5 | `home-copy.ts · description` | آگهی‌های خودروی کارکرده از سایت‌های آگهی، با ارزش بازار هر خودرو و ارزیابی قیمت: بفهمید قیمت منصفانه است یا نه، و چرا. | آگهی‌های خودروی کارکرده با ارزش بازار و ارزیابی قیمت. ببینید قیمت منصفانه است یا نه. | R4 R5 |
| E6 | `home-copy.ts · how.steps[0].body` | آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، نام و تیپ هر خودرو را از میان نوشته‌های پراکنده درمی‌آوریم و آگهی‌ها را یک‌جا کنار هم می‌گذاریم. | نام، تیپ و وضعیت هر خودرو را از متن آگهی درمی‌آوریم. | R5 R4 |
| E7 | `home-copy.ts · how.steps[1].body` | هر روز، از خودروهای مشابه همان روز، ارزش بازار هر خودرو را برآورد می‌کنیم؛ با تیپ، سال، کارکرد و وضعیت بدنه. | از روی آگهی‌های همان مدل حساب می‌شود، با توجه به تیپ، سال، کارکرد و وضعیت بدنه. هر روز تازه می‌شود. | R4 R6 |
| E8 | `home-copy.ts · how.steps[2]` (title, body) | قیمت را ارزیابی می‌کنیم و دلیلش را می‌گوییم<br>قیمت هر آگهی را با ارزش بازار می‌سنجیم، از «معامله‌ی عالی» تا «خیلی گران»، و کنارش می‌نویسیم چرا. | قیمت را ارزیابی می‌کنیم<br>از «معامله‌ی عالی» تا «خیلی گران». دلیلش کنار هر ارزیابی نوشته شده است. | R5 |
| E9 | `home-copy.ts · how.trustTitle` | اعداد این صفحه، از خود پایگاه داده | امروز در کارشناس | R7 |
| E10 | `home-copy.ts · how.errorBody` | پایگاه داده پاسخ نداد؛ کمی بعد دوباره امتحان کنید. | (delete: the title «عددها بارگذاری نشد» and [تلاش دوباره] say it) | R5 R7 |
| E11 | `home-copy.ts · cta.title` | ماشین بعدی‌تان را با اطمینان بخرید | از بهترین معامله‌ها شروع کنید | R2 M2 |
| E12 | `home-copy.ts · cta.body` | همه‌ی آگهی‌ها را با ارزش بازار و ارزیابی قیمت ببینید و از بهترین معامله شروع کنید. | هر آگهی با ارزش بازار و ارزیابی قیمتش. | R4 R5 |
| E13 | `home-copy.ts · bodyTypes.lead` | یکی را بزنید تا آگهی‌های همان نوع را ببینید. | (delete: the tiles explain themselves) | R5 |
| E14 | `home-copy.ts · footer.creditsLead` | عکس‌های بالای صفحه از تهران است و از همین سایت نمایش داده می‌شود. هر عکس این‌جا با پروانه‌ی خودش آمده است. | عکس‌های بالای صفحه از تهران است. پروانه‌ی هر عکس اینجا آمده است. | R7 R10 |

### Paste a link

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E15 | `check-copy.ts · description` | لینک آگهی دیوار را بچسبانید و همان لحظه ببینید قیمتش نسبت به ارزش بازار منصفانه است یا نه، و چرا. | لینک آگهی دیوار را بچسبانید تا ببینید قیمتش منصفانه است یا نه. | R2 R4 |
| E16 | `check-copy.ts · hint` | لینک آگهی دیوار را از مرورگر یا از دکمه‌ی «هم‌رسانی» دیوار بردارید. | لینک را از نوار آدرس یا از «هم‌رسانی» در دیوار کپی کنید. | R6 |
| E17 | `check-copy.ts · page.h1` | لینک آگهی را بچسبانید، ارزیابی را همین‌جا ببینید | ارزیابی قیمت با لینک آگهی | R5 |
| E18 | `check-copy.ts · page.steps[1]` | اینجا بچسبانید؛ با چسباندن، بلافاصله بررسی شروع می‌شود. | (delete the three steps: one field needs none; the label says it) | R5 R4 |
| E19 | `check-copy.ts · pasteDenied` | دستگاه اجازه‌ی خواندن حافظه را نداد؛ لینک را در کادر نگه دارید و «چسباندن» را بزنید. | مرورگر اجازه‌ی خواندن لینک را نداد. آن را خودتان در کادر بچسبانید. | R4 R8 |
| E20 | `check-copy.ts · info.content` (paragraph 1) | فعلاً فقط آگهی‌های دیوار را ارزیابی می‌کنیم. لینک را همان‌طور که هست بچسبانید؛ آدرس کوتاه و آدرس بلندی که عنوان آگهی در آن است، هر دو درست‌اند. | لینک هر آگهی دیوار را می‌خوانیم، کوتاه یا بلند. | R7 R8 |
| E21 | `check-copy.ts · info.content` (paragraph 2) | لینک را فقط با آگهی‌هایی که خودمان خوانده‌ایم تطبیق می‌دهیم و هیچ درخواستی به دیوار نمی‌فرستیم. آگهی‌ای را که ندیده باشیم ثبت می‌کنیم تا در نوبت خواندن بیاید. | اگر آگهی را قبلاً ندیده باشیم، لینکش را برای خواندن ثبت می‌کنیم. | R7 |
| E22 | `check-copy.ts · problems.divarOther` | این لینک دیوار است، اما لینک یک آگهی نیست. صفحه‌ی خودِ آگهی را باز کنید و لینک همان را بچسبانید. | این لینک یک آگهی نیست. آگهی را در دیوار باز کنید و لینکش را بچسبانید. | R4 |
| E23 | `check-copy.ts · notFound` (title, body) | این آگهی را هنوز ندیده‌ایم<br>ارزیابی‌ای از آن نداریم و برای ساختنش هم چیزی از دیوار نمی‌خوانیم. لینکش را ثبت کردیم تا در نوبت خواندن بیاید. | این آگهی را نداریم<br>لینکش را برای خواندن ثبت کردیم. | R7 R8 |
| E24 | `check-copy.ts · unread.body` | از پژو ۲۰۶ فعلاً فقط فهرست آگهی‌ها را می‌خوانیم، نه صفحه‌ی تک‌تک آگهی‌ها؛ برای همین قیمت این آگهی ارزیابی نشده. | برای پژو ۲۰۶ هنوز ارزیابی نداریم. | R7 R8 |
| E25 | `check-copy.ts · unread.counted` | درخواست شما شمرده شد؛ مدلی که بیشتر خواسته شود زودتر کامل خوانده می‌شود. | درخواست شما شمرده شد. آگهی‌های مدلی که بیشتر خواسته شود، زودتر ارزیابی می‌شوند. | R4 R7 |
| E26 | `check-copy.ts · limited.body` | برای اینکه همه نوبت داشته باشند، کمی صبر کنید و دوباره امتحان کنید. دیدن آگهی‌های ارزیابی‌شده نیازی به صبر ندارد. | کمی صبر کنید و لینک بعدی را بچسبانید. (the title «چند لینک پشت‌سرهم بررسی شد» stays: it says what happened) | R8 |
| E27 | `check-copy.ts · result.checkedNow` | ارزیابی همین حالا از روی داده‌های ما ساخته شد. | (delete) | R2 R7 |
| E28 | `check-copy.ts · error.body` | پایگاه داده پاسخ نداد؛ لینک شما از بین نرفته است، کمی بعد دوباره امتحان کنید. | لینک شما همین‌جا مانده است. | R7 R8 |
| E29 | `check-copy.ts · off.body` | آخرین چیزی را که از آگهی دیده‌ایم و آگهی‌های مشابهی که هنوز روی بازارند در صفحه‌ی آگهی هست. | (delete: the button «دیدن آخرین وضعیت و آگهی‌های مشابه» says it) | R5 |

### Search and filters

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E30 | `search-copy.ts · bar.linkHint` | این یک لینک است؛ با «ارزیابی لینک» قیمتش را با ارزش بازار می‌سنجیم. | این یک لینک است. قیمتش را با «ارزیابی لینک» بسنجید. | R3 R4 |
| E31 | `search-copy.ts · results.moreFailed` | آگهی‌های بعدی بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. | آگهی‌های بعدی بارگذاری نشد. | R5 R8 |
| E32 | `search-copy.ts · results.limit` | ۱۲۰ آگهی اول نمایش داده شد. برای دیدن بقیه، جست‌وجو را با فیلتر یا عبارت محدودتر کنید. | فقط ۱۲۰ آگهی اول نشان داده می‌شود. برای دیدن بقیه، فیلتر بیشتری بگذارید. | R8 |
| E33 | `search-copy.ts · ignored.lead` | بخشی از آدرس این جست‌وجو قابل‌استفاده نبود و نادیده گرفته شد: | این بخش‌های لینک جست‌وجو را نشناختیم و کنار گذاشتیم: | R7 |
| E34 | `search-copy.ts · emptyIndex` (title, body) | فعلاً آگهی تازه‌ای نداریم<br>کارشناس فقط آگهی‌هایی را نشان می‌دهد که در ۴۸ ساعت گذشته دیده شده باشند، تا هر آگهی‌ای که می‌بینید هنوز در بازار باشد. کمی بعد دوباره سر بزنید. | آگهی تازه‌ای نیست<br>فقط آگهی‌هایی را نشان می‌دهیم که در ۴۸ ساعت گذشته دیده شده‌اند. کمی بعد سر بزنید. | R4 R8 |
| E35 | `search-copy.ts · error.body` | مشکلی در خواندن آگهی‌ها پیش آمد. دوباره امتحان کنید؛ اگر باز هم نشد، کمی بعد برگردید. | (delete: title «آگهی‌ها بارگذاری نشد» and [تلاش دوباره]) | R5 |
| E36 | `search-copy.ts · sheet.countFailed` | شمارش آگهی‌ها انجام نشد؛ می‌توانید باز هم فیلترها را اعمال کنید. | تعداد آگهی‌ها معلوم نشد، اما فیلترها را می‌توانید اعمال کنید. | R4 T8 |
| E37 | `search-copy.ts · card.unratedOutlier` | قیمت نامعمول است و با ارزش بازار فاصله‌ی بسیار دارد؛ احتمالاً اشتباه تایپی یا قیمت نمایشی است. | قیمت با ارزش بازار خیلی فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد. | R4 R5 |
| E38 | `search-copy.ts · card.unratedWithValue` | ارزش بازار برآورد شده، اما قیمت این آگهی با آن مقایسه نمی‌شود. | قیمت این آگهی را با ارزش بازار نمی‌سنجیم. | R4 R6 |
| E39 | `search-copy.ts · info` (rule, conditions, options) | معیار دقیق<br>شرط‌ها<br>گزینه‌ها | (no headings: one paragraph) | R7 |
| E40 | `filters.ts · deal.description` | قیمت آگهی در مقایسه با ارزش بازار همان خودرو که کارشناس هر روز از آگهی‌های مشابه حساب می‌کند. آگهی‌های بدون ارزیابی کنار می‌روند. | قیمت آگهی در مقایسه با ارزش بازار همان خودرو. | R5 R7 |
| E41 | `filters.ts · paintFree.rule` | فروشنده بدنه را سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده یا متن آگهی گفته بی‌رنگ است، و نه فروشنده و نه متن هیچ رنگی، حتی یک لکه، نگفته‌اند. | به گفته‌ی فروشنده، بدنه سالم است یا فقط خط و خش جزئی یا صافکاری بی‌رنگ دارد. در آگهی هم از رنگ‌شدگی چیزی نیامده است. | R4 |
| E42 | `filters.ts · plate (free zone).description` | خودروهای پلاک منطقه آزاد بازار جدایی دارند و بیرون از منطقه تردد محدود دارند؛ آگهی‌هایی که متنشان پلاک منطقه آزاد گفته کنار می‌روند. | پلاک منطقه‌ی آزاد بازار جدایی دارد و تردد خارج از منطقه محدود است. آگهی‌هایی که این پلاک را نوشته‌اند نشان داده نمی‌شوند. | R4 |
| E43 | `gauge-view.ts` (the «چه وقت ارزیابی نمی‌کنیم؟» section) | فقط وقتی ارزیابی می‌کنیم که برای آن مدل دست‌کم ۸ آگهی مشابه داشته باشیم، دست‌کم ۳ تا از آن‌ها با فاصله‌ی حداکثر ۲ سال از این خودرو باشند و خطای معمول برآورد برای آن مدل از ۱۵٪ بیشتر نباشد. آگهی توافقی و قسطی هم ارزیابی نمی‌شود. | اگر آگهی مشابه کم باشد یا برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نباشد، قیمت را ارزیابی نمی‌کنیم. آگهی توافقی و قسطی هم ارزیابی نمی‌شود. | R7 |

### The listing page and its explanation

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E44 | `listing-copy.ts · freshness.queuedHint` | درخواست شما ثبت شد؛ هر وقت صفحه‌ی آگهی دوباره خوانده شود، اطلاعات این صفحه به‌روز می‌شود. | درخواست شما ثبت شد. بعد از بررسی، اطلاعات این صفحه به‌روز می‌شود. | R4 R7 |
| E45 | `listing-copy.ts · freshness.busy` | صف بررسی مجدد فعلاً پر است؛ کمی بعد دوباره سر بزنید. | درخواست‌های بررسی زیاد است. کمی بعد دوباره امتحان کنید. | R7 R8 |
| E46 | `listing-copy.ts · analysis.notValued` | ارزش بازار هر روز برای آگهی‌های خوانده‌شده حساب می‌شود؛ این آگهی هنوز در آن نیست. | ارزش بازار هر روز حساب می‌شود و این خودرو هنوز در آن نیست. | R3 R7 |
| E47 | `listing-copy.ts · comparables.hint` | نزدیک‌ترین آگهی‌ها به این خودرو در سال ساخت و کارکرد. «قیمت برای این خودرو» قیمت هر کدام است اگر مثل این خودرو بود. | آگهی‌هایی که سال و کارکردشان به این خودرو نزدیک است. «قیمت برای این خودرو» یعنی اگر خودروی هر آگهی مثل این خودرو بود، چه قیمتی داشت. | R3 |
| E48 | `listing-copy.ts · condition.textHint` | جمله‌ی کوتاهی که هر مورد از آن خوانده شد زیر آن آمده است؛ اگر اشتباه است، به آگهی در منبع تکیه کنید. | زیر هر مورد، جمله‌ی آگهی را می‌بینید. اگر برداشت ما اشتباه است، آگهی اصلی را ببینید. | R3 R4 |
| E49 | `listing-explanation.ts` (accuracy line) | برآورد ما برای پژو ۲۰۶ معمولاً حدود ۸٪ با قیمت واقعی فاصله دارد (میانه‌ی خطا روی آگهی‌های همین مدل). | برآورد ما برای پژو ۲۰۶ معمولاً حدود ۸٪ با قیمت آگهی‌ها فرق دارد. | R7 |
| E50 | `listing-explanation.ts` (method line) | هر روز، از آگهی‌های پژو ۲۰۶ که در ۳۰ روز گذشته روی بازار بوده‌اند، قیمت هر خودرو را بر پایه‌ی سال ساخت، کارکرد (در برابر ۲۰٬۰۰۰ کیلومتر در سال)، وضعیت بدنه و شاسی، گیربکس، سوخت و رنگ برآورد می‌کنیم (روش شماره‌ی ۱). | هر روز، از آگهی‌های همین مدل، ارزش بازار هر خودرو را حساب می‌کنیم. سال ساخت، کارکرد، بدنه، شاسی، گیربکس، سوخت و رنگ هر خودرو در آن اثر دارند. | R7 R6 |
| E51 | `listing-explanation.ts` (too few comparables) | برای این مدل فقط ۳ آگهی مشابه داریم؛ دست‌کم ۸ آگهی لازم است. | برای این مدل آگهی مشابه کافی نداریم. | R7 |
| E52 | `listing-explanation.ts` (uncertain segment) | برآورد ما برای این مدل معمولاً حدود ۱۸٪ خطا دارد و این بیشتر از ۱۵٪ است؛ برای همین قیمت‌ها را برای این مدل ارزیابی نمی‌کنیم. | برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نیست، پس قیمت‌ها را ارزیابی نمی‌کنیم. | R7 |
| E53 | `listing-explanation.ts` (year out of range) | آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم (دست‌کم ۳ آگهی با فاصله‌ی حداکثر ۲ سال لازم است). | آگهی مشابه کافی با سال ساخت یا کارکردی نزدیک به این خودرو نداریم. | R7 |
| E54 | `listing-explanation.ts` (price outlier) | قیمت آگهی بیش از ۳ برابر با ارزش بازار فاصله دارد؛ شاید اشتباه تایپی یا قیمت طعمه باشد، پس آن را ارزیابی نمی‌کنیم. | قیمت این آگهی خیلی با ارزش بازار فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد، پس ارزیابی‌اش نمی‌کنیم. | R7 R4 |
| E55 | `listing-view.ts` (free-zone plate risk) | پلاک منطقه‌ی آزاد است و بازارش جداست؛ ارزش بازار ما این را از پلاک ملی جدا حساب نمی‌کند، پس گران‌تر از واقع نشان می‌دهد. | پلاک منطقه‌ی آزاد بازار جدایی دارد و معمولاً ارزان‌تر است. ارزش بازار برای پلاک ملی حساب شده است، پس برای این خودرو بالاتر از واقع است. | R7 R3 |

### The model page and the status page

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E56 | `model-copy.ts · stats.rangeHelp` | ۸۰٪ میانیِ ۴۲ آگهی | از ۴۲ آگهی با قیمت نقدی، بیشترشان در این محدوده‌اند. | R7 |
| E57 | `model-info.ts · rangeInfo` (rule) | ۱۰٪ ارزان‌ترین و ۱۰٪ گران‌ترین قیمت‌ها کنار گذاشته می‌شود تا یک آگهی بسیار ارزان یا بسیار گران محدوده را بی‌جهت باز نکند؛ می‌ماند ۸۰٪ میانی. | ارزان‌ترین و گران‌ترین قیمت‌ها حساب نمی‌شود تا یک آگهی غیرعادی محدوده را بی‌جهت باز نکند. | R7 |
| E58 | `model-info.ts · trendInfo` (what) | روند قیمت از ثبت‌های روزانه‌ی خود کارشناس ساخته می‌شود: هر روز آگهی‌های ارزیابی‌شده‌ی یک سال ساخت از این مدل را می‌شمارد و میانه‌ی قیمتشان را نگه می‌دارد. از تاریخ ثبت آگهی‌ها حساب نمی‌شود، چون آگهی‌های فروش‌رفته در آن نیستند و نمودار را گمراه می‌کردند. | هر روز میانه‌ی قیمت آگهی‌های هر سال ساخت را ثبت می‌کنیم. | R7 R4 |
| E59 | `model-info.ts · trendInfo` (the rows «نقطه، نوار، روز و هفته، نمودار، تغییر») | هر روز دست‌کم ۸ آگهی ارزیابی‌شده از آن سال ساخت لازم است؛ با آگهی کمتر نقطه‌ای نمی‌گذاریم. | (delete all five rows: the chart's own legend says what a point and the band are) | R7 |
| E60 | `model-copy.ts · trend.short.body` | کارشناس قیمت هر مدل را هر روز ثبت می‌کند و روند فقط از ثبت‌های خودش ساخته می‌شود، نه از حدس. برای رسم نمودار دست‌کم ۳ روز ثبت لازم است؛ برای این مدل ۲ روز داریم. | نمودار از روز سوم نشان داده می‌شود. برای این مدل ۲ روز ثبت داریم. | R7 M10 |
| E61 | `model-copy.ts · trend.error.body` | خواندن تاریخچه‌ی قیمت به مشکل خورد. صفحه را دوباره باز کنید. | (delete: title «روند قیمت بارگذاری نشد» and [تلاش دوباره]) | R5 V2 |
| E62 | `data-status-copy.ts · lead` | کارشناس آگهی‌ها را خودش از سایت‌های آگهی می‌خواند و نگه می‌دارد؛ جست‌وجوی شما هیچ درخواستی به آن سایت‌ها نمی‌فرستد. این صفحه نشان می‌دهد این داده‌ها چقدر تازه و ارزش‌های بازار چقدر دقیق‌اند. | ببینید آگهی‌ها چقدر تازه‌اند و ارزش بازار چقدر دقیق است. | R4 R7 |
| E63 | `data-status-copy.ts · leadNumbers` | همه‌ی عددهای این صفحه از پایگاه داده‌ی کارشناس خوانده می‌شوند و هر دقیقه تازه می‌شوند. | (delete) | R7 |
| E64 | `data-status-copy.ts · targetsLead` | کارشناس این سه تعهد را داده است و هر ساعت اندازه می‌گیرد که به آن‌ها رسیده یا نه. | هر ساعت می‌سنجیم که به این سه هدف رسیده‌ایم یا نه. | R6 R9 |
| E65 | `data-status-copy.ts · extractionLead` | هوش مصنوعی از متن آگهی فقط واقعیت‌ها را برمی‌دارد: رنگ‌شدگی، قطعه‌ی تعویضی، شاسی، توافقی یا اقساطی بودن قیمت. هر عددی که می‌بینید از پایگاه داده است، نه از متن مدل. | از متن آگهی‌ها رنگ‌شدگی، قطعه‌ی تعویضی، وضعیت شاسی و توافقی یا قسطی بودن قیمت را می‌خوانیم. | R7 R4 |
| E66 | `data-status-copy.ts · HOW_STEPS` (the step «خواندن با ملاحظه») | هر منبع سقف درخواست روزانه دارد و درخواست‌ها با فاصله فرستاده می‌شوند. اگر منبعی درخواست‌ها را رد کند، خواندنش متوقف می‌شود و آگهی‌هایش با تاریخ آخرین داده‌ها می‌مانند. | (delete the step: it describes the crawler) | R7 |
| E67 | `data-status-copy.ts · INDEX_STATE_HEADLINE.not_updating` | خواندن تازه از منبع فعلاً متوقف است | آگهی تازه‌ای نمی‌رسد. آخرین داده‌ها از ۹ مهر ۱۴۰۵ است. | R7 R8 |

### Accounts, search files, marks, notifications, plain search, error pages

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E68 | `accounts-copy.ts · signUp.lead` | برای استفاده از تمام قابلیت‌های اپ کارشناس، وارد حساب کاربری خود شوید. | با حساب کاربری می‌توانید آگهی‌ها را نشان کنید و جست‌وجوهایتان را نگه دارید. | R2 V6 |
| E69 | `accounts-copy.ts · signIn.forgotBody` | فعلاً رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، روی کادر رمز عبور پیشنهادش می‌دهد؛ در غیر این صورت حساب کاربری جدید بسازید. | رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، در کادر رمز عبور پیشنهادش می‌دهد. وگرنه حساب تازه‌ای بسازید. | R8 R4 |
| E70 | `search-files-copy.ts · lead` | جست‌وجوهایی که به کارشناس سپرده‌اید. هر پرونده آگهی‌های مطابق جست‌وجوی خودش را نشان می‌دهد و می‌گوید از آخرین دیدن شما چه چیزی تازه آمده است. | جست‌وجوهایی که نگه داشته‌اید. هر پرونده آگهی‌های مطابقش را نشان می‌دهد و می‌گوید از آخرین بازدیدتان چه آگهی‌هایی تازه آمده است. (the same «آخرین بازدید» in `viewed`, `newSince` and `nothingNew`) | R4 |
| E71 | `search-files-copy.ts · save.dialogLead` | کارشناس این جست‌وجو را در یک پرونده برایتان نگه می‌دارد و هر بار که سر بزنید می‌گوید چه آگهی‌ای تازه آمده است. | (delete: the title and the page lead say it) | R5 |
| E72 | `search-files-copy.ts · save.saved` | ذخیره شد · مشاهده پرونده | دیدن پرونده (the check icon says it was saved) | R8 |
| E73 | `search-files-copy.ts · save.button` | بسپارش به کارشناس | سپردن به کارشناس (the glossary row changes with it, appendix A) | V2 |
| E74 | `search-files-copy.ts · save.limitTitle` | پرونده‌ی تازه جا ندارید | به سقف پرونده‌ها رسیده‌اید | R8 |
| E75 | `search-files-copy.ts · alerts.infoWhat` | کارشناس هر ۵ دقیقه آگهی‌هایی را که تازه در جست‌وجو آمده‌اند یا قیمتشان کم شده با جست‌وجوی این پرونده می‌سنجد. اگر آگهی تازه‌ای با قیمت خوب یا عالی بیابد یا قیمت آگهی‌ای کم شده باشد، یک اعلان می‌فرستد، نه یک اعلان برای هر آگهی. آگهی‌های تازه‌ی دیگر فقط با نشان «تازه» در همین صفحه می‌آیند. | وقتی آگهی تازه‌ای با قیمت خوب بیاید یا قیمتی کم شود، یک اعلان می‌گیرید. بقیه‌ی آگهی‌های تازه فقط با نشان «تازه» در همین صفحه می‌آیند. | R7 R4 |
| E76 | `search-files-copy.ts · alerts.infoLimits` | برای هر پرونده دست‌کم ۲ ساعت میان دو اعلان می‌ماند و هر حساب در روز تا ۸ اعلان پرونده می‌گیرد. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید. | در روز تا ۸ اعلان پرونده می‌گیرید و میان دو اعلان دست‌کم ۲ ساعت فاصله است. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید. | R7 |
| E77 | `search-files-copy.ts · file.pausedNotice` | این پرونده متوقف است و پایش نمی‌شود. آگهی‌های مطابق و تازه‌ها را همچنان می‌بینید؛ با «ادامه‌ی پایش» دوباره دنبال می‌شود. | این پرونده متوقف است و اعلانی نمی‌فرستد. آگهی‌ها را همچنان می‌بینید. با «ادامه‌ی پایش» دوباره اعلان می‌گیرید. | R7 R4 |
| E78 | `marked-copy.ts · lead` | آگهی‌هایی که نشان کرده‌اید، با قیمت امروزشان کنار قیمت روزی که نشانشان کردید. اگر قیمتی کم شود یا آگهی‌ای فروخته شود، در اعلان‌ها خبرتان می‌کنیم. | آگهی‌های نشان‌شده‌تان، با قیمت امروز و قیمت روزی که نشانشان کردید. | R5 |
| E79 | `marked-copy.ts · info.rows` («زمان اعلان») | هر تغییر یک‌بار در اعلان‌ها می‌آید، تا چند دقیقه بعد از دیده‌شدنش. | (delete) | R7 |
| E80 | `notifications-copy.ts · unknownKind` | اعلانی که این نسخه‌ی کارشناس نمی‌تواند نشانش دهد. | این اعلان نمایش داده نمی‌شود. | R7 |
| E81 | `kinds.ts` (crawl request approved) | این مدل در صف خواندن آگهی‌ها قرار گرفت و آگهی‌هایش پس از خوانده شدن به پرونده‌ی شما می‌آید. | آگهی‌های این مدل را می‌خوانیم و به پرونده‌ی شما اضافه می‌کنیم. | R7 T3 |
| E82 | `crawl-requests-copy.ts` (the card's info) | کارشناس آگهی‌ها را مدل‌به‌مدل و در اندازه‌ی ظرفیت روزانه‌ی خواندن می‌خواند. اگر مدل پرونده‌ی شما هنوز کامل خوانده نمی‌شود، می‌توانید درخواست بدهید و مدیر درباره‌اش تصمیم می‌گیرد. | بعضی مدل‌ها را کامل نمی‌خوانیم. اگر مدل پرونده‌ی شما از آن‌هاست، درخواست بدهید تا مدیر تصمیم بگیرد. | R7 T4 |
| E83 | `crawl-requests-copy.ts` (a queued request) | در صف خواندن است. خواندن آگهی‌ها اکنون متوقف است؛ تا از سر گرفته شود چیزی خوانده نمی‌شود و به محض شروع، نوبت این مدل می‌رسد. | آگهی‌های این مدل با تأخیر به پرونده‌ی شما می‌آیند. (the status badge beside it already says «تأیید شد») | R7 |
| E84 | `plain-search.tsx` (the hint) | مثل «۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون» یا «یه ماشین تمیز و بی‌دردسر می‌خوام». فیلترهایی که فهمیدیم را می‌بینید و می‌توانید برشان دارید. | مثلاً «۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون» یا «یه ماشین تمیز و بی‌دردسر می‌خوام». فیلترهایی که از جمله‌ی شما درمی‌آوریم بالای نتایج می‌آیند و هر کدام را می‌توانید بردارید. | R4 R9 |
| E85 | `plain-search.tsx` (the group titles) | فهمیدم<br>این‌ها را هم گذاشتم<br>در متن آگهی‌ها هم می‌گردم | فیلترهای شما<br>این فیلترها هم اضافه شد<br>در متن آگهی‌ها هم جست‌وجو می‌شود | R9 M9 |
| E86 | `plain-search.tsx` (the unused words) | این کلمه‌ها را نتوانستم به فیلتر تبدیل کنم | این کلمه‌ها به فیلتر تبدیل نشدند | R9 V5 |
| E87 | `plain-search.tsx` (the reasons) | کارشناس هنوز این را فیلتر نمی‌کند.<br>خطاب به سیستم بود و به کار نرفت.<br>معنایش را پیدا نکردم. | فیلتری برای این نداریم.<br>این بخش را نادیده گرفتیم.<br>معنایش را نفهمیدیم. | R8 R7 R9 |
| E88 | `plain-search.tsx` (network failure) | به سرور نرسیدیم؛ اینترنت را بررسی کنید و دوباره بفرستید. جمله‌ی شما همین‌جا مانده است. | اتصال برقرار نشد. جمله‌ی شما همین‌جا مانده است. دوباره بفرستید. | R7 R4 |
| E89 | `plain-search.tsx` (server failure) | مشکلی پیش آمد؛ دوباره امتحان کنید. جمله‌ی شما همین‌جا مانده است. | جمله‌ی شما خوانده نشد و همین‌جا مانده است. دوباره امتحان کنید. | R2 V5 |
| E90 | `error.tsx` (title, description) | مشکلی پیش آمد<br>این صفحه باز نشد. دوباره امتحان کنید؛ اگر باز هم باز نشد، از صفحه‌ی اصلی ادامه دهید. | این صفحه باز نشد<br>(delete the description: [تلاش دوباره] and [صفحه‌ی اصلی] say it) | R5 R2 |
| E91 | `not-found.tsx` | شاید نشانی آن تغییر کرده یا آگهی آن حذف شده باشد. از صفحه‌ی اصلی دوباره جست‌وجو کنید. | شاید نشانی عوض شده یا آگهی برداشته شده باشد. | R5 R6 |

### The superadmin section

The reader acts on operations, so «صف»، «کارگر»، «خزش» stay where the owner acts on them; the rest of the rules hold.

| # | Where | Before | After | Rules |
|---|---|---|---|---|
| E92 | `tracked-models-admin-copy.ts · paused` | خواندن آگهی‌ها اکنون متوقف است. پوشش دادن یک مدل آن را در صف می‌گذارد و هیچ درخواستی به هیچ سایتی نمی‌رود؛ خواندن جزئیات با از سرگرفتن خواندن شروع می‌شود. | خواندن آگهی‌ها متوقف است. پوشش دادن یک مدل آن را در صف می‌گذارد. تا خواندن از سر گرفته نشود، درخواستی به سایت‌ها نمی‌رود. | R4 |
| E93 | `tracked-models-admin-copy.ts` (a failed save) | ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید. | ثبت نشد. دوباره امتحان کنید. | R7 R4 |
| E94 | `crawl-requests-admin-copy.ts · result.invalid` | فرم نامعتبر بود. اگر دلیل رد را ننوشته‌اید، بنویسید. | تصمیم ثبت نشد. اگر دلیل رد را ننوشته‌اید، بنویسید. | R8 R3 |
| E95 | `admin-copy.ts · WORKER_COPY.lead` | آنچه کارگر همین حالا می‌کند و آنچه در بازه‌ی انتخاب‌شده انجام داده است، از پایگاه داده. صفحه هر ۱۵ ثانیه تازه می‌شود. | کار جاری کارگر و کارهایی که در بازه‌ی انتخاب‌شده انجام داده است. صفحه هر ۱۵ ثانیه تازه می‌شود. | R7 R4 |
| E96 | `admin-copy.ts · WORKER_COPY.noJobs` | صف خالی است؛ کارگر هنوز کاری نفرستاده یا pg-boss کارهای تمام‌شده را پاک کرده است. | صف خالی است. کارگر هنوز کاری نفرستاده یا کارهای تمام‌شده پاک شده‌اند. | R7 R4 |

## 9. Using the guide

- **Writing.** Load the `copy-fa` skill. Its procedure: list the screen's strings as one set, give each idea one string, apply the element patterns, cut what a buyer cannot use, check the words and the typography, then ask the `copy-reviewer`.
- **Reviewing.** The `copy-reviewer` quotes each violation with its file and line, the rule or pattern it breaks and a rewrite, and never edits. Taste, brand feel and whether a joke lands stay with the owner («left for you to check»).
- **Mechanical checks.** The copy lint (CS-105) owns digits, half-spaces, the words of appendix B, «!», the middle dot and length.
- **Changing it.** The address and register (section 2) change only by a superseding ADR. Examples, the words table and the patterns change by pull request; a rewrite task that settles a new word adds it to section 4 in the same commit.

## Appendix A: glossary decisions the rewrites need

The glossary stays authoritative until the owner or a rewrite task changes a row. Found while writing this guide:

1. «ارزش‌گذاری» (the daily valuing) has no row; section 4 uses it, as the owner did on 2026-10-04.
2. «پایش» (`در حال پایش`) is jargon; «دنبال کردن» is the plain word. A glossary decision.
3. «بسپارش به کارشناس» uses a spoken clitic in a polite voice (V2); «سپردن به کارشناس» keeps the idea. The glossary row and `search_file` notes change with it.
4. «پیوند» (listing share) against «لینک» (everywhere else): one word, «لینک».
5. «مبلغ آگهی» (`listing-view.ts` status chips) against «قیمت»: «قیمت».
6. «قیمت کارشناسی» is a second name for «ارزش بازار»; it stays in the glossary for query understanding and never appears on screen.
7. «خزش», «خزنده», «مدل پوشش‌داده‌شده», «تعهد», «مرور»: operational or internal; superadmin section only, or not at all.
8. Meta lines joined with « · » (`summaryLine(listing).join(' · ')` in `check-answer.tsx` and on the listing page, and the superadmin screens) break the digit rule wherever a digit sits beside the dot; join with «،» (or lay the facts out as separate items).
9. «پلاک منطقه آزاد» (the glossary, the filters) against «پلاک منطقه‌ی آزاد» (`listing-view.ts`): the project writes the ezafe after a silent «ه» as «ه‌ی», so the second is right and the glossary row and the filters change.

## Appendix B: what the copy lint refuses in a buyer string

The source for CS-105's list. «Refuse» fails the lint; «warn» asks a person.

| Level | Words and marks |
|---|---|
| refuse | «لطفاً», «متأسفانه», «خوشبختانه», «نمایید», «گردید», «می‌باشد», «نمودن», «بفرمایید», «!», « · » next to a digit, Arabic «ي» and «ك», an ASCII digit in Farsi text, «پایگاه داده», «سرور», «هوش مصنوعی», «مدل زبانی», «API», «اپ», «سامانه», «پلتفرم», «نامعتبر», «با موفقیت» |
| warn | «هنوز», «فعلاً», «در حال حاضر», «می‌توانید», «شما می‌توانید», «ممکن است», «احتمالاً» more than once in a string, «؛», a sentence over 25 words, a parenthesis, «اتصال را بررسی کنید», «مشکلی پیش آمد», «من»-verbs («فهمیدم، گذاشتم، نتوانستم»)، «مورد … قرار», «در رابطه با», «به منظور», «جهت», «حذف», «مشاهده», «پیوند» |
