# Shot list: what to open, type and paste, scene by scene

The exact queries, links and listings for the five-minute demo (`demo-script.md`). Everything below was checked against main's database and dev server on **2026-10-04, 13:30 Tehran time**. Listings change by the hour, so on the recording day run `pnpm db:psql < docs/submission/pick-examples.sql` (it prints fresh candidates for scenes 3 and 4), choose one per row, and write the choice into `DEMO_*` below so the rehearsal (`pnpm e2e:demo`) and the recording use the same cars.

- A **listing id** (`/listings/89002`) is this database's id. A **token** (`ga_W7LVY`) is Divar's own code for the ad, the last part of its link, and is the same in any database that read the ad. On a deployed database (`TODO-01`) use tokens and look the id up: `pnpm db:psql -c "select id from listing where source_listing_key = 'ga_W7LVY'"`.
- Values are as of 2026-10-04. Prices are in millions of tomans. «Gap» is the asking price against the market value, as the page shows it.
- Nothing here quotes a title, a description, a phone number or a name.

## The screen

| Setting | Value | Why |
|---|---|---|
| Browser | Chrome or Chromium, a fresh profile: no extensions, no bookmarks bar, no autofill, notifications off | nothing personal on screen |
| Window | 1440 × 810 CSS pixels, 100 % zoom (raise to 110 % only if the text reads small in the export) | 16:9, the size the rehearsal uses |
| Language and time | the site is Farsi and right to left; the system clock in Tehran time | dates on the page are Jalali, in Tehran time |
| Phone moment | Chrome device mode «Pixel 7» (412 × 915), or a phone mirrored; one 4-second shot of the same search | the product is phone-first |
| Typing | type the sentence live, at a calm speed, with a Persian keyboard layout; keep it open in a note to copy from if a typo costs a retake | the sentence is 30 characters |
| Terminal | font 18 pt or larger, a clean prompt, `clear` before each command, no `.env` or token anywhere in the buffer | scene 6 |
| Never on screen | Divar's own site with an ad open, the superadmin section with real names, the accounts list, `.env`, a database prompt with a connection string | personal data, secrets |

## Scene by scene

### Scene 1 · 0:00 to 0:30 · The problem

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | `/` (the home page), hold on the hero for 5 seconds | the Tehran photograph, the one box, the three example sentences |
| 2 | click the tab «ارزیابی لینک», then back to «جست‌وجو» | two ways in: a sentence, or a link |

No Divar page is shown. The problem is said over the home page.

### Scene 2 · 0:30 to 1:10 · A plain-Farsi search

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | in the hero's box type `۲۰۶ تیپ ۲ بدون رنگ زیر ۱ میلیارد`, press Enter | the results page at once, no confirm step |
| 2 | read the chips: «پژو ۲۰۶», «پژو ۲۰۶ تیپ ۲», «تا ۱ میلیارد تومان», «بدون رنگ» | the filters the sentence became: `/search?model=peugeot.206&trim=peugeot.206.2&price=..1000000000&nopaint=1&ask=…` |
| 3 | the count and the order «بهترین معامله» | 44 listings on 2026-10-04, the best deals first |
| 4 | click the × on «بدون رنگ», then browser Back | the results change at once, and Back brings the first search back |
| 5 | phone moment: the same sentence in a phone-sized window | the same chips on a phone |

Sentences that work today, with what each returned on 2026-10-04 (read the count off the page; the rehearsal prints it):

| Sentence | Listings | Use |
|---|---|---|
| `۲۰۶ تیپ ۲ بدون رنگ زیر ۱ میلیارد` | 44 | the main one |
| `۲۰۶ تیپ ۵ بدون رنگ زیر ۱٫۳ میلیارد` | 13 | a backup with a decimal |
| `۲۰۷ اتوماتیک بدون تصادف زیر ۲ میلیارد و ۵۰۰ میلیون` | 86 | a second model |
| `یک ماشین تمیز، کم‌کارکرد و بی‌دردسر` | 2,002 | the vague kind: five filters |
| `ماشین ژاپنی تمیز` | 158 | a country word (the Corolla) |
| `خانوادگی زیر ۱ میلیارد` | 75 | an intent |
| `۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون` | **1** | **do not use**: it is the hero's first example and finds one listing (`open-items.md`, F2) |

