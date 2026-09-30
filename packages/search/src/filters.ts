// Every search filter, in the order the filter sheet, the URL and a chip row list them (CS-58, ADR-0027). Each is one
// declarative definition: adding or removing a filter touches its definition here and its cases in
// test/filter-cases.ts, nothing else. docs/specs/S02-filters-and-catalogues.md says why each exists and what its data
// can and cannot say; listing_filter_row (db/migrations/20260930202001) holds the columns the predicates name.
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatCountOf } from '@carshenas/locale/format-number';
import { choice, flag, limit, range, ranked, type Filter } from './kinds.ts';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MODEL_KEY = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/;
const TRIM_KEY = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE = /^[a-z][a-z0-9_]{1,30}$/;
// A district as the listing names it, in Persian letters and spaces.
const DISTRICT = /^[\u0600-\u06FF\u200C ]{1,60}$/u;

/** The share of the valuation's normal 20,000 km a year (S01) below which a car counts as little driven. */
export const LOW_MILEAGE_KM_PER_YEAR = 12_000;
/** How many of the most listed models count as popular. */
export const POPULAR_MODEL_RANK = 15;

export const make = choice(
  {
    id: 'make',
    param: 'make',
    label: 'برند',
    description:
      'سازنده‌ی خودرو، مثل پژو، ایران‌خودرو یا کیا. فقط برندهایی که آگهی فعال دارند نشان داده می‌شوند.',
    group: 'car',
    words: ['برند', 'سازنده', 'ماشین'],
    optionsFrom: 'make',
    column: 'make_key',
  },
  SLUG,
);

export const model = choice(
  {
    id: 'model',
    param: 'model',
    label: 'مدل',
    description:
      'مدل خودرو، مثل ۲۰۶، دنا پلاس یا کوییک. «مدل ۱۴۰۰» در آگهی‌ها معمولاً سال ساخت است؛ آن را در سال ساخت بگذارید.',
    group: 'car',
    words: ['مدل'],
    optionsFrom: 'model',
    column: 'model_key',
  },
  MODEL_KEY,
);

export const trim = choice(
  {
    id: 'trim',
    param: 'trim',
    label: 'تیپ',
    description:
      'تیپ یا نسخه‌ی مدل، مثل «تیپ ۲» یا «پلاس». آگهی‌هایی که تیپشان را نگفته‌اند با این فیلتر کنار می‌روند.',
    group: 'car',
    words: ['تیپ', 'نسخه'],
    optionsFrom: 'trim',
    column: 'trim_key',
  },
  TRIM_KEY,
);

export const bodyType = choice(
  {
    id: 'body_type',
    param: 'body',
    label: 'نوع بدنه',
    description:
      'سدان، هاچ‌بک، شاسی‌بلند و بقیه، از روی مدل هر خودرو. فقط نوع‌هایی که آگهی فعال دارند نشان داده می‌شوند.',
    group: 'car',
    words: ['سدان', 'هاچ‌بک', 'شاسی‌بلند', 'کراس‌اوور', 'وانت', 'ون', 'کوپه', 'کروک', 'استیشن'],
    optionsFrom: 'body_type',
    column: 'body_type',
  },
  CODE,
);

export const year = range({
  id: 'year',
  param: 'year',
  label: 'سال ساخت',
  description: 'سال ساخت به تقویم شمسی. سال میلادی خودروهای وارداتی به شمسی برگردانده شده است.',
  group: 'car',
  words: ['مدل', 'سال', 'سال ساخت'],
  unit: 'year',
  bounds: { min: 1300, max: 1500 },
  steps: [1380, 1385, 1390, 1395, 1398, 1400, 1401, 1402, 1403, 1404, 1405],
  column: 'model_year_sh',
});

export const age = limit({
  id: 'age',
  param: 'age',
  label: 'حداکثر عمر',
  description: 'خودروهایی که از سال ساختشان حداکثر این چند سال گذشته است؛ با گذشت سال خودش جلو می‌رود.',
  group: 'car',
  words: ['نو', 'کم‌سن', 'جدید', 'مدل بالا'],
  bounds: { min: 0, max: 60 },
  choices: [1, 3, 5, 8, 10, 15],
  predicate: { kind: 'yearsOldAtMost', column: 'model_year_sh' },
  chip: (years) => `حداکثر ${formatCountOf(years, 'سال')} عمر`,
});

