# A mileage typed in thousands: what we hold, how it is read, and how often that is wrong (CS-101)

Measured on 2026-10-03 on a lane copy of the main database (6,088 listings with a stored snapshot, 17,664 without; Divar paused, no request sent). Reproduce with `pnpm derive:listings`, `pnpm valuation:run` and `pnpm mileage:measure` (it prints the ratios behind every number below). The rule is ADR-0040. No language model is involved: the code reads the wordings and the price.

## What is affected

Of 6,088 listings with a snapshot, **82** state a mileage under 1,000 km on a car of three or more model years (the CS-86 floor; 79 active). Another 1,470 state under 1,000 km on a car of the current or the two previous model years: those are new cars and are never touched (the owner's example, a 1405 car at 70 km, is one of them: listing 2316 keeps its 70 km, and the same words on an older car read as really low). Among the 82:

| Reading | Listings | How |
| --- | ---: | --- |
| really that low (`really_low`) | 21 | the text says so: «صفر خشک» 11, «ماشین صفر» 3, «صفر کیلو متر» 2, «خودرو صفر», «صفرکیلومتر», «حرکت نداشته», «۶۰۰ دونه کار», «۳۵۰۰ کارکرد واقعی» |
| thousands by the text (`thousands_text`) | 4 | «۱۰۹تا کیلومتر انداخته», «۳۰ تا کار», «۶۰ هزار», «کار کرد 73000» |
| thousands by the price (`thousands_price`) | 20 | no wording; the asking price fits the car at 1,000 times the figure (rule below) |
| unread (`unread`) | 37 | neither; the mileage stays unknown as under CS-86. 5 of them wrote 0, which has no thousands |

## The wordings

From the 82 real texts and the owner's examples (`apps/worker/src/sources/mileage-wording.ts`, tested on fragments in `mileage-wording.test.ts`). Really low: «صفر خشک», «صفر کیلومتر» (and «کیلو متر», «کیلو مترو»), «بدون کارکرد», «حرکت نداشته», «ماشین/خودرو صفر», a figure under 10,000 with «کیلومتر» («۴۴۰ کیلومتر»), with «دونه/دانه» beside «کار/کارکرد» («۱۰۰ دونه کار»), «N کارکرد واقعی», and «N کیلومتر راه رفته» (the owner's listing 2316: «۷۰کیلومتر راه رفته»). Thousands: the written figure followed by «هزار» (not «هزار تومان»), by «تا» with «کار/کارکرد/کیلومتر/انداخته», or 1,000 times the figure written out («۷۳۰۰۰», «۷۳٬۰۰۰») beside «کارکرد» or «کیلومتر». Left out on purpose because the real texts use them as figures of speech: «در حد صفر» (seen on cars of 1385 and 1398 at 126 and 540), «موتور صفر», a bare «کارکرد ۳۰۷» and «کارکرد واقعی» alone (a seller who counts in thousands also says it). A text that points both ways reads as nothing.

## The price test and its thresholds

The valuation model (S01) gives a market value for the listing's model, year, gearbox and condition at any mileage. A figure `W` is read in thousands when all three hold:

