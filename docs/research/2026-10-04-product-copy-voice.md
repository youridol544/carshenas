# How should product copy sound, and how does Carshenas keep its Farsi free of fluff, repetition, technical detail and machine-written patterns?

- Date: 2026-10-04
- Asked by / for: Pedrum (owner feedback of 2026-10-04), task CS-104; the rewrites are CS-106 to CS-110 and the copy lint is CS-105
- Outcome: the guide `docs/design/product-voice.md`, ADR-0042 (voice and register), the `copy-fa` skill, the `.claude/rules/copy.md` rule and the `copy-reviewer` agent. The voice is a calm, direct expert friend, written to «شما» in plain standard Farsi.

## Questions

1. How do the best product-writing guides say copy must sound (voice and tone), and where do they agree?
2. How do they keep text short, free of fluff, free of repetition and free of detail the reader does not need?
3. What are the tells of machine-written copy in English, which carry over to Farsi, and which tells are Farsi's own (translationese, over-formal verbs)?
4. What do Farsi orthography and localisation guides say about register, half-spaces, punctuation and digits?
5. How do Iranian products speak (Torob, Alibaba, Jabama, Snapp, Tapsi, Digikala, Snappfood)?
6. What does Carshenas's own text do wrong, in numbers?
7. Which voice, address form and verb register should Carshenas use, and how is a rewrite judged?

## Method

- Every page below was read on 2026-10-04 with the fetch tool. A small model reads the page and answers a prompt, so **quotes marked "tool" are as the tool returned them and were not re-checked against the live page**. Quotes marked "raw" come from page or PDF text I extracted myself: the Microsoft Writing Style Guide page (raw markdown), the Microsoft Persian style guide (PDF text through `pdftotext` and PyMuPDF) and the Academy's orthography (PDF text through PyMuPDF, normalised with NFKC).
- Iranian products: public landing pages and Cafe Bazaar store pages only. No listing site was fetched: Divar, Bama and the others are left out on purpose (the lane rule and ADR-0008), so Divar's own voice is not quoted. Digikala's and Snappfood's own sites returned nothing readable (a script-rendered page and a 403), Snapp's site looped through redirects, and Tapsi, Jabama and Alibaba served text; the gaps are filled from their store pages.
- Our strings: a script (`/home/pedrum/Dev/carshenas-lane-run/scratch/cs104-corpus.py`, not committed) pulled the Farsi string literals and JSX text out of the copy-bearing files of the lane at `4d980fd`, 1,871 strings in 72 files. It is regex work: counts are right to within a few percent, not exact.
- The trial (section "The trial on 20 real strings") applies the guide and the skill's procedure by hand to strings that are not among the guide's 96 rewrites.

## Sources

Product and UX writing guidelines

| # | Source | Who and when | Why credible | Quotes |
|---|---|---|---|---|
| S1 | https://styleguide.mailchimp.com/voice-and-tone/ | Mailchimp, Content Style Guide, 2023 | A long-running public style guide of a large consumer product | tool |
| S2 | https://shopify.dev/docs/apps/design/content | Shopify, app design content guidelines (Polaris) | Written for thousands of third-party writers | tool |
| S3 | https://atlassian.design/foundations/content/voice-tone | Atlassian Design System, voice and tone | Public design system of a large product company | tool |
| S4 | https://developer.apple.com/design/human-interface-guidelines/writing | Apple, Human Interface Guidelines, Writing (read through its JSON data file) | The platform owner's rules for app text | tool |
| S5 | https://developers.google.com/style/tone | Google developer documentation style guide, tone | Google's own style guide | tool |
| S6 | https://m1.material.io/style/writing.html | Google, Material Design (archive), Writing | Written for interface text | tool |
| S7 | https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ , `.../right-tone/` , `.../style-guides/a-to-z-style-guide/` and https://design-system.service.gov.uk/components/error-message/ | GOV.UK content and publishing guidance and Design System (Government Digital Service) | Tested with real users at national scale; Open Government Licence | tool |
| S8 | https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice | Microsoft Writing Style Guide, top 10 tips (page dated 2026-07-02) | Microsoft's own guide, kept in a public repository | raw |
| S9 | https://download.microsoft.com/download/3/e/c/3ec58a9a-70ff-4a31-8cfd-d185983111be/fas-irn-StyleGuide.pdf | Microsoft Persian (Iran) localization style guide, 50 pages, PDF created 2023-05-08 | The only large vendor guide that says how its voice is carried in Persian | raw |
| S10 | https://www.nngroup.com/articles/tone-voice-users/ | Kate Moran, NN/g, "The Four Dimensions of Tone of Voice", 2016-08-07, reviewed 2024-01-30 | Controlled study with users | tool |
| S11 | https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/ and https://www.nngroup.com/articles/how-users-read-on-the-web/ | John Morkes and Jakob Nielsen, 1997 | The measured study behind "write for scanning" | tool |
| S12 | https://www.nngroup.com/articles/error-message-guidelines/ | Tim Neusesser and Evan Sunwall, NN/g, 2023-05-14 | Usability research | tool |
| S13 | https://www.nngroup.com/articles/empty-state-interface-design/ | Kate Kaplan, NN/g, 2021-09-19 | Usability research | tool |
| S14 | https://www.nngroup.com/articles/tooltip-guidelines/ | Alita Kendrick, NN/g, 2019-01-27 | Usability research | tool |
| S15 | https://www.nngroup.com/articles/progressive-disclosure/ | Jakob Nielsen, 2006-12-03 | The original statement of the pattern | tool |
| S16 | https://digital.gov/guides/plain-language/writing and https://www.nngroup.com/articles/plain-language-experts/ | digital.gov (US federal plain language guide); Hoa Loranger, NN/g, 2017-10-08 | Government standard and a user study | tool |

