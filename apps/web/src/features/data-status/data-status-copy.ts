import type { TargetKey } from '@/features/data-status/data-status-rules';
import type { UpdateState } from '@/features/data-status/data-status-types';

// The data-status page's Farsi words (CS-66), shared by the page, its components and their tests, so a test finds a
// region by the text people read and retyped Persian never drifts from it. Terms follow docs/product/glossary.md:
// آگهی، منبع، ارزش بازار، خودروی مشابه، آخرین بررسی، مدل پوشش‌داده‌شده. Every number is put in by a formatter.

export const STATUS_COPY = {
  title: 'تازگی داده‌ها',
  lead: 'ببینید آگهی‌ها چقدر تازه‌اند و ارزش بازار چقدر دقیق است.',
  loading: 'در حال بارگذاری وضعیت داده‌ها…',

  measuredAt: 'زمان این گزارش:',
  lastRead: 'آخرین داده‌ها از',
  latestData: 'آخرین داده‌ها از',
  noData: 'هنوز آگهی‌ای نداریم.',
  indexSince: 'جمع‌آوری آگهی‌ها از',

  active: 'آگهی فعال',
  activeHint: 'اکنون روی بازار',
  posted: 'آگهی تازه',
  postedHint: (window: string) => `در ${window} گذشته`,
  gone: 'رفته از بازار',
  goneHint: (window: string) => `در ${window} گذشته`,
  checkAge: 'زمان از آخرین بررسی',
  checkAgeHint: 'میانه‌ی آگهی‌های نتایج جست‌وجو',
  noShown: 'آگهی‌ای در نتایج نیست',

  targetsTitle: 'هدف‌های تازگی',
  targetsLead: 'هر ساعت می‌سنجیم که به این هدف‌ها رسیده‌ایم یا نه.',
  shownOfTracked: (window: string) =>
    `آگهی فعال مدل‌هایی که کامل می‌خوانیم، در ${window} گذشته دیده یا بررسی شده‌اند.`,

  sourcesTitle: 'منبع‌ها',
  sourceLastRead: 'آخرین خواندن',
  sourceActive: 'آگهی فعال',
  sourcePosted: (window: string) => `تازه در ${window} گذشته`,
  sourceGone: (window: string) => `رفته از بازار در ${window} گذشته`,
  sourceCheckAge: 'میانه‌ی زمان از آخرین بررسی',
  /** «دیوار به‌روز نمی‌شود. آخرین داده‌هایش از ۹ مهر ۱۴۰۵ ساعت ۲۳:۳۹ است.». */
  sourceNotUpdating: {
    before: 'به‌روز نمی‌شود. آخرین داده‌هایش از',
    after: 'است.',
  },
  sourceDelayed: { before: 'با تأخیر به‌روز می‌شود. آخرین داده‌هایش از', after: 'است.' },
  noSources: 'هنوز منبعی نداریم.',
  chartTitle: 'میانه‌ی زمان از آخرین بررسی، ساعت به ساعت',
  chartLead: (window: string) => `در همه‌ی آگهی‌های فعال این منبع، در ${window} گذشته.`,
  chartLeadSince: 'در همه‌ی آگهی‌های فعال این منبع، از نخستین اندازه‌گیری تا اکنون.',
  chartAgo: (age: string) => `${age} پیش`,
  chartNow: 'اکنون',
  chartTarget: 'خط‌چین: هدف نتایج جست‌وجو، کمتر از یک روز',
  chartTable: 'عددهای نمودار',
  chartTime: 'ساعت',
  chartAge: 'میانه',
  chartActive: 'آگهی فعال',
  noChart: (window: string) => `در ${window} گذشته اندازه‌گیری‌ای ثبت نشده است.`,

  valuationTitle: 'ارزش بازار',
  valuationLead:
    'ارزش بازار هر خودرو از روی خودروهای مشابه حساب می‌شود. ارزیابی قیمت هم از مقایسه‌ی قیمت آگهی با همین ارزش می‌آید.',
  valuationDate: 'ارزش‌های بازار برای',
  valued: 'آگهی ارزش‌گذاری‌شده',
  rated: 'آگهی ارزیابی‌شده',
  comparables: 'خودروی مشابه',
  accuracyTitle: 'دقت ارزش بازار، مدل به مدل',
  accuracyLead:
    'عدد هر مدل نشان می‌دهد ارزش بازار معمولاً چقدر با قیمت آگهی‌ها فرق دارد. هر چه کمتر، دقیق‌تر.',
  accuracyRangeFrom: 'فرق معمول از',
  accuracyRangeTo: 'تا',
  accuracyRangeEnd: '، بسته به مدل.',
  accuracyScale: 'فرق معمول',
  modelComparables: 'خودروی مشابه',
  noValuation: 'ارزش بازار هنوز حساب نشده است.',

  extractionTitle: 'خواندن متن آگهی‌ها',
  extractionLead: 'رنگ‌شدگی، قطعه‌ی تعویضی، وضعیت شاسی و توافقی یا قسطی بودن قیمت را از متن می‌خوانیم.',
  fieldsRight: 'مورد درست خوانده شد',
  itemsRight: 'آگهی بدون خطا',
  of: 'از',
  extractionOn: 'مقایسه با بررسی دستی آگهی‌ها در',
  noExtraction: 'هنوز اندازه‌گیری‌ای نداریم.',

  howTitle: 'آگهی‌ها چطور تازه می‌مانند',
  errorTitle: 'وضعیت داده‌ها بارگذاری نشد',
  retry: 'تلاش دوباره',
} as const;

