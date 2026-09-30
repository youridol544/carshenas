import type { TargetKey } from '@/features/data-status/data-status-rules';
import type { UpdateState } from '@/features/data-status/data-status-types';

// The data-status page's Farsi words (CS-66), shared by the page, its components and their tests, so a test finds a
// region by the text people read and retyped Persian never drifts from it. Terms follow docs/product/glossary.md:
// آگهی، منبع، ارزش بازار، خودروی مشابه، آخرین بررسی، مدل پوشش‌داده‌شده. Every number is put in by a formatter.

export const STATUS_COPY = {
  title: 'تازگی داده‌ها',
  lead: 'کارشناس آگهی‌ها را خودش از سایت‌های آگهی می‌خواند و نگه می‌دارد؛ جست‌وجوی شما هیچ درخواستی به آن سایت‌ها نمی‌فرستد. این صفحه نشان می‌دهد این داده‌ها چقدر تازه و ارزش‌های بازار چقدر دقیق‌اند.',
  leadNumbers: 'همه‌ی عددهای این صفحه از پایگاه داده‌ی کارشناس خوانده می‌شوند و هر دقیقه تازه می‌شوند.',
  loading: 'در حال خواندن وضعیت داده‌ها…',

  measuredAt: 'زمان این گزارش:',
  lastRead: 'آخرین خواندن از منبع‌ها',
  latestData: 'آخرین داده‌ها از',
  noData: 'هنوز آگهی‌ای خوانده نشده است.',
  indexSince: 'جمع‌آوری آگهی‌ها از',

  active: 'آگهی فعال',
  activeHint: 'اکنون روی بازار',
  posted: 'آگهی تازه',
  postedHint: (window: string) => `در ${window} گذشته`,
  gone: 'رفته از بازار',
  goneHint: (window: string) => `در ${window} گذشته`,
  checkAge: 'زمان از آخرین بررسی',
  checkAgeHint: 'میانه، در نتایج جست‌وجو',
  noShown: 'آگهی‌ای در نتایج نیست',

  targetsTitle: 'تعهدهای تازگی',
  targetsLead: 'کارشناس این سه تعهد را داده است و هر ساعت اندازه می‌گیرد که به آن‌ها رسیده یا نه.',
  shownOfTracked: (window: string) =>
    `آگهیِ فعالِ مدل‌های پوشش‌داده‌شده در ${window} گذشته دیده یا بررسی شده‌اند و در نتایج می‌آیند.`,

  sourcesTitle: 'منبع‌ها',
  sourceLastRead: 'آخرین خواندن',
  sourceActive: 'آگهی فعال',
  sourcePosted: (window: string) => `تازه در ${window} گذشته`,
  sourceGone: (window: string) => `رفته از بازار در ${window} گذشته`,
  sourceCheckAge: 'میانه‌ی زمان از آخرین بررسی',
  sourceBudget: 'سقف درخواست روزانه',
  /** «دیوار فعلاً به‌روز نمی‌شود؛ آخرین داده‌هایش از ۹ مهر ۱۴۰۵ ساعت ۲۳:۳۹ است و …». */
  sourceNotUpdating: {
    before: 'فعلاً به‌روز نمی‌شود؛ آخرین داده‌هایش از',
    after: 'است و آگهی‌هایش با همین تاریخ نشان داده می‌شوند.',
  },
  sourceDelayed: { before: 'با تأخیر به‌روز می‌شود؛ آخرین داده‌هایش از', after: 'است.' },
  noSources: 'هنوز منبعی خوانده نمی‌شود.',
  chartTitle: 'میانه‌ی زمان از آخرین بررسی، ساعت به ساعت',
  chartLead: (window: string) => `در همه‌ی آگهی‌های فعال این منبع، در ${window} گذشته.`,
  chartTable: 'عددهای نمودار',
  chartTime: 'ساعت',
  chartAge: 'میانه',
  chartActive: 'آگهی فعال',
  noChart: (window: string) => `در ${window} گذشته اندازه‌گیری ساعتی‌ای ثبت نشده است.`,

  valuationTitle: 'ارزش بازار',
  valuationLead:
    'ارزش بازار هر خودرو هر روز از خودروهای مشابه همان روز حساب می‌شود و ارزیابی قیمت هر آگهی از مقایسه‌ی قیمتش با این ارزش می‌آید.',
  valuationDate: 'ارزش‌های بازار برای',
  valued: 'آگهی ارزش‌گذاری شد',
  rated: 'آگهی ارزیابی قیمت گرفت',
  comparables: 'خودروی مشابه',
  accuracyTitle: 'دقت ارزش بازار، مدل به مدل',
  accuracyLead:
    'هر خودروی مشابه یک بار بدون خودش ارزش‌گذاری شد و ارزشش با قیمت آگهی‌اش مقایسه شد. عدد هر مدل خطای میانه است: نیمی از ارزش‌ها کمتر از این با قیمت آگهی فاصله داشتند.',
  accuracyRangeFrom: 'خطای میانه از',
  accuracyRangeTo: 'تا',
  accuracyRangeEnd: '، بسته به مدل.',
  modelComparables: 'خودروی مشابه',
  noValuation: 'هنوز ارزش بازاری حساب نشده است.',

  extractionTitle: 'خواندن متن آگهی‌ها',
  extractionLead:
    'هوش مصنوعی از متن آگهی فقط واقعیت‌ها را برمی‌دارد: رنگ‌شدگی، قطعه‌ی تعویضی، شاسی، توافقی یا اقساطی بودن قیمت. هر عددی که می‌بینید از پایگاه داده است، نه از متن مدل.',
  fieldsRight: 'واقعیت درست خوانده شد',
  itemsRight: 'آگهی بی هیچ خطا',
  injectedHeld: 'آگهیِ دارای دستور پنهان برای هوش مصنوعی، برای بازبینی انسانی کنار گذاشته شد',
  of: 'از',
  extractionOn: 'ارزیابی روی آگهی‌های برچسب‌خورده‌ای که در نوشتن دستورها دیده نشده بودند،',
  noExtraction: 'هنوز ارزیابی‌ای منتشر نشده است.',

  howTitle: 'آگهی‌ها چطور تازه می‌مانند',
  errorTitle: 'وضعیت داده‌ها خوانده نشد',
  errorBody: 'پایگاه داده پاسخ نداد. کمی بعد دوباره امتحان کنید.',
  retry: 'تلاش دوباره',
} as const;