The tells of machine-written text

| # | Source | Who and when | Why credible | Quotes |
|---|---|---|---|---|
| S17 | https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing | WikiProject AI Cleanup, last update seen August 2026 | A field guide made by editors who remove such text daily, with real examples; descriptive, not prescriptive | tool |
| S18 | https://arxiv.org/abs/2406.07016 (v4, 2025-07-03; word figures from v2) | Dmitry Kobak, Rita González-Márquez, Emőke-Ágnes Horvát, Jan Lause | A count over more than 15 million PubMed abstracts | tool |
| S19 | https://arxiv.org/abs/2501.15654 | Jenna Russell, Marzena Karpinska, Mohit Iyyer, ACL 2025 | Human detectors who use LLMs daily misclassified 1 of 300 articles | tool |
| S20 | https://simonwillison.net/2024/May/8/slop/ | Simon Willison, 2024-05-08 | The post that fixed the word "slop" | tool, paraphrased only |

Farsi

| # | Source | Who and when | Why credible | Quotes |
|---|---|---|---|---|
| S21 | https://www.ekhtebar.ir/wp-content/uploads/2023/07/Dastour-e-Khat-17.04.1402-3.pdf | فرهنگستان زبان و ادب فارسی، «دستور خط فارسی» (ویراست جدید), electronic edition of July 2023; the rules were approved on 30 Tir 1380 (2001-07-21) | The Academy is the body that sets Persian orthography | raw |
| S22 | https://w3c.github.io/alreq/ | W3C, Arabic and Persian Layout Requirements | The standard that the project's own locale rules rest on | tool |
| S23 | https://blog.faradars.org/ux-writing-چیست/ | Fahimeh Sokouti, Faradars magazine, 1404/04/17 (2025-07-08) | A mainstream Persian primer on UX writing | tool |
| S24 | https://codelabs.developers.google.com/codelabs/material-communication-guidance?hl=fa | Google, Material codelab, Persian translation | Google's UX writing course in Farsi | tool |

How Iranian products speak (public pages, read 2026-10-04)

| # | Page | Quotes |
|---|---|---|
| P1 | https://torob.com/ and https://cafebazaar.ir/app/ir.torob | tool |
| P2 | https://www.alibaba.ir/ , https://www.alibaba.ir/hotel and https://cafebazaar.ir/app/ir.alibaba | tool |
| P3 | https://www.jabama.com/ and https://cafebazaar.ir/app/com.jabamaguest | tool |
| P4 | https://cafebazaar.ir/app/cab.snapp.passenger | tool |
| P5 | https://tapsi.cab/ and https://cafebazaar.ir/app/taxi.tap30.passenger | tool |
| P6 | https://cafebazaar.ir/app/com.digikala | tool |
| P7 | https://cafebazaar.ir/app/com.zoodfood.android | tool |
| P8 | `docs/research/2026-09-29-iranian-sign-in-teardown.md` (Aparat, Filimo, Virgool, Torob, Namava; captured 2026-09-29, not re-read) | the note |

Not found: a public, authoritative catalogue of the tells of machine-written Farsi, and a Persian UX-writing guide published by one of the products above. The Farsi catalogue in the guide is therefore built from S9, the product's own strings and the English tells, and says which is which.

## Findings

### 1. What the guides agree on about voice and tone

- **Voice is constant, tone follows the moment.** "You have the same voice all the time, but your tone changes" (S1). Apple: "Match your tone to the context" (S4). Atlassian: tone changes with the situation, an error against a success (S3).
- **The target voice is an informed friend, not an entertainer and not a clerk.** Google: "sound like a knowledgeable friend who understands what the developer wants to do", "Don't try to be super-entertaining, but also don't aim for super-dry" (S5). Mailchimp: "the experienced and compassionate business partner we wish we'd had" (S1). GOV.UK: "brisk, but not terse", "serious but not pompous" (S7). Microsoft: "Warm and relaxed", "Crisp and clear", "Ready to lend a hand" (S9).
- **Clarity beats charm, and humour is optional.** "It's always more important to be clear than entertaining" and "forced humor can be worse than none at all" (S1). Atlassian limits its delight to success messages, "little flourishes, not humor or being cheeky", and only after trust is built (S3).
- **Conversational beats formal, but trust matters most.** In NN/g's study casual, conversational and moderately enthusiastic tones performed best, and "52% of the variability in the desirability scores is explained by trustworthiness"; a casual bank was read as friendlier and more trustworthy than a formal one (S10). For a product that tells people whether a price is fair, trust is the whole product.
- **Say it like a person would, and read it aloud.** Microsoft: "Write like you speak. Read your text aloud." Apple: "When in doubt, read your writing out loud." (S8, S4)
- **Second person, not "the user".** Microsoft's Persian guide: third-person references "such as 'user' should be avoided as they sound formal and impersonal"; "Avoid the corporate 'we'", keep the focus on "you" (S9). Material: use "you" and "your", avoid "we" (S6). Our one exception is the plain «ما» for what the product did; Microsoft's Persian examples use "we" in reassurance too: "Use of \"we\" provides a more personal feel" (S9).

### 2. Short, no fluff, one idea, no repetition

