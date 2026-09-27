# Domain glossary (Farsi ↔ English)

Use these terms consistently in code (English identifiers), tasks and docs (English), and UI copy (Farsi). Add a term the first time it appears in a spec. Keep one row per concept.

| English (code/docs) | Farsi (UI) | Notes |
|---|---|---|
| listing | آگهی | One ad on one source site. The unit we crawl, rate and show. Avoid `post` and `ad` in code. |
| source | منبع | A site we read listings from (`divar`, `bama`, `karnameh`, `khodro45`, `sheypoor`). Rules per source: ADR-0008. |
| snapshot | — | An immutable raw copy of a listing's page data at one time. Everything else is derived from snapshots and can be rebuilt. |
| vehicle | خودرو | The physical car behind one or more listings. UI copy may say ماشین in casual text. |
| duplicate group | — | Listings on one or more sources that are the same vehicle. The UI shows the group once, cheapest listing first. |
| make | برند / سازنده | Peugeot, Saipa, Iran Khodro, Kia … In code `make`, never `brand`. |
| model | مدل | 206, Dena, Quick … Careful: in listings «مدل ۱۴۰۰» usually means the model **year**. |
| trim | تیپ | «تیپ ۲», «پلاس», «توربو». Canonical trims live in one catalogue; aliases map onto them (CS-10). |
| model year | سال ساخت / مدل | Solar Hijri (۱۴۰۰) for domestic cars, often Gregorian (2021) for imports. Stored as the ad wrote it; a Gregorian-only year also gets its solar year by one rule (minus 621), flagged as derived, so search and valuation compare one column (ADR-0014). |
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
| saved search | جست‌وجوی ذخیره‌شده | A stored query that alerts can run against. |
| price alert | هشدار قیمت | A message (Telegram first) when a saved search gets a new deal or a price drop. |
| inspection | کارشناسی | A physical inspection and valuation service; also where our name comes from. |
| click-out | رفتن به آگهی | Sending the buyer to the listing on its source site: the event Torob-style revenue is built on. |
| Toman | تومان | The unit we store and show (ADR-0014): whole tomans in `bigint` columns named `_toman`. 1 toman = 10 rials of the rial in use in 1405, before any redenomination. Written after the number: «۱٬۲۵۰٬۰۰۰٬۰۰۰ تومان». |
| rial | ریال | The official unit. An ad that states rials is converted to tomans (divided by 10) at extraction; nothing is stored in rials. |
| Jalali calendar | تقویم شمسی | The display calendar, in Asia/Tehran; storage, URLs and APIs use ISO-8601 instants in UTC (ADR-0014). Model years are the one stored Jalali value. |
