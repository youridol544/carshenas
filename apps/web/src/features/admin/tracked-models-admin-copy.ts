import { isolateLtr } from '@carshenas/locale/bidi';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import type { TrackedPriority } from '@/lib/tracked-models-rules';

// The words of the superadmin's tracked-models screen (CS-53, ADR-0037). The glossary's «مدل پوشش‌داده‌شده» is the
// tracked model. Numbers go through the locale formatters; no middle dot beside a digit (it reads as a zero).

export const PRIORITY_LABELS: Record<TrackedPriority, string> = {
  high: 'بالا',
  normal: 'معمولی',
  low: 'کم',
};

export const TRACKED_MODELS_COPY = {
  title: 'مدل‌های پوشش‌داده‌شده',
  link: 'مدل‌های پوشش‌داده‌شده',
  linkBody:
    'کدام مدل‌ها عمیق خوانده شوند: پوشش دادن، توقف، اولویت، و وضعیت همگام‌سازی هر مدل با پیشرفت خواندن جزئیات.',
  lead: 'مدل‌هایی که کارشناس عمیق می‌خواند: جزئیات آگهی‌ها، استخراج اطلاعات، ارزش بازار و نتایج جست‌وجو. بقیه‌ی مدل‌ها فقط از فهرست‌ها شمرده می‌شوند. ظرفیت روزانه‌ی خواندن محدود است؛ مدل‌های مهم‌تر را پوشش بدهید.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  paused:
    'خواندن آگهی‌ها اکنون متوقف است. پوشش دادن یک مدل آن را در صف می‌گذارد و هیچ درخواستی به هیچ سایتی نمی‌رود؛ خواندن جزئیات با از سرگرفتن خواندن شروع می‌شود.',
  summary: {
    tracking: 'در حال خواندن',
    queued: 'در صف خواندن',
    paused: 'متوقف',
    details: 'جزئیات خوانده‌شده',
    detailsOf: (read: number, all: number) => `${formatCount(read)} از ${formatCountOf(all, 'آگهی فعال')}`,
    none: 'بدون آگهی',
  },
  trackedHeading: 'مدل‌هایی که پوشش داده می‌شوند',
  trackedEmpty: 'هنوز مدلی پوشش داده نمی‌شود. از فهرست پایین مدلی را انتخاب کنید؛ پرآگهی‌ترین‌ها اول هستند.',
  info: {
    label: 'توضیح درباره‌ی «پوشش مدل»',
    close: 'بستن توضیح',
    title: 'پوشش مدل یعنی چه',
    what: 'برای مدل پوشش‌داده‌شده کارشناس جزئیات هر آگهی را می‌خواند و آن را شبانه دوباره می‌پیماید؛ استخراج اطلاعات از متن، ارزش بازار و رتبه‌ی قیمت هم برای همین آگهی‌ها محاسبه می‌شود. مدل‌های دیگر فقط از فهرست‌ها شمرده می‌شوند.',
    pauseHeading: 'توقف',
    pause:
      'مدل متوقف دیگر خوانده نمی‌شود، اما آخرین داده‌اش با تاریخ آن در صفحه‌ها می‌ماند. آگهی‌های آن با گذشت ۴۸ ساعت از نتایج جست‌وجو کنار می‌روند، چون تازه نمی‌شوند.',
    removeHeading: 'حذف از فهرست',
    remove: 'مدل از فهرست برداشته می‌شود و داده‌اش می‌ماند. هر زمان می‌توانید دوباره پوشش بدهید.',
    budgetHeading: 'ظرفیت',
    budget:
      'هر منبع در روز ظرفیت محدودی دارد و خواندن به ترتیب اهمیت خرج می‌شود: آگهی‌های تازه، بررسی مجدد، پیمایش مدل‌های پوشش‌داده‌شده، و در آخر خواندن جزئیات آگهی‌های قدیمی‌تر. هرچه مدل بیشتر پوشش بدهید، نوبت هر کدام دیرتر می‌رسد.',
  },
  priority: {
    label: 'اولویت',
    infoLabel: 'توضیح درباره‌ی «اولویت»',
    title: 'اولویت چه می‌کند',
    text: 'اولویت ترتیب پیمایش و خواندن جزئیات را تعیین می‌کند: مدل با اولویت بالا سهم بیشتری از صف خواندن می‌گیرد و زودتر می‌رسد. ظرفیت روزانه را بیشتر نمی‌کند.',
    labels: PRIORITY_LABELS,
  },
  // While the crawl is paused nothing is being read: a tracked model is queued, never «reading».
  state: { tracking: 'در حال خواندن', queued: 'در صف', paused: 'متوقف' },
  origin: {
    seed: 'انتخاب مالک در آغاز',
    // The person's name is set in its own isolate by the screen (a username is Latin text beside Persian digits).
    superadmin: 'افزوده‌ی',
    request: 'از درخواست خریداران؛ تأییدکننده',
    requestWaiting: 'تأییدشده و در صف خواندن',
    requestFulfilled: 'خوانده‌شده',
    requestLink: 'درخواست‌ها',
  },
  progress: {
    label: 'جزئیات آگهی‌ها',
    infoLabel: (carName: string) => `توضیح درباره‌ی «جزئیات آگهی‌ها»: ${carName}`,
    infoTitle: 'پیشرفت خواندن جزئیات',
    info: 'هر آگهی فعال فقط با قیمت و نام از فهرست آمده است تا صفحه‌اش خوانده شود. پس از خواندن، سال، کارکرد، وضعیت و عکس‌ها هم ثبت می‌شود و آگهی در نتایج جست‌وجو و ارزش بازار می‌آید. جدیدترین آگهی‌ها اول خوانده می‌شوند و روزی تا ظرفیت خواندن پیش می‌روند.',
    value: (read: number, all: number, share: string) =>
      `${formatCount(read)} از ${formatCount(all)} (${share})`,
    noListings: 'هنوز آگهی فعالی از این مدل دیده نشده است.',
    complete: 'جزئیات همه‌ی آگهی‌های فعال خوانده شده است.',
    waitingPaused: (queued: number) =>
      `${formatCountOf(queued, 'آگهی')} در صف خواندن است. خواندن اکنون متوقف است و با از سرگرفتن خواندن ادامه می‌یابد.`,
    waiting: (queued: number) =>
      `${formatCountOf(queued, 'آگهی')} در صف خواندن است؛ جدیدترین‌ها اول، تا ظرفیت امروز.`,
    modelPaused: 'این مدل متوقف است؛ آخرین داده‌اش با تاریخ آن نمایش داده می‌شود.',
  },
  facts: {
    active: 'آگهی فعال',
    rated: 'دارای رتبه‌ی قیمت',
    ratedValue: (share: string) => share,
    newInDay: 'جدید در ۲۴ ساعت',
    goneInDay: 'رفته در ۲۴ ساعت',
    lastSweep: 'آخرین پیمایش',
    lastSweepNone: 'هنوز نشده',
    medianAge: 'میانه‌ی سن آخرین بررسی',
    medianAgeNone: 'بدون آگهی فعال',
    valuedOn: 'ارزش بازار',
    valuedOnNone: 'هنوز محاسبه نشده',
    valuedOnDate: (date: string) => `برای ${date}`,
  },
  controls: {
    group: 'تغییر این مدل',
    pause: 'توقف خواندن',
    resume: 'ادامه‌ی خواندن',
    untrack: 'حذف از فهرست',
    confirmUntrack: (carName: string) =>
      `«${carName}» از فهرست پوشش برداشته شود؟ دیگر خوانده نمی‌شود و داده‌اش با تاریخ آن می‌ماند.`,
    confirm: 'بله، حذف شود',
    cancel: 'انصراف',
    blocked:
      'درخواست خریداران برای این مدل تأیید شده و هنوز خوانده نشده است؛ تا خوانده نشود نه متوقف می‌شود و نه حذف. برای کنار گذاشتنش، درخواست را رد کنید.',
    blockedLink: 'باز کردن درخواست‌ها',
  },
  result: {
    changed: {
      track: 'مدل پوشش داده شد.',
      pause: 'متوقف شد. آخرین داده‌اش می‌ماند.',
      resume: 'خواندن این مدل ادامه می‌یابد.',
      untrack: 'از فهرست برداشته شد.',
      priority: 'اولویت ثبت شد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این مدل دیگر در فهرست نیست. صفحه تازه شد.',
    blocked:
      'درخواست تأییدشده‌ای منتظر خواندن این مدل است؛ برای متوقف کردن یا برداشتنش آن درخواست را رد کنید.',
    failed: 'ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.',
    invalid: 'فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.',
  },
  history: {
    heading: 'تاریخچه‌ی تغییرها',
    empty: 'تغییری ثبت نشده است.',
    seeded: 'انتخاب مالک در آغاز',
    tracked: (priority: string) => `پوشش داده شد، اولویت ${priority}`,
    from_request: 'از درخواست تأییدشده پوشش داده شد',
    paused: 'متوقف شد',
    resumed: 'ادامه یافت',
    priority_changed: (from: string, to: string) => `اولویت از ${from} به ${to}`,
    untracked: 'از فهرست برداشته شد',
    request_withdrawn: 'با ردِ درخواست برداشته شد',
    by: (who: string, date: string) => `${who}، ${date}`,
    byNone: (date: string) => date,
  },
  recent: {
    heading: 'آخرین تغییرها',
    lead: 'هر تغییر با نام کسی که انجامش داده و زمانش ثبت می‌شود و پاک نمی‌شود.',
    empty: 'هنوز تغییری ثبت نشده است.',
  },
  untracked: {
    heading: 'مدل‌هایی که پوشش داده نمی‌شوند',
    lead: 'مدل‌هایی که آگهی فعال دارند و فقط از فهرست‌ها شمرده می‌شوند، پرآگهی‌ترین اول.',
    search: 'جست‌وجوی مدل',
    searchPlaceholder: 'مثلاً پژو یا ۴۰۵',
    searchSubmit: 'جست‌وجو',
    searchClear: 'پاک کردن جست‌وجو',
    empty: 'مدلی با آگهی فعال پیدا نشد.',
    emptyAll: 'همه‌ی مدل‌های دارای آگهی پوشش داده می‌شوند.',
    emptyQuery: (query: string) => `مدلی با «${isolateLtr(query)}» پیدا نشد.`,
    active: (count: number) => formatCountOf(count, 'آگهی فعال'),
    shownOf: (shown: number) => `${formatCountOf(shown, 'مدل')} نمایش داده شد؛ برای دیدن بقیه جست‌وجو کنید.`,
    track: 'پوشش بده',
    trim: 'نسخه',
    allTrims: 'همه‌ی نسخه‌ها',
    priority: 'اولویت',
  },
  loading: 'در حال بارگذاری مدل‌ها…',
  errorTitle: 'مدل‌ها خوانده نشدند',
  errorBody: 'پایگاه داده پاسخ نداد. چیزی تغییر نکرده است؛ کمی بعد دوباره امتحان کنید.',
  retry: 'تلاش دوباره',
} as const;
