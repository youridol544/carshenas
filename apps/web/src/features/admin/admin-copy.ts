import type {
  ChosenCrawlState,
  CrawlState,
  SourceStateOutcome,
  StopReason,
} from '@/features/admin/admin-types';

// The superadmin section's Farsi words (CS-39, CS-40), shared by its pages, its form and their tests, so a test finds a
// control by the text people read and retyped Persian never drifts from it. Terms follow docs/product/glossary.md.

export const CRAWL_STATE_LABEL = {
  enabled: 'فعال',
  paused: 'متوقف',
  stopped_on_block: 'متوقف پس از مسدود شدن',
} as const satisfies Record<CrawlState, string>;

export const STOP_REASON_LABEL = {
  blocked: 'سایت درخواست را رد کرد',
  challenge: 'سایت به‌جای پاسخ، صفحه‌ی آزمون ضدربات نشان داد',
  rate_limited: 'سایت در یک شبانه‌روز دو بار گفت درخواست‌ها زیاد است',
} as const satisfies Record<StopReason, string>;

export const SOURCES_COPY = {
  title: 'منبع‌ها',
  lead: 'خزش هر منبع را این‌جا متوقف کنید یا از سر بگیرید. هر تغییر با نام کاربری شما و زمانش ثبت می‌شود.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  empty: 'هنوز منبعی ثبت نشده است؛ منبع‌ها با خزنده اضافه می‌شوند.',
  state: 'وضعیت خزش',
  notCrawled: 'این منبع خزیده نمی‌شود، پس خزش آن را نمی‌توان روشن کرد.',
  stopped: 'خزنده این منبع را متوقف کرد',
  stoppedAt: 'زمان توقف',
  stopReason: 'دلیل',
  stopAdvice:
    'پیش از ازسرگیری، درخواستی را که رد شد در گزارش درخواست‌ها بخوانید. اگر سایت هنوز ما را مسدود می‌کند، خزش را متوقف نگه دارید.',
  pause: 'توقف خزش',
  resume: 'ازسرگیری خزش',
  changes: 'تغییرهای اخیر',
  noChanges: 'هنوز کسی وضعیت این منبع را تغییر نداده است.',
  clearedStop: 'توقف خزنده برداشته شد',
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

/** The status line under a source's buttons, after the section has answered. */
export const SOURCE_STATE_RESULT = {
  changed: { enabled: 'خزش از سر گرفته شد.', paused: 'خزش متوقف شد.' },
  unchanged: {
    enabled: 'خزش این منبع همین حالا هم فعال است.',
    paused: 'خزش این منبع همین حالا هم متوقف است.',
  },
  stale:
    'وضعیت این منبع در این فاصله عوض شده بود و چیزی تغییر نکرد. وضعیت تازه را ببینید و دوباره تصمیم بگیرید.',
  not_crawled: 'این منبع خزیده نمی‌شود و خزش آن روشن نشد.',
  invalid: 'درخواست کامل نرسید. صفحه را دوباره باز کنید و دوباره امتحان کنید.',
} as const satisfies {
  changed: Record<ChosenCrawlState, string>;
  unchanged: Record<ChosenCrawlState, string>;
} & Record<Exclude<SourceStateOutcome, 'changed' | 'unchanged'> | 'invalid', string>;
