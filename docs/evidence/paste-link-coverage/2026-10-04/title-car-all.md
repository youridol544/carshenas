# Car read from the title, 6802 real titles

Source: listings of postgres://127.0.0.1:5428/carshenas whose own page was read; truth = the model Divar filed the listing under.

| Outcome | Listings | Share |
|---|---:|---:|
| the right model | 5694 | 83.7 % |
| a wrong model | 13 | 0.2 % |
| only the right make | 796 | 11.7 % |
| only a wrong make | 1 | 0.0 % |
| ambiguous (more than one) | 27 | 0.4 % |
| nothing named | 271 | 4.0 % |

Accuracy where a model is named: 5694 of 5707 (99.8 %). Recall (the right model of all titles): 83.7 %.

| Model | Titles | Right | Wrong | Unread |
|---|---:|---:|---:|---:|
| peugeot.206 | 1629 | 1544 | 4 | 81 |
| peugeot.207i | 1487 | 1443 | 2 | 42 |
| peugeot.pars | 1331 | 1278 | 2 | 51 |
| dena.plus | 1261 | 781 | 2 | 478 |
| samand.soren | 227 | 203 | 0 | 24 |
| quick.manual | 192 | 7 | 4 | 181 |
| pride.131 | 185 | 90 | 0 | 95 |
| peugeot.405 | 174 | 144 | 0 | 30 |
| toyota.corolla | 165 | 143 | 0 | 22 |
| samand.lx | 149 | 61 | 0 | 88 |
| lamari.eama-normal | 1 | 0 | 0 | 1 |
| tara.v1-plus | 1 | 0 | 0 | 1 |

First 40 titles that were not read as their model:

| id | title | filed as | read as |
|---:|---|---|---|
| 27 | پراید دوگانه، مدل ۸۶ | pride.131 | pride |
| 28 | فروش خودروپراید95 | pride.131 | - |
| 31 | دنا شش دنده EF7p فول .. مدل ۱۴۰۴    ۱۴۰۵  رنگ‌بندی | dena.plus | dena |
| 34 | کوییک ۱۴۰۲ | quick.manual | quick |
| 37 | دنا۶ سرعته پلاس | dena.plus | dena |
| 39 | پراید مدل ۹۵ | pride.131 | pride |
| 53 | امور حواله خودرو | dena.plus | - |
| 64 | تیپ۵ مدل۸۲ tu5 شاسی پلمپ خانگی نقدو اقساط و معاوضه | peugeot.206 | - |
| 65 | دنا ۶ دنده مشکی با رینگ برج ۶ | dena.plus | dena |
| 69 | کوییکs کوییک RsکوییکGXR صفر خشک 1405 | quick.manual | quick.gxr |
| 85 | سمند اوراقی مدل ۱۳۹۶ | samand.lx | samand |
| 88 | پراید مدل ۹۰ شاسی سالم | pride.131 | pride |
| 91 | کوییک S مدل 1402 دنده ای بدون خط و خش | quick.manual | quick |
| 98 | کوییک اس و جی ایکس / صفر سال جدید نقدی و شرایطی | quick.manual | quick |
| 99 | کوئیک اس سفید ۱۴۰۵ صفروخشک | quick.manual | quick |
| 101 | سمندef7دوگانه کارخانه | samand.lx | samand |
| 105 | پژو 2000مدل 78 | peugeot.405 | peugeot |
| 112 | کوییک ساده مدل ۹۸ بی رنگ | quick.manual | quick |
| 113 | کوییک ار مدل۱۴۰۰بدون رنگ | quick.manual | quick |
| 114 | دنا / صفر وخشک تحویل فوری | dena.plus | dena |
| 116 | مدل87 | peugeot.206 | - |
| 118 | سمند۸۹ معمولی | samand.lx | samand |
| 119 | کویک R مدل۱۴۰۰بدون رنگ | quick.manual | - |
| 121 | تیپ ۲مدل ۸۸خاکستری | peugeot.206 | - |
| 206 | مدل 99 تیپ 2 رنگ ابی کاسپین | peugeot.206 | - |
| 207 | تیپ۵ مدل۹۷ | peugeot.206 | - |
| 209 | فروش خودرو | peugeot.206 | - |
| 219 | خودرو | peugeot.206 | - |
| 283 | وی هشت تیو فایو تک رنگ | peugeot.206 | - |
| 309 | فروش ماشین | peugeot.206 | - |
| 336 | مدل ۹۹ (بدون رنگ)در حد | peugeot.206 | - |
| 391 | v8 مدل ۸۹ بسیار سالم | peugeot.206 | - |
| 392 | پژو 205 تیپ5 فول | peugeot.206 | peugeot.205 |
| 393 | پژو | peugeot.206 | peugeot |
| 402 | مشاوره وخریدار خودرو تصادفی | peugeot.206 | - |
| 430 | فروش خودرو | peugeot.206 | - |
| 442 | اس دی SD ۹۶ وی ۸ V8 | peugeot.206 | - |
| 448 | فروشی فوری | peugeot.206 | - |
| 492 | Sdمدل ۹۰ اتومات | peugeot.206 | - |
| 530 | پژو اس دی مدل ۹۴ فوری فروشی | peugeot.206 | peugeot |