### Scene 3 · 1:10 to 2:05 · A listing and its explanation

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | from the results open the first card, a great deal; or `/listings/89002` | `پژو ۲۰۶ تیپ ۲، مدل ۱۳۹۶`, 215,000 km, **995** against a market value of **1,150**, «معامله‌ی عالی», 14 % under |
| 2 | scroll to «تحلیل قیمت» | the five-band gauge with the marker, then «چرا این ارزیابی؟» |
| 3 | scroll to «آگهی‌های مشابهی که ارزش بازار از آن‌ها حساب شد» | the ten comparables, nearest in year and mileage, with their prices |
| 4 | open `/listings/892` and scroll to «تاریخچه‌ی قیمت» | a price drop from **1,180** to **1,120** on 12 Mehr, «۵٪ کمتر» |
| 5 | open `/listings/5432`: «بدون ارزیابی» | an instalment sale at 1,400 against a market value of 2,850: the page says why it is not rated |
| 6 | (2 seconds) `/listings/107176` | the other end of the gauge: 1,650 against 1,346, 22.6 % over, «خیلی گران» |

Opening a listing last checked more than six hours ago asks the worker to read it again and the page says so («بررسی مجدد در صف است»). That is the product working, but it adds a line under the price: prefer a listing from block 1 of `pick-examples.sql` whose `checked_h_ago` is under 6, and tell the viewer the line when it shows.

Alternates (2026-10-04), with Divar's token:

| Role | Id | Token | Car | Km | Price | Market value | Gap |
|---|---|---|---|---|---|---|---|
| Great deal | 89002 | `ga_W7LVY` | 206, 1396 | 215,000 | 995 | 1,152 | -13.7 % |
| Great deal | 89119 | `gaBnXBeb` | 206, 1397 | 175,000 | 1,120 | 1,268 | -11.7 % |
| Great deal | 88688 | `gaBvAxKp` | 206, 1394 | 180,000 | 1,020 | 1,133 | -10.1 % |
| Great deal | 9867 | `gavud6TL` | Pride 131, 1385 | 200,000 | 375 | 441 | -15.0 % |
| Overpriced | 107176 | `gaBjdZhq` | 206, 1396 | 140,000 | 1,650 | 1,346 | +22.6 % |
| Overpriced | 105811 | `gaBLdEOm` | 206, 1398 | 98,000 | 1,770 | 1,568 | +12.8 % |
| Overpriced | 95196 | `gaBvq5Yr` | 206, 1394 | 245,000 | 1,360 | 1,182 | +15.1 % |
| Unrated (instalment) | 5432 | `gauOm5Fu` | Dena Plus, 1403 | 20,000 | 1,400 | 2,854 | not rated |
| Unrated (instalment) | 4594 | `ga76bLzB` | Dena Plus, 1402 | 40,000 | 1,200 | 2,349 | not rated |
| Unrated (instalment) | 3685 | `ga4Stkgy` | Pars, 1402 | 60,000 | 900 | 1,707 | not rated |
| Price drop, great | 892 | `ga7eYpWG` | 206, 1400 | 136,000 | 1,180 to 1,120 | | -12.8 % |
| Price drop, great | 13833 | `ga4eO1x7` | 206, 1386 | 273,000 | 670 to 630 | | -11.7 % |
| Price drop, great | 791 | `ga7aal1u` | 206, 1383 | 230,000 | 580 to 540 | | great |

Also on the model page, if there is time (it is not in the script): `/models/peugeot/206` shows today's price for the model, the price by model year, the ratings and the trend from our own daily valuations.

### Scene 4 · 2:05 to 2:30 · A pasted link

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | home, tab «ارزیابی لینک» (or `/check`) | one box |
| 2 | paste a link of an ad posted today: `[[the link, copied from Divar in another window the viewer never sees]]` | the answer in seconds: the car, the price, the verdict, the gauge |
| 3 | point at «آخرین بررسی» and «ارزش بازار … ۱۲ مهر ۱۴۰۵» | the date of the market value and the age of the check |

