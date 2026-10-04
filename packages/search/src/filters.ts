// Every search filter, in the order the filter sheet, the URL and a chip row list them (CS-58, ADR-0027). Each is one
// declarative definition: adding or removing a filter touches its definition here and its cases in
// test/filter-cases.ts, nothing else. docs/specs/S02-filters-and-catalogues.md says why each exists and what its data
// can and cannot say; listing_filter_row (db/migrations/20260930202001) holds the columns the predicates name.
import { formatCount, formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { ENGINE_VOLUME_BOUNDS } from '@carshenas/locale/engine-volume';
import { choice, flag, limit, range, ranked, type Filter } from './kinds.ts';
import { ORIGIN_DEFINITIONS } from './specs.ts';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MODEL_KEY = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/;
const TRIM_KEY = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE = /^[a-z][a-z0-9_]{1,30}$/;
// A district as city slug.district, the district as the listing names it, in Persian letters and spaces.
const DISTRICT = /^[a-z0-9]+(-[a-z0-9]+)*\.[\u0600-\u06FF\u200C ]{1,60}$/u;

// The numbers the rules measure against. The predicates and the Farsi rules below both read these constants, so an
// info control can never state a number the SQL does not use (definitions.test.ts checks it).

/** Kilometres a year the valuation counts as normal (S01, method 1). */
export const NORMAL_KM_PER_YEAR = 20_000;
/** At most this many kilometres a year of age counts as little driven: 60 % of the normal. */
export const LOW_MILEAGE_KM_PER_YEAR = 12_000;
/** How many of the most listed models count as popular. */
export const POPULAR_MODEL_RANK = 15;
/**
 * S01's rating boundaries, in percent of market value: great at or below -10, good up to -4, fair below +4, high
 * below +10. valuation_rate_listing() and dealRatingForGap() (apps/worker) apply them; a worker test compares.
 */
export const DEAL_GAP_PCT = { great: -10, good: -4, fair: 4, high: 10 } as const;

const percent = (pct: number) => formatPercent(Math.abs(pct) / 100);
// «۲۴ ساعت» for one day, which is what «the last day» means to the database's clock; «۳ روز» beyond.
const within = (days: number) => (days === 1 ? formatCountOf(24, 'ساعت') : formatCountOf(days, 'روز'));

export const make = choice(
  {
    id: 'make',
    param: 'make',
    label: 'برند',
    description: 'سازنده‌ی خودرو، مثل پژو، ایران‌خودرو یا کیا.',
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
      'مدل خودرو، مثل ۲۰۶، دنا پلاس یا کوییک. «مدل ۱۴۰۰» در آگهی‌ها معمولاً سال ساخت است. برای آن «سال ساخت» را انتخاب کنید.',
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
    description: 'نسخه‌ی مدل، مثل «تیپ ۲» یا «پلاس». آگهی‌هایی که تیپ را ننوشته‌اند نشان داده نمی‌شوند.',
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
    description: 'سدان، هاچ‌بک، شاسی‌بلند و مانند آن‌ها. نوع بدنه از روی مدل خودرو معلوم می‌شود.',
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
  description: 'سال ساخت به تقویم شمسی. سال میلادی خودروهای وارداتی به شمسی تبدیل شده است.',
  group: 'car',
  words: ['مدل', 'سال', 'سال ساخت'],
  unit: 'year',
  bounds: { min: 1300, max: 1500 },
  steps: [1380, 1385, 1390, 1395, 1398, 1400, 1401, 1402, 1403, 1404, 1405],
  quick: 'atLeast',
  column: 'model_year_sh',
});

export const age = limit({
  id: 'age',
  param: 'age',
  label: 'حداکثر عمر',
  description: 'خودروهایی که حداکثر این چند سال از سال ساختشان گذشته است.',
  group: 'car',
  words: ['نو', 'کم‌سن', 'جدید', 'مدل بالا'],
  bounds: { min: 0, max: 60 },
  choices: [1, 3, 5, 8, 10, 15],
  predicate: { kind: 'yearsOldAtMost', column: 'model_year_sh' },
  chip: (years) => `حداکثر ${formatCountOf(years, 'سال')} عمر`,
  rule: (years) =>
    years === 0 ? 'سال ساخت امسال.' : `سال ساخت از ${formatCountOf(years, 'سال')} پیش تا امسال.`,
});

export const mileage = range({
  id: 'mileage',
  param: 'km',
  label: 'کارکرد',
  description: 'کیلومتری که فروشنده نوشته است. آگهی‌هایی که کارکرد را ننوشته‌اند نشان داده نمی‌شوند.',
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
  description: 'خودروهایی که کمتر از معمول بازار کار کرده‌اند.',
  rule: `حداکثر ${formatCountOf(LOW_MILEAGE_KM_PER_YEAR, 'کیلومتر')} برای هر سال عمر خودرو.`,
  group: 'car',
  words: ['کم‌کار', 'کم‌کارکرد', 'کم کار', 'کارکرد پایین', 'کم‌کیلومتر'],
  predicate: { kind: 'mileageForAgeAtMost', kmPerYear: LOW_MILEAGE_KM_PER_YEAR },
});

export const popularModel = flag({
  id: 'popular_model',
  param: 'popular',
  label: 'مدل پرطرفدار',
  description: 'مدلی که آگهی‌های زیادی دارد. قطعه و تعمیرکارش راحت پیدا می‌شود و زودتر فروش می‌رود.',
  rule: `یکی از ${formatCount(POPULAR_MODEL_RANK)} مدلی که بیشترین آگهی را دارند.`,
  group: 'car',
  words: ['بی‌دردسر', 'بی دردسر', 'پرطرفدار', 'قطعه‌ی ارزان', 'نگهداری راحت', 'کم‌خرج', 'نقدشونده'],
  predicate: { kind: 'atMost', column: 'model_rank', value: POPULAR_MODEL_RANK },
});

export const price = range({
  id: 'price',
  param: 'price',
  label: 'قیمت',
  description:
    'قیمتی که آگهی نوشته است، به تومان. آگهی‌های توافقی و قسطی قیمت نقدی ندارند و نشان داده نمی‌شوند.',
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
  description: 'قیمت آگهی در مقایسه با ارزش بازار همان خودرو.',
  group: 'price',
  words: ['ارزان', 'زیر قیمت', 'معامله', 'قیمت خوب', 'مناسب'],
  options: [
    {
      value: 'great',
      label: 'معامله‌ی عالی',
      chip: 'فقط معامله‌ی عالی',
      rule: `دست‌کم ${percent(DEAL_GAP_PCT.great)} زیر ارزش بازار.`,
    },
    {
      value: 'good',
      label: 'معامله‌ی خوب',
      chip: 'معامله‌ی خوب یا بهتر',
      rule: `دست‌کم ${percent(DEAL_GAP_PCT.good)} زیر ارزش بازار.`,
    },
    {
      value: 'fair',
      label: 'قیمت منصفانه',
      chip: 'قیمت منصفانه یا بهتر',
      rule: `کمتر از ${percent(DEAL_GAP_PCT.fair)} بالاتر از ارزش بازار.`,
    },
    {
      value: 'high',
      label: 'گران',
      chip: 'به‌جز خیلی گران',
      rule: `کمتر از ${percent(DEAL_GAP_PCT.high)} بالاتر از ارزش بازار.`,
    },
    {
      value: 'overpriced',
      label: 'خیلی گران',
      chip: 'همه‌ی آگهی‌های ارزیابی‌شده',
      rule: 'همه‌ی آگهی‌های ارزیابی‌شده، با هر قیمتی.',
    },
  ],
  column: 'deal_rating',
  type: 'deal_rating',
});

export const gearbox = choice({
  id: 'gearbox',
  param: 'gearbox',
  label: 'گیربکس',
  description: 'دنده‌ای یا اتوماتیک، به گفته‌ی آگهی.',
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
  description: 'دوگانه‌سوز شرکتی را کارخانه نصب کرده است و دوگانه‌سوز دستی را بعداً نصب کرده‌اند.',
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

export const engineVolume = range({
  id: 'engine_volume',
  param: 'cc',
  label: 'حجم موتور',
  description:
    'حجم موتور به سی‌سی، از عنوان آگهی یا از مشخصات مدل. آگهی‌هایی که حجمشان معلوم نیست نشان داده نمی‌شوند.',
  group: 'car',
  words: ['حجم موتور', 'حجم', 'سی‌سی', 'سی سی', 'لیتر', 'لیتری', 'موتور'],
  unit: 'cc',
  bounds: { min: ENGINE_VOLUME_BOUNDS.min, max: ENGINE_VOLUME_BOUNDS.max },
  steps: [1000, 1300, 1600, 1800, 2000, 2500, 3000, 4000],
  quick: 'atLeast',
  column: 'engine_volume_cc',
});

export const origin = choice({
  id: 'origin',
  param: 'origin',
  label: 'مبدأ خودرو',
  description: ORIGIN_DEFINITIONS.map(({ label, description }) => `${label}: ${description}`).join(' '),
  group: 'car',
  words: ['خارجی', 'وارداتی', 'ایرانی', 'ساخت داخل', 'ساخت ایران', 'مونتاژ', 'مشترک', 'خارج'],
  options: ORIGIN_DEFINITIONS.map(({ value, label, description }) => ({ value, label, description })),
  column: 'car_origin',
});

/** A country's code in a URL or a stored search: two lower-case letters (the closed list is in specs.ts and the database). */
const COUNTRY_CODE = /^[a-z]{2}$/;

export const country = choice(
  {
    id: 'country',
    param: 'country',
    label: 'کشور سازنده',
    description:
      'کشوری که برند خودرو از آنجاست، حتی اگر در ایران ساخته یا مونتاژ شده باشد. مثلاً پژو ۲۰۶ ساخت ایران «فرانسوی» است. اگر منظورتان از «خارجی» وارداتی است، «مبدأ خودرو» را ببینید.',
    group: 'car',
    words: ['ژاپنی', 'کره‌ای', 'آلمانی', 'چینی', 'فرانسوی', 'ایتالیایی', 'آمریکایی', 'انگلیسی', 'سوئدی'],
    optionsFrom: 'country',
    column: 'country',
    valueChip: (label) => `کشور ${label}`,
  },
  COUNTRY_CODE,
);

export const colour = choice({
  id: 'colour',
  param: 'colour',
  label: 'رنگ',
  description:
    'رنگ‌های نزدیک به هم یک گروه‌اند. مثلاً «سفید» سفید صدفی را هم می‌گیرد و «خاکستری» نوک‌مدادی و طوسی را.',
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
  description: 'بدنه‌ای که سالم است یا فقط خط‌وخش جزئی یا صافکاری بی‌رنگ دارد.',
  rule: 'در آگهی نوشته شده بدنه بی‌رنگ است و حتی یک لکه رنگ هم نیامده است.',
  group: 'condition',
  words: ['بدون رنگ', 'بی‌رنگ', 'بیرنگ', 'تمیز', 'فابریک', 'بدنه سالم'],
  predicate: { kind: 'isTrue', column: 'paint_free' },
});

export const bodyCondition = ranked({
  id: 'body_condition',
  param: 'bodystate',
  label: 'وضعیت بدنه',
  description: 'وضعیت بدنه را فروشنده گفته است، نه بازدید خودرو.',
  group: 'condition',
  words: ['بدنه', 'رنگ‌شدگی', 'دوررنگ', 'تمام رنگ', 'تصادفی'],
  options: [
    { value: 'intact', label: 'سالم و بی‌خط‌وخش', chip: 'بدنه‌ی سالم و بی‌خط‌وخش' },
    { value: 'minor_scratches', label: 'خط‌وخش جزئی', chip: 'خط‌وخش جزئی یا بهتر' },
    { value: 'paintless_dent_repair', label: 'صافکاری بی‌رنگ', chip: 'صافکاری بی‌رنگ یا بهتر' },
    { value: 'partly_repainted', label: 'رنگ‌شدگی', chip: 'رنگ‌شدگی یا بهتر' },
    { value: 'repainted_around', label: 'دوررنگ', chip: 'دوررنگ یا بهتر' },
    { value: 'fully_repainted', label: 'تمام رنگ', chip: 'تمام رنگ یا بهتر' },
    { value: 'accident_damaged', label: 'تصادفی', chip: 'بدنه: به‌جز اوراقی' },
    { value: 'salvage', label: 'اوراقی', chip: 'بدنه: همه‌ی وضعیت‌ها' },
  ],
  column: 'body_condition',
});

export const engineCondition = choice({
  id: 'engine_condition',
  param: 'engine',
  label: 'وضعیت موتور',
  description: 'وضعیت موتور را فروشنده گفته است، نه بازدید خودرو.',
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
  description: 'وضعیت گیربکس را فروشنده گفته است، نه بازدید خودرو.',
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
    'سالم یعنی هر دو شاسی جلو و عقب سالم و پلمپ‌اند، به گفته‌ی آگهی. اگر یکی آسیب دیده یا رنگ شده باشد، همان وضعیت حساب می‌شود.',
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
    'آگهی‌هایی که تصادف در آن‌ها نوشته شده نشان داده نمی‌شوند. ننوشتن تصادف به معنی نداشتن آن نیست.',
  rule: 'در آگهی از تصادف و اوراقی بودن بدنه چیزی نیامده است.',
  group: 'condition',
  words: ['بدون تصادف', 'بی‌تصادف', 'تصادف نداشته', 'سالم'],
  predicate: { kind: 'isNot', column: 'accident', value: 'had_accident' },
});

export const noReplacedParts = flag({
  id: 'no_replaced_parts',
  param: 'noreplaced',
  label: 'بدون تعویض بدنه',
  description: 'آگهی‌هایی که تعویض گلگیر، درب، کاپوت، سقف یا صندوق در آن‌ها نوشته شده نشان داده نمی‌شوند.',
  rule: 'در متن آگهی از تعویض قطعه‌ی بدنه چیزی نیامده است.',
  group: 'condition',
  words: ['بدون تعویض', 'فاقد تعویض', 'تعویضی نداره'],
  predicate: { kind: 'isNot', column: 'replaced_parts', value: 'some' },
});

export const notRideHailing = flag({
  id: 'not_ride_hailing',
  param: 'notaxi',
  label: 'بدون سابقه‌ی تاکسی اینترنتی',
  description: 'آگهی‌هایی که سابقه‌ی تاکسی اینترنتی را نوشته‌اند نشان داده نمی‌شوند.',
  rule: 'در متن آگهی از کار در اسنپ، تپسی یا تاکسی چیزی نیامده است.',
  group: 'condition',
  words: ['اسنپ کار نکرده', 'شخصی', 'دست خانم', 'بدون اسنپ'],
  predicate: { kind: 'isNot', column: 'ride_hailing', value: 'used' },
});

export const noFreeZonePlate = flag({
  id: 'no_free_zone_plate',
  param: 'nofreezone',
  label: 'بدون پلاک منطقه‌ی آزاد',
  description:
    'پلاک منطقه‌ی آزاد بازار جدایی دارد و تردد خارج از منطقه محدود است. آگهی‌هایی که این پلاک را نوشته‌اند نشان داده نمی‌شوند.',
  rule: 'در متن آگهی از پلاک منطقه‌ی آزاد چیزی نیامده است.',
  group: 'terms',
  words: ['پلاک ملی', 'پلاک تهران', 'منطقه آزاد'],
  predicate: { kind: 'isNot', column: 'plate', value: 'free_zone' },
});

export const insurance = limit({
  id: 'insurance',
  param: 'insurance',
  label: 'بیمه‌ی شخص ثالث',
  description: 'خودروهایی که دست‌کم این چند ماه از بیمه‌ی شخص ثالثشان مانده است، به گفته‌ی آگهی.',
  group: 'terms',
  words: ['بیمه', 'بیمه دار', 'بیمه کامل'],
  bounds: { min: 1, max: 12 },
  choices: [1, 3, 6, 9, 12],
  predicate: { kind: 'atLeast', column: 'insurance_months_left' },
  chip: (months) => `دست‌کم ${formatCountOf(months, 'ماه')} بیمه`,
  rule: (months) => `بیمه‌ی شخص ثالث دست‌کم ${formatCountOf(months, 'ماه')} دیگر اعتبار دارد.`,
});

export const swap = flag({
  id: 'swap',
  param: 'swap',
  label: 'معاوضه',
  description: 'آگهی‌هایی که فروشنده در آن‌ها معاوضه با خودرو یا ملک را قبول کرده است.',
  rule: 'در آگهی معاوضه آمده است.',
  group: 'terms',
  words: ['معاوضه', 'تعویض با'],
  predicate: { kind: 'isTrue', column: 'offers_swap' },
});

export const installments = flag({
  id: 'installments',
  param: 'installments',
  label: 'فروش قسطی',
  description: 'آگهی‌هایی که خرید قسطی یا با چک دارند.',
  rule: 'در آگهی خرید قسطی یا با چک آمده است، یا قیمت آگهی فقط پیش‌پرداخت است.',
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
    description: 'محله‌ای که آگهی نوشته است.',
    group: 'place',
    words: ['محله', 'منطقه'],
    optionsFrom: 'district',
    column: 'district_key',
  },
  DISTRICT,
);

export const seller = choice({
  id: 'seller',
  param: 'seller',
  label: 'فروشنده',
  description: 'نمایشگاه یا فروشنده‌ی شخصی، همان‌طور که در آگهی آمده است.',
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
  rule: 'آگهی دست‌کم یک عکس دارد.',
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
  chip: (days) => `آگهی‌های ${within(days)} گذشته`,
  rule: (days) => `آگهی در ${within(days)} گذشته منتشر شده است.`,
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
  engineVolume,
  origin,
  country,
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
