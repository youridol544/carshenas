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
