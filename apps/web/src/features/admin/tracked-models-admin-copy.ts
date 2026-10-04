import { isolateLtr } from '@carshenas/locale/bidi';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';
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
  link: 'مدیریت مدل‌ها',
  linkBody: 'کدام مدل‌ها کامل خوانده شوند، با اولویت و پیشرفت هر کدام.',
  lead: 'مدل‌هایی را که باید کامل خوانده شوند انتخاب کنید. به هر منبع در روز تعداد محدودی درخواست می‌فرستیم. مدل‌های مهم‌تر را اول بگذارید.',
  backToDashboard: 'پنل مدیریت',
  paused: 'خزش متوقف است. مدلی که پوشش دهید در صف می‌ماند و تا ازسرگیری خزش درخواستی به سایت‌ها نمی‌رود.',
  summary: {
    tracking: 'در حال خواندن',
    queued: 'در صف خواندن',
    paused: 'متوقف',
    details: 'جزئیات خوانده‌شده',
    detailsOf: (read: number, all: number) => `${formatCount(read)} از ${formatCountOf(all, 'آگهی فعال')}`,
    none: 'بدون آگهی',
  },
  trackedHeading: 'مدل‌هایی که پوشش داده می‌شوند',
  trackedEmpty: 'مدلی پوشش داده نمی‌شود. از فهرست پایین مدلی را انتخاب کنید.',
  info: {
    label: 'توضیح درباره‌ی «پوشش مدل»',
    close: 'بستن توضیح',
    title: 'پوشش مدل',
    what: 'جزئیات آگهی‌های مدل پوشش‌داده‌شده را می‌خوانیم و فهرست این مدل را هر شب پیمایش می‌کنیم. اطلاعات متن آگهی، ارزش بازار و ارزیابی قیمت هم فقط برای این مدل‌ها ساخته می‌شود. مدل‌های دیگر فقط از فهرست‌ها شمرده می‌شوند.',
    pauseHeading: 'توقف',
    pause: `مدل متوقف دیگر خوانده نمی‌شود و آخرین داده‌اش با تاریخ آن می‌ماند. آگهی‌هایش بعد از ${formatCountOf(SEARCH_FRESHNESS_HOURS, 'ساعت')} از نتایج جست‌وجو کنار می‌روند، چون تازه نمی‌شوند.`,
    removeHeading: 'برداشتن از فهرست',
    remove: 'مدل از فهرست برداشته می‌شود و داده‌اش می‌ماند. برای برگرداندنش دوباره پوشش بدهید.',
    budgetHeading: 'سقف روزانه',
    budget: 'هرچه مدل بیشتری را پوشش بدهید، هر مدل دیرتر خوانده می‌شود.',
  },
  priority: {
    label: 'اولویت',
    infoLabel: 'توضیح درباره‌ی «اولویت»',
    title: 'اولویت',
    text: 'مدل با اولویت بالا زودتر پیمایش و خوانده می‌شود و سهم بیشتری از صف می‌گیرد. سقف روزانه را بیشتر نمی‌کند.',
    labels: PRIORITY_LABELS,
  },
  // While the crawl is paused nothing is being read: a tracked model is queued, never «reading».
  state: { tracking: 'در حال خواندن', queued: 'در صف', paused: 'متوقف' },
  origin: {
    seed: 'انتخاب اولیه‌ی مالک',
    // The person's name is set in its own isolate by the screen (a username is Latin text beside Persian digits).
    superadmin: 'افزوده‌شده توسط',
    request: 'از درخواست خریداران، تأییدشده توسط',
    requestWaiting: 'در صف خواندن',
    requestFulfilled: 'خوانده‌شده',
  },
  progress: {
    label: 'جزئیات آگهی‌ها',
    infoLabel: (carName: string) => `توضیح درباره‌ی «جزئیات آگهی‌ها»: ${carName}`,
    infoTitle: 'پیشرفت خواندن جزئیات',
    info: 'هر آگهی از فهرست فقط با قیمت و نام می‌آید. با خواندن صفحه‌اش سال، کارکرد، وضعیت و عکس‌ها هم ثبت می‌شود و آگهی وارد نتایج جست‌وجو و ارزش بازار می‌شود.',
    value: (read: number, all: number, share: string) =>
      `${formatCount(read)} از ${formatCount(all)}، ${share}`,
    noListings: 'آگهی فعالی از این مدل دیده نشده است.',
    complete: 'جزئیات همه‌ی آگهی‌های فعال خوانده شده است.',
    waitingPaused: (queued: number) =>
      `${formatCountOf(queued, 'آگهی')} در صف خواندن است و تا ازسرگیری خزش خوانده نمی‌شود.`,
    waiting: (queued: number) =>
      `${formatCountOf(queued, 'آگهی')} در صف خواندن است. جدیدترین‌ها اول خوانده می‌شوند.`,
    modelPaused: 'آخرین داده‌ی این مدل با تاریخ آن نشان داده می‌شود.',
  },
  facts: {
    active: 'آگهی فعال',
    rated: 'دارای ارزیابی قیمت',
    newInDay: `تازه در ${formatCountOf(24, 'ساعت')}`,
    goneInDay: `خارج‌شده در ${formatCountOf(24, 'ساعت')}`,
    lastSweep: 'آخرین پیمایش',
    lastSweepNone: 'هنوز نشده',
    medianAge: 'میانه‌ی زمان از آخرین بررسی',
    medianAgeNone: 'بدون آگهی فعال',
    valuedOn: 'آخرین ارزش‌گذاری',
    valuedOnNone: 'هنوز نشده',
    valuedOnDate: (date: string) => date,
  },
  controls: {
    group: 'تغییر این مدل',
    pause: 'توقف خواندن',
    resume: 'ادامه‌ی خواندن',
    untrack: 'برداشتن از فهرست',
    confirmUntrack: (carName: string) =>
      `«${carName}» از فهرست پوشش برداشته شود؟ دیگر خوانده نمی‌شود و داده‌اش با تاریخ آن می‌ماند.`,
    confirm: 'برداشتن',
    cancel: 'انصراف',
    blocked:
      'درخواستی تأییدشده منتظر خواندن این مدل است، پس نه متوقف می‌شود و نه برداشته. برای متوقف کردن یا برداشتن، آن درخواست را رد کنید.',
    blockedLink: 'دیدن درخواست‌ها',
  },
  result: {
    changed: {
      track: 'مدل پوشش داده شد.',
      pause: 'مدل متوقف شد.',
      resume: 'خواندن مدل از سر گرفته شد.',
      untrack: 'از فهرست برداشته شد.',
      priority: 'اولویت تغییر کرد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این مدل دیگر در فهرست نیست. صفحه تازه شد.',
    blocked: 'تغییر ثبت نشد، چون درخواستی تأییدشده منتظر خواندن این مدل است. آن درخواست را رد کنید.',
    failed: 'تغییر ثبت نشد. دوباره امتحان کنید.',
    invalid: 'تغییر ثبت نشد. صفحه را تازه کنید.',
  },
  history: {
    heading: 'تاریخچه‌ی تغییرها',
    empty: 'تغییری ثبت نشده است.',
    seeded: 'انتخاب اولیه‌ی مالک',
    tracked: (priority: string) => `پوشش داده شد، اولویت ${priority}`,
    from_request: 'از درخواست تأییدشده پوشش داده شد',
    paused: 'متوقف شد',
    resumed: 'از سر گرفته شد',
    priority_changed: (from: string, to: string) => `اولویت از ${from} به ${to}`,
    untracked: 'از فهرست برداشته شد',
    request_withdrawn: 'با رد درخواست برداشته شد',
    by: (who: string, date: string) => `${who}، ${date}`,
    byNone: (date: string) => date,
  },
  recent: {
    heading: 'تغییرهای اخیر',
    lead: 'هر تغییر با نام انجام‌دهنده و زمانش ثبت می‌شود و پاک نمی‌شود.',
    empty: 'تغییری ثبت نشده است.',
  },
  untracked: {
    heading: 'مدل‌هایی که پوشش داده نمی‌شوند',
    lead: 'مدل‌هایی که آگهی فعال دارند، پرآگهی‌ترین اول.',
    search: 'جست‌وجوی مدل',
    searchPlaceholder: 'مثلاً پژو یا ۴۰۵',
    searchSubmit: 'جست‌وجو',
    searchClear: 'پاک کردن جست‌وجو',
    empty: 'مدلی با آگهی فعال پیدا نشد.',
    emptyAll: 'همه‌ی مدل‌های دارای آگهی پوشش داده می‌شوند.',
    emptyQuery: (query: string) => `مدلی با «${isolateLtr(query)}» پیدا نشد.`,
    active: (count: number) => formatCountOf(count, 'آگهی فعال'),
    shownOf: (shown: number) => `${formatCountOf(shown, 'مدل')} نشان داده شد. برای دیدن بقیه جست‌وجو کنید.`,
    track: 'پوشش دادن',
    trim: 'تیپ',
    allTrims: 'همه‌ی تیپ‌ها',
    priority: 'اولویت',
  },
  loading: 'در حال بارگذاری مدل‌ها…',
  errorTitle: 'مدل‌ها بارگذاری نشد',
  errorBody: 'چیزی تغییر نکرده است.',
  retry: 'تلاش دوباره',
} as const;