- **Fluff is measurable.** Users "detest anything that seems like marketing fluff or overly hyped language ('marketese') and prefer factual information"; credibility questions about promotional statements "may distract users from processing the meaning" (S11). In the 1997 test concise text scored 58 % better usability, scannable 47 %, objective 27 %, all three 124 % (S11).
- **Cut words.** Apple: "Check each word to be sure it needs to be there. If you can use fewer words, do so." Microsoft: "Give customers just enough information to make decisions confidently. Prune every excess word." (S4, S8) Google lists the fillers: "Placeholder phrases like please note and at this time" and "simply", "It's easy" (S5).
- **Tell people only what they need.** Atlassian: "Tell people only what they need to know in the moment and nothing more." (S3). NN/g on progressive disclosure: "Initially, show users only a few of the most important options. Offer a larger set of specialized options upon request." (S15). Tooltips: "lengthy content is no longer a 'tip', so keep it brief" and "tooltips shouldn't be essential for the tasks users need to accomplish"; redundant tooltip text is "information pollution" (S14).
- **One idea per sentence, short sentences.** GOV.UK: "Try to split up sentences that are over 25 words long", and "Do not use formal or long words when easy or short ones will do. Use 'buy' instead of 'purchase'" (S7). Material: "Write in small, scannable segments" (S6). Even experts want the same: "Even highly educated online readers crave succinct information that is easy to scan, just like everyone else" (S16).
- **Lead with the point.** Microsoft: "Lead with what's most important. Front-load keywords for scanning." (S8). Users "rarely read Web pages word by word; instead, they scan" (S11).
- **Verbs, not nouns that hide a verb.** "A hidden verb (or nominalization) is a verb converted into a noun. ... They make our writing weak and longer than necessary" (S16). Microsoft: "Edit out *you can* when it isn't necessary." (S8)
- **One word for one thing.** Shopify: "Use a single noun, verb, or phrase to describe a specific thing, action, or concept." Apple: "Consistency builds familiarity" (S2, S4). The one sanctioned repeat is GOV.UK's: the same error message next to the field and in the summary, so they "look, sound and mean the same" (S7).
- **Cut the nice-to-know from the screen, not from the product.** None of the guides asks a product to show how it works inside; Atlassian and NN/g ask the opposite.

### 3. Errors, empty states, limits, buttons

- **Errors say what happened and what to do.** GOV.UK: "Describe what has happened and tell them how to fix it." (S7). NN/g: "Merely stating the problem is also not enough; offer some potential remedies"; do not blame with words such as "invalid, illegal, or incorrect" (S12). Apple: "That password is too short" is worse than "Choose a password with at least 8 characters" (S4). Microsoft: replace "Invalid ID" with "You need an ID that looks like this: someone@example.com" (S8).
- **No "please", "sorry", "oops".** GOV.UK: "Do not use: 'please' because it implies a choice"; "Do not use: 'sorry' because it does not help fix the problem"; "Do not use: 'valid' and 'invalid'" (S7). Google: "using please in a set of instructions is overdoing the politeness" (S5). Apple: "Interjections like 'oops!' or 'uh-oh' are typically unnecessary and can sound insincere." (S4)
- **No exclamation marks.** Material: "Avoid exclamation points as they tend to come across as shouting." (S6)
- **Buttons are verbs.** Apple: "When labeling buttons and links, it's almost always best to use a verb"; "just saying 'Send' often works better than 'Let's do it!'" Shopify: "For calls to action (CTAs), start with a strong verb that describes the action." (S4, S2)
- **Empty states communicate status and give a way forward.** NN/g's three guidelines: "Communicate system status", learning cues, "direct pathways for getting started with key tasks" (S13).
- **A limit is not an apology.** None of the pages read here recommends an apology for a limit, and GOV.UK gives the reason: "sorry" "does not help fix the problem" (S7). Microsoft's Persian guide gives the plain form for a failure: «مشکلی پیش آمد» ("Something went wrong") and a short factual sentence such as «حافظه کافی برای پردازش این دستور وجود نداشت» (S9).

### 4. The tells of machine-written text

What the English sources list, with what carries over to Farsi (the Farsi column is my reading, not a source):

| Tell (source) | Example from the source | In Farsi |
|---|---|---|
| "AI vocabulary" (S17): 2023 to mid-2024 "Additionally, boasts, bolstered, crucial, delve, emphasizing, enduring, garner, intricate, interplay, key, landscape, meticulous, pivotal, underscore, tapestry, testament, valuable, vibrant"; mid-2024 to mid-2025 "align with, enhance, fostering, highlighting, showcasing"; later "emphasizing, enhance, highlighting, showcasing" | Kobak et al.: "delves" at 28 times its expected frequency, "showcasing" at 10 times, "underscores" at 11 times; 66 % of the excess style words were verbs and 16 % adjectives (S18) | The same family: «بی‌نظیر، حرفه‌ای، پیشرفته، هوشمند، جامع، متنوع، جذاب، ویژه، کلیدی، حیاتی» and verbs such as «ارائه می‌دهد، فراهم می‌کند، تقویت می‌کند، برجسته می‌کند» |
| Experts spot it by "AI vocabulary" plus formality, originality and clarity (S19) | five readers misclassified 1 of 300 articles | A reader who knows Farsi hears the same: the formal, vague, interchangeable sentence |
| Undue emphasis on significance, "marking a pivotal moment" (S17) | | «نقش مهمی ایفا می‌کند»، «از اهمیت بالایی برخوردار است» |
| Promotional language, "vibrant town with a rich cultural heritage" (S17) | | «معتبرترین»، «کاربردی‌ترین»، «تخفیف‌های جذاب»، «با اطمینان بخرید» |
| Avoidance of "is": "serves as a" for "is" (S17) | | «به‌عنوان … عمل می‌کند»، «محسوب می‌شود» for «است» |
| Negative parallelism, "not only … but also …" (S17) | | «نه‌تنها … بلکه …»، «این فقط … نیست، بلکه …» |
| Vague attribution, "Industry reports", "Observers have cited" (S17) | | «طبق بررسی‌ها»، «کارشناسان معتقدند» |
| Outline-like conclusions, "Despite its … faces challenges" (S17) | | «در مجموع»، «در نتیجه»، a closing line that restates the section |
| Rule of three, em dashes, boldface (S17) | | «سریع، دقیق و قابل‌اعتماد»; the dash rarely appears in Farsi, but the triad and the doubled pair («سریع و آسان») do |

