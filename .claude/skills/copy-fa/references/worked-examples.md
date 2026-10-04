# Six worked examples

The process, from the whole set to the final strings. Every string is real (`4d980fd`); the guide's section 8 has the same rewrites as a table. Copy the process, not the sentences: a screen's own facts decide its words.

## 1. A page as a set: paste a link (`check-copy.ts`)

The page has 15 strings. Written as an idea table:

| String | Element | Idea | Decision |
|---|---|---|---|
| «ارزیابی قیمت با لینک آگهی» | title | what the page is | keep |
| «لینک آگهی را بچسبانید، ارزیابی را همین‌جا ببینید» | `h1` | what the page is, and to paste | the title again: fold into the title |
| «قیمت آگهی را با ارزش بازار همان خودرو می‌سنجیم و می‌گوییم چرا. لازم نیست ثبت‌نام کنید.» | lead | what we do; no sign-up | the first sentence is the title again; keep the fact: «ثبت‌نام لازم نیست.» |
| «لینک آگهی را بچسبانید» | label | where to paste | keep, shorter: «لینک آگهی دیوار» |
| «لینک آگهی دیوار را از مرورگر یا از دکمه‌ی «هم‌رسانی» دیوار بردارید.» | hint | where to get the link | keep: «لینک را از نوار آدرس یا از «هم‌رسانی» در دیوار کپی کنید.» |
| «ارزیابی قیمت» | button | the result | keep |
| «چطور؟» and three steps | list | how to use it | delete: the label, the hint and the button already are the three steps |
| «لینک آگهی را بچسبانید.» | error (empty) | paste a link | keep, as what happened: «لینکی نوشته نشده است.» then the way: «لینک آگهی را بچسبانید.» |

Result: nine strings, each idea once. The rule that decided: the same instruction was in the label, the heading, the second step and the error (R5); the lead restated the title (R2).

## 2. An error block: one idea, three strings (`search-copy.ts`)

Title «آگهی‌ها بارگذاری نشد», body «مشکلی در خواندن آگهی‌ها پیش آمد. دوباره امتحان کنید؛ اگر باز هم نشد، کمی بعد برگردید.», button «دوباره امتحان کنید». All three say that loading failed and that the buyer can retry. The button says it by being there. The title says what happened. The body adds nothing: it is deleted, and the button's label becomes the table's «تلاش دوباره». Result: title and button. A body returns only when it holds a fact the buyer needs: «جمله‌ی شما همین‌جا مانده است.»

## 3. A popover: how many numbers? (`filters.ts`, `gauge-view.ts`)

The low-mileage filter's popover said: «خودرویی که کمتر از معمول بازار (حدود ۲۰٬۰۰۰ کیلومتر در سال) کار کرده است. آگهی‌های بدون کارکرد یا سال ساخت کنار می‌روند.» and «حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو؛ خودروی کمتر از یک سال، نیم سال حساب می‌شود.»

| Fact | Could the buyer decide differently, or check it on a listing? | Decision |
|---|---|---|
| normal is about 20 000 km a year | no, it is the model's norm; and beside 12 000 it contradicts | cut |
| at most 12 000 km per year of age | yes: they can divide a listing's mileage by its age | keep |
| listings without mileage or year are left out | it explains an absence, but not a decision | cut |
| a car under one year counts as half a year | an edge of the code | cut |

Result: «حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو.» One number, one sentence; the owner's request of 2026-10-01 is met. The same test shortens the rating popover's «چه وقت ارزیابی نمی‌کنیم؟» from «دست‌کم ۸ آگهی … حداکثر ۲ سال … از ۱۵٪ بیشتر نباشد» to «اگر آگهی مشابه کافی نداشته باشیم یا برآورد ما برای آن مدل دقیق نباشد، قیمت را ارزیابی نمی‌کنیم.»: the buyer cannot check eight, two or fifteen on the page, but both reasons are facts about what they see (the second one is not left out: a cut removes the machinery, not a cause).

## 4. A limit (`check-copy.ts · problems.otherSite`)

«فعلاً فقط آگهی‌های دیوار را ارزیابی می‌کنیم. «bama.ir» را هنوز نمی‌خوانیم.» Read it as the buyer: «فعلاً» says the feature is unfinished, «هنوز نمی‌خوانیم» says the other site is missing, and naming it points at the gap. Nothing says what to do. Two moves: state the boundary as a fact about this link, and give the way forward. «این لینک آگهی دیوار نیست. لینک یک آگهی از دیوار را بچسبانید.» The same fact, no apology, an action. The popover that explains the scope says it as scope: «لینک هر آگهی دیوار را می‌خوانیم، کوتاه یا بلند.»

## 5. An explanation line: what does the buyer need? (`listing-explanation.ts`)

«برآورد ما برای این مدل معمولاً حدود ۱۸٪ خطا دارد و این بیشتر از ۱۵٪ است؛ برای همین قیمت‌ها را برای این مدل ارزیابی نمی‌کنیم.» The fact the buyer needs: this listing is not rated, because our estimate for the model is not accurate enough. The 18 % and the 15 % are the method's error and its threshold: not checkable, not actionable (R7). «برای همین» and the repeated «برای این مدل» are two ways of saying one thing (R4). Result: «برآورد ما برای این مدل به‌اندازه‌ی کافی دقیق نیست، پس قیمت‌ها را ارزیابی نمی‌کنیم.» The code that builds the line keeps its figures for the test that checks them; only the buyer's sentence loses them.

## 6. A button that names a mood (`plain-search.tsx`)

The submit button said «بفهم». Ask what it does: it takes the typed sentence, shows the filters it made and lands on the results. The button names the mechanism («understand!», in the singular imperative: V4), and it sits beside the header's «جست‌وجو» and the label «چه ماشینی می‌خواهید؟». It names the result in the table's word: «جست‌وجو». The spinner stays inside and the label does not change while it works (`.claude/rules/ui.md`).
