import { formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { toPersianDigits } from '@carshenas/locale/digits';
import {
  BAND_HIGH_FRACTION,
  BAND_LOW_FRACTION,
  RANGE_HIGH_FRACTION,
  RANGE_LOW_FRACTION,
  TREND_MIN_LISTINGS,
  TREND_MIN_POINTS,
} from '@/features/model/model-rules';

// Every word of the model page and the models index (CS-67), Farsi, in one place. Numbers come from the locale
// formatters and from the constants of model-rules.ts, so a sentence cannot state a number the query does not use.

const NO_BREAK_SPACE = ' ';

/** «مدل ۱۴۰۰»: a model year, with the word tied to it. */
export const modelYear = (year: number) => `مدل${NO_BREAK_SPACE}${toPersianDigits(String(year))}`;

export const MODEL_COPY = {
  siteTitle: 'کارشناس',
  title: (name: string) => `${name}، قیمت و روند بازار`,
  description: (name: string) =>
    `ارزش بازار، محدوده‌ی قیمت و روند قیمت ${name} از آگهی‌های امروز، با بهترین معامله‌های این مدل.`,
  notFoundTitle: 'این مدل پیدا نشد',
  notFoundBody:
    'نشانی این مدل در فهرست خودروهای کارشناس نیست. از فهرست مدل‌ها یکی را انتخاب کنید یا در جست‌وجو بنویسید.',
  allModels: 'فهرست مدل‌ها',
  searchInstead: 'جست‌وجوی خودرو',
  breadcrumb: { label: 'مسیر صفحه', home: 'خانه', models: 'مدل‌ها' },
  hero: {
    listings: (count: number) => `${formatCountOf(count, 'آگهی')} در بازار`,
    years: (first: number, last: number) =>
      first === last ? modelYear(first) : `مدل ${toPersianDigits(String(first))} تا ${toPersianDigits(String(last))}`,
    popular: 'مدل پرطرفدار',
    seeAll: (count: number) => `دیدن ${formatCountOf(count, 'آگهی')}`,
    seeAllOfYear: (count: number, year: number) => `دیدن ${formatCountOf(count, 'آگهی')} ${modelYear(year)}`,
    photoCaption: (bodyType: string) => `عکس نمونه از بدنه‌ی ${bodyType}؛ خودروی همین مدل نیست`,
    photoNote: 'عکس‌ها از آگهی‌های هر خودرو در صفحه‌ی خودش دیده می‌شود.',
  },
  stats: {
    label: 'قیمت این مدل امروز',
    median: 'میانه‌ی قیمت آگهی‌ها',
    medianHelp: 'نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از آن هستند.',
    range: 'محدوده‌ی قیمت',
    rangeHelp: (count: number) => `${formatPercent(RANGE_HIGH_FRACTION - RANGE_LOW_FRACTION)} میانیِ ${formatCountOf(count, 'آگهی')}`,
    value: 'ارزش بازار',
    valueHelp: (date: string) => `میانه‌ی ارزش خودروهای آگهی‌شده، تا ${date}`,
    mileage: 'کارکرد معمول',
    mileageHelp: 'میانه‌ی کارکرد اعلام‌شده',
    none: 'بدون قیمت',
  },
  info: {
    close: 'بستن',
    rangeLabel: 'توضیح درباره‌ی محدوده‌ی قیمت',
    valueLabel: 'توضیح درباره‌ی ارزش بازار',
    trendLabel: 'توضیح درباره‌ی روند قیمت',
    ratingsLabel: 'توضیح درباره‌ی ارزیابی آگهی‌ها',
    dealsLabel: 'توضیح درباره‌ی ترتیب بهترین معامله‌ها',
    popularLabel: 'توضیح درباره‌ی مدل پرطرفدار',
    factsLabel: 'توضیح درباره‌ی نکته‌های آگهی‌ها',
    yearsLabel: 'توضیح درباره‌ی قیمت به تفکیک سال',
  },
  years: {
    label: 'سال ساخت',
    all: 'همه‌ی سال‌ها',
    navLabel: 'نمایش بر پایه‌ی سال ساخت',
    pick: 'برای دیدن فقط یک سال ساخت، آن را انتخاب کنید.',
    chip: (year: number, count: number) => `${toPersianDigits(String(year))} (${formatCountOf(count, 'آگهی')})`,
  },
  trend: {
    title: 'روند قیمت',
    cohort: (year: number) => `آگهی‌های ${modelYear(year)}`,
    cohortNote: (year: number) => `روند برای ${modelYear(year)} حساب شده، چون بیشترین آگهی را دارد. سال دیگری را بالا انتخاب کنید.`,
    median: 'میانه‌ی قیمت آگهی‌ها',
    latest: (date: string) => `در ${date}`,
    band: `${formatPercent(BAND_HIGH_FRACTION - BAND_LOW_FRACTION)} میانی`,
    legendLine: 'میانه‌ی قیمت آگهی‌ها',
    legendBand: `${formatPercent(BAND_HIGH_FRACTION - BAND_LOW_FRACTION)} میانیِ قیمت‌ها`,
    daily: 'هر نقطه یک روز است.',
    weekly: 'هر نقطه یک هفته است (آخرین روزِ هفته که ارزیابی شده).',
    sinceDay: (date: string) => `تاریخچه از ${date} است.`,
    chartLabel: (cohort: string, from: string, to: string, first: string, last: string) =>
      `نمودار میانه‌ی قیمت آگهی‌های ${cohort}، از ${from} تا ${to}: از ${first} به ${last}`,
    chartTitle: 'نمودار میانه‌ی قیمت آگهی‌ها به تفکیک روز',
    yAxis: 'محور عمودی: قیمت به تومان',
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
      label: 'تغییر میانه‌ی قیمت',
      over: (days: number) => `نسبت به ${formatCountOf(days, 'روز')} پیش`,
      flat: 'تقریباً بدون تغییر',
      rise: 'گران‌تر شده',
      fall: 'ارزان‌تر شده',
      notYet: (days: number) => `برای ${formatCountOf(days, 'روز')} پیش هنوز تاریخچه نداریم`,
    },
    short: {
      title: 'تاریخچه‌ی قیمت هنوز کوتاه است',
      body: (points: number) =>
        `کارشناس قیمت هر مدل را هر روز ثبت می‌کند و روند فقط از ثبت‌های خودش ساخته می‌شود، نه از حدس. برای رسم نمودار دست‌کم ${formatCountOf(TREND_MIN_POINTS, 'روز')} ثبت لازم است؛ برای این مدل ${points === 0 ? 'هنوز ثبتی نداریم' : `${formatCountOf(points, 'روز')} داریم`}.`,
      listed: 'ثبت‌های تا امروز',
    },
    none: {
      title: 'برای این سال ساخت هنوز روندی نداریم',
      body: `برای هر روز دست‌کم ${formatCountOf(TREND_MIN_LISTINGS, 'آگهی')} ارزیابی‌شده از این سال ساخت لازم است تا میانه‌ی قیمتش درست باشد. با آگهی‌های بیشتر یا سال ساخت دیگر دوباره نگاه کنید.`,
    },
    error: {
      title: 'روند قیمت خوانده نشد',
      body: 'خواندن تاریخچه‌ی قیمت به مشکل خورد. صفحه را دوباره باز کنید.',
    },
  },
  deals: {
    title: 'بهترین معامله‌های این مدل',
    titleOfYear: (year: number) => `بهترین معامله‌های ${modelYear(year)}`,
    lead: 'ارزان‌تر از ارزش بازار، از همین مدل؛ هر آگهی با قیمت و ارزیابی خودش.',
    seeAll: 'دیدن همه‌ی آگهی‌ها',
    empty: 'آگهی‌ای از این مدل برای نمایش نداریم.',
    error: { title: 'بهترین معامله‌ها خوانده نشد', body: 'خواندن آگهی‌ها به مشکل خورد. صفحه را دوباره باز کنید.' },
  },
  ratings: {
    title: 'ارزیابی قیمت آگهی‌ها',
    lead: (count: number) => `ارزیابی ${formatCountOf(count, 'آگهی')} این مدل نسبت به ارزش بازار`,
    unrated: 'بدون ارزیابی',
    label: (name: string, count: number) => `${name}: ${formatCountOf(count, 'آگهی')}`,
    chartLabel: 'سهم هر ارزیابی از آگهی‌های این مدل',
  },
  byYear: {
    title: 'قیمت به تفکیک سال ساخت',
    lead: 'میانه‌ی قیمت آگهی‌ها در هر سال ساخت؛ برای دیدن آن سال انتخابش کنید.',
    columns: { year: 'سال ساخت', count: 'آگهی', median: 'میانه‌ی قیمت', mileage: 'کارکرد معمول' },
    current: 'سال انتخاب‌شده',
    open: (year: number) => `دیدن ${modelYear(year)}`,
  },
  trims: {
    title: 'تیپ‌ها',
    lead: 'آگهی‌هایی که تیپ را نوشته‌اند یا از متن آگهی خوانده شده.',
    unnamed: 'تیپ نامشخص',
    columns: { name: 'تیپ', count: 'آگهی', median: 'میانه‌ی قیمت' },
  },
  facts: {
    title: 'آگهی‌ها چه می‌گویند',
    lead: (count: number) => `از ${formatCountOf(count, 'آگهی')} این مدل؛ فقط آنچه آگهی‌ها نوشته‌اند`,
    paintFree: 'بدون رنگ‌شدگی',
    automatic: 'گیربکس اتوماتیک',
    privateSeller: 'فروشنده‌ی شخصی',
    of: (yes: number, of: number) => `${formatCountOf(yes, 'آگهی')} از ${formatCountOf(of, 'آگهی')} که این را نوشته‌اند`,
    note: 'این‌ها شمارش آگهی‌هاست، نه وضعیت واقعی خودروها؛ پیش از خرید خودرو را کارشناسی کنید.',
  },
  empty: {
    title: 'الان آگهی‌ای از این مدل نداریم',
    body: 'آگهی‌های این مدل از بازار رفته‌اند یا هنوز خوانده نشده‌اند. وقتی آگهی تازه بیاید، قیمت و روندش همین‌جا دیده می‌شود.',
    action: 'دیدن آگهی‌های دیگر',
  },
  year: {
    emptyTitle: (year: number) => `آگهی‌ای از ${modelYear(year)} نداریم`,
    emptyBody: 'این سال ساخت الان آگهی ندارد. همه‌ی سال‌ها را ببینید.',
    emptyAction: 'همه‌ی سال‌ها',
  },
  index: {
    title: 'مدل‌های خودرو',
    metaDescription: 'قیمت و روند بازار هر مدل خودرو، از آگهی‌های امروز: ارزش بازار، محدوده‌ی قیمت و بهترین معامله‌ها.',
    lead: 'هر مدل یک صفحه دارد: ارزش بازار، محدوده‌ی قیمت، روند قیمت و بهترین معامله‌های همان مدل.',
    popularTitle: 'مدل‌های پرطرفدار',
    popularLead: 'مدل‌هایی که بیشترین آگهی را دارند.',
    allTitle: 'همه‌ی مدل‌ها به تفکیک سازنده',
    makeCount: (models: number, listings: number) =>
      `${formatCountOf(models, 'مدل')} · ${formatCountOf(listings, 'آگهی')}`,
    empty: {
      title: 'هنوز مدلی با آگهی نداریم',
      body: 'وقتی آگهی‌ها خوانده شوند، مدل‌ها همین‌جا فهرست می‌شوند.',
    },
    error: { title: 'فهرست مدل‌ها خوانده نشد', body: 'خواندن فهرست به مشکل خورد. صفحه را دوباره باز کنید.' },
    card: {
      listings: (count: number) => formatCountOf(count, 'آگهی'),
      median: 'میانه‌ی قیمت',
    },
  },
  home: {
    title: 'مدل‌های پرطرفدار',
    lead: 'قیمت و روند هر مدل: ارزش بازار، محدوده‌ی قیمت و بهترین معامله‌ها.',
    all: 'همه‌ی مدل‌ها',
    openModel: (name: string) => `صفحه‌ی ${name}`,
  },
  links: {
    modelPage: 'صفحه‌ی مدل',
    modelPageOf: (name: string) => `صفحه‌ی مدل ${name}: قیمت و روند`,
    restOfModel: 'بقیه‌ی آگهی‌های این مدل',
    modelPageFor: (name: string) => `روند قیمت ${name}`,
  },
  loading: 'در حال بارگذاری اطلاعات مدل',
  retry: 'دوباره امتحان کنید',
} as const;
