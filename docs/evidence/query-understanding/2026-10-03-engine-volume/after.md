| # | Phrase | Filters understood | Words left unused | Listings (understood) | Listings (raw words as text) | As labelled |
|---|---|---|---|---|---|---|
| E001 | ماشین با حجم موتور بیشتر از ۲۰۰۰ سی‌سی | `{"engine_volume":{"min":2000}}` |  | 61 | 0 | yes |
| E002 | ۲۰۰۰ cc به بالا | `{"engine_volume":{"min":2000}}` |  | 61 | 0 | yes |
| E003 | موتور ۲ لیتری | `{"engine_volume":{"min":1900,"max":2100}}` |  | 61 | 0 | yes |
| E004 | حجم موتور بالای 2500 | `{"engine_volume":{"min":2500}}` |  | 0 | 0 | yes |
| E005 | ماشین ۱۶۰۰ سی سی | `{"engine_volume":{"min":1520,"max":1680}}` |  | 2034 | 0 | yes |
| E006 | حجم موتور حداقل ۱۸۰۰ | `{"engine_volume":{"min":1800}}` |  | 1387 | 0 | yes |
| E007 | موتور بالاتر از ۳ لیتر | `{"engine_volume":{"min":3000}}` |  | 0 | 0 | yes |
| E008 | ماشین با موتور کمتر از ۱۵۰۰ سی‌سی | `{"engine_volume":{"max":1499}}` |  | 1094 | 0 | yes |
| E009 | حجم موتور زیر ۱۳۰۰ | `{"engine_volume":{"max":1299}}` |  | 5 | 0 | yes |
| E010 | موتور حداکثر ۱۶۰۰ cc | `{"engine_volume":{"max":1600}}` |  | 3256 | 0 | yes |
| E011 | ماشین ۱۴۰۰ تا ۱۸۰۰ سی‌سی | `{"engine_volume":{"min":1400,"max":1800}}` |  | 5756 | 0 | yes |
| E012 | حجم موتور بین ۱۶۰۰ و ۲۰۰۰ | `{"engine_volume":{"min":1600,"max":2000}}` |  | 4709 | 0 | yes |
| E013 | موتور ۱.۶ لیتری | `{"engine_volume":{"min":1520,"max":1680}}` |  | 2034 | 0 | yes |
| E014 | موتور ۱٫۸ لیتر | `{"engine_volume":{"min":1710,"max":1890}}` |  | 1326 | 0 | yes |
| E015 | hajme motor bishtar az 2000cc | `{"engine_volume":{"min":2000}}` |  | 61 | 0 | yes |
| E016 | motor 2000 cc be bala | `{"engine_volume":{"min":2000}}` |  | 61 | 0 | yes |
| E017 | 2000cc | `{"engine_volume":{"min":1900,"max":2100}}` |  | 61 | 0 | yes |
| E018 | ۲۰۰۰سی‌سی | `{"engine_volume":{"min":1900,"max":2100}}` |  | 61 | 1 | yes |
| E019 | دو لیتری | `{"engine_volume":{"min":1900,"max":2100}}` |  | 61 | 1 | yes |
| E020 | ماشین دو هزار سی‌سی | `{"engine_volume":{"min":1900,"max":2100}}` |  | 61 | 0 | yes |
| E021 | موتور ۳٫۵ لیتری و بالاتر | `{"engine_volume":{"min":3500}}` |  | 0 | 0 | yes |
| E022 | بیشتر از 2000 cc | `{"engine_volume":{"min":2000}}` |  | 61 | 0 | yes |
| E023 | موتور ۱۰۰۰ سی سی | `{"engine_volume":{"min":950,"max":1050}}` |  | 0 | 0 | yes |
| E024 | ماشین با موتور ۲۰۰۰ تا ۳۰۰۰ cc | `{"engine_volume":{"min":2000,"max":3000}}` |  | 61 | 0 | yes |
| E025 | ماشین‌های خارجی تمیز | `{"origin":["imported"],"paint_free":true,"no_accident":true,"no_replaced_parts":true}` |  | 113 | 0 | yes |
| E026 | ماشین خارجی | `{"origin":["imported"]}` |  | 117 | 0 | yes |
| E027 | خودرو وارداتی | `{"origin":["imported"]}` |  | 117 | 0 | yes |
| E028 | ماشین ایرانی | `{"origin":["domestic","joint_venture"]}` |  | 5858 | 0 | yes |
| E029 | ماشین ساخت داخل | `{"origin":["domestic","joint_venture"]}` |  | 5858 | 0 | yes |
| E030 | خودروی مونتاژ ایران | `{"origin":["joint_venture"]}` |  | 4136 | 0 | yes |
| E031 | ماشین وارداتی کم کارکرد | `{"low_mileage_for_age":true,"origin":["imported"]}` |  | 114 | 0 | yes |
| E032 | ایرانی تمیز | `{"origin":["domestic","joint_venture"],"paint_free":true,"no_accident":true,"no_replaced_parts":true}` |  | 4192 | 0 | yes |
| E033 | masshin haye kharejie tamiz | `{"origin":["imported"],"paint_free":true,"no_accident":true,"no_replaced_parts":true}` |  | 113 | 0 | yes |
| E034 | mashin khareji | `{"origin":["imported"]}` |  | 117 | 0 | yes |
| E035 | mashin irani 1600cc | `{"engine_volume":{"min":1520,"max":1680},"origin":["domestic","joint_venture"]}` |  | 2026 | 0 | yes |
| E036 | ماشین خارجی با موتور ۲۰۰۰ به بالا | `{"engine_volume":{"min":2000},"origin":["imported"]}` |  | 61 | 0 | yes |
| E037 | خارجی ۲ لیتری | `{"engine_volume":{"min":1900,"max":2100},"origin":["imported"]}` |  | 61 | 0 | yes |
| E038 | وارداتی بالای ۳۰۰۰ سی سی | `{"engine_volume":{"min":3000},"origin":["imported"]}` |  | 0 | 0 | yes |
| E039 | ماشین ایرانی ۱۳۰۰ سی‌سی | `{"engine_volume":{"min":1240,"max":1370},"origin":["domestic","joint_venture"]}` |  | 108 | 0 | yes |
| E040 | کم‌کارکرد خارجی بالای ۲۰۰۰ سی‌سی | `{"low_mileage_for_age":true,"engine_volume":{"min":2000},"origin":["imported"]}` |  | 61 | 0 | yes |
| E041 | ماشین‌های وارداتی با حجم موتور ۳۰۰۰ تا ۴۰۰۰ | `{"engine_volume":{"min":3000,"max":4000},"origin":["imported"]}` |  | 0 | 0 | yes |
| E042 | ماشین ۲۰۰۰ cc بنزینی اتوماتیک | `{"gearbox":["automatic"],"fuel":["petrol"],"engine_volume":{"min":1900,"max":2100}}` |  | 19 | 0 | yes |
| E043 | ایرانی اتوماتیک کم کارکرد | `{"low_mileage_for_age":true,"gearbox":["automatic"],"origin":["domestic","joint_venture"]}` |  | 684 | 0 | yes |
| E044 | ماشین خارجی زیر ۵۰۰ میلیون | `{"price":{"max":500000000},"origin":["imported"]}` |  | 0 | 0 | yes |
| E045 | ماشین با موتور ۲۰۰۰ تا ۳۰۰۰ cc کم‌کارکرد | `{"low_mileage_for_age":true,"engine_volume":{"min":2000,"max":3000}}` |  | 61 | 0 | yes |
| E046 | کرولا ۱۸۰۰ سی‌سی | `{"model":["toyota.corolla"],"engine_volume":{"min":1710,"max":1890}}` |  | 41 | 3 | yes |
| E047 | پژو ۲۰۶ موتور ۱۶۰۰ | `{"model":["peugeot.206"],"engine_volume":{"min":1520,"max":1680}}` |  | 587 | 0 | yes |
| E048 | دنا پلاس ۱۷۰۰ cc | `{"model":["dena.plus"],"engine_volume":{"min":1620,"max":1790}}` |  | 1205 | 0 | yes |
| E049 | تویوتا کرولا خارجی تمیز | `{"model":["toyota.corolla"],"origin":["imported"],"paint_free":true,"no_accident":true,"no_replaced_parts":true}` |  | 113 | 0 | yes |
| E050 | پژو ۲۰۶ مدل ۲۰۰۰ | `{"model":["peugeot.206"],"year":{"min":1379,"max":1379}}` |  | 0 | 0 | yes |
| E051 | کارکرد ۲۰۰۰ کیلومتر | `{"mileage":{"max":2000}}` |  | 1483 | 0 | yes |
| E052 | ماشین ۲۰۰۰ سی‌سی با قیمت زیر ۵۰۰ میلیون | `{"price":{"max":500000000},"engine_volume":{"min":1900,"max":2100}}` |  | 0 | 0 | yes |

As labelled: 52 of 52.
