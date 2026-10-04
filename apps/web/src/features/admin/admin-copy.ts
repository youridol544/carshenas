import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import type {
  ChangeSourceStateStatus,
  ChosenCrawlState,
  CrawlState,
  StopReason,
} from '@/features/admin/admin-types';

// The superadmin section's Farsi words (CS-39, CS-40), shared by its pages, its form and their tests, so a test finds a
// control by the text people read and retyped Persian never drifts from it. Terms follow docs/product/glossary.md; the
// operating words (crawl, stop, queue) stay where the owner acts on them, the rest is the voice guide's (CS-109).

/** A crawled source's state. The badge says what holds now; why the crawler stopped it is on its own line. */
export const CRAWL_STATE_LABEL = {
  enabled: 'فعال',
  paused: 'متوقف',
  stopped_on_block: 'توقف خودکار',
} as const satisfies Record<CrawlState, string>;

/** The badge of a source that is not crawled (a partner API, a benchmark): it has no crawl to pause. */
export const NOT_CRAWLED_LABEL = 'بدون خزش';

export const STOP_REASON_LABEL = {
  blocked: 'سایت درخواست را رد کرد',
  challenge: 'سایت به‌جای پاسخ، آزمون ضدربات نشان داد',
  rate_limited: 'سایت در یک شبانه‌روز دو بار گفت درخواست‌ها زیاد است',
} as const satisfies Record<StopReason, string>;

// Said the same on the sources screen and on the worker screen: one sentence each, written once.
const NO_ANSWER = 'پاسخی نرسید. صفحه را تازه کنید.';
const INCOMPLETE_REQUEST = 'درخواست ناقص بود. صفحه را تازه کنید.';
const CRAWLER_STOPPED = 'خزنده این منبع را متوقف کرد';

export const SOURCES_COPY = {
  title: 'منبع‌ها',
  lead: 'خزش هر منبع را متوقف کنید یا از سر بگیرید. هر تغییر با نام شما و زمانش ثبت می‌شود.',
  backToDashboard: 'پنل مدیریت',
  empty: 'منبعی ثبت نشده است.',
  stopped: CRAWLER_STOPPED,
  stoppedAt: 'زمان توقف',
  stopReason: 'دلیل',
  stopAdvice:
    'پیش از ازسرگیری، درخواست ردشده را در صفحه‌ی کارگر ببینید. تا وقتی سایت درخواست‌ها را رد می‌کند، خزش را از سر نگیرید.',
  pause: 'توقف خزش',
  resume: 'ازسرگیری خزش',
  changes: 'تغییرهای اخیر',
  noChanges: 'تغییری ثبت نشده است.',
  /** «توقف خودکار از ۶ مهر ۱۴۰۵ ساعت ۱۶:۲۷ برداشته شد. دلیل: …»: the time is when the stop began. */
  clearedStopFrom: 'توقف خودکار از',
  clearedStopLifted: 'برداشته شد',
  noAnswer: 'پاسخی نرسید. شاید تغییر ثبت شده باشد.',
  showCurrentState: 'دیدن وضعیت تازه',
} as const;

/**
 * How a change reads in a source's history: the action the person took, named as its button is. The screen offers pause
 * and resume; a stop left paused comes from change_source_state() called by hand (docs/runbooks/worker.md).
 */
export const CHANGE_LABEL = {
  enabled: 'ازسرگیری خزش',
  paused: 'توقف خزش',
  keptPaused: 'توقف خزش پس از توقف خودکار',
} as const;

/**
 * The status line under a source's button once the section has answered. Each answer fits one line on a 320 px
 * phone, so the line reserved for it never grows and nothing below it moves.
 */
export const SOURCE_STATE_RESULT = {
  changed: { enabled: 'خزش از سر گرفته شد.', paused: 'خزش متوقف شد.' },
  unchanged: { enabled: 'خزش از قبل فعال است.', paused: 'خزش از قبل متوقف است.' },
  stale: 'وضعیت عوض شده بود. تغییری ثبت نشد.',
  not_crawled: 'این منبع خزش ندارد.',
  failed: NO_ANSWER,
  invalid: INCOMPLETE_REQUEST,
} as const satisfies {
  changed: Record<ChosenCrawlState, string>;
  unchanged: Record<ChosenCrawlState, string>;
} & Record<Exclude<ChangeSourceStateStatus, 'idle' | 'changed' | 'unchanged'>, string>;

// The worker screen (CS-41): the worker's heartbeat, its jobs, each source's crawl, listings in and out, and what went
// wrong at a source. Machine names (queues, job kinds, errors, trace ids) stay as the worker wrote them, isolated
// left to right.

