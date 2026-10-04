# Car read from the title, 300 real titles

Source: listings of postgres://127.0.0.1:5428/carshenas whose own page was read; truth = the model Divar filed the listing under.

| Outcome | Listings | Share |
|---|---:|---:|
| the right model | 248 | 82.7 % |
| a wrong model | 1 | 0.3 % |
| only the right make | 39 | 13.0 % |
| only a wrong make | 0 | 0.0 % |
| ambiguous (more than one) | 0 | 0.0 % |
| nothing named | 12 | 4.0 % |

Accuracy where a model is named: 248 of 249 (99.6 %). Recall (the right model of all titles): 82.7 %.

| Model | Titles | Right | Wrong | Unread |
|---|---:|---:|---:|---:|
| peugeot.pars | 70 | 68 | 0 | 2 |
| peugeot.206 | 69 | 67 | 1 | 1 |
| dena.plus | 51 | 33 | 0 | 18 |
| peugeot.207i | 49 | 47 | 0 | 2 |
| samand.lx | 12 | 3 | 0 | 9 |
| pride.131 | 11 | 3 | 0 | 8 |
| samand.soren | 10 | 10 | 0 | 0 |
| peugeot.405 | 10 | 8 | 0 | 2 |
| toyota.corolla | 9 | 9 | 0 | 0 |
| quick.manual | 9 | 0 | 0 | 9 |

First 40 titles that were not read as their model:

| id | title | filed as | read as |
|---:|---|---|---|
| 392 | پژو 205 تیپ5 فول | peugeot.206 | peugeot.205 |
| 1072 | پراید مدل ۸۳ سالم | pride.131 | pride |
| 1140 | ماشین کوییک | quick.manual | quick |
| 1363 | کوییک مدل ۱۴۰۲ بدون رنگ و ضربه | quick.manual | quick |
| 2270 | tu3تیوتری خشک دنده ای صفر برج روز  تحویل فوری | peugeot.207i | - |
| 2909 | Tu3،صفر،از مصرف کننده به مصرف کننده | peugeot.207i | - |
| 3039 | پژو پارسی | peugeot.pars | peugeot |
| 3904 | پرشیاسالم۸۳ | peugeot.pars | - |
| 4342 | دنا اتومات اپشنال ۱۴۰۵تحویل فوری  (نقد و اقساط) | dena.plus | dena |
| 4405 | دنا 6 دنده تحویل آنی صفر 405 | dena.plus | dena |
| 4430 | دنا ۶ دنده /صفر/مشکی تحویل روز نمایندگی | dena.plus | dena |
| 4599 | دنا۶دنده/دنا اتومات آپشنال/صفر/اقساطی | dena.plus | dena |
| 4605 | دنا اتوماتیک اپشنال فول 1405 فول تیتانیوم کرمان | dena.plus | dena |
| 4824 | دنا اتومات / دنده اپشنال صفر / تیتانیوم / مشکی | dena.plus | dena |
| 4828 | دنا ۶سرعته EF7P سفید صفر ۱۴۰۴ و ۱۴۰۵ | dena.plus | dena |
| 5014 | دنا ۶دنده صفرمدل ۱۴۰۵ تحویل آنی گارانتی قیمت | dena.plus | dena |
| 5026 | دنا۶دنده معمولی و اتومات آپشنال توربوصفر خشک۱۴۰۵ | dena.plus | dena |
| 5066 | دنا 6 سرعته مدل ۱۴۰۲ نقد و اقساط اتولند غرب | dena.plus | dena |
| 5201 | دنا/اتومات1405/صفر نمایندگی/باسانروف/بدون سانروف | dena.plus | dena |
| 5206 | دنا۶دنده معمولی و اتومات آپشنال توربو در رنگ بندی | dena.plus | dena |
| 5242 | حواله *دنا ۶ سرعته/رنگ بندی | dena.plus | - |
| 5282 | دنا۶دنده /سفید مدل۱۴۰۵/ تحویل فوری/سندآزاد | dena.plus | dena |
| 5423 | دنا ۶ سرعته سفید ۱۴۰۵ صفر خشک آماده تحویل درجا | dena.plus | dena |
| 5470 | دنا 6 دنده/نقد/اقساط/تحویل فوری | dena.plus | dena |
| 6719 | پژو slx مدل ۹۳ موتور tu5 تصادفی | peugeot.405 | peugeot |
| 8243 | کوییک S | quick.manual | quick |
| 9188 | تاکسی گردشی | peugeot.405 | - |
| 9196 | فروشی | samand.lx | - |
| 9218 | کوییک S - اقساطی - رنگ دلخواه - تحویل فوری | quick.manual | quick |
| 9527 | پراید یورو ۴ معاوضه با زونتس کیوجی | pride.131 | pride |
| 11205 | پراید مدل۹۳ نقد و اقساط | pride.131 | pride |
| 12090 | سمند EF7 96 | samand.lx | samand |
| 12183 | سمند ۸۹ | samand.lx | samand |
| 20127 | کوییک s مدل 1402 | quick.manual | quick |
| 22943 | سمندالیکس مدل 90 | samand.lx | - |
| 24917 | دنا آپشنال بی رنگ۱۴۰۴ | dena.plus | dena |
| 32342 | ماشین | peugeot.206 | - |
| 39173 | کوییک GXL دنده ای مدل ۱۴۰۵ | quick.manual | quick |
| 39259 | پراید مدل 94 بیرنگ 155تا کار | pride.131 | pride |
| 39545 | فروش خودرو کوئیک اس | quick.manual | quick |
/home/pedrum/Dev/carshenas-cs115/packages/search:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @carshenas/search@0.0.0 measure:title-car: `node --env-file-if-exists=../../.env --experimental-strip-types --no-warnings=ExperimentalWarning scripts/measure-title-car.ts -- --sample 300 --json docs/evidence/paste-link-coverage/2026-10-04/title-car-sample-300.json`
Exit status 1
