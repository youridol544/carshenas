import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { SEARCH_FILE_ALERT_RULES } from '@carshenas/notifications/search-file-alerts';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';
import {
  MAX_NAME_LENGTH,
  MAX_SEARCH_FILES,
  type SearchFileState,
} from '@/features/search-files/search-files-rules';

// Every word search files say (CS-70, ADR-0031), in the glossary's terms: «پرونده‌ی جست‌وجو» is the file, «بسپارش به
// کارشناس» hands a search to Karshenas, «پایش» is its watching. What a filter means is never written here: the search
// is shown as the chips the search page shows, from the definitions in @carshenas/search. Numbers come from the
// formatters in @carshenas/locale. Tests import these constants instead of retyping Persian, which loses the
// zero-width non-joiner.

const LISTING = 'آگهی';
const FILE = 'پرونده';

export const STATE_LABELS = {
  watching: 'در حال پایش',
  paused: 'متوقف',
  closed: 'بسته',
} as const satisfies Record<SearchFileState, string>;

export const SEARCH_FILES_COPY = {
  title: 'پرونده‌های جست‌وجو',
  lead: 'جست‌وجوهایی که به کارشناس سپرده‌اید. هر پرونده آگهی‌های مطابق جست‌وجوی خودش را نشان می‌دهد و می‌گوید از آخرین دیدن شما چه چیزی تازه آمده است.',
  state: STATE_LABELS,
  save: {
    /** The button on the search page and on the home page. */
    button: 'بسپارش به کارشناس',
    /** The button's name on a home page row: it says which row it saves. */
    buttonFor: (title: string) => `بسپارش «${title}» به کارشناس`,
    dialogTitle: 'این جست‌وجو را به کارشناس بسپارید',
    dialogLead:
      'کارشناس این جست‌وجو را در یک پرونده برایتان نگه می‌دارد و هر بار که سر بزنید می‌گوید چه آگهی‌ای تازه آمده است.',
    close: 'بستن',
    preparing: 'در حال آماده‌سازی…',
    searchLabel: 'جست‌وجوی این پرونده',
    nameLabel: 'نام پرونده',
    nameHint: 'برای پیدا کردنش در فهرست پرونده‌ها.',
    submit: 'ساختن پرونده',
    created: 'پرونده ساخته شد',
    createdBody: (name: string) => `«${name}» در پرونده‌های جست‌وجوی شما نگه داشته می‌شود.`,
    open: 'دیدن پرونده',
    keepSearching: 'ادامه‌ی جست‌وجو',
    /** The button after a file was made from this search: it leads to the file. */
    saved: 'ذخیره شد · مشاهده پرونده',
    savedBefore: 'پرونده دارید · مشاهده پرونده',
    existsTitle: 'این جست‌وجو را پیش‌تر سپرده‌اید',
    existsBody: (name: string, state: SearchFileState) =>
      `پرونده‌ی «${name}» (${STATE_LABELS[state]}) همین جست‌وجو را دارد.`,
    limitTitle: 'پرونده‌ی تازه جا ندارید',
    limitBody: `هر حساب تا ${formatCountOf(MAX_SEARCH_FILES, FILE)} می‌تواند داشته باشد. برای ساختن این یکی، پرونده‌ای را که دیگر لازم ندارید پاک کنید.`,
    limitAction: 'رفتن به پرونده‌ها',
    failed: 'پرونده ساخته نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
    invalidName: `نام پرونده باید از ۱ تا ${formatCount(MAX_NAME_LENGTH)} نویسه باشد.`,
    invalidSearch: 'این جست‌وجو را نمی‌شود نگه داشت. صفحه را تازه کنید و دوباره امتحان کنید.',
    retry: 'تلاش دوباره',
    signedOutTitle: 'برای سپردن جست‌وجو وارد شوید',
    signedOutBody:
      'پرونده‌ی جست‌وجو در حساب شما نگه داشته می‌شود. بعد از ورود یا ثبت‌نام، به همین جست‌وجو برمی‌گردید و پرونده را می‌سازید.',
    signUp: 'ثبت‌نام',
    signIn: 'ورود',
  },
  banner: {
    title: 'بگذارید کارشناس دنبال این ماشین بگردد',
    body: 'این جست‌وجو را به کارشناس بسپارید؛ هر بار که برگردید، آگهی‌های تازه‌اش را جدا نشان می‌دهد.',
  },
  list: {
    loading: 'در حال بارگذاری پرونده‌ها…',
    emptyTitle: 'هنوز پرونده‌ای ندارید',
    emptyBody:
      'جست‌وجویی را با فیلترهایتان بسازید و با «بسپارش به کارشناس» نگهش دارید. کارشناس برایتان می‌گوید چه چیزی تازه آمده است.',
    emptyAction: 'رفتن به جست‌وجو',
    errorTitle: 'پرونده‌ها خوانده نشد',
    errorBody: 'پایگاه داده پاسخ نداد. پرونده‌های شما سر جایشان هستند؛ کمی بعد دوباره امتحان کنید.',
    retry: 'تلاش دوباره',
    matches: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    noMatches: 'آگهی مطابقی ندارد',
    bestDeal: 'بهترین معامله',
    newestPhoto: 'عکس تازه‌ترین آگهی',
    nothingNew: 'چیز تازه‌ای نیست',
    newCount: (count: number) => `${formatCountOf(count, LISTING)} تازه`,
    unreadable: 'این پرونده با نسخه‌ی تازه سازگار نیست',
    countFailed: 'شمارش آگهی‌ها ممکن نشد',
    viewed: (ago: string) => `آخرین دیدن: ${ago}`,
    lastAlert: (ago: string) => `آخرین هشدار: ${ago}`,
    alertsMuted: 'هشدار خاموش',
    open: (name: string) => `باز کردن پرونده‌ی «${name}»`,
  },
  account: {
    heading: 'پرونده‌های جست‌وجو',
    none: 'جست‌وجویی را به کارشناس بسپارید تا برایتان نگه دارد.',
    count: (count: number) => formatCountOf(count, FILE),
    newIn: (count: number) => `${formatCountOf(count, LISTING)} تازه`,
    all: 'همه‌ی پرونده‌ها',
    menu: 'پرونده‌های جست‌وجو',
  },
  file: {
    back: 'پرونده‌های جست‌وجو',
    notFoundTitle: 'این پرونده پیدا نشد',
    notFoundBody: 'یا پاک شده است یا از حساب دیگری است. پرونده‌های خودتان را در فهرست ببینید.',
    searchLabel: 'جست‌وجوی این پرونده',
    openInSearch: 'باز کردن در جست‌وجو',
    createdOn: (date: string) => `ساخته‌شده: ${date}`,
    matchesHeading: 'آگهی‌های مطابق',
    rankedBy: 'به ترتیب بهترین معامله',
    matchesCount: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    newSince: (count: number, since: string) =>
      `${formatCountOf(count, LISTING)} تازه از آخرین دیدن شما (${since})`,
    newBadge: 'تازه',
    alertNote: (ago: string) =>
      `آخرین هشدار: ${ago}. هشدار فقط برای آگهی با قیمت خوب یا برای کاهش قیمت می‌آید؛ شمار «تازه» همه‌ی آگهی‌های تازه را از آخرین دیدن شما می‌شمارد.`,
    nothingNew: (since: string) => `از آخرین دیدن شما (${since}) آگهی تازه‌ای نیامده است.`,
    shownOf: (shown: number, total: string) => `${formatCount(shown)} آگهی از ${total} نمایش داده شد`,
    seeAll: (total: string) => `دیدن همه‌ی ${total} در جست‌وجو`,
    emptyTitle: 'هنوز آگهی مطابقی ندارد',
    emptyWatching: `در ${formatCount(SEARCH_FRESHNESS_HOURS)} ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. پرونده نگه داشته می‌شود و هر آگهی مطابقی که بیاید همین‌جا می‌بینید.`,
    emptyOther: `در ${formatCount(SEARCH_FRESHNESS_HOURS)} ساعت گذشته آگهی‌ای با این جست‌وجو دیده نشده است. جست‌وجو را باز کنید و فیلترها را بازتر کنید.`,
    pausedNotice:
      'این پرونده متوقف است و پایش نمی‌شود. آگهی‌های مطابق و تازه‌ها را همچنان می‌بینید؛ با «ادامه‌ی پایش» دوباره دنبال می‌شود.',
    closedNotice: 'این پرونده بسته است. برای دنبال کردن دوباره، بازش کنید.',
    unreadableTitle: 'این جست‌وجو با نسخه‌ی تازه سازگار نیست',
    unreadableBody:
      'فیلترهای این پرونده دیگر وجود ندارند، پس آگهی‌هایش را نشان نمی‌دهیم تا چیز نادرستی نبینید. می‌توانید پرونده را پاک کنید و جست‌وجو را دوباره بسپارید.',
    resultsFailedTitle: 'آگهی‌های پرونده خوانده نشد',
    resultsFailedBody: 'پایگاه داده پاسخ نداد. خود پرونده سر جایش است؛ کمی بعد دوباره امتحان کنید.',
    retry: 'تلاش دوباره',
    loadingResults: 'در حال بارگذاری آگهی‌های پرونده…',
  },
  alerts: {
    label: 'هشدار آگهی تازه',
    on: 'وقتی آگهی تازه یا کاهش قیمتی پیدا شود، در اعلان‌هایتان خبرتان می‌کنیم.',
    off: 'هشدار این پرونده خاموش است. پرونده آگهی‌ها را همچنان پیدا می‌کند و تازه‌ها را همین‌جا می‌بینید.',
    notWatching: 'پرونده پایش نمی‌شود، پس تا ادامه‌ی پایش هشداری نمی‌آید.',
    infoLabel: 'توضیح درباره‌ی هشدار پرونده',
    infoClose: 'بستن',
    infoTitle: 'هشدار پرونده چطور کار می‌کند؟',
    infoWhat: `کارشناس هر ${formatCount(SEARCH_FILE_ALERT_RULES.runEveryMinutes)} دقیقه آگهی‌هایی را که تازه در جست‌وجو آمده‌اند یا قیمتشان کم شده با جست‌وجوی این پرونده می‌سنجد. اگر آگهی تازه‌ای با قیمت خوب یا عالی بیابد یا قیمت آگهی‌ای کم شده باشد، یک اعلان می‌فرستد، نه یک اعلان برای هر آگهی. آگهی‌های تازه‌ی دیگر فقط با نشان «تازه» در همین صفحه می‌آیند.`,
    infoLimits: `برای هر پرونده دست‌کم ${formatCount(SEARCH_FILE_ALERT_RULES.minGapMinutes / 60)} ساعت میان دو اعلان می‌ماند و هر حساب در روز تا ${formatCount(SEARCH_FILE_ALERT_RULES.dailyCap)} اعلان پرونده می‌گیرد. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید.`,
    infoBefore:
      'آگهی‌هایی که پیش از ساخت پرونده در جست‌وجو بودند تازه حساب نمی‌شوند. با خاموش کردن هشدار هم چیزی پاک نمی‌شود.',
    failed: 'تغییر ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
  },
  actions: {
    menu: 'کارهای پرونده',
    rename: 'تغییر نام',
    renameTitle: 'تغییر نام پرونده',
    renameSubmit: 'ذخیره‌ی نام',
    pause: 'توقف پایش',
    resume: 'ادامه‌ی پایش',
    close: 'بستن پرونده',
    reopen: 'باز کردن دوباره',
    delete: 'پاک کردن پرونده',
    deleteTitle: (name: string) => `پرونده‌ی «${name}» پاک شود؟`,
    deleteBody: 'پرونده پاک می‌شود. آگهی‌ها دست‌نخورده می‌مانند و می‌توانید این جست‌وجو را دوباره بسپارید.',
    deleteConfirm: 'پاک کردن',
    keep: 'نگه داشتن',
    cancel: 'انصراف',
    failed: 'تغییر ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
    signedOut: 'نشست شما پایان یافته است. دوباره وارد شوید.',
    gone: 'این پرونده دیگر وجود ندارد.',
    dismiss: 'بستن پیام',
    retry: 'تلاش دوباره',
  },
} as const;

/** «در حال پایش (۲)»: a state's heading with its count. */
export function groupHeading(state: SearchFileState, count: number): string {
  return `${STATE_LABELS[state]} (${formatCount(count)})`;
}