Two cautions from the sources, both applied in the guide. The Wikipedia guide says: "Please do not merely treat these signs as the problems to be fixed; that could just make detection harder" (S17): replacing «بی‌نظیر» with «عالی» fixes nothing when the sentence says nothing, so the guide asks for a fact or a cut, not a swap. And the signs are "descriptive, not prescriptive" and human writers share some of them (S17): a tell is a reason to look at a sentence, not a verdict.

Slop, in Willison's use, is unrequested, unreviewed generated content handed to people (S20): the defence is that every string is read by a person against a checklist before it ships, which is the `copy-reviewer`'s job.

### 5. Farsi: orthography, punctuation and register

Half-space (ZWNJ, U+200C), from the Academy's new edition (S21, page numbers of the 2023 electronic edition):

- Three kinds of space exist: full, half («نیم‌فاصله»), none (pp. 22–23). The Academy says (translated) that spacing is necessary in Persian script and that ignoring it may cause misreading or ambiguity (p. 22).
- «می‌» and «نمی‌» are always written with a half-space from the verb: «می‌افکند، می‌رود» (p. 39).
- The plural «ها» may be written joined or with a half-space, but writing it apart is recommended, for teaching and for text processing (translated, p. 40); after silent «ه» it is always apart: «خانه‌ها، میوه‌ها» (p. 41); after a foreign word too: «ویتامین‌ها».
- «تر» and «ترین» take a half-space («وسیع‌تر»), except in «بهتر، بیشتر، کمتر», which are joined (p. 40). «بی‌» as a negating prefix always takes a half-space: «بی‌تردید» (p. 39); «هم‌» too: «هم‌گروه» (p. 40).
- «اینجا، آنجا، اینکه، آنکه، آنچه» are joined, «همین‌جا، همان‌جا» take a half-space (pp. 34–35).
- After a silent «ه» the ezafe is written «ۀ» (a short ya): «خانۀ او، برنامۀ روزانه» (p. 47). **The product writes «ه‌ی»** (`docs/design/design-language.md` section 2, the glossary), which the Academy does not: it types the same on every keyboard and searches as itself. The guide keeps the project's choice and records the divergence.
- W3C: the Persian digits are U+06F0 to U+06F9; "a special character should be used to enforce disjoining of these letters ... U+200C ZERO WIDTH NON-JOINER"; the percent sign "is placed on the left after the number" (S22).
- Microsoft's Persian guide (S9): the Persian comma «،»; do not use ellipses mid-sentence; use «تا» for ranges instead of a dash; use parentheses rather than em dashes; a no-break space between a number and its unit («۵ کیلوگرم»); half-space for the plural, the verb prefix «می‌» and verb endings («گرفته‌اند»).

Register and voice in Persian localisation (S9):

- "Use language that resembles conversation observed in everyday settings as opposed to the formal, technical language that is often used for technical and commercial content."
- "There is a very deep difference indeed between Persian formal-informal and/colloquial tone. ... An informal tone is preferred which can be assumed a friendly tone." Its own Persian samples stay in the polite plural with plain written verbs: «این کلید محصول کار نکرد. آن را بررسی کنید و دوباره امتحان کنید.» and «می‌خواهید ادامه دهید؟» (the PDF text has lost the half-space; restored here).
- The classic-against-modern table: «مورد استفاده قرار دادن» becomes «استفاده کردن», «ذیل» becomes «زیر», «می‌باشد» becomes «است»/«هست», «اطمینان حاصل کنید» becomes «مطمئن شوید»/«بررسی کنید». Its tense example: «برای دریافت جزئیات بیشتر نیاز خواهید داشت که با فروشنده تماس برقرار کنید» becomes «برای جزئیات بیشتر با فروشنده تماس بگیرید».
- The product should have "the 'look and feel' of a product originally written in Persian, using idiomatic syntax" and error messages should be "more natural, empathetic and not robot-like".
- Farsi UX writing primers say the same in short: «هرچه کوتاه‌تر، بهتر»; do not use jargon; use active verbs and everyday words (S23); «مختصر و مفید باشید، اما نه رباتیک»; «ساده و مستقیم بنویسید»; the choices best for interfaces "are not always the same as the rules of formal writing" (S24).

### 6. How Iranian products speak (public pages, 2026-10-04)