export const mileage = range({
  id: 'mileage',
  param: 'km',
  label: 'کارکرد',
  description: 'کیلومتری که فروشنده اعلام کرده است. آگهی‌های بدون کارکرد یا با کارکرد «نامشخص» کنار می‌روند.',
  group: 'car',
  words: ['کارکرد', 'کیلومتر', 'صفر'],
  unit: 'km',
  bounds: { min: 0, max: 9_999_999 },
  steps: [0, 10_000, 30_000, 60_000, 100_000, 150_000, 200_000, 300_000],
  column: 'mileage_km',
});

export const lowMileageForAge = flag({
  id: 'low_mileage_for_age',
  param: 'lowkm',
  label: 'کم‌کارکرد نسبت به سن',
  description: `حداکثر ${formatCountOf(LOW_MILEAGE_KM_PER_YEAR, 'کیلومتر')} برای هر سال عمر؛ خودروی زیر یک سال نیم سال حساب می‌شود. معمول بازار حدود ۲۰ هزار کیلومتر در سال است.`,
  group: 'car',
  words: ['کم‌کار', 'کم‌کارکرد', 'کم کار', 'کارکرد پایین', 'کم‌کیلومتر'],
  predicate: { kind: 'mileageForAgeAtMost', kmPerYear: LOW_MILEAGE_KM_PER_YEAR },
});

export const popularModel = flag({
  id: 'popular_model',
  param: 'popular',
  label: 'مدل پرطرفدار',
  description: `یکی از ${toPersianDigits(String(POPULAR_MODEL_RANK))} مدلی که بیشترین آگهی را در بازار دارند: قطعه و تعمیرکارش همه‌جا پیدا می‌شود و زودتر فروش می‌رود.`,
  group: 'car',
  words: ['بی‌دردسر', 'بی دردسر', 'پرطرفدار', 'قطعه‌ی ارزان', 'نگهداری راحت', 'کم‌خرج', 'نقدشونده'],
  predicate: { kind: 'atMost', column: 'model_rank', value: POPULAR_MODEL_RANK },
});

export const price = range({
  id: 'price',
  param: 'price',
  label: 'قیمت',
  description:
    'قیمتی که آگهی نوشته است، به تومان. آگهی‌های توافقی و قسطی قیمت نقد ندارند و با این فیلتر کنار می‌روند.',
  group: 'price',
  words: ['قیمت', 'بودجه', 'زیر', 'تا', 'میلیون', 'میلیارد'],
  unit: 'toman',
  bounds: { min: 1, max: 999_999_999_999_999 },
  steps: [
    300_000_000, 500_000_000, 700_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000, 3_000_000_000,
    5_000_000_000, 10_000_000_000,
  ],
  column: 'asking_price_toman',
});

export const deal = ranked({
  id: 'deal',
  param: 'deal',
  label: 'ارزیابی قیمت',
  description:
    'قیمت آگهی در مقایسه با ارزش بازار همان خودرو که کارشناس هر روز از آگهی‌های مشابه حساب می‌کند. آگهی‌های بدون ارزیابی کنار می‌روند.',
  group: 'price',
  words: ['ارزان', 'زیر قیمت', 'معامله', 'قیمت خوب', 'مناسب'],
  options: [
    { value: 'great', label: 'معامله‌ی عالی', chip: 'فقط معامله‌ی عالی' },
    { value: 'good', label: 'معامله‌ی خوب', chip: 'معامله‌ی خوب یا بهتر' },
    { value: 'fair', label: 'قیمت منصفانه', chip: 'قیمت منصفانه یا بهتر' },
    { value: 'high', label: 'گران', chip: 'به‌جز خیلی گران' },
    { value: 'overpriced', label: 'خیلی گران', chip: 'همه‌ی آگهی‌های ارزیابی‌شده' },
  ],
  column: 'deal_rating',
});

export const gearbox = choice({
  id: 'gearbox',
  param: 'gearbox',
  label: 'گیربکس',
  description: 'دنده‌ای یا اتوماتیک، همان‌طور که آگهی نوشته است.',
  group: 'car',
  words: ['دنده‌ای', 'دستی', 'اتوماتیک', 'اتومات'],
  options: [
    { value: 'manual', label: 'دنده‌ای' },
    { value: 'automatic', label: 'اتوماتیک' },
  ],
  column: 'gearbox',
});

