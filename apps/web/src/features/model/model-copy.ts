import { formatCount, formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { toPersianDigits } from '@carshenas/locale/digits';
import { BAND_HIGH_FRACTION, BAND_LOW_FRACTION, TREND_MIN_POINTS } from '@/features/model/model-rules';

// Every word of the model page and the models index (CS-67), Farsi, in one place. Numbers come from the locale
// formatters and from the constants of model-rules.ts, so a sentence cannot state a number the query does not use.

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/** «مدل ۱۴۰۰»: a model year, with the word tied to it. */
export const modelYear = (year: number) => `مدل${NO_BREAK_SPACE}${toPersianDigits(String(year))}`;

export const MODEL_COPY = {
  title: (name: string) => `${name}، قیمت و روند بازار`,
  description: (name: string) =>
    `ارزش بازار، محدوده‌ی قیمت و روند قیمت ${name} از آگهی‌های امروز، با بهترین معامله‌های این مدل.`,
  notFoundTitle: 'این مدل پیدا نشد',
  allModels: 'فهرست مدل‌ها',
  searchInstead: 'جست‌وجوی خودرو',
  breadcrumb: { label: 'مسیر صفحه', home: 'صفحه‌ی اصلی', models: 'مدل‌ها' },
  hero: {
    listings: (count: number) => `${formatCountOf(count, 'آگهی')} در بازار`,
    popular: 'مدل پرطرفدار',
    seeAll: (count: number) => `دیدن ${formatCountOf(count, 'آگهی')}`,
    seeAllOfYear: (count: number, year: number) => `دیدن ${formatCountOf(count, 'آگهی')} ${modelYear(year)}`,
    photoCaption: (bodyType: string) => `عکس نمونه از بدنه‌ی ${bodyType} است، نه خودروی همین مدل.`,
  },
  stats: {
    label: 'قیمت این مدل امروز',
    median: 'میانه‌ی قیمت آگهی‌ها',
    medianHelp: 'نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از آن هستند.',
    range: 'محدوده‌ی قیمت',
    rangeHelp: (count: number) =>
      `از ${formatCountOf(count, 'آگهی')} با قیمت نقدی، بیشترشان در این محدوده‌اند.`,
    value: 'ارزش بازار',
    valueHelp: (date: string) => `میانه‌ی ارزش خودروهای آگهی‌شده، برای ${date}`,
    valueNone: 'هنوز حساب نشده است',
    mileage: 'کارکرد معمول',
    mileageHelp: 'میانه‌ی کارکرد اعلام‌شده',
    years: 'سال‌های ساخت',
    yearsValue: (first: number, last: number) =>
      first === last
        ? toPersianDigits(String(first))
        : `${toPersianDigits(String(first))} تا ${toPersianDigits(String(last))}`,
    yearsHelp: (year: number) => `بیشترین آگهی: ${modelYear(year)}`,
    none: 'معلوم نیست',
  },
  info: {
    close: 'بستن',
    rangeLabel: 'توضیح درباره‌ی «محدوده‌ی قیمت»',
    valueLabel: 'توضیح درباره‌ی «ارزش بازار»',
    trendLabel: 'توضیح درباره‌ی «روند قیمت»',
    ratingsLabel: 'توضیح درباره‌ی «ارزیابی قیمت آگهی‌ها»',
    dealsLabel: 'توضیح درباره‌ی «ترتیب بهترین معامله‌ها»',
    popularLabel: 'توضیح درباره‌ی «مدل پرطرفدار»',
    factsLabel: 'توضیح درباره‌ی «آگهی‌ها چه می‌گویند»',
    yearsLabel: 'توضیح درباره‌ی «قیمت هر سال ساخت»',
  },
  years: {
    label: 'سال ساخت',
    allChip: (count: number) => `همه‌ی سال‌ها، ${formatCountOf(count, 'آگهی')}`,
    navLabel: 'انتخاب سال ساخت',
    chip: (year: number, count: number) =>
      `${toPersianDigits(String(year))}، ${formatCountOf(count, 'آگهی')}`,
  },
  trend: {
    title: 'روند قیمت',
    cohort: (year: number) => `آگهی‌های ${modelYear(year)}`,
    cohortNote: (year: number) => `روند برای ${modelYear(year)} است، چون بیشترین آگهی را دارد.`,
    median: 'میانه‌ی قیمت آگهی‌ها',
    latest: (date: string) => `در ${date}`,
    legendLine: 'میانه‌ی قیمت آگهی‌ها',
    legendBand: `${formatPercent(BAND_HIGH_FRACTION - BAND_LOW_FRACTION)} میانیِ قیمت‌ها`,
    daily: 'هر نقطه یک روز است.',
    weekly: 'هر نقطه یک هفته است.',
    sinceDay: (date: string) => `تاریخچه از ${date} است.`,
    chartLabel: (cohort: string, from: string, to: string, first: string, last: string) =>
      `نمودار میانه‌ی قیمت ${cohort}: ${first} در ${from}، ${last} در ${to}`,
    tableSummary: 'جدول عددهای نمودار',
    tableCaption: (cohort: string) => `میانه و محدوده‌ی قیمت آگهی‌های ${cohort} در هر روز`,
    columns: {
      date: 'تاریخ',
      count: 'تعداد آگهی',
      median: 'میانه‌ی قیمت',
      range: `${formatPercent(BAND_HIGH_FRACTION - BAND_LOW_FRACTION)} میانی`,
      value: 'ارزش بازار',
    },
    change: {
      over: (days: number) => `نسبت به ${formatCountOf(days, 'روز')} پیش`,
      flat: 'تقریباً بدون تغییر',
      rise: 'گران‌تر شده',
      fall: 'ارزان‌تر شده',
      notYet: (days: number) => `برای ${formatCountOf(days, 'روز')} پیش هنوز تاریخچه نداریم`,
    },
    scope:
      'اعداد بالای صفحه از همه‌ی آگهی‌های قیمت‌دار امروز است. روند فقط از آگهی‌های ارزیابی‌شده‌ی این سال ساخت است.',
    short: {
      title: 'تاریخچه‌ی قیمت هنوز کوتاه است',
      body: (points: number) =>
        `برای رسم نمودار دست‌کم ${formatCountOf(TREND_MIN_POINTS, 'روز')} ثبت لازم است. برای این مدل ${points === 0 ? 'ثبتی نداریم' : `${formatCountOf(points, 'روز')} داریم`}.`,
      listed: 'ثبت‌های تا امروز',
    },
    none: {
      title: 'روندی برای این سال ساخت نداریم',
      body: 'آگهی ارزیابی‌شده‌ی این سال ساخت کافی نیست. سال ساخت دیگری را ببینید.',
    },
    error: {
      title: 'روند قیمت بارگذاری نشد',
    },
  },
  deals: {
    title: 'بهترین معامله‌های این مدل',
    titleOfYear: (year: number) => `بهترین معامله‌های ${modelYear(year)}`,
    lead: 'آگهی‌هایی که از ارزش بازار ارزان‌ترند.',
    seeAll: 'دیدن همه‌ی آگهی‌ها',
    empty: 'آگهی‌ای از این مدل برای نمایش نداریم.',
    error: {
      title: 'بهترین معامله‌ها بارگذاری نشد',
    },
  },
  ratings: {
    title: 'ارزیابی قیمت آگهی‌ها',
    lead: (count: number) => `سهم هر ارزیابی در ${formatCountOf(count, 'آگهی')} این مدل.`,
    unrated: 'بدون ارزیابی',
    chartLabel: 'تعداد آگهی‌ها در هر ارزیابی',
  },
  byYear: {
    title: 'قیمت هر سال ساخت',
    lead: 'میانه‌ی قیمت آگهی‌های هر سال ساخت.',
    columns: { year: 'سال ساخت', count: 'آگهی', median: 'میانه‌ی قیمت', mileage: 'کارکرد معمول' },
    current: 'سال انتخاب‌شده',
    open: (year: number) => `دیدن ${modelYear(year)}`,
  },
  trims: {
    title: 'تیپ‌ها',
    lead: 'تیپ، همان‌طور که در آگهی آمده است.',
    unnamed: 'تیپ نامشخص',
    columns: { name: 'تیپ', count: 'آگهی', median: 'میانه‌ی قیمت' },
    error: { title: 'تیپ‌ها بارگذاری نشد' },
  },
  facts: {
    title: 'آگهی‌ها چه می‌گویند',
    lead: (count: number) => `از ${formatCountOf(count, 'آگهی')} این مدل.`,
    paintFree: 'بدون رنگ‌شدگی',
    automatic: 'گیربکس اتوماتیک',
    privateSeller: 'فروشنده‌ی شخصی',
    of: (yes: number, of: number) =>
      `${formatCount(yes)} از ${formatCountOf(of, 'آگهی')} که درباره‌اش نوشته‌اند`,
    note: 'این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها. پیش از خرید، خودرو را کارشناسی کنید.',
  },
  empty: {
    title: 'الان آگهی‌ای از این مدل نداریم',
    body: 'وقتی آگهی تازه‌ای بیاید، قیمت و روند این مدل را همین‌جا می‌بینید.',
    action: 'دیدن آگهی‌های دیگر',
  },
  year: {
    emptyTitle: (year: number) => `آگهی‌ای از ${modelYear(year)} نداریم`,
    emptyAction: 'دیدن همه‌ی سال‌ها',
  },
  index: {
    title: 'مدل‌های خودرو',
    metaDescription:
      'قیمت و روند بازار هر مدل خودرو، از آگهی‌های امروز: ارزش بازار، محدوده‌ی قیمت و بهترین معامله‌ها.',
    lead: 'ارزش بازار، محدوده‌ی قیمت، روند و بهترین معامله‌های هر مدل.',
    popularTitle: 'مدل‌های پرطرفدار',
    popularLead: 'مدل‌هایی که بیشترین آگهی را دارند.',
    allTitle: 'همه‌ی مدل‌ها',
    makeCount: (models: number, listings: number) =>
      `${formatCountOf(models, 'مدل')}، ${formatCountOf(listings, 'آگهی')}`,
    empty: {
      title: 'هنوز مدلی با آگهی نداریم',
      body: 'وقتی آگهی تازه‌ای بیاید، مدل‌ها همین‌جا فهرست می‌شوند.',
    },
    error: { title: 'فهرست مدل‌ها بارگذاری نشد' },
    card: {
      sample: 'عکس نمونه',
      listings: (count: number) => formatCountOf(count, 'آگهی'),
      median: 'میانه‌ی قیمت',
    },
  },
  home: {
    title: 'مدل‌های پرطرفدار',
    lead: 'قیمت و روند هر مدل.',
    all: 'همه‌ی مدل‌ها',
  },
  loading: 'در حال بارگذاری اطلاعات مدل',
  retry: 'تلاش دوباره',
} as const;