| Product | What the pages say (verbatim, tool) | Register |
|---|---|---|
| Torob (P1, P8) | Home: «ترب \| بهترین قیمت بازار», «مقایسه قیمت میلیون‌ها محصول بین هزاران فروشگاه». Bazaar: «خرید با بهترین قیمت بازار؛ چه آنلاین، چه حضوری», «با ترب می‌تونی قیمت میلیون‌ها کالا رو بین صدها هزار فروشنده آنلاین و حضوری مقایسه کنی», «ترب فقط قیمت‌ها رو کنار هم نمی‌ذاره؛ با نمودار تغییرات قیمت، مشخصات کالا و دستیار خرید «از ترب بپرس»، کمک می‌کنه انتخابت آگاهانه‌تر و مطمئن‌تر باشه». Sign-in dialog (P8): «ورود به ترب», «شماره موبایل خود را وارد کنید» | Store text in spoken «تو» (می‌تونی، رو، انتخابت); the site and dialog in neutral noun phrases and polite «خود را وارد کنید». Short, factual, numbers in the first line |
| Alibaba (P2) | «سریع‌تر و مطمئن‌تر به سفر بروید», «معتبرترین عرضه‌کننده محصولات گردشگری در ایران», «پشتیبانی و همراهی ۲۴ ساعته در تمامی مراحل سفر». FAQ in the traveller's voice: «چه ساعتی می‌توانیم اتاق‌مان را تحویل بگیریم و چه ساعتی باید اتاق را پس بدهیم؟». Bazaar: «علی بابا کاربردی‌ترین اپلیکیشن سفر», «به همه خدمات سفر به صورت یکجا دسترسی دارید و می‌توانید خودتان خرید … را در کمترین زمان انجام دهید» | Polite «شما» with written verbs; superlative claims; stacked «می‌توانید … انجام دهید», «به صورت»; the FAQ questions are natural because they quote the buyer |
| Jabama (P3) | Search form: «مقصد سفرت کجاست؟», «تاریخ ورود», «تعداد نفرات». Headings: «اجاره ویلا در محبوب‌ترین شهرها», «قیمت منصفانه», «آخر هفته تو استخر». Trust line: «در تمامی سفر‌های شما، ۲۴ ساعته در کنار شما هستیم.» Bazaar: «رزرو آنی و تضمینی بدون نیاز به تایید میزبان» | Informal «تو» in the form and headings, formal «شما» and «تمامی» in the trust line, on one page |
| Snapp (P4) | Bazaar: «اسنپ، سوپراپلیکیشنی برای همه‌ی نیازها», «اسنپ سوپراپلیکیشنی برای گوشی‌های هوشمند است که امکانات متنوعی را در اختیار کاربرانش قرار می‌دهد.», «اسنپ اکو : پرطرفدارترین سرویس. درخواست سریع و مقرون‌به‌صرفه‌ی خودرو» | Third person «کاربرانش», «در اختیار … قرار می‌دهد» (a calque of "makes available"), claims; labels as short noun phrases |
| Tapsi (P5) | Home: «با سوپر اپلیکیشن تپسی، زندگی به فرمان توست.», «همین حالا تپسی رو نصب کن!», «در کمتر از ۱۰ دقیقه ثبت‌نام کنید». Bazaar: «تپسی — زندگی به فرمان تو!», «از بسته‌های کوچک تا بزرگ، سریع و مطمئن به مقصد برسانید» | Spoken «تو» and exclamation marks for passengers, polite «-ید» for drivers, on the same page |
| Digikala (P6) | Bazaar: «دیجی‌کالا – لبخند به خانه می‌رسد», «امکان بازگشت کالا تا ۷ روز با پشتیبانی ۲۴ ساعته», «اطلاع از تخفیف‌ها و فروش‌های ویژه» | A brand line plus noun-phrase benefits that start with «امکان» ("the possibility of") |
| Snappfood (P7) | Bazaar: «اپلیکیشن اسنپ‌فود پلتفرم جامع سفارش آنلاین در دسته‌بندی‌های بسیار متنوع است», «تخفیف‌های جذاب روزانه» | The promotional vocabulary of the machine-written list: «پلتفرم، جامع، متنوع، جذاب» |
| Aparat, Namava (P8) | «موبایل یا ایمیل خود را وارد کنید:», «رمز عبور خود را فراموش کرده‌ام.» | Polite and plain; the first-person form for a link the user "says" |

Reading across them:

- **Nobody holds one register.** Torob, Tapsi and Jabama mix «تو» and «شما» (Tapsi's driver heading says «ثبت‌نام کنید», its install line «نصب کن!»). My reading: a mixed register is what reads machine-written, and a product of about 2,000 strings cannot hold «تو» by hand.
- **Torob, the product Carshenas is modelled on, speaks two ways.** The home page text I read is neutral and number-first, its store text is spoken «تو», and its sign-in dialog (captured 2026-09-29) says «شماره موبایل خود را وارد کنید».
- **The stiff patterns are visible in the biggest brands' store text**: «در اختیار … قرار می‌دهد», «به صورت یکجا», «امکان …», superlatives, «پلتفرم جامع». They are what the owner objects to.
- **Names and short words win**: «ورود», «ثبت‌نام», «جست‌وجو», «ادامه». Where the products write a sentence, the strongest ones state what is and how many (Torob: "millions of products between thousands of shops"), not how good it is.

### 7. Our own strings (measured 2026-10-04, regex pass, approximate)

1,871 Farsi strings in 72 files; 1,295 sentences of three words or more, mean 7.5 words, median 5.

| What | Strings | What it says |
|---|---|---|
| Sentences over 20 words | 44 sentences (12 over 25) of 1,295 | Rare, and they are the ones that carry the thresholds and the method |
| «؛» inside a string | 152 | The splice that lets two ideas share one sentence |
| «هنوز» / «فعلاً» | 57 / 11 | "Not yet" and "for now" attached to what the product cannot do |
| «پایگاه داده» | 17 | An error stated as an internal fact: «پایگاه داده پاسخ نداد» |
| «اتصال را بررسی کنید» | 10 | The same recovery sentence pasted into ten failure messages |
| «دوباره امتحان» / «تلاش دوباره» | 57 | Two spellings of one control, and often a third as a sentence beside it |
| «… نشد» (خوانده، ثبت، انجام، پیدا، ساخته، بارگذاری، ذخیره، اعمال) | 56 | The agentless failure; fine alone, a template when every error uses it |
| First person plural «ما» verbs / singular «من» verbs | 70 / 5 | «می‌خوانیم» against «فهمیدم، گذاشتم، نتوانستم، می‌گردم» (the plain-search panel) |
| «برداشتن» / «پاک کردن» / «حذف» / «بستن» | 27 / 9 / 7 / 18 | Four verbs for taking something away |
| «می‌توانید» | 7 | The stacked-modal-verb problem is small here; the fluff is somewhere else |
| «لطفاً», «متأسفانه», exclamation marks | 0, 0, 0 | The existing error rules (`states-a11y.md`) already hold |
| Missing half-space after «می» | 0 | The authors and the formatters keep the ZWNJ |

Repetition inside one file (a 4-word sequence shared by two strings) shows in 140 string pairs; the worst cases are real:

- The home page says «آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم» twice, in the hero and in step 1.
- The paste-a-link page tells the visitor to paste the link in its label, its heading, its second step and its empty-state message.
- The search error has a title («آگهی‌ها بارگذاری نشد»), a body that says «دوباره امتحان کنید؛ اگر باز هم نشد، کمی بعد برگردید» and a button «دوباره امتحان کنید».
- `lib/crawl-requests-copy.ts`, shown to buyers, says «در صف خواندن است. خواندن آگهی‌ها اکنون متوقف است؛ تا از سر گرفته شود چیزی خوانده نمی‌شود» and «کارشناس آگهی‌ها را مدل‌به‌مدل و در اندازه‌ی ظرفیت روزانه‌ی خواندن می‌خواند»: the crawler's state and budget, told to a car buyer.

## Not verified

- English quotes marked "tool" were not re-checked against the live pages. The Kobak figures are from v2 of the paper; v4's abstract gives "at least 13.5%" of 2024 abstracts for the lower bound.
- The Wikipedia page changes; its word lists are as read on 2026-10-04.
- Iranian pages change; the quotes are what the tool returned on 2026-10-04. Digikala, Snappfood and Snapp were read through their store pages only.
- The catalogue of Farsi tells is not sourced beyond S9, the product's strings and the English lists; its Farsi column is my reading.

## Recommendation

1. Adopt the guide `docs/design/product-voice.md` as normative for every string a person reads, and ADR-0042 for the address and register decision.
2. Give Claude Code three pieces: the `copy-fa` skill (loads when Farsi UI text is written or read), the `.claude/rules/copy.md` rule (attaches to the files that hold copy), and the read-only `copy-reviewer` agent (quotes each violation with file and line, the rule broken and a rewrite).
3. Let the copy lint (CS-105) own what a script can see (digits, half-spaces, forbidden words, the middle dot, exclamation marks, length) and the reviewer own what it cannot (repetition across a screen, register, whether a sentence says anything).
4. Rewrite in the order CS-106 to CS-110, a screen at a time, with the guide's list of words (section 4) as the single vocabulary.

**Trade-off accepted:** a plain, polite «شما» voice is less playful than Torob's store text or Jabama's «سفرت». It is the safer reading for a purchase of hundreds of millions of tomans and the only register that stays consistent across thousands of strings.

**What would change my mind:** a buyer test in which the polite voice is read as cold; the owner preferring the spoken «تو» (then ADR-0042 is superseded and every example is rewritten once, which a table of 96 rows does cheaply); or the status page needing its operational detail for the challenge reviewers (then it becomes the one place where numbers about the system live, in buyers' units).

## The trial on 20 real strings

Applied by hand, as the `copy-fa` skill's procedure and `references/review.md` say: the screen's other strings read first (the idea table), each string judged against R1 to R10, the patterns and the words tables, then a rewrite checked again with the scan and the checklist. The 20 are not among the guide's 96 rewrites; I chose them across files and kinds (a hint, a notice, an empty state, a limit, an error, a popover, a lead, a risk line), on purpose including four that should pass. All 20 befores are verbatim in the repository at `4d980fd`.

| # | Where | Before | Verdict | Rules | After | What the guide settled, or lacked |
|---|---|---|---|---|---|---|
| 1 | `listing-copy.ts:47 action.note` | برای دیدن توضیحات کامل، گفت‌وگو با فروشنده و عکس‌های بیشتر، به آگهی در منبع بروید. | fix | R3 R6 | توضیحات کامل، گفت‌وگو با فروشنده و عکس‌های بیشتر در آگهی اصلی است. | the reason came before the step, and «در منبع» against the table's «در دیوار»; the words table settled it |
| 2 | `listing-copy.ts:54 state.offHint` | قیمت و مشخصات زیر آخرین چیزی است که از آگهی دیده‌ایم. بدون ارزیابی تازه، به آن‌ها تکیه نکنید. | fix | R3 R4 | قیمت و مشخصات زیر مربوط به آخرین بررسی است و ممکن است دیگر درست نباشد. | one real hedge is allowed (R4 table), which kept the honest part |
| 3 | `listing-copy.ts:146 freshness.stale` | اطلاعات این آگهی بیش از ۶ ساعت پیش خوانده شده است. | keep | — | (unchanged) | a number the buyer can check (section 5 «what stays»); no scan hit |
| 4 | `model-copy.ts:176 empty.body` | آگهی‌های این مدل از بازار رفته‌اند یا هنوز خوانده نشده‌اند. وقتی آگهی تازه بیاید، قیمت و روندش همین‌جا دیده می‌شود. | fix | R5 R7 | وقتی آگهی تازه‌ای بیاید، قیمت و روند این مدل را همین‌جا می‌بینید. | «هنوز خوانده نشده‌اند» is the crawler; the first sentence also repeated the title; the error pattern says to name a cause only when it is known. The language pass added «ای», and «این مدل» for «روندش»: one listing has no trend |
| 5 | `model-copy.ts:172 facts.note` | این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها؛ پیش از خرید خودرو را کارشناسی کنید. | minor | R4 | این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها. پیش از خرید، خودرو را کارشناسی کنید. | honest and useful; the «؛» changes, and a comma stops «خرید خودرو» reading as one phrase (language pass) |
| 6 | `model-copy.ts:188 index.lead` | هر مدل یک صفحه دارد: ارزش بازار، محدوده‌ی قیمت، روند قیمت و بهترین معامله‌های همان مدل. | fix | R2 R5 | ارزش بازار، محدوده‌ی قیمت، روند و بهترین معامله‌های هر مدل. | «هر مدل یک صفحه دارد» says what the screen shows; it also repeats `home.lead` and the meta description |
| 7 | `search-files-copy.ts:67-68 banner` | بگذارید کارشناس دنبال این ماشین بگردد | fix | R9 R5 | این جست‌وجو را به کارشناس بسپارید | the name as a subject that «می‌گردد»; the body then says «بسپارید» again. Title and body are one set |
| 8 | `search-files-copy.ts:68 banner.body` | این جست‌وجو را به کارشناس بسپارید؛ هر بار که برگردید، آگهی‌های تازه‌اش را جدا نشان می‌دهد. | fix | R4 R5 R9 | هر بار که برگردید، آگهی‌های تازه‌اش را جدا نشان می‌دهیم. | the page lead and the dialog lead already promise the same (E70, E71) |
| 9 | `search-files-copy.ts:128 file.unreadableBody` | فیلترهای این پرونده دیگر وجود ندارند، پس آگهی‌هایش را نشان نمی‌دهیم تا چیز نادرستی نبینید. می‌توانید پرونده را پاک کنید و جست‌وجو را دوباره بسپارید. | fix | R7 R2 T4 | فیلترهای این پرونده دیگر وجود ندارند. پرونده را پاک کنید و جست‌وجو را دوباره بسپارید. | the title «با نسخه‌ی تازه سازگار نیست» is a version (section 5); the body keeps its reason and loses the defence and the stacked «می‌توانید» (the language pass: a first rewrite had dropped the reason) |
| 10 | `search-files-copy.ts:121 file.emptyWatching` | در ۴۸ ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. پرونده نگه داشته می‌شود و هر آگهی مطابقی که بیاید همین‌جا می‌بینید. | minor | R5 | در ۴۸ ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. هر آگهی مطابقی که بیاید، همین‌جا نشان داده می‌شود. | «پرونده نگه داشته می‌شود» is the page lead's promise again; the passive avoids a missing «را» (language pass) |
| 11 | `accounts-copy.ts:91 errors.passwordFromName` | رمز عبور نباید از نام کاربری یا نام کارشناس ساخته شده باشد. | minor | R6 | رمز عبور نباید شامل نام کاربری یا «کارشناس» باشد. | «نام کارشناس» can read as «an expert's name»: the guide now says to quote the product's name when a sentence could mean the person |
| 12 | `accounts-copy.ts:35 signUp.recoveryNote` | فعلاً رمز عبور فراموش‌شده بازیابی نمی‌شود؛ آن را در مرورگرتان ذخیره کنید. | fix | R8 R4 | رمز عبور فراموش‌شده بازیابی نمی‌شود. آن را در مرورگرتان ذخیره کنید. | a limit with a way forward, spoilt by «فعلاً» |
| 13 | `notifications-copy.ts:34 settings.lead` | اعلانی که خاموش کنید دیگر ساخته نمی‌شود؛ اعلان‌هایی که گرفته‌اید می‌مانند. | fix | R7 R4 | اعلانی را که خاموش کنید دیگر نمی‌گیرید. اعلان‌هایی که گرفته‌اید می‌مانند. | «ساخته نمی‌شود» is how the code works; the buyer «نمی‌گیرد» |
| 14 | `marks-copy.ts:21 visitor.returnNote` | بعد از ورود به همین صفحه برمی‌گردید و آگهی نشان‌شده است. | keep | — | (unchanged) | one idea, a promise made at the point of decision; no hit |
| 15 | `marked-copy.ts:47 empty.body` | در جست‌وجو یا صفحه‌ی هر آگهی، «نشان کردن» را بزنید تا اینجا جمع شود. اگر قیمتش کم شود یا فروخته شود، خبرتان می‌کنیم. | keep | — | (unchanged) | passes only as a set: with the page lead rewritten (E78) the promise appears once on this screen; the guide's promise rule had to say «once per screen, again where the buyer decides again» |
| 16 | `data-status-copy.ts:70 accuracyLead` | هر خودروی مشابه یک بار بدون خودش ارزش‌گذاری شد و ارزشش با قیمت آگهی‌اش مقایسه شد. عدد هر مدل خطای میانه است: نیمی از ارزش‌ها کمتر از این با قیمت آگهی فاصله داشتند. | fix | R7 R4 | عدد هر مدل نشان می‌دهد ارزش بازار معمولاً چقدر با قیمت آگهی‌ها فرق دارد. هر چه کمتر، دقیق‌تر. | a leave-one-out method told to a buyer; the guide had no word on the status page, which now has one («how fresh and how accurate, never how it works») |
| 17 | `search-copy.ts:129 modelNotice.lead` | ${name} صفحه‌ی خودش را دارد: ارزش بازار، محدوده‌ی قیمت و روند قیمت. | keep | — | (unchanged) | one idea that names what the page holds; no hit (a true negative) |
| 18 | `home-copy.ts:19 hero.searchLabel` | چه ماشینی می‌خواهید؟ به زبان خودتان بنویسید | fix | R5 R4 | چه ماشینی می‌خواهید؟ | the second sentence is the instruction the example chips under the box already give |
| 19 | `listing-view.ts:348 risk (mileage missing)` | کارکرد در آگهی نیامده یا قابل‌اعتماد نیست؛ بدون آن ارزش بازار حساب نمی‌شود. کارکرد را از فروشنده بپرسید. | minor | R4 R7 | کارکرد در آگهی نیامده یا معلوم نیست، پس ارزش بازار حساب نمی‌شود. کارکرد را از فروشنده بپرسید. | two ideas joined by «؛»; «قابل‌اعتماد نیست» is our judgement, «معلوم نیست» is the buyer's view; «آن» would have pointed at «ارزش بازار» (language pass) |
| 20 | `crawl-requests-copy.ts:57` | برای درخواست، در جست‌وجو یک مدل یا تیپ را مشخص کنید. آگهی‌ها مدل‌به‌مدل خوانده می‌شوند، پس برای یک برند تنها نمی‌شود درخواست داد. | fix | R7 R8 T12 | درخواست برای یک مدل یا تیپ ثبت می‌شود، نه برای کل یک برند. در جست‌وجو یک مدل یا تیپ را مشخص کنید. | the crawler's shape («مدل‌به‌مدل») as the reason for a limit; the limit now comes first, then the way forward |

**Result.**

- **4 kept, 4 minor, 12 changed.** In the 16 changed strings the words fall from 269 to 205 (a quarter), the «؛» from 5 to 0, and the longest sentence from 17 to 15 words. The scan finds nothing in any of the 16 rewrites.
- **No padding.** The four kept strings (3, 14, 15, 17) have no scan hit and no finding; the guide's "do not pad" rule held. String 15 passes only as a set, with the page lead rewritten (E78): the same promise on the same screen twice would have failed it.
- **The scan is a candidate generator.** On the 16 changed strings it flags 8 strings with 9 hits (five «؛», two «فعلاً» or «هنوز», two method or crawler words; the first run flagged 7 strings, and «خطای میانه» was added after it); 8 it does not see: a reason before the step (1, 2), a lead that restates the screen (6, 18), a name used as a subject (7), a defensive body (9), a repeated promise (10), an ambiguous product name (11). Those came from the idea table and from reading, which is what the reviewer's checklist asks for and what a lint cannot do.
- **Where the guide was thin, and what changed.** (1) The promise rule said "once, where the buyer decides" without saying "per screen": it now says once on a screen and again only where the buyer decides again (section 4). (2) The data-status page, a buyer page about the system, had no rule: section 5 now says it shows how fresh and how accurate in the buyer's units and never how it works. (3) «نام کارشناس» can read as an expert's name: the words table now says to quote the product's name when a sentence could mean the person. (4) The detectors gained R5, R6 and R8 candidates (a retry sentence, a word of the words table, a «هنوز» or «فعلاً») and «خطای میانه», after the first run missed them.
- **A second reader found what the author did not.** A fresh-context pass (a subagent briefed as an Iranian copy editor; a model, not a human native speaker) read 99 After strings (the guide's first 91 rows less their 12 deletions, and the 20 of this trial): 68 natural, 26 stiff or odd, 5 wrong. Each was adopted or answered (one stays: E1 is the owner's own wording), and 30 of the guide's rows and five rows of this table changed. The errors were of three kinds: cuts that left a pronoun or a quantifier pointing at nothing («بقیه»، «آن»، «این آگهی‌ها»), rules applied as word swaps (the «می‌توانید» removed where it stated a real ability; a colloquial hint example removed that the hint exists to show; the reason removed from a state note), and word pairings a lint cannot see («فیلتر نشدند» reads as «not blocked» in Iran, «قیمت واقعی» promises a sold price, «ارزش بازاری» reads as an adjective, «قیمت طعمه» against the product's own «قیمت نمایشی»). The review also caught a contradiction in my own appendix: «منطقه آزاد» breaks the project's «ه‌ی» rule. The checklist and the skill now say: after a cut, read each sentence alone, and check a rewrite for the fact it dropped.
- **Left to the owner, not decided by the guide:** string 7's playful title («بگذارید کارشناس دنبال این ماشین بگردد») against the plainer rewrite is taste; so is string 2's single hedge and string 6's list against a sentence. They are listed under "left for you to check", as the reviewer's report format asks.

## Voice and tone summary for Carshenas

- **Voice: a calm, direct expert friend.** It tells you what it found, in the words you would use, and what to do next. Calm (facts at the volume of the facts, no exclamation marks), direct (the answer first), plain (the glossary's words, no internals), honest (says what it does not know, once, without an apology).
- **Tone follows the moment.** A rating is flat and exact. An error says what happened and what to do, with no sorrow. A confirmation is two words. A limit is a fact with a way forward. No humour, no slang, no emoji.
- **Address: «شما», usually unsaid; verbs in plain standard Farsi.** «می‌خواهید»، «ببینید»، «بنویسید»; not the spoken «می‌خوای / می‌تونی / رو / یه», and not the clerk's «نمایید / گردید / می‌باشد / لطفاً». A buyer's own typed words are shown as typed.
- **Who speaks:** «ما» when the product did something («آگهی‌ها را می‌خوانیم»); never «من»; usually no subject at all.
- **Shape:** one idea per sentence, 15 words or fewer, the answer first, a verb for every action, a full stop where a «؛» was.
- **Each screen is written as one set.** Title, lead, hint, button and notice are audited together, and an idea appears once.
- **A buyer sees what a buyer can check or act on.** Not the database, the queue, the thresholds the model needs, the method's version or window, the crawler, or the parts of the system.
- **Written down:** Persian digits through the formatters, half-spaces by the Academy's rules, «ه‌ی» for the ezafe (the project's choice), «» for quoted words, no «!», no « · » next to a digit.