export const fuel = choice({
  id: 'fuel',
  param: 'fuel',
  label: 'سوخت',
  description: 'نوع سوخت. دوگانه‌سوز شرکتی را کارخانه نصب کرده و دوگانه‌سوز دستی را بعداً نصب کرده‌اند.',
  group: 'car',
  words: ['بنزینی', 'دوگانه‌سوز', 'گازسوز', 'هیبرید', 'برقی', 'دیزل'],
  options: [
    { value: 'petrol', label: 'بنزینی' },
    { value: 'dual_fuel_factory', label: 'دوگانه‌سوز شرکتی' },
    { value: 'dual_fuel_aftermarket', label: 'دوگانه‌سوز دستی' },
    { value: 'hybrid', label: 'هیبرید' },
    { value: 'plug_in_hybrid', label: 'هیبرید شارژی' },
    { value: 'electric', label: 'برقی' },
    { value: 'diesel', label: 'دیزلی' },
  ],
  column: 'fuel',
});

export const colour = choice({
  id: 'colour',
  param: 'colour',
  label: 'رنگ',
  description: 'خانواده‌ی رنگ؛ مثلاً «سفید» سفید صدفی را هم می‌آورد و «خاکستری» نوک‌مدادی و طوسی را.',
  group: 'car',
  words: ['رنگ', 'سفید', 'مشکی', 'نقره‌ای', 'خاکستری'],
  options: [
    { value: 'white', label: 'سفید' },
    { value: 'black', label: 'مشکی' },
    { value: 'grey', label: 'خاکستری' },
    { value: 'silver', label: 'نقره‌ای' },
    { value: 'blue', label: 'آبی' },
    { value: 'red', label: 'قرمز' },
    { value: 'green', label: 'سبز' },
    { value: 'yellow', label: 'زرد' },
    { value: 'orange', label: 'نارنجی' },
    { value: 'brown', label: 'قهوه‌ای' },
    { value: 'beige', label: 'بژ' },
    { value: 'gold', label: 'طلایی' },
    { value: 'purple', label: 'بنفش' },
    { value: 'pink', label: 'صورتی' },
    { value: 'other', label: 'سایر رنگ‌ها' },
  ],
  column: 'colour_family',
});

export const paintFree = flag({
  id: 'paint_free',
  param: 'nopaint',
  label: 'بدون رنگ',
  description:
    'بدنه‌ای که فروشنده سالم، خط و خش جزئی یا صافکاری بی‌رنگ اعلام کرده، یا متن آگهی گفته بی‌رنگ است. اگر متن حتی یک لکه رنگ بگوید کنار می‌رود.',
  group: 'condition',
  words: ['بدون رنگ', 'بی‌رنگ', 'بیرنگ', 'تمیز', 'فابریک', 'بدنه سالم'],
  predicate: { kind: 'isTrue', column: 'paint_free' },
});

export const bodyCondition = ranked({
  id: 'body_condition',
  param: 'bodystate',
  label: 'وضعیت بدنه',
  description: 'بدنه همان‌طور که فروشنده در آگهی انتخاب کرده است؛ ادعای فروشنده است، نه نتیجه‌ی کارشناسی.',
  group: 'condition',
  words: ['بدنه', 'رنگ‌شدگی', 'دوررنگ', 'تمام رنگ', 'تصادفی'],
  options: [
    { value: 'intact', label: 'سالم و بی خط و خش', chip: 'بدنه‌ی سالم و بی خط و خش' },
    { value: 'minor_scratches', label: 'خط و خش جزئی', chip: 'بدنه: خط و خش جزئی یا بهتر' },
    { value: 'paintless_dent_repair', label: 'صافکاری بی‌رنگ', chip: 'بدنه: صافکاری بی‌رنگ یا بهتر' },
    { value: 'partly_repainted', label: 'رنگ‌شدگی', chip: 'بدنه: رنگ‌شدگی یا بهتر' },
    { value: 'repainted_around', label: 'دوررنگ', chip: 'بدنه: دوررنگ یا بهتر' },
    { value: 'fully_repainted', label: 'تمام رنگ', chip: 'بدنه: تمام رنگ یا بهتر' },
    { value: 'accident_damaged', label: 'تصادفی', chip: 'بدنه: به‌جز اوراقی' },
    { value: 'salvage', label: 'اوراقی', chip: 'بدنه: همه‌ی وضعیت‌های اعلام‌شده' },
  ],
  column: 'body_condition',
});

