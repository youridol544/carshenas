import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import type {
  ChangeSourceStateStatus,
  ChosenCrawlState,
  CrawlState,
  StopReason,
} from '@/features/admin/admin-types';

// The superadmin section's Farsi words (CS-39, CS-40), shared by its pages, its form and their tests, so a test finds a
// control by the text people read and retyped Persian never drifts from it. Terms follow docs/product/glossary.md.

/** A crawled source's state. The badge says what holds now; why the crawler stopped it is on its own line. */
export const CRAWL_STATE_LABEL = {
  enabled: 'فعال',
  paused: 'متوقف',
  stopped_on_block: 'متوقف به دست خزنده',
} as const satisfies Record<CrawlState, string>;

/** The badge of a source that is not crawled (a partner API, a benchmark): it has no crawl to pause. */
export const NOT_CRAWLED_LABEL = 'خزیده نمی‌شود';

export const STOP_REASON_LABEL = {
  blocked: 'سایت درخواست را رد کرد',
  challenge: 'سایت به‌جای پاسخ، صفحه‌ی آزمون ضدربات نشان داد',
  rate_limited: 'سایت در یک شبانه‌روز دو بار گفت درخواست‌ها زیاد است',
} as const satisfies Record<StopReason, string>;

export const SOURCES_COPY = {
  title: 'منبع‌ها',
  lead: 'خزش هر منبع را این‌جا متوقف کنید یا از سر بگیرید. هر تغییر با نام کاربری شما و زمانش ثبت می‌شود.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  empty: 'هنوز منبعی ثبت نشده است؛ هر منبع همراه خزنده‌ی خودش افزوده می‌شود.',
  stopped: 'خزنده این منبع را متوقف کرد',
  stoppedAt: 'زمان توقف',
  stopReason: 'دلیل',
  stopAdvice:
    'پیش از ازسرگیری، درخواست ردشده را در گزارش کارگر بخوانید. اگر سایت هنوز ما را مسدود می‌کند، خزش را متوقف نگه دارید.',
  pause: 'توقف خزش',
  resume: 'ازسرگیری خزش',
  changes: 'تغییرهای اخیر',
  noChanges: 'هنوز کسی وضعیت این منبع را تغییر نداده است.',
  /** «توقف خزنده از ۶ مهر ۱۴۰۵ ساعت ۱۶:۲۷ برداشته شد؛ …»: the time is when the stop began. */
  clearedStopFrom: 'توقف خزنده از',
  clearedStopLifted: 'برداشته شد',
  noAnswer: 'پاسخی نرسید؛ شاید تغییر ثبت شده باشد.',
  showCurrentState: 'دیدن وضعیت تازه',
} as const;

/**
 * How a change reads in a source's history: what the person did. The screen offers pause and resume; a stop left
 * paused comes from change_source_state() called by hand (docs/runbooks/worker.md).
 */
export const CHANGE_LABEL = {
  enabled: 'خزش از سر گرفته شد',
  paused: 'خزش متوقف شد',
  keptPaused: 'توقف پذیرفته شد و خزش متوقف ماند',
} as const;

/**
 * The status line under a source's button once the section has answered. Each answer fits one line on a 320 px
 * phone, so the line reserved for it never grows and nothing below it moves.
 */
export const SOURCE_STATE_RESULT = {
  changed: { enabled: 'خزش از سر گرفته شد.', paused: 'خزش متوقف شد.' },
  unchanged: { enabled: 'خزش همین حالا هم فعال است.', paused: 'خزش همین حالا هم متوقف است.' },
  stale: 'وضعیت عوض شده بود؛ چیزی تغییر نکرد.',
  not_crawled: 'این منبع خزیده نمی‌شود.',
  failed: 'پاسخی نرسید؛ وضعیت تازه را ببینید.',
  invalid: 'درخواست ناقص رسید؛ صفحه را تازه کنید.',
} as const satisfies {
  changed: Record<ChosenCrawlState, string>;
  unchanged: Record<ChosenCrawlState, string>;
} & Record<Exclude<ChangeSourceStateStatus, 'idle' | 'changed' | 'unchanged'>, string>;

