# Spotting the patterns of the guide's section 7

How to find each pattern in a diff, when it is not a violation, and where the product has it. The ids are the guide's (T translated or stiff, M machine-written or promotional, V register slips; R1 to R10 are the ten rules). A hit is a reason to read the sentence, not a verdict: the Wikipedia guide that lists the English tells says they are descriptive, human writers share some of them, and removing a sign does not fix a sentence that says nothing (`docs/research/2026-10-04-product-copy-voice.md`, section 4).

## The detectors

The ids T, M and V are the guide's patterns; R5, R6 and R8 only list candidates for those rules (a retry sentence, a word of the words table, a «هنوز» or «فعلاً»). Python, not `grep` (ugrep refuses Farsi alternations). `ZW` is the half-space (U+200C), built from its code point so that no escape sequence is typed. `review.md` has the runner that applies these to a list of strings.

```python
import re

ZW = chr(0x200C)
LETTER = '[' + chr(0x0600) + '-' + chr(0x06FF) + ZW + ']'
NOT_LETTER = '(?<!' + LETTER + ')'


def word(*alternatives):
    """Whole words only: not inside a longer Farsi word."""
    return NOT_LETTER + '(?:' + '|'.join(alternatives) + ')(?!' + LETTER + ')'


PATTERNS = {
    # T: translated or stiff
    'T1': re.compile('این امکان را|اجازه می' + ZW + 'دهد|قادر می' + ZW + 'سازد'),
    'T2': re.compile('در اختیار[^.؟]{0,40}قرار|ارائه می' + ZW + '(?:دهد|شود)|فراهم می' + ZW + 'کند'),
    'T3': re.compile('مورد [^ ]+ قرار'),
    'T4': re.compile('شما می' + ZW + 'توانید|می' + ZW + 'توانید [^.؟]{0,30} ببینید'),
    'T5': re.compile('لازم به|شایان ذکر|توجه داشته باشید'),
    'T6': re.compile(word('در رابطه با', 'در خصوص', 'به منظور', 'جهت', 'از طریق')),
    'T7': re.compile(word('نمود', 'گردید', 'نمایید', 'بفرمایید') + '|می' + ZW + 'باشد|نمودن'),
    'T8': re.compile('انجام (?:شد|نشد|می' + ZW + 'شود)|صورت (?:می' + ZW + ')?گیر|اقدام به|ممکن نشد'),
    'T9': re.compile('با توجه به اینکه|در صورتی که|تا زمانی که'),
    'T10': re.compile('در حال حاضر|لطفاً|با موفقیت|کلیک'),
    'T12': re.compile('ممکن نیست|امکان' + ZW + 'پذیر نیست|قادر به'),
    # M: machine-written or promotional
    'M1': re.compile('در دنیای|همان' + ZW + 'طور که می' + ZW + 'دانید|بی' + ZW + 'شک|در نهایت'),
    'M2': re.compile(
        word('بی' + ZW + 'نظیر', 'حرفه' + ZW + 'ای', 'پیشرفته', 'هوشمند', 'جامع', 'متنوع', 'جذاب', 'ویژه')
        + '|کاربردی' + ZW + 'ترین|معتبرترین|با اطمینان'
    ),
    'M5': re.compile('نه' + ZW + '?تنها|این فقط[^.؟]{0,30}نیست'),
    'M6': re.compile('ایفا می|عمل می' + ZW + 'کند|محسوب می'),
    'M7': re.compile('در مجموع|به' + ZW + 'طور خلاصه'),
    'M8': re.compile('!|آماده' + ZW + 'اید|بفرمایید'),
    'M9': re.compile('فهمیدم|گذاشتم|نتوانستم|می' + ZW + 'گردم|پیدا نکردم'),
    'M10': re.compile('احتمالاً[^.؟]*(?:شاید|ممکن است)|(?:شاید|ممکن است)[^.؟]*احتمالاً|نه از حدس'),
    'M11': re.compile('طبق بررسی|معتقدند'),
    'M12': re.compile(
        'پایگاه داده|سرور|' + word('صف', 'خزنده', 'خزش', 'ظرفیت', 'پنجره', 'نسخه', 'تعهد')
        + '|روش شماره|میانه' + ZW + 'ی خطا|هوش مصنوعی|خطای میانه|مدل' + ZW + 'به' + ZW + 'مدل|پوشش' + ZW + 'داده'
    ),
    # R5, R6, R8: candidates for the rules about repetition, words and limits
    'R5': re.compile('اتصال را بررسی کنید|دوباره امتحان کنید|دوباره تلاش کنید'),
    'R6': re.compile(word('حذف', 'مشاهده', 'پیوند', 'مبلغ', 'تخمین')),
    'R8': re.compile(word('فعلاً', 'هنوز')),
    # V: register and voice
    'V1': re.compile('می' + ZW + '(?:خوام|خوای|خواین|تونی|تونم|تونید)|' + word('رو', 'یه')),
    'V2': re.compile('بسپارش|برشان|بذار|ببینش|به مشکل خورد'),
    'V3': re.compile('کاربران گرامی|' + word('کاربر', 'کاربران')),
    'V4': re.compile(word('ببین', 'بفهم', 'بزن', 'بخر')),
    'V5': re.compile('متأسفانه|خوشبختانه|مشکلی پیش آمد'),
    'V6': re.compile(word('اپ', 'سیستم', 'پلتفرم', 'سامانه')),
}
```