export const WORKER_COPY = {
  title: 'کارگر و خط پردازش',
  lead: 'کار جاری کارگر و کارهایی که در بازه‌ی انتخاب‌شده انجام داده است. صفحه هر چند ثانیه خودش تازه می‌شود.',
  backToDashboard: 'پنل مدیریت',
  window: 'بازه',
  windows: {
    '1h': formatCountOf(1, 'ساعت'),
    '24h': formatCountOf(24, 'ساعت'),
    '7d': formatCountOf(7, 'روز'),
  },
  worker: 'کارگر',
  status: {
    alive: 'در حال کار',
    stopped: 'خاموش شد',
    silent: 'بی‌پاسخ',
    never: 'هرگز اجرا نشده',
  },
  statusAdvice: {
    alive: 'آخرین ضربان به‌تازگی رسیده است.',
    stopped: 'کارگر خودش خاموش شد و کاری برنمی‌دارد تا دوباره اجرا شود.',
    silent: 'ضربانی نرسیده است. کارگر را بررسی کنید.',
    never: 'هیچ کارگری ضربان نفرستاده است. کارگر را اجرا کنید.',
  },
  version: 'نسخه',
  runningSince: 'در حال کار از',
  stoppedAt: 'خاموش شده در',
  lastBeat: 'آخرین ضربان',
  processes: 'پردازه‌های اخیر کارگر',
  jobs: 'کارها',
  queue: 'صف',
  queuesCaption: 'کارهای هر صف، بر اساس وضعیت',
  noJobs: 'صف خالی است. کارگر هنوز کاری نفرستاده یا کارهای تمام‌شده پاک شده‌اند.',
  failures: 'خطاهای اخیر',
  noFailures: 'کار ناموفقی نیست.',
  attempt: 'تلاش',
  of: 'از',
  traceId: 'شناسه‌ی ردیابی',
  noTraceId: 'بدون شناسه‌ی ردیابی',
  retry: 'تلاش دوباره',
  cancel: 'لغو',
  cancelQuestion: 'این کار لغو شود؟ لغو را از این صفحه نمی‌شود برگرداند.',
  cancelConfirm: 'لغو کار',
  cancelKeep: 'انصراف',
  noMessage: 'پیامی ثبت نشده',
  cancelledHere: 'این کار به‌تازگی لغو شد.',
  newFailures: 'خطای تازه',
  internalQueue: 'این صف داخلی است و دستی تغییر نمی‌کند.',
  stoppedSummary: 'منبع با توقف خودکار',
  noStopped: 'توقف خودکاری در کار نیست.',
  seeProblems: 'دیدن مشکل‌ها',
  chartTable: 'جدول اندازه‌گیری‌های ساعتی',
  chartTime: 'زمان',
  tracked: 'مدل',
  flowsCaption: 'آگهی‌های منبع و هر مدل پوشش‌داده‌شده',
  deadLetters: 'کارهای رهاشده',
  deadLettersLead:
    'کارهایی که همه‌ی تلاش‌هایشان ناموفق بود یا داده‌شان خوانده نشد. در صف خودشان هم دیده می‌شوند.',
  noDeadLetters: 'کار رهاشده‌ای نیست.',
  fromQueue: 'از صف',
  jobChanges: 'تلاش‌های دوباره و لغوهای اخیر',
  noJobChanges: 'کسی کاری را دوباره نفرستاده یا لغو نکرده است.',
  retried: 'دوباره فرستاده شد',
  cancelled: 'لغو شد',
  crawl: 'خزش',
  budget: 'درخواست‌های امروز',
  budgetOf: 'از سقف روزانه‌ی',
  noBudget: 'بدون سقف روزانه',
  runs: 'اجراها در این بازه',
  noRuns: 'اجرایی نبوده است.',
  averageDuration: 'میانگین',
  runUnit: 'اجرا',
  outcomes: 'پاسخ‌ها در این بازه',
  recentRuns: 'اجراهای اخیر',
  running: 'در حال اجرا',
  listings: 'آگهی‌ها',
  wholeSource: 'همه‌ی آگهی‌های منبع',
  total: 'کل',
  active: 'فعال',
  added: 'تازه',
  changed: 'تغییر قیمت',
  gone: 'خارج از بازار',
  lastCheck: 'میانه‌ی زمان از آخرین بررسی',
  noActive: 'آگهی فعالی نیست',
  chart: 'آگهی‌های تازه و خارج‌شده، و میانه‌ی زمان از آخرین بررسی',
  chartLead: `هر نقطه یک اندازه‌گیری ساعتی است و ${formatCountOf(24, 'ساعت')} پیش از خودش را می‌شمارد.`,
  chartAdded: `تازه در ${formatCountOf(24, 'ساعت')}`,
  chartGone: `خارج‌شده در ${formatCountOf(24, 'ساعت')}`,
  chartAge: 'زمان از آخرین بررسی',
  noChart: 'اندازه‌گیری ساعتی‌ای در این بازه نیست.',
  problems: 'مشکل‌های منبع',
  stopped: CRAWLER_STOPPED,
  resumeOnSources: 'ازسرگیری در صفحه‌ی منبع‌ها',
  cooldown: 'وقفه‌ی خزش تا',
  cooldownReason: {
    unavailable: 'پاسخ‌ندادن‌های پی‌درپی',
    rate_limited: 'پاسخ «درخواست زیاد» با کد ۴۲۹',
  },
  rateLimitedAt: 'آخرین پاسخ «درخواست زیاد»',
  refused: 'درخواست‌های ردشده',
  noRefused: 'درخواست ردشده‌ای ثبت نشده است.',
  unparsed: 'مقدارهایی که خوانده نشدند',
  noUnparsed: 'همه‌ی مقدارها خوانده شده‌اند.',
  listingsWithIt: 'آگهی',
  noSources: 'منبعی برای خزش ثبت نشده است.',
  seconds: 'ثانیه',
  underASecond: 'کمتر از یک ثانیه',
  minutes: 'دقیقه',
  hours: 'ساعت',
  days: 'روز',
} as const;