export const engineCondition = choice({
  id: 'engine_condition',
  param: 'engine',
  label: 'وضعیت موتور',
  description: 'موتور همان‌طور که فروشنده اعلام کرده است.',
  group: 'condition',
  words: ['موتور', 'موتور سالم', 'موتور تعویضی'],
  options: [
    { value: 'sound', label: 'موتور سالم' },
    { value: 'needs_repair', label: 'موتور نیازمند تعمیر' },
    { value: 'replaced', label: 'موتور تعویض‌شده' },
  ],
  column: 'engine_condition',
});

export const gearboxCondition = choice({
  id: 'gearbox_condition',
  param: 'gearboxstate',
  label: 'وضعیت گیربکس',
  description: 'گیربکس همان‌طور که فروشنده اعلام کرده است.',
  group: 'condition',
  words: ['گیربکس سالم', 'گیربکس'],
  options: [
    { value: 'sound', label: 'گیربکس سالم' },
    { value: 'needs_repair', label: 'گیربکس نیازمند تعمیر' },
    { value: 'replaced', label: 'گیربکس تعویض‌شده' },
  ],
  column: 'gearbox_condition',
});

export const chassis = choice({
  id: 'chassis',
  param: 'chassis',
  label: 'وضعیت شاسی',
  description:
    'سالم یعنی فروشنده هر دو شاسی جلو و عقب را سالم و پلمپ اعلام کرده، یا فقط متن آگهی گفته شاسی سالم است. آسیب یا رنگ هر کدام از دو شاسی، در فیلد یا متن، همان وضعیت را می‌گیرد.',
  group: 'condition',
  words: ['شاسی', 'شاسی سالم', 'شاسی پلمپ', 'پالونی'],
  options: [
    { value: 'intact', label: 'شاسی سالم و پلمپ' },
    { value: 'repainted', label: 'شاسی رنگ‌شده' },
    { value: 'damaged', label: 'شاسی آسیب‌دیده' },
  ],
  column: 'chassis_condition',
});

export const noAccident = flag({
  id: 'no_accident',
  param: 'noaccident',
  label: 'بدون تصادف',
  description:
    'آگهی‌هایی که فروشنده بدنه را تصادفی یا اوراقی زده یا در متن از تصادف گفته کنار می‌روند. نگفتن تصادف به معنی نداشتن آن نیست.',
  group: 'condition',
  words: ['بدون تصادف', 'بی‌تصادف', 'تصادف نداشته', 'سالم'],
  predicate: { kind: 'isNot', column: 'accident', value: 'had_accident' },
});

export const noReplacedParts = flag({
  id: 'no_replaced_parts',
  param: 'noreplaced',
  label: 'بدون تعویض بدنه',
  description: 'آگهی‌هایی که در متنشان تعویض گلگیر، درب، کاپوت یا قطعه‌ی دیگری از بدنه آمده کنار می‌روند.',
  group: 'condition',
  words: ['بدون تعویض', 'فاقد تعویض', 'تعویضی نداره'],
  predicate: { kind: 'isNot', column: 'replaced_parts', value: 'some' },
});

export const notRideHailing = flag({
  id: 'not_ride_hailing',
  param: 'notaxi',
  label: 'کار نکرده در تاکسی اینترنتی',
  description: 'آگهی‌هایی که در متنشان گفته‌اند خودرو در اسنپ، تپسی یا تاکسی کار کرده کنار می‌روند.',
  group: 'condition',
  words: ['اسنپ کار نکرده', 'شخصی', 'دست خانم', 'بدون اسنپ'],
  predicate: { kind: 'isNot', column: 'ride_hailing', value: 'used' },
});

export const noFreeZonePlate = flag({
  id: 'no_free_zone_plate',
  param: 'nofreezone',
  label: 'بدون پلاک منطقه آزاد',
  description:
    'خودروهای پلاک منطقه آزاد بازار جدایی دارند و بیرون از منطقه تردد محدود دارند؛ آگهی‌هایی که متنشان پلاک منطقه آزاد گفته کنار می‌روند.',
  group: 'terms',
  words: ['پلاک ملی', 'پلاک تهران', 'منطقه آزاد'],
  predicate: { kind: 'isNot', column: 'plate', value: 'free_zone' },
});

export const insurance = limit({
  id: 'insurance',
  param: 'insurance',
  label: 'بیمه‌ی شخص ثالث',
  description: 'دست‌کم این چند ماه بیمه‌ی شخص ثالث باقی‌مانده، همان‌طور که آگهی اعلام کرده است.',
  group: 'terms',
  words: ['بیمه', 'بیمه دار', 'بیمه کامل'],
  bounds: { min: 1, max: 12 },
  choices: [1, 3, 6, 9, 12],
  predicate: { kind: 'atLeast', column: 'insurance_months_left' },
  chip: (months) => `دست‌کم ${formatCountOf(months, 'ماه')} بیمه`,
});