Mechanical findings that need no pattern id (the lint, CS-105, owns them): an ASCII digit in Farsi text, Arabic «ي» or «ك», «می» followed by a space and a letter, « ها» after a space, «؛», «!», « · » beside a digit, a sentence over 25 words.

## What is not a violation

| Id | Not a violation when |
|---|---|
| T4 | the buyer really is allowed to do something optional: «می‌توانید پرونده را پاک کنید» in a settings screen. A control that does it already makes the sentence unnecessary. |
| T5, T6, T10 | the word is part of a quoted listing text or a seller's own wording. |
| T8 | «ثبت نشد» for a request that was not saved: the passive is right when the person did not do it and the next sentence says what to do. Many «نشد» in a row on one screen is the problem, not one. |
| M2 | «بهترین معامله» is the name of a sort order and a catalogue, not praise. «ویژه» inside a quoted feature name. «متنوع» describing a real list of body types. |
| M9 | the buyer's own typed words are shown back as typed. |
| M10 | one «احتمالاً» on an assumed mileage («احتمالاً ۱۰۰٬۰۰۰ کیلومتر») is the product being honest, not hedging. |
| M12 | the superadmin section (guide, section 5), where the owner acts on the operation; and the data-status page's freshness numbers in the buyer's units («۳ ساعت پیش»). |
| V1 | a query example the buyer would type («یه ماشین تمیز می‌خوام»); a model prompt or a test fixture. |
| V3 | «نام کاربری» and «حساب کاربری» (username and account): the pattern is the word for the person, not these glossary terms. The word list above already excludes «کاربری». |
| V4 | a single imperative that is a seller's or a listing's own text. |
| «هنوز», «فعلاً» (R8) | the buyer's own state («هنوز آگهی‌ای نشان نکرده‌اید») or data that will exist when the next step follows («برای این آگهی هنوز ارزش بازاری حساب نشده است»). Not for what the product cannot do. |
| R5 | a field error and its summary link; an accessible name that adds the object; a page title and its `h1`; a promise on a second screen where the buyer decides again (guide, section 4). The scan's R5 hit is only a retry sentence: read the screen for a retry button. |
| R6 | «برآورد» as a noun for a dated estimate; «حذف» in the superadmin section is a verb of its own screen only when the glossary says so. |

## Where the product has them today (measured at `4d980fd`, regex pass)

| Pattern | Count | Example |
|---|---|---|
| R4: «؛» inside a string | 152 strings | `check-copy.ts · pasteDenied` |
| R8: «هنوز» / «فعلاً» about a capability | 57 / 11 | `check-copy.ts · problems.otherSite` |
| M12: «پایگاه داده» | 17 | `home-copy.ts · how.errorBody` |
| R5: the retry sentence «اتصال را بررسی کنید» | 10 | `search-files-copy.ts · save.failed`, `notifications-copy.ts · failures` |
| R6: four verbs for taking something away | «برداشتن» 27, «پاک کردن» 9, «حذف» 7, «بستن» 18 | `search-copy.ts`, `admin-copy.ts` |
| M9: «من» verbs | 5 strings | `plain-search.tsx` |
| T8: «… نشد» as the whole message | 56 strings | `model-copy.ts`, `search-copy.ts` |
| T4: «می‌توانید» | 7 | `search-copy.ts · sheet.countFailed` |
| T1, T2, T3, T5, T6, T10 | 0 in our strings | They are in the big Iranian apps' store text (Snapp, Alibaba) and in what a model writes: expect them in new drafts, not in the old files. |

The old strings' problems are fluff, repetition, internals and register slips; the translated-Farsi tells are what a fresh draft brings, so look for them hardest in new text.