export const JOB_STATE_LABEL = {
  created: 'در انتظار',
  retry: 'منتظر تلاش دوباره',
  active: 'در حال اجرا',
  completed: 'انجام‌شده',
  cancelled: 'لغوشده',
  failed: 'ناموفق',
} as const;

/** The dead-letter queue by what it holds. */
export const DEAD_LETTER_QUEUE_LABEL = 'کارهای رهاشده';

export const FETCH_OUTCOME_LABEL = {
  ok: 'پاسخ درست',
  not_modified: 'بدون تغییر',
  not_found: 'پیدا نشد',
  gone: 'برداشته‌شده',
  blocked: 'ردشده',
  rate_limited: 'درخواست زیاد',
  challenge: 'آزمون ضدربات',
  error: 'خطا',
} as const;

export const CRAWL_KIND_LABEL = {
  discovery: 'یافتن آگهی‌های تازه',
  detail: 'صفحه‌ی آگهی',
  measure: 'اندازه‌گیری',
  sweep: 'پیمایش فهرست',
  check: 'بررسی خروج از بازار',
  recheck: 'بررسی دوباره برای خریدار',
} as const;

export const RUN_STATUS_LABEL = {
  running: 'در حال اجرا',
  succeeded: 'موفق',
  failed: 'ناموفق',
  stopped_on_block: 'متوقف به‌خاطر رد درخواست',
} as const;

export const UNPARSED_FIELD_LABEL: Record<string, string> = {
  model_year: 'سال ساخت',
  mileage_km: 'کارکرد',
  fuel: 'سوخت',
  gearbox: 'گیربکس',
  insurance_months_left: 'مهلت بیمه',
  price: 'قیمت',
  accepts_swap: 'معاوضه',
  accepts_installments: 'اقساط',
  seller_type: 'نوع فروشنده',
  body_condition: 'وضعیت بدنه',
  engine_condition: 'وضعیت موتور',
  gearbox_condition: 'وضعیت گیربکس',
  chassis_condition: 'وضعیت شاسی',
  colour: 'رنگ',
};

/** The line under a job's button once the section has answered; one short line on a 320 px phone. */
export const JOB_STATE_RESULT = {
  changed: { retry: 'کار دوباره به صف رفت.', cancel: 'کار لغو شد.' },
  unchanged: { retry: 'کار از قبل منتظر تلاش دوباره است.', cancel: 'کار از قبل لغو شده است.' },
  stale: 'کار عوض شده بود. تغییری ثبت نشد.',
  failed: NO_ANSWER,
  invalid: INCOMPLETE_REQUEST,
} as const;