export const swap = flag({
  id: 'swap',
  param: 'swap',
  label: 'معاوضه',
  description: 'فروشنده، در فیلد آگهی یا در متن، گفته است خودرو یا ملک را معاوضه می‌کند.',
  group: 'terms',
  words: ['معاوضه', 'تعویض با'],
  predicate: { kind: 'isTrue', column: 'offers_swap' },
});

export const installments = flag({
  id: 'installments',
  param: 'installments',
  label: 'فروش قسطی',
  description: 'فروشنده امکان خرید قسطی یا با چک گذاشته است، یا قیمت آگهی پیش‌پرداخت است.',
  group: 'terms',
  words: ['قسطی', 'اقساطی', 'اقساط', 'با چک', 'پیش‌پرداخت'],
  predicate: { kind: 'isTrue', column: 'offers_installments' },
});

export const city = choice(
  {
    id: 'city',
    param: 'city',
    label: 'شهر',
    description: 'شهری که آگهی در آن ثبت شده است.',
    group: 'place',
    words: ['تهران', 'شهر'],
    optionsFrom: 'city',
    column: 'city_key',
  },
  SLUG,
);

export const district = choice(
  {
    id: 'district',
    param: 'district',
    label: 'محله',
    description: 'محله‌ای که آگهی نام برده است.',
    group: 'place',
    words: ['محله', 'منطقه'],
    optionsFrom: 'district',
    column: 'district_fa',
  },
  DISTRICT,
);

export const seller = choice({
  id: 'seller',
  param: 'seller',
  label: 'فروشنده',
  description: 'نمایشگاه یا فروشنده‌ی شخصی، همان‌طور که منبع آگهی مشخص کرده است.',
  group: 'place',
  words: ['نمایشگاه', 'شخصی', 'از مالک'],
  options: [
    { value: 'private', label: 'فروشنده‌ی شخصی' },
    { value: 'dealer', label: 'نمایشگاه' },
  ],
  column: 'seller_type',
});

export const source = choice(
  {
    id: 'source',
    param: 'source',
    label: 'منبع',
    description: 'سایتی که آگهی در آن منتشر شده است.',
    group: 'listing',
    words: ['دیوار', 'باما'],
    optionsFrom: 'source',
    column: 'source_id',
  },
  CODE,
);

export const hasPhoto = flag({
  id: 'has_photo',
  param: 'photo',
  label: 'عکس‌دار',
  description: 'فقط آگهی‌هایی که عکس دارند.',
  group: 'listing',
  words: ['عکس', 'با عکس'],
  predicate: { kind: 'isTrue', column: 'has_photo' },
});

export const postedWithin = limit({
  id: 'posted_within',
  param: 'posted',
  label: 'زمان انتشار',
  description: 'آگهی‌هایی که در این چند روز اخیر منتشر شده‌اند.',
  group: 'listing',
  words: ['جدید', 'تازه', 'امروز', 'این هفته'],
  bounds: { min: 1, max: 90 },
  choices: [1, 3, 7, 30],
  predicate: { kind: 'withinDays', column: 'listed_at' },
  chip: (days) => (days === 1 ? 'آگهی‌های امروز' : `آگهی‌های ${formatCountOf(days, 'روز')} اخیر`),
});

/** Every filter, in the order the sheet, the URL and the chips list them. */
export const FILTERS = [
  make,
  model,
  trim,
  bodyType,
  year,
  age,
  mileage,
  lowMileageForAge,
  popularModel,
  price,
  deal,
  gearbox,
  fuel,
  colour,
  paintFree,
  bodyCondition,
  engineCondition,
  gearboxCondition,
  chassis,
  noAccident,
  noReplacedParts,
  notRideHailing,
  insurance,
  swap,
  installments,
  noFreeZonePlate,
  city,
  district,
  seller,
  source,
  hasPhoto,
  postedWithin,
] as const satisfies readonly Filter[];

export type AnyFilter = (typeof FILTERS)[number];
export type FilterId = AnyFilter['id'];

const BY_ID: ReadonlyMap<string, AnyFilter> = new Map(FILTERS.map((filter) => [filter.id, filter]));

export function filterById(id: string): AnyFilter | undefined {
  return BY_ID.get(id);
}