Rehearsal links, listings already in the database (a pasted link adds one «paste» demand to its model, which is real product data):

| Link | Car | Verdict on 2026-10-04 |
|---|---|---|
| `https://divar.ir/v/ga56Oz0e` | 206 tip 5, 1394, 155,000 km, 1,110 | «معامله‌ی عالی» |
| `https://divar.ir/v/ga2-gkr_` | 206, 1395, 159,000 km, 1,220 | «گران», 5 % over; its price dropped from 1,250 that morning |
| `https://divar.ir/v/ga6yDF10` | 206, 1380, 194,000 km, 643 | «معامله‌ی خوب» |

An address the database has never seen is not a rehearsal link: the page keeps it as a wanted link and says so. Until `TODO-08` (CS-117) lands, a link to an ad we have not read gets that answer, not a rating, so the live link must be one of the cars the index already holds (a recently posted ad of a tracked model, which discovery stores within hours). Check the link in the rehearsal first.

### Scene 5 · 2:30 to 3:00 · How fresh the index is

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | `/status` | «تازگی داده‌ها»: the state line, four figures (active, new in 24 hours, gone, median check age) |
| 2 | scroll to «تعهدهای تازگی» | three targets: two met, one marked «هنوز نه» (a new listing in under an hour: the median is 3 hours) |
| 3 | the hourly chart | the median age of the last check, hour by hour |

Read the figures off the screen; they are in `numbers.md` (N01 to N06) only as examples.

### Scene 6 · 3:00 to 4:00 · The pipeline and its measured accuracy

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | `docs/assets/architecture.svg` in a browser tab (or the README on GitHub) | crawl, normalise, value, rank, explain, over PostgreSQL |
| 2 | `/status`, scroll to «ارزش بازار» then «دقت ارزش بازار، مدل به مدل» | ten bars: median error 4 % to 8 % by model |
| 3 | scroll to «خواندن متن آگهی‌ها» | 791 of 792 facts right, 65 of 66 listings without an error, 11 of 11 hostile ads held |
| 4 | terminal: `pnpm --filter @carshenas/ai query-understanding:code-only` | `270 queries: 257 fully right by code alone (95.2%)`, free and offline |
| 5 | terminal: `pnpm --filter @carshenas/ai listing-facts:evaluate --score ../../docs/evidence/listing-facts/2026-09-30/run-571b413f827bf546.json` | the per-field table, scored again from the saved answers, no model call |

`TODO-04`: when CS-48's harness lands, step 5 becomes its one command and its report.

### Scene 7 · 4:00 to 4:45 · The decisions

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | `docs/decisions/` on GitHub, or the editor's file tree | the decision records, numbered |
| 2 | open in turn, a few seconds each: `0017` (a live, bounded index), `0008` (what the crawler does and does not follow), `0029` (code first), `0030` (explanations by templates), `0011` (PostgreSQL only) | the five decisions, in the order the script says them |

The order is the script's: data first.

### Scene 8 · 4:45 to 5:00 · The close

| Step | Open or do | What the viewer sees |
|---|---|---|
| 1 | the README on GitHub, the top | the name, the one paragraph, the screenshots |

## Picking the examples again on the day

1. `pnpm db:psql < docs/submission/pick-examples.sql`. Block 0 must show today's valuation day.
2. Block 1: a great deal with `checked_h_ago` under 6 and a photo. Block 2: an expensive one. Block 3: an instalment sale. Block 4: a price drop of 4 % or more on a rated listing. Block 5: three links to rehearse the paste with.
3. Write the five ids and the link into the environment the rehearsal reads: `DEMO_LISTING_GREAT`, `DEMO_LISTING_OVERPRICED`, `DEMO_LISTING_UNRATED`, `DEMO_LISTING_DROP`, `DEMO_PASTED_LINK` and, to change the sentence, `DEMO_SENTENCE`.
4. `pnpm e2e:demo`. Its report (`e2e/demo-shots/<time>/walk-report.md`) says what each scene found and prints the count each sentence returned. Open the screenshots; a scene that failed names the listing to replace.
5. Models with photos on the home page and the model pages wait for `TODO-07` (CS-113): the owner sets the links in the superadmin section. Block 7 of the script shows which tracked models have one.