// The worker screen (CS-41): the worker's heartbeat, its jobs, each source's crawl, listings in and out, and what went
// wrong at a source. Machine names (queues, job kinds, errors, trace ids) stay as the worker wrote them, isolated
// left to right.

export const WORKER_COPY = {
  title: 'کارگر و خط پردازش',
  lead: 'آنچه کارگر همین حالا می‌کند و آنچه در بازه‌ی انتخاب‌شده انجام داده است، از پایگاه داده. صفحه هر ۱۵ ثانیه تازه می‌شود.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  window: 'بازه',
  windows: { '1h': '۱ ساعت', '24h': '۲۴ ساعت', '7d': '۷ روز' },
  worker: 'کارگر',
  status: {
    alive: 'در حال کار',
    stopped: 'خاموش شد',
    silent: 'بی‌پاسخ',
    never: 'هنوز اجرا نشده',
  },
  statusAdvice: {
    alive: 'آخرین ضربان در ۴۰ ثانیه‌ی گذشته رسیده است.',
    stopped: 'کارگر خودش خاموش شد و کاری برنمی‌دارد تا دوباره اجرا شود.',
    silent: 'بیش از ۴۰ ثانیه ضربانی نرسیده است؛ کارگر از کار افتاده یا به پایگاه داده نمی‌رسد.',
    never: 'هیچ کارگری تا حالا در این پایگاه داده ضربان نفرستاده است.',
  },
  version: 'نسخه',
  runningSince: 'در حال کار از',
  stoppedAt: 'خاموش شده در',
  lastBeat: 'آخرین ضربان',
  processes: 'پردازه‌های اخیر کارگر',
  jobs: 'کارها',
  queue: 'صف',
  queuesCaption: 'کارها در هر صف، به تفکیک وضعیت',
  noJobs: 'صف خالی است؛ کارگر هنوز کاری نفرستاده یا pg-boss کارهای تمام‌شده را پاک کرده است.',
  failures: 'خطاهای اخیر',
  noFailures: 'کار ناموفقی در صف نیست.',
  attempt: 'تلاش',
  of: 'از',
  traceId: 'شناسه‌ی رد',
  noTraceId: 'بدون شناسه‌ی رد',
  retry: 'تلاش دوباره',
  cancel: 'لغو',
  cancelQuestion: 'این کار لغو شود؟ از این صفحه نمی‌شود برش گرداند.',
  cancelConfirm: 'بله، لغو شود',
  cancelKeep: 'نه، بماند',
  noMessage: 'پیامی ثبت نشده',
  cancelledHere: 'این کار در ۱۰ دقیقه‌ی گذشته لغو شد.',
  newFailures: 'خطای تازه',
  internalQueue: 'صف خودِ pg-boss؛ دستی تغییر داده نمی‌شود.',
  stoppedSummary: 'منبعِ متوقف‌شده به دست خزنده',
  noStopped: 'هیچ منبعی متوقف نیست.',
  seeProblems: 'دیدن مشکل‌ها',
  chartTable: 'اندازه‌گیری‌های ساعتی به‌صورت جدول',
  chartTime: 'زمان',
  tracked: 'مدل',
  flowsCaption: 'آگهی‌های منبع و هر مدل پوشش‌داده‌شده',
  deadLetters: 'کارهای کنارگذاشته',
  deadLettersLead:
    'کارهایی که همه‌ی تلاش‌هایشان ناموفق بود یا داده‌شان خواندنی نبود؛ خودِ کار ناموفق در صف خودش هم آمده است.',
  noDeadLetters: 'کار کنارگذاشته‌ای نیست.',
  fromQueue: 'از صف',
  jobChanges: 'تلاش‌های دوباره و لغوهای اخیر',
  noJobChanges: 'هنوز کسی کاری را دوباره نفرستاده یا لغو نکرده است.',
  retried: 'دوباره فرستاده شد',
  cancelled: 'لغو شد',
  crawl: 'خزش',
  budget: 'درخواست‌های امروز',
  budgetOf: 'از سقف روزانه‌ی',
  noBudget: 'سقف روزانه تعیین نشده است',
  runs: 'اجراها در این بازه',
  noRuns: 'در این بازه اجرایی نبوده است.',
  averageDuration: 'میانگین',
  runUnit: 'اجرا',
  outcomes: 'پاسخ‌ها در این بازه',
  recentRuns: 'آخرین اجراها',
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
  chartLead: 'هر نقطه اندازه‌گیری ساعتی است و ۲۴ ساعتِ پیش از خودش را می‌شمارد.',
  chartAdded: 'تازه در ۲۴ ساعت',
  chartGone: 'خارج‌شده در ۲۴ ساعت',
  chartAge: 'میانه‌ی زمان از آخرین بررسی',
  noChart: 'هنوز اندازه‌گیری ساعتی‌ای در این بازه نیست.',
  problems: 'مشکل‌های منبع',
  stopped: 'خزنده این منبع را متوقف کرده است',
  resumeOnSources: 'بررسی و ازسرگیری در صفحه‌ی منبع‌ها',
  cooldown: 'مسیر این منبع در حال استراحت است تا',
  cooldownReason: { unavailable: 'پاسخ‌ندادن‌های پی‌درپی', rate_limited: 'پاسخ «درخواست زیاد» (۴۲۹)' },
  rateLimitedAt: 'آخرین پاسخ «درخواست زیاد»',
  refused: 'درخواست‌های ردشده',
  noRefused: 'درخواست ردشده‌ای ثبت نشده است.',
  unparsed: 'مقدارهایی که خوانده نشدند',
  noUnparsed: 'همه‌ی مقدارها خوانده شده‌اند.',
  listingsWithIt: 'آگهی',
  noSources: 'هنوز منبعی خزیده نمی‌شود.',
  seconds: 'ثانیه',
  underASecond: 'کمتر از ۱ ثانیه',
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
export const DEAD_LETTER_QUEUE_LABEL = 'کارهای کنارگذاشته';

export const FETCH_OUTCOME_LABEL = {
  ok: 'پاسخ درست',
  not_modified: 'بدون تغییر',
  not_found: 'پیدا نشد',
  gone: 'حذف‌شده',
  blocked: 'ردشده',
  rate_limited: 'درخواست زیاد',
  challenge: 'آزمون ضدربات',
  error: 'خطا',
} as const;

export const CRAWL_KIND_LABEL = {
  discovery: 'کشف آگهی‌های تازه',
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
  stopped_on_block: 'متوقف با رد شدن',
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
  unchanged: { retry: 'کار همین حالا هم منتظر تلاش دوباره است.', cancel: 'کار همین حالا هم لغو شده است.' },
  stale: 'کار عوض شده بود؛ چیزی تغییر نکرد.',
  failed: 'پاسخی نرسید؛ وضعیت تازه را ببینید.',
  invalid: 'درخواست ناقص رسید؛ صفحه را تازه کنید.',
} as const;

/** What a crawl run counted, by the names the worker gives its counts; a name not listed shows as the worker wrote it. */
export const RUN_COUNT_LABEL: Record<string, string> = {
  rows: 'ردیف خوانده‌شده',
  newListings: 'آگهی تازه',
  changedListings: 'آگهی تغییرکرده',
  lateListings: 'آگهی دیررس',
  detailsNew: 'جزئیات تازه',
  detailsChanged: 'جزئیات تغییرکرده',
  snapshotsStored: 'نسخه‌ی ذخیره‌شده',
  snapshotsUnchanged: 'نسخه‌ی بی‌تغییر',
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
  missingChecks: 'بررسی گم‌شده',
  missingHeld: 'گم‌شده‌ی نگه‌داشته',
  slices: 'برش',
  slicesSplit: 'برش شکسته‌شده',
  markedExpired: 'منقضی‌شده',
  measured: 'اندازه‌گیری‌شده',
  queued: 'در صف',
  requests: 'درخواست',
  pageLimit: 'رسیدن به سقف صفحه',
  priceUnread: 'قیمت خوانده‌نشده',
  postedAtUnread: 'زمان انتشار خوانده‌نشده',
  notACar: 'غیرخودرو',
  derivationsRefused: 'استخراج ردشده',
  roundsSkipped: 'دور ردشده',
  alreadyMeasured: 'پیش‌تر اندازه‌گیری‌شده',
  fields: 'فیلد',
};

/** The screen of every buyer's search files (CS-70): who handed which search to Karshenas, and what it finds now. */
export const SEARCH_FILES_ADMIN_COPY = {
  title: 'پرونده‌های جست‌وجو',
  lead: 'جست‌وجوهایی که خریداران به کارشناس سپرده‌اند: چه کسی، چه جست‌وجویی و چند آگهی مطابقش است. خریدار با نام کاربری‌اش شناخته می‌شود؛ حساب‌ها شماره‌ی تلفن ندارند.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  link: 'پرونده‌های جست‌وجو',
  linkBody: 'جست‌وجوهای سپرده‌شده‌ی خریداران و تعداد آگهی‌های مطابقشان.',
  empty: 'هنوز هیچ خریداری پرونده‌ای نساخته است.',
  buyer: 'خریدار',
  search: 'جست‌وجو',
  matches: 'آگهی مطابق',
  created: 'ساخته‌شده',
  state: 'وضعیت',
  list: 'پرونده‌ها',
  unreadable: 'جست‌وجوی نامعتبر',
  countFailed: 'شمارش نشد',
  states: { watching: 'در حال پایش', paused: 'متوقف', closed: 'بسته' },
  totals: (files: number, buyers: number) =>
    `${formatCountOf(files, 'پرونده')} از ${formatCountOf(buyers, 'خریدار')}`,
  shownLatest: (shown: number, total: number) =>
    `${formatCount(shown)} پرونده‌ی تازه‌تر از ${formatCount(total)} نمایش داده شد.`,
  matchesOf: (count: number, exact: boolean) => (exact ? formatCount(count) : `بیش از ${formatCount(count)}`),
  newOf: (count: number) => `${formatCountOf(count, 'آگهی')} تازه`,
  matching: {
    heading: 'پایش پرونده‌ها',
    lead: 'کارشناس هر چند دقیقه آگهی‌های تازه‌ی جست‌وجو را با پرونده‌های در حال پایش می‌سنجد و برای هر پرونده یک اعلان می‌فرستد. اینجا آخرین اجراها را می‌بینید.',
    empty:
      'هنوز اجرایی ثبت نشده است. وقتی کارگر روشن باشد، هر چند دقیقه یک بار اجرا می‌شود و اجرای بعدی همین‌جا می‌آید.',
    notified: (count: number) => `${formatCountOf(count, 'اعلان')} فرستاده شد`,
    read: (files: number, listings: number, drops: number) =>
      `${formatCountOf(files, 'پرونده')} · ${formatCountOf(listings, 'آگهی تازه')} · ${formatCountOf(drops, 'کاهش قیمت')}`,
    deferred: (count: number) => `${formatCountOf(count, 'پرونده')} به بعد موکول شد`,
    took: (milliseconds: number) =>
      milliseconds < 1000
        ? `${formatCount(milliseconds)} میلی‌ثانیه`
        : `${formatCount(Math.round(milliseconds / 100) / 10)} ثانیه`,
  },
  fileRequests: 'درخواست‌های جست‌وجوی بیشتر',
} as const;