/** What a crawl run counted, by the names the worker gives its counts; a name not listed shows as the worker wrote it. */
export const RUN_COUNT_LABEL: Record<string, string> = {
  rows: 'ردیف خوانده‌شده',
  newListings: 'آگهی تازه',
  changedListings: 'آگهی تغییرکرده',
  lateListings: 'آگهی دیررس',
  detailsNew: 'جزئیات تازه',
  detailsChanged: 'جزئیات تغییرکرده',
  snapshotsStored: 'رونوشت ذخیره‌شده',
  snapshotsUnchanged: 'رونوشت بی‌تغییر',
  priceEvents: 'تغییر قیمت',
  attributesChanged: 'مشخصات تغییرکرده',
  photosChanged: 'عکس‌های تغییرکرده',
  photosSkipped: 'عکس ردشده',
  unparsedValues: 'مقدار خوانده‌نشده',
  unknownLabels: 'برچسب ناشناخته',
  unknownSections: 'بخش ناشناخته',
  sightings: 'دیده‌شدن',
  fresh: 'تازه‌خوانده',
  offMarket: 'خارج از بازار',
  notFound: 'پیدا نشد',
  notSent: 'فرستاده‌نشده',
  missingChecks: 'آگهی گم‌شده برای بررسی',
  missingHeld: 'آگهی گم‌شده‌ی معلق',
  slices: 'برش',
  slicesSplit: 'برش تقسیم‌شده',
  markedExpired: 'منقضی‌شده',
  measured: 'اندازه‌گیری‌شده',
  queued: 'در صف',
  requests: 'درخواست',
  pageLimit: 'رسیدن به سقف صفحه',
  priceUnread: 'قیمت خوانده‌نشده',
  postedAtUnread: 'زمان انتشار خوانده‌نشده',
  notACar: 'غیرخودرو',
  derivationsRefused: 'استخراج ردشده',
  roundsSkipped: 'دور تکراری',
  alreadyMeasured: 'پیش‌تر اندازه‌گیری‌شده',
  fields: 'فیلد',
};

/** The screen of every buyer's search files (CS-70): who handed which search to Karshenas, and what it finds now. */
export const SEARCH_FILES_ADMIN_COPY = {
  title: 'پرونده‌های جست‌وجو',
  lead: 'پرونده‌های همه‌ی خریداران. خریدار فقط با نام کاربری دیده می‌شود.',
  backToDashboard: 'پنل مدیریت',
  link: 'دیدن پرونده‌ها',
  linkBody: 'پرونده‌های همه‌ی خریداران، با تعداد آگهی‌های مطابق هر کدام.',
  empty: 'هیچ خریداری پرونده‌ای نساخته است.',
  buyer: 'خریدار',
  search: 'جست‌وجو',
  matches: 'آگهی مطابق',
  created: 'تاریخ ساخت',
  state: 'وضعیت',
  list: 'پرونده‌ها',
  unreadable: 'جست‌وجو خوانده نشد',
  countFailed: 'تعداد معلوم نشد',
  states: { watching: 'در حال پایش', paused: 'متوقف', closed: 'بسته' },
  totals: (files: number, buyers: number) =>
    `${formatCountOf(files, 'پرونده')} از ${formatCountOf(buyers, 'خریدار')}`,
  shownLatest: (shown: number, total: number) =>
    `${formatCount(shown)} پرونده‌ی تازه‌تر از ${formatCount(total)} نشان داده شد.`,
  matchesOf: (count: number, exact: boolean) => (exact ? formatCount(count) : `بیش از ${formatCount(count)}`),
  newOf: (count: number) => `${formatCountOf(count, 'آگهی')} تازه`,
  matching: {
    heading: 'پایش پرونده‌ها',
    lead: 'هر چند دقیقه، آگهی‌های تازه و قیمت‌های کم‌شده با پرونده‌های در حال پایش سنجیده می‌شوند. پرونده‌ای که خبر تازه دارد یک اعلان می‌گیرد.',
    empty: 'اجرایی ثبت نشده است. وقتی کارگر روشن باشد، اجرای بعدی اینجا می‌آید.',
    notified: (count: number) => `${formatCountOf(count, 'اعلان')} فرستاده شد`,
    read: (files: number, listings: number, drops: number) =>
      `${formatCountOf(files, 'پرونده')}، ${formatCountOf(listings, 'آگهی تازه')}، ${formatCountOf(drops, 'کاهش قیمت')}`,
    deferred: (count: number) => `${formatCountOf(count, 'پرونده')} به بعد موکول شد`,
    took: (milliseconds: number) =>
      milliseconds < 1000
        ? `${formatCount(milliseconds)} میلی‌ثانیه`
        : `${formatCount(Math.round(milliseconds / 100) / 10)} ثانیه`,
  },
  fileRequests: 'درخواست‌های جست‌وجوی بیشتر',
} as const;
