# The notes for «توضیحات تکمیلی»

The submission form has an optional notes field (`docs/product/challenge.md`). Paste the text below, plain, after replacing the markers: `TODO-01` the live site, `TODO-02` the repository, `TODO-03` the video, `TODO-13` the contact details. `open-items.md` says where each comes from.

- The numbers are the ones in `numbers.md` on the day the notes are sent. If `TODO-04` (CS-48's evaluation) or `TODO-11` (a new valuation run) produced newer reports, change the numbers here and in the README in one commit.
- The crawl is described as it is: polite, bounded, stopping on any block, with no personal data kept. The text does not say that robots.txt or the sources' terms are followed, because they are not (ADR-0008, the owner's decision of 2026-09-28). `open-items.md`, D2, is the owner's call on the wording.
- Two versions of each language: the full text, and a short one for a field that cuts at about 500 characters.

## Farsi

### Full

```text
کارشناس: ارزیابی قیمت هر آگهی خودروی کارکرده، فارسی و راست‌به‌چپ، مثل «ترب برای خودرو».
آگهی‌های دیوار در تهران را می‌خواند، متن آگهی را به داده‌ی ساختاریافته تبدیل می‌کند، ارزش بازار هر خودرو را از آگهی‌های مشابه حساب می‌کند و قیمت را از «معامله‌ی عالی» تا «خیلی گران» ارزیابی می‌کند، با دلیل.

سایت: [TODO-01]
مخزن: [TODO-02]
ویدیو: [TODO-03]

عددها، هر کدام با دستور و فایل در docs/submission/numbers.md:
- خطای میانه‌ی ارزش بازار ۶٫۸٪ روی آگهی‌های تازه‌تر، با یادگیری فقط از آگهی‌های قدیمی‌تر
- ۹۹٫۹٪ واقعیت‌های متن آگهی درست خوانده شد (۷۹۱ از ۷۹۲، روی ۶۶ آگهی آزمون)
- ۹۵٪ جمله‌های جست‌وجو را کد به‌تنهایی درست می‌خواند (۲۷۰ جمله)
- در نمونه‌ی ۳۰ آگهی، عدد هر ۲۸۱ جمله‌ی توضیح با پایگاه داده جور بود

آگهی‌ها مؤدبانه و محدود از دیوار خوانده می‌شود (هر بار یک درخواست، ۳ ثانیه فاصله، ۱۲ هزار در روز) و با اولین مسدودی خواندن می‌ایستد. اطلاعات شخصی ذخیره نمی‌شود. شرایط استفاده‌ی دیوار ثبت شده و برای این نمایش رعایت نمی‌شود (ADR-0008).

محدودیت‌ها: فقط دیوار و فقط تهران؛ آگهی تکراری میان سایت‌ها نداریم؛ ارزیابی‌ها را هنوز با رفتار بعدی بازار نسنجیده‌ایم.

از README شروع کنید و صفحه‌ی /status را باز کنید.
تماس: [TODO-13]
```

### Short

```text
کارشناس: ارزیابی قیمت آگهی‌های خودروی کارکرده، فارسی و راست‌به‌چپ. آگهی‌های دیوار در تهران را می‌خواند، ارزش بازار را حساب می‌کند و قیمت را از «معامله‌ی عالی» تا «خیلی گران» ارزیابی می‌کند، با دلیل. سایت: [TODO-01]. مخزن: [TODO-02]. عددها و دستور هر کدام: docs/submission/numbers.md. فقط دیوار و تهران؛ خواندن مؤدبانه و محدود؛ شرایط دیوار برای این نمایش رعایت نمی‌شود (ADR-0008). تماس: [TODO-13]
```

## English

### Full

```text
Carshenas is a Farsi, right-to-left appraiser for used-car listings: "Torob for cars". It reads Divar's Tehran listings, turns each ad's text into structured data, estimates every car's market value from comparable listings and rates the asking price from "great deal" to "way too expensive", with the reason.

Site: [TODO-01]
Repository: [TODO-02]
Video: [TODO-03]

Numbers, each with its command and file in docs/submission/numbers.md:
- median market-value error 6.8 % on listings posted after the cut date
- 99.9 % of ad-text facts read right (791 of 792, on 66 held-out ads)
- 95 % of search sentences read right by code alone (270 sentences)
- 281 of 281 explanation sentences match the database

The crawl is polite and bounded (one request at a time, three seconds apart, 12 thousand a day) and stops at the first block. No personal data is kept. Divar's terms are recorded and, for this demo, not followed (ADR-0008).

Limits: Divar and Tehran only; no cross-site duplicates; the ratings are not yet checked against what the market did next.

Start with the README and open /status.
Contact: [TODO-13]
```

### Short

```text
Carshenas: a Farsi, right-to-left appraiser for used-car listings. It reads Divar's Tehran listings, works out each car's market value and rates the asking price from "great deal" to "way too expensive", with the reason. Site: [TODO-01]. Repository: [TODO-02]. Every number and its command: docs/submission/numbers.md. Divar and Tehran only; polite, bounded crawl; Divar's terms are not followed for this demo (ADR-0008). Contact: [TODO-13]
```