/** The whole index's state, as a sentence. */
export const INDEX_STATE_HEADLINE = {
  live: 'آگهی‌ها پیوسته از منبع تازه می‌شوند',
  delayed: 'تازه شدن آگهی‌ها کمی عقب است',
  not_updating: 'آگهی تازه‌ای نمی‌رسد',
} as const satisfies Record<UpdateState, string>;

/** A source's state, as its badge. */
export const SOURCE_STATE_LABEL = {
  live: 'به‌روز',
  delayed: 'با تأخیر',
  not_updating: 'به‌روز نمی‌شود',
} as const satisfies Record<UpdateState, string>;

export const TARGET_COPY = {
  newListing: {
    title: 'آگهی تازه در کمتر از یک ساعت',
    body: () => 'از انتشار آگهی در منبع تا رسیدنش به ما، میانه:',
  },
  resultsMedian: {
    title: 'نتایج جست‌وجو تازه‌تر از یک روز',
    body: (window: string) =>
      `نتایج فقط آگهی‌هایی را نشان می‌دهند که در ${window} گذشته دیده یا بررسی شده‌اند. میانه‌ی زمان از آخرین بررسی‌شان:`,
  },
  valuationDaily: {
    title: 'ارزش بازار هر روز از نو حساب می‌شود',
    body: () => 'آخرین محاسبه:',
  },
} as const satisfies Record<TargetKey, { title: string; body: (window: string) => string }>;

export const TARGET_STATUS_LABEL = {
  met: 'به هدف رسیده',
  missed: 'به هدف نرسیده',
  unmeasured: 'اندازه‌گیری نشده',
} as const;

/** How the index is kept (ADR-0017 points 3, 5, 8 and 9), in the order a listing meets them. */
export const HOW_STEPS = [
  {
    key: 'discover',
    title: 'پیدا کردن آگهی‌های تازه',
    body: 'فهرست آگهی‌های هر منبع چند بار در هر ساعت خوانده می‌شود تا آگهی تازه زود برسد.',
  },
  {
    key: 'check',
    title: 'بررسی دوباره',
    body: 'آگهی‌ای که باز می‌کنید، اگر چند ساعت از آخرین بررسی‌اش گذشته باشد، دوباره بررسی می‌شود.',
  },
] as const;