/** The whole index's state, as a sentence. */
export const INDEX_STATE_HEADLINE = {
  live: 'آگهی‌ها زنده به‌روز می‌شوند',
  delayed: 'به‌روزرسانی آگهی‌ها عقب افتاده است',
  not_updating: 'آگهی‌ها فعلاً به‌روز نمی‌شوند',
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
    body: () => 'از انتشار آگهی در منبع تا رسیدنش به کارشناس، میانه:',
  },
  resultsMedian: {
    title: 'نتایج جست‌وجو تازه‌تر از یک روز',
    body: (window: string) =>
      `نتایج فقط آگهی‌هایی را نشان می‌دهند که در ${window} گذشته دیده یا بررسی شده‌اند. میانه‌ی زمان از آخرین بررسی‌شان:`,
  },
  valuationDaily: {
    title: 'ارزش بازار هر روز از نو',
    body: () => 'روز آخرین محاسبه:',
  },
} as const satisfies Record<TargetKey, { title: string; body: (window: string) => string }>;

export const TARGET_STATUS_LABEL = {
  met: 'برآورده',
  missed: 'هنوز نه',
  unmeasured: 'اندازه‌گیری نشده',
} as const;

/** How the index is kept (ADR-0017 points 3, 5, 8 and 9), in the order a listing meets them. */
export const HOW_STEPS = [
  {
    key: 'discover',
    title: 'پیدا کردن آگهی‌های تازه',
    body: 'فهرست آگهی‌های هر منبع، از تازه‌ترین، چند بار در هر ساعت خوانده می‌شود تا آگهی تازه زود برسد.',
  },
  {
    key: 'sweep',
    title: 'مرور همه‌ی بازار',
    body: 'آگهی‌های مدل‌های پوشش‌داده‌شده هر روز و بقیه‌ی بازار هر هفته از روی فهرست‌ها مرور می‌شوند: قیمت‌های تازه ثبت و آگهی‌های رفته از بازار پیدا می‌شوند.',
  },
  {
    key: 'check',
    title: 'بررسی هر آگهی',
    body: 'صفحه‌ی هر آگهیِ تازه یا تغییرکرده خوانده می‌شود، و آگهی‌ای که باز می‌کنید اگر چند ساعت از آخرین بررسی‌اش گذشته باشد دوباره بررسی می‌شود.',
  },
  {
    key: 'polite',
    title: 'خواندن با ملاحظه',
    body: 'هر منبع سقف درخواست روزانه دارد و درخواست‌ها با فاصله فرستاده می‌شوند. اگر منبعی درخواست‌ها را رد کند، خواندنش متوقف می‌شود و آگهی‌هایش با تاریخ آخرین داده‌ها می‌مانند.',
  },
  {
    key: 'value',
    title: 'ارزش بازار روزانه',
    body: 'هر روز ارزش بازار هر خودرو از خودروهای مشابه همان روز از نو حساب می‌شود و همیشه با تاریخش نشان داده می‌شود.',
  },
] as const;
