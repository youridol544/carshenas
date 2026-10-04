import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { SEARCH_FILE_ALERT_RULES } from '@carshenas/notifications/search-file-alerts';
import {
  MAX_NAME_LENGTH,
  MAX_SEARCH_FILES,
  type SearchFileState,
} from '@/features/search-files/search-files-rules';

// Every word search files say (CS-70, ADR-0031), in the glossary's terms: «پرونده‌ی جست‌وجو» is the file, «سپردن به
// کارشناس» hands a search to Karshenas, and a file is «فعال» (watching), «متوقف» or «بسته»: adjectives, so a sentence
// can say «پرونده … فعال است». What a filter means is never written here: the search is shown as the chips the search
// page shows, from the definitions in @carshenas/search. Numbers come from the formatters in @carshenas/locale. Tests
// import these constants instead of retyping Persian, which loses the zero-width non-joiner.

const LISTING = 'آگهی';
const FILE = 'پرونده';

// The reason a stored search cannot be shown, on its card and on its page.
const NO_FILTERS = 'فیلترهای این پرونده دیگر وجود ندارند.';

export const STATE_LABELS = {
  watching: 'فعال',
  paused: 'متوقف',
  closed: 'بسته',
} as const satisfies Record<SearchFileState, string>;

export const SEARCH_FILES_COPY = {
  title: 'پرونده‌های جست‌وجو',
  lead: 'هر پرونده نشان می‌دهد از آخرین بازدیدتان چند آگهی تازه آمده است.',
  state: STATE_LABELS,
  save: {
    /** The button on the search page and on the home page. */
    button: 'سپردن به کارشناس',
    /** The button's name on a home page row: it says which row it saves. */
    buttonFor: (title: string) => `سپردن «${title}» به کارشناس`,
    dialogTitle: 'این جست‌وجو را به کارشناس بسپارید',
    close: 'بستن',
    preparing: 'در حال آماده‌سازی…',
    searchLabel: 'جست‌وجو',
    nameLabel: 'نام پرونده',
    submit: 'ساختن پرونده',
    created: 'پرونده ساخته شد',
    open: 'دیدن پرونده',
    keepSearching: 'ادامه‌ی جست‌وجو',
    /** The button after a file was made from this search: it leads to the file. */
    saved: 'دیدن پرونده',
    savedBefore: 'دیدن پرونده',
    existsTitle: 'این جست‌وجو را پیش‌تر سپرده‌اید',
    existsBody: (name: string, state: SearchFileState) =>
      `پرونده‌ی «${name}» همین جست‌وجو را دارد و ${STATE_LABELS[state]} است.`,
    limitTitle: 'به سقف پرونده‌ها رسیده‌اید',
    limitBody: `هر حساب تا ${formatCountOf(MAX_SEARCH_FILES, FILE)} می‌تواند داشته باشد. برای ساختن این یکی، پرونده‌ای را که دیگر لازم ندارید پاک کنید.`,
    limitAction: 'دیدن پرونده‌ها',
    failed: 'جست‌وجو سپرده نشد. دوباره امتحان کنید.',
    invalidName: `نام پرونده باید از ${formatCount(1)} تا ${formatCountOf(MAX_NAME_LENGTH, 'کاراکتر')} باشد.`,
    invalidSearch: 'این جست‌وجو را نمی‌شود سپرد. صفحه را تازه کنید و دوباره امتحان کنید.',
    signedOutTitle: 'برای سپردن جست‌وجو وارد شوید',
    signedOutBody: 'بعد از ورود یا ثبت‌نام، به همین جست‌وجو برمی‌گردید و پرونده را می‌سازید.',
    signUp: 'ثبت‌نام',
    signIn: 'ورود',
  },
  banner: {
    title: 'آگهی‌های تازه‌ی این جست‌وجو را جدا ببینید',
  },
  list: {
    loading: 'در حال بارگذاری پرونده‌ها…',
    emptyTitle: 'هنوز پرونده‌ای ندارید',
    emptyBody: 'در جست‌وجو فیلترهایتان را بگذارید و «سپردن به کارشناس» را بزنید.',
    emptyAction: 'جست‌وجوی خودرو',
    errorTitle: 'پرونده‌ها بارگذاری نشد',
    errorBody: 'پرونده‌هایتان سر جایشان است.',
    retry: 'تلاش دوباره',
    matches: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    noMatches: 'آگهی مطابقی ندارد',
    bestDeal: 'بهترین معامله',
    nothingNew: 'آگهی تازه‌ای نیست',
    newCount: (count: number) => `${formatCountOf(count, LISTING)} تازه`,
    unreadable: NO_FILTERS,
    countFailed: 'تعداد آگهی‌ها معلوم نشد.',
    viewed: (ago: string) => `آخرین بازدید: ${ago}`,
    lastAlert: (ago: string) => `آخرین اعلان: ${ago}`,
    alertsMuted: 'اعلان خاموش',
    open: (name: string) => `دیدن پرونده‌ی «${name}»`,
  },
  account: {
    heading: 'پرونده‌های جست‌وجو',
    none: 'هنوز پرونده‌ای ندارید.',
    count: (count: number) => formatCountOf(count, FILE),
    newIn: (count: number) => `${formatCountOf(count, LISTING)} تازه`,
  },
  file: {
    back: 'پرونده‌های جست‌وجو',
    searchLabel: 'جست‌وجوی این پرونده',
    openInSearch: 'باز کردن در جست‌وجو',
    createdOn: (date: string) => `ساخته‌شده در ${date}`,
    matchesHeading: 'آگهی‌های مطابق',
    rankedBy: 'به ترتیب بهترین معامله',
    matchesCount: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    newSince: (count: number, since: string) =>
      `${formatCountOf(count, LISTING)} تازه از آخرین بازدیدتان در ${since}`,
    newBadge: 'تازه',
    alertNote: (ago: string) => `آخرین اعلان: ${ago}`,
    nothingNew: (since: string) => `از آخرین بازدیدتان در ${since} آگهی تازه‌ای نیامده است.`,
    shownOf: (shown: number, total: string) => `${formatCount(shown)} از ${total} نمایش داده شد`,
    seeAll: (total: string) => `دیدن همه‌ی ${total}`,
    emptyTitle: 'هنوز آگهی مطابقی ندارد',
    emptyWatching: 'هر آگهی مطابقی که بیاید، همین‌جا می‌بینید.',
    emptyOther: 'فیلترها را بازتر کنید.',
    unreadableTitle: 'آگهی‌های این پرونده نمایش داده نمی‌شود',
    unreadableBody: `${NO_FILTERS} پرونده را پاک کنید و جست‌وجو را دوباره بسپارید.`,
    resultsFailedTitle: 'آگهی‌های پرونده بارگذاری نشد',
    resultsFailedBody: 'خود پرونده سر جایش است.',
    retry: 'تلاش دوباره',
    loadingResults: 'در حال بارگذاری آگهی‌های پرونده…',
  },
  alerts: {
    label: 'اعلان این پرونده',
    on: 'وقتی آگهی تازه‌ای با قیمت خوب بیاید یا قیمتی کم شود، اعلان می‌گیرید.',
    off: 'آگهی‌های تازه را فقط همین‌جا می‌بینید.',
    notWatching: 'پرونده متوقف است، پس اعلانی نمی‌آید.',
    infoLabel: 'توضیح درباره‌ی اعلان این پرونده',
    infoClose: 'بستن',
    infoTitle: 'اعلان این پرونده',
    infoLimits: `برای هر پرونده حداکثر هر ${formatCount(SEARCH_FILE_ALERT_RULES.minGapMinutes / 60)} ساعت یک اعلان می‌آید و در روز تا ${formatCount(SEARCH_FILE_ALERT_RULES.dailyCap)} اعلان می‌گیرید. آنچه در این فاصله بیاید، در اعلان بعدی می‌آید.`,
    failed: 'تغییر ثبت نشد.',
  },
  actions: {
    menu: 'منوی پرونده',
    rename: 'تغییر نام',
    renameTitle: 'تغییر نام پرونده',
    renameSubmit: 'ذخیره‌ی نام',
    pause: 'متوقف کردن',
    resume: 'فعال کردن',
    close: 'بستن پرونده',
    reopen: 'باز کردن دوباره',
    delete: 'پاک کردن پرونده',
    deleteTitle: (name: string) => `پرونده‌ی «${name}» پاک شود؟`,
    deleteBody: 'این جست‌وجو را هر وقت خواستید دوباره بسپارید.',
    deleteConfirm: 'پاک کردن',
    keep: 'نگه داشتن',
    cancel: 'انصراف',
    failed: 'تغییر ثبت نشد.',
    signedOut: 'از حساب خارج شده‌اید. دوباره وارد شوید.',
    gone: 'این پرونده دیگر وجود ندارد.',
    dismiss: 'بستن پیام',
    retry: 'تلاش دوباره',
  },
} as const;

/** «فعال (۲)»: a state's heading with its count. */
export function groupHeading(state: SearchFileState, count: number): string {
  return `${STATE_LABELS[state]} (${formatCount(count)})`;
}