1. the asking price is at most 1.15 times the market value at `1000 × W` (a used car's price within the model's own error);
2. the value at `W` as written is at least 1.15 times the value at `1000 × W` (the two readings are further apart than the model's error, so a price can tell them apart);
3. `1000 × W` is at most 40,000 km for each year of the car's age counted from the middle of its model year.

Why these numbers. 15 % is the error a model may have and still rate listings at all (S01, `MAX_SEGMENT_ERROR_PCT`): a difference below it cannot separate two readings. 40,000 km a year is above the 99th percentile of the 3,852 stated mileages of cars of three or more years (median 16,600, 95th 28,600, 99th 37,000). The 15 % was chosen from the table of the 48 untested figures (the tested ones' ratio and gap are in the sample below): at a gap of 1.10 it would read 27 and include cars of three to five years, where the model's mileage effect is only 5 to 14 % and a near-new car at 100 km cannot be told from a used one at 100,000 km; at 1.15 it reads 20, all on cars of nine or more years with a written figure of 200 to 540; at 1.25 only 9. The model's weakness for young cars is the finding: **the price decides nothing for a car under about nine years, so those stay unread unless the text says**. Listings the run reads this way (`thousands_price`) never enter the fit, so the price that chose the reading cannot also teach the model a price.

## The false-assumption rate

- **Really-low cars read as thousands.** The 17 priced listings whose text says the car was never driven or states a small exact figure (the labelled set), run through the price test as if the words were absent and the seller had typed their own figure (100 when it was 0): **0 of 17** would be read in thousands. Most of them are cars of three to six years, where the gap rule refuses; 16939 (a 1398 car of 2.1 billion tomans, «صفر خشک واقعی») fails the price condition (1.74).
- **Eye check.** The 30 listings below were read by eye with their texts and prices: of the 24 read in thousands (20 by price, 4 by text), 23 are plainly cars that have run 100,000 to 540,000 km, and 1 (3103) is a finance advert whose price is not a car's; none is a car that has run a few kilometres. Of the 6 unread ones, 3 are probably thousands, 1 is a zero-km car by its title, 2 are unknowable; leaving them unread is the safe side.
- **Recall, simulated.** Stated mileages of 60,000 to 400,000 km on cars of three or more years, written as a seller would in thousands: read as thousands 71 % (848 of 1,196) on cars of 11 years or more, 19.5 % (158 of 810) at 6 to 10 years, 0.3 % (2 of 597) at 3 to 5. The rest stay unread, as they are today.
- The labelled sample is small (82 listings) and the labels are the developer's reading; a larger labelled set needs fresh crawls, which are the owner's to start.

## The sample of 30

Ratio is the asking price over the market value at 1,000 times the figure; gap is the value at the figure as written over the value at 1,000 times it. Prices are in millions of tomans. Only the car's own words that decide the case are quoted; descriptions are not kept.

| Listing | Model year | Written | Asking | Reading | Ratio | Gap | By eye | Why |
| ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
| 263 | 1380 | 380 | 480 | thousands_price | 0.81 | 1.26 | thousands | «۳۸۰ کار کرده» in the text: a count of thousands |
| 437 | 1394 | 320 | 965 | thousands_price | 0.94 | 1.23 | thousands | a 1394 car at a used price, text lists paint and repairs |
| 499 | 1383 | 300 | 585 | thousands_price | 0.93 | 1.22 | thousands | 1383 car, used price, paint and parts listed |
| 628 | 1393 | 250 | 1,030 | thousands_price | 0.98 | 1.19 | thousands | 1393 car at a used price |
| 651 | 1388 | 250 | 680 | thousands_price | 0.88 | 1.19 | thousands | 1388 car, «ماشین خواب بوده» but 17 years old at a used price |
| 1423 | 1395 | 300 | 1,220 | thousands_price | 0.94 | 1.22 | thousands | 1395 car, used price, tyres at 80 % |
| 1454 | 1385 | 350 | 730 | thousands_price | 1.11 | 1.25 | thousands | 1385 car, overhauled engine, used price |
| 1458 | 1387 | 260 | 760 | thousands_price | 1.03 | 1.19 | thousands | 1387 car, used price |
| 1594 | 1384 | 307 | 685 | thousands_price | 0.93 | 1.22 | thousands | «کارکرد ۳۰۷» in the text: no one counts a 21-year-old car in single kilometres |
| 1597 | 1391 | 250 | 1,150 | thousands_price | 1.03 | 1.19 | thousands | 1391 car, used price |
| 3103 | 1396 | 200 | 800 | thousands_price | 0.62 | 1.16 | not a car for sale | a finance advert whose price is the advert's, not a car's: the reading is moot |
| 3555 | 1390 | 204 | 830 | thousands_price | 1.01 | 1.16 | thousands | 1390 car, repaired fender, used price |
| 3661 | 1393 | 270 | 1,080 | thousands_price | 0.99 | 1.20 | thousands | 1393 car, used price |
| 3733 | 1383 | 540 | 620 | thousands_price | 1.08 | 1.37 | thousands | 1383 car, panel damage, used price |
| 3962 | 1388 | 400 | 850 | thousands_price | 0.96 | 1.28 | thousands | 1388 car, used price |
| 9158 | 1385 | 400 | 640 | thousands_price | 0.88 | 1.28 | thousands | «کارکرد ۴۰۰» in the text, 1385 car at a used price |
| 16327 | 1393 | 290 | 1,250 | thousands_price | 1.05 | 1.21 | thousands | 1393 car at a used price |
| 22932 | 1388 | 375 | 750 | thousands_price | 1.08 | 1.26 | thousands | 1388 car, parts replaced, used price |
| 39246 | 1389 | 290 | 780 | thousands_price | 1.00 | 1.21 | thousands | 1389 car, «مصرفی‌ها تعویض شده», used price |
| 39260 | 1383 | 390 | 425 | thousands_price | 0.69 | 1.27 | thousands | 1383 car, used price |
| 4958 | 1397 | 109 | 940 | thousands_text | 0.81 | 1.11 | thousands | «۱۰۹تا کیلومتر انداخته»: the owner's own example |
| 139 | 1399 | 73 | 1,250 | thousands_text | 0.94 | 1.09 | thousands | «کار کرد 73000» in the text |
| 8166 | 1400 | 30 | 1,164 | thousands_text | 1.03 | 1.07 | thousands | «۳۰ تا کار» on a 1400 car at a used price |
| 37528 | 1400 | 60 | 1,550 | thousands_text | 1.05 | 1.08 | thousands | «کم کار 60 هزارتا» |
| 3604 | 1383 | 500 | 1,230 | unread | 1.89 | 1.34 | probably thousands | 1383 car with a tuned engine: its price is 1.9 times the model's value, so the price test leaves it unread (right to be careful) |
| 3484 | 1385 | 540 | 950 | unread | 1.27 | 1.37 | probably thousands | «در حد صفر واقعی» is a figure of speech: engine rebuilt, 1385 car; left unread by the price |
| 3455 | 1393 | 35 | 1,700 | unread | 1.26 | 1.07 | unknown | «کارکرد واقعی بشرط» says the figure is real, not its unit; left unread |
| 7191 | 1393 | 141 | 1,450 | unread | 1.41 | 1.12 | probably thousands | 1393 car with fitted parts, price 1.4 times the model's value; left unread |
| 4574 | 1401 | 100 | 2,680 | unread | 1.12 | 1.10 | unknown | a 1401 car: 100 km and 100,000 km are worth within 10 % of each other, so the price cannot tell; left unread |
| 4638 | 1402 | 45 | 2,700 | unread | 1.05 | 1.07 | really low | the title says «صفر» (zero-km) and the price is a near-new car's: left unread by the code, which is the safe side |

## Effect on valuation (lane copy, same day 2026-10-03)

| | CS-86 (all 82 unread) | CS-101 |
| --- | ---: | ---: |
| comparables in the fit | 3,987 | 4,005 |
| listings valued | 5,187 | 5,222 |
| listings rated | 3,686 | 3,716 |
| «عالی» | 299 | 298 |

32 listings gained a rating, 2 lost one, and 70 moved one bucket (mostly because the fit now learns from 18 more comparables: the cars the text proves are comparables again, the 20 read by price are not).
