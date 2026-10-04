import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { SEARCH_FRESHNESS_HOURS } from '@carshenas/search/freshness';

// Every word the search page says (CS-61), in the glossary's terms (docs/product/glossary.md): «آگهی», «ارزش بازار»,
// «کارکرد», «روز روی بازار», «فروشنده‌ی شخصی». What a filter or a catalogue means is never written here: it comes from
// the definitions in @carshenas/search (explain.ts, the filters' own descriptions and rules), so a rule and its
// explanation cannot disagree. Numbers come from the formatters in @carshenas/locale. Tests import these constants
// instead of retyping Persian, which loses the zero-width non-joiner.

const LISTING = 'آگهی';

export const SEARCH_COPY = {
  title: 'جست‌وجوی خودرو',
  bar: {
    label: 'جست‌وجو در آگهی‌ها',
    placeholder: 'چه ماشینی می‌خواهید؟ یا لینک آگهی دیوار',
    submit: 'جست‌وجو',
    checkLink: 'ارزیابی لینک',
    linkHint: 'این یک لینک است؛ با «ارزیابی لینک» قیمتش را با ارزش بازار می‌سنجیم.',
    clear: 'پاک کردن عبارت جست‌وجو',
  },
  controls: {
    filters: 'فیلترها',
    sort: 'مرتب‌سازی',
    clearFilters: 'پاک کردن فیلترها',
    skipToResults: 'پرش به نتایج',
    close: 'بستن',
    /** The filter button's name when filters are applied: «فیلترها، ۳ فیلتر فعال». */
    filtersApplied: (count: number) => `فیلترها، ${formatCountOf(count, 'فیلتر')} فعال`,
  },
  catalogues: {
    label: 'مجموعه‌های آماده',
    all: 'همه‌ی آگهی‌ها',
    /** The info button's name: «توضیح درباره‌ی «کم‌کارکرد»». */
    info: (title: string) => `توضیح درباره‌ی «${title}»`,
    previous: 'مجموعه‌های قبلی',
    next: 'مجموعه‌های بعدی',
    allCount: (count: number) => `${formatCount(count)} ${LISTING}`,
    summaryOrder: 'ترتیب',
  },
  chips: {
    label: 'فیلترهای فعال',
    remove: (text: string) => `برداشتن «${text}»`,
    /** A word of the sentence no filter could name, looked for in the listings' own text. */
    words: (words: string) => `«${words}»`,
  },
  /** What the page says about the sentence beside the filters it became (CS-111). */
  sentence: {
    label: 'درباره‌ی جمله',
    /** Words the listings do not have: left out of the results, with a way to put them back. */
    dropped: (words: string) => `آگهی‌ای با «${words}» پیدا نشد. بدون آن نشان می‌دهیم.`,
    putBack: 'برگرداندن',
    putBackName: (words: string) => `برگرداندن «${words}»`,
    suggestions: 'شاید منظورتان این هم بود',
    add: (text: string) => `اضافه کردن «${text}»`,
    /** The quiet line while a model reads what the code could not (the switch is on). */
    reading: 'در حال خواندن بقیه‌ی جمله…',
  },
  results: {
    listLabel: 'نتیجه‌های جست‌وجو',
    count: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    shown: (shown: number, total: string) => `${formatCount(shown)} از ${total} نمایش داده شد`,
    more: 'نمایش بیشتر',
    loading: 'در حال بارگذاری آگهی‌ها…',
    loadingMore: 'در حال بارگذاری آگهی‌های بعدی…',
    added: (count: number) => `${formatCountOf(count, LISTING)} دیگر اضافه شد.`,
    moreFailed: 'آگهی‌های بعدی بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
    retry: 'تلاش دوباره',
    reopen: 'بارگذاری دوباره‌ی فهرست',
    end: 'به آخر فهرست رسیدید.',
    endCapped: 'برای دیدن بقیه، فیلترها را محدودتر کنید.',
    limit: (count: number) =>
      `${formatCountOf(count, 'آگهی')} اول نمایش داده شد. برای دیدن بقیه، جست‌وجو را با فیلتر یا عبارت محدودتر کنید.`,
    updated: (count: string) => `فهرست به‌روز شد: ${count}`,
  },
  words: {
    corrected: (from: string, to: string) => `نتیجه‌ها برای «${to}» است؛ «${from}» در هیچ آگهی‌ای نبود.`,
    unknown: (word: string) => `«${word}» در هیچ آگهی‌ای نبود.`,
  },
  ignored: {
    lead: 'بخشی از آدرس این جست‌وجو قابل‌استفاده نبود و نادیده گرفته شد:',
    sort: 'مرتب‌سازی',
    catalogue: 'مجموعه',
    query: 'عبارت جست‌وجو',
  },
  noResults: {
    title: 'آگهی‌ای با این فیلترها پیدا نشد',
    lead: 'با برداشتن یکی از این‌ها نتیجه می‌بینید:',
    remove: (text: string) => `برداشتن «${text}»`,
    count: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    clearAll: 'پاک کردن همه‌ی فیلترها',
    withoutWords: 'برداشتن عبارت جست‌وجو',
    onlyWords: 'برای این عبارت آگهی‌ای پیدا نشد. عبارت کوتاه‌تر یا نام دیگری را امتحان کنید.',
  },
  emptyIndex: {
    title: 'فعلاً آگهی تازه‌ای نداریم',
    body: `کارشناس فقط آگهی‌هایی را نشان می‌دهد که در ${formatCountOf(SEARCH_FRESHNESS_HOURS, 'ساعت')} گذشته دیده شده باشند، تا هر آگهی‌ای که می‌بینید هنوز در بازار باشد. کمی بعد دوباره سر بزنید.`,
  },
  error: {
    title: 'آگهی‌ها بارگذاری نشد',
    body: 'مشکلی در خواندن آگهی‌ها پیش آمد. دوباره امتحان کنید؛ اگر باز هم نشد، کمی بعد برگردید.',
    retry: 'دوباره امتحان کنید',
  },
  sheet: {
    title: 'فیلترها',
    apply: (count: string) => `نمایش ${count}`,
    none: 'آگهی‌ای پیدا نشد',
    noneHint: 'یکی از فیلترها را بردارید.',
    counting: 'در حال شمارش…',
    countFailed: 'شمارش آگهی‌ها انجام نشد؛ می‌توانید باز هم فیلترها را اعمال کنید.',
  },
  panel: {
    label: 'فیلترها',
    featured: 'فیلتر اصلی',
    anyOption: 'بدون محدودیت',
    minimum: 'بدون حداقل',
    maximum: 'بدون حداکثر',
    from: 'از',
    to: 'تا',
    fromName: (label: string) => `حداقل ${label}`,
    toName: (label: string) => `حداکثر ${label}`,
    showAll: (count: number) => `نمایش همه (${formatCount(count)})`,
    showFewer: 'نمایش کمتر',
    searchWithin: (label: string) => `جست‌وجو در ${label}`,
    noMatch: 'موردی پیدا نشد',
    appliedInGroup: (count: number) => `${formatCount(count)} فعال`,
    otherFilters: 'فیلترهای بیشتر',
  },
  info: {
    /** The info button's name: «توضیح درباره‌ی «کارکرد»». */
    button: (label: string) => `توضیح درباره‌ی «${label}»`,
    close: 'بستن توضیح',
    rule: 'معیار دقیق',
    options: 'گزینه‌ها',
    conditions: 'شرط‌ها',
    order: 'ترتیب نمایش',
    bestToWorst: 'از بهترین به بدترین',
  },
  /** The line under the catalogue when the search is for one model (CS-67). */
  modelNotice: {
    lead: (name: string) => `${name} صفحه‌ی خودش را دارد: ارزش بازار، محدوده‌ی قیمت و روند قیمت.`,
    /** For a model the filter options do not name yet (the worker has not counted it): the notice still stands. */
    thisModel: 'این مدل',
    link: 'دیدن صفحه‌ی مدل',
  },
  card: {
    unknownPrice: 'قیمت نامشخص',
    negotiable: 'توافقی',
    installment: 'فروش قسطی',
    unrated: 'بدون ارزیابی',
    unratedWithValue: 'ارزش بازار برآورد شده، اما قیمت این آگهی با آن مقایسه نمی‌شود.',
    unratedOutlier:
      'قیمت نامعمول است و با ارزش بازار فاصله‌ی بسیار دارد؛ احتمالاً اشتباه تایپی یا قیمت نمایشی است.',
    unratedShowroom: 'قیمت خودروی صفر نمایشگاه‌ها اغلب نمایشی است؛ ارزیابی نشد.',
    unratedNoValue: 'برای این خودرو ارزش بازار قابل‌اعتمادی نداریم.',
    belowMarket: 'زیر ارزش بازار',
    aboveMarket: 'بالاتر از ارزش بازار',
    atMarket: 'نزدیک ارزش بازار',
    marketValue: 'ارزش بازار',
    noPhoto: 'بدون عکس',
    zeroKm: 'صفر کیلومتر',
    photos: (count: number) => formatCountOf(count, 'عکس'),
    viewOn: (source: string) => `دیدن آگهی در ${source}`,
    /** The card's link leads to the listing's own page: its price analysis, comparables and the click-out. */
    viewPage: 'دیدن ارزیابی قیمت و جزئیات',
    opensInNewTab: 'در زبانه‌ی جدید باز می‌شود',
    /** The link to the model's page (CS-67), in the card's footer: the price, range and trend of the whole model. */
    modelPage: 'صفحه‌ی مدل',
    modelPageOf: (name: string) => `صفحه‌ی مدل ${name}: قیمت و روند`,
    thinHint: (source: string) => `قیمت و مشخصات را در آگهی ${source} ببینید`,
    today: 'امروز منتشر شد',
    daysOnMarket: (days: number) => `${formatCountOf(days, 'روز')} روی بازار`,
    soundBoth: 'موتور و گیربکس سالم',
    paintedSomewhere: 'رنگ‌شدگی دارد',
    accident: 'تصادفی',
  },
} as const;
