# Domain glossary (Farsi ↔ English)

Use these terms consistently in code (English identifiers), tasks and docs (English), and UI copy (Farsi). Add a term the first time it appears in a spec. Keep one row per concept.

| English (code/docs) | Farsi (UI) | Notes |
|---|---|---|
| listing | آگهی | One car offered on one source site: the unit we crawl, rate and show. Never `ad` or `post`, in code or in prose. |
| source | منبع | A site we read listings from (`divar`, `bama`, `karnameh`, `khodro45`, `sheypoor`). Rules per source: ADR-0008. |
| snapshot | — | An immutable raw copy of a listing's page data at one time. Everything else is derived from snapshots and can be rebuilt. |
| vehicle | خودرو | The physical car behind one or more listings. UI copy may say ماشین in casual text. |
| duplicate group | — | Listings on one or more sources that are the same vehicle. The UI shows the group once, cheapest listing first. |
| make | برند / سازنده | Peugeot, Saipa, Iran Khodro, Kia … In code `make`, never `brand`. |
| model | مدل | 206, Dena, Quick … Careful: in listings «مدل ۱۴۰۰» usually means the model **year**. |
| trim | تیپ | «تیپ ۲», «پلاس», «توربو». Canonical trims live in one catalogue; aliases map onto them (CS-50). |
| model year | سال ساخت / مدل | Solar Hijri (۱۴۰۰) for domestic cars, often Gregorian (2021) for imports. Stored as the listing wrote it; a Gregorian-only year also gets its solar year by one rule (minus 621), flagged as derived, so search and valuation compare one column (ADR-0014). In column names, `sh` and `ad` are the calendars (Solar Hijri, Anno Domini), never an advertisement. |
| mileage | کارکرد | Kilometres. «صفر کیلومتر» (zero km) means new; «کارکرده» means used. |
| body condition | وضعیت بدنه / رنگ‌شدگی | Paint and replaced panels: the largest price factor in this market. |
| paint-free | بدون رنگ / بی‌رنگ | No repainted panels. |
| paint spot | لکه رنگ | Counted: «یک لکه»، «دو لکه». |
| repainted around | دور رنگ / تمام رنگ | Painted all around or entirely: a large discount. |
| replaced panel | تعویض (کاپوت، گلگیر، درب، سقف) | Which panel was replaced matters; roof and pillars are severe. |
| chassis | شاسی | «شاسی سالم» (intact) or «شاسی ضربه‌خورده» (damaged). |
| gearbox | گیربکس (دستی / اتوماتیک) | manual / automatic. |
| fuel | سوخت (بنزینی / دوگانه‌سوز / هیبرید / برقی) | Dual-fuel is petrol plus CNG, valued for ride-hailing work. |
| insurance left | بیمه (ماه باقی‌مانده) | Months of third-party insurance remaining. |
| asking price | قیمت | The price written in the listing. In code `askingPrice`. |
| negotiable | توافقی | No price given. Kept out of market value. |
| installment price | اقساطی / پیش‌قسط | Often a down payment presented as the price (bait). Flagged and kept out of market value. |
| swap | معاوضه | The seller accepts a car in exchange. |
| market value | ارزش بازار / قیمت کارشناسی | Our daily estimate for a vehicle, like CarGurus's IMV. In code `marketValue`, always with the date it was computed. |
| comparable | خودروی مشابه | A listing used to compute a market value. In code `comparable`. |
| price gap | اختلاف با ارزش بازار | Asking price minus market value, as a percentage of market value. |
| deal rating | ارزیابی قیمت | `great` `good` `fair` `high` `overpriced` → «عالی» «خوب» «منصفانه» «گران» «خیلی گران». Shown as «معامله‌ی عالی» and so on. |
| days on market | روز روی بازار | Days since we first saw the listing (or the group). |
| price drop | کاهش قیمت | A lower asking price than in an earlier snapshot. |
| seller | فروشنده | `dealer` (نمایشگاه) or `private` (فروشنده‌ی شخصی). |
| model page | صفحه‌ی مدل | One page per make, model, trim and year: Torob's product page applied to cars. |
| tracked model | مدل پوشش‌داده‌شده | A make and model (optionally a trim) the crawler reads in depth: details, extraction, valuation and search. Chosen by the superadmin (CS-53); every other model is only counted from list pages (ADR-0017). In code `trackedModel`. |
| sweep | — | A pass over a source's list pages that refreshes when each listing was last seen, catches price changes and counts each model's listings, without opening the listings (ADR-0017). |
| last checked | آخرین بررسی | When we last read a listing on its source. Shown on the listing page («آخرین بررسی: ۲ ساعت پیش»). In code `lastCheckedAt`, as against `lastSeenAt` (last seen in a list). |
| release | — | A named, dated, frozen cut of the index for evaluations, backtests and the recorded demo (CS-49). Never committed. |
| request budget | — | The requests a source may receive from us in a day, spent in a fixed priority order (ADR-0017 point 5). |
| crawler | خزنده | The worker's jobs that read a source's pages (ADR-0008, ADR-0018). Reading them is «خزش». |
| crawl state | وضعیت خزش | A source's `crawl_state`: «فعال» (`enabled`, crawled), «متوقف» (`paused` by the superadmin) or «متوقف پس از مسدود شدن» (`stopped_on_block` by the crawler, until the superadmin resumes it). |
| pause, resume | توقف خزش، ازسرگیری خزش | What the superadmin does to a source's crawl state on the sources screen (CS-40); every change is recorded with who made it and when. In code `paused` and `enabled`, the state chosen. |
| superadmin section | پنل مدیریت | The owner-only admin pages of the web app (CS-40): tracked models, sources, review queues, labelling. Behind sign-in; linked only from the signed-in superadmin's own account menu (owner, 2026-09-29), never from what visitors and buyers see. |
| account | حساب کاربری | Someone who signs in to Carshenas (ADR-0020): a buyer or the superadmin. In code `account`, never `user`. The page is «حساب کاربری». |
| buyer | خریدار | An account with the buyer role: everyone who signs up. |
| superadmin | مدیر | The account with the superadmin role, made only by `pnpm account:superadmin`; lands on «پنل مدیریت» after signing in. |
| username | نام کاربری | Lowercase Latin letters, digits and `_`, 3 to 30 characters, starting with a letter (ADR-0020). |
| password | رمز عبور | Two words. Length rules say «کاراکتر», not «نویسه». |
| sign in, sign up, sign out | ورود، ثبت‌نام، خروج از حساب | The header's visitor link reads «ورود / ثبت‌نام». In code `signIn`, `signUp`, `signOut`. |
| saved search | جست‌وجوی ذخیره‌شده | A stored query that alerts can run against. |
| price alert | هشدار قیمت | A message (Telegram first) when a saved search gets a new deal or a price drop. |
| inspection | کارشناسی | A physical inspection and valuation service; also where our name comes from. |
| reference code | کد پیگیری | The code an error screen shows so a visitor's report leads to its log line (ADR-0016): the digest of a server error or a 10-digit code for a browser error, in Persian digits. In code and logs `reference`. «شناسه‌ی خطا» is the neutral alternative, left to the owner. |
| click-out | رفتن به آگهی | Sending the buyer to the listing on its source site: the event Torob-style revenue is built on. |
| Toman | تومان | The unit we store and show (ADR-0014): whole tomans in `bigint` columns named `_toman`. 1 toman = 10 rials of the rial in use in 1405, before any redenomination. Written after the number: «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان». |
| rial | ریال | The official unit. A listing that states rials is converted to tomans (divided by 10) at extraction; nothing is stored in rials. |
| Jalali calendar | تقویم شمسی | The display calendar, in Asia/Tehran; storage, URLs and APIs use ISO-8601 instants in UTC (ADR-0014). Model years are the one stored Jalali value. |
