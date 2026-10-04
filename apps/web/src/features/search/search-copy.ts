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
    linkHint: 'این یک لینک است. قیمتش را با «ارزیابی لینک» بسنجید.',
    clear: 'پاک کردن متن',
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
    listLabel: 'نتایج جست‌وجو',
    count: (count: number, exact: boolean) =>
      exact ? formatCountOf(count, LISTING) : `بیش از ${formatCountOf(count, LISTING)}`,
    // Listings the rest of the search keeps but that a volume or origin filter leaves out, because we do not know it.
    unknown: {
      engine_volume: (count: number) =>
        `${formatCountOf(count, LISTING)} دیگر با بقیه‌ی فیلترها می‌خواند، اما حجم موتور در آگهی نیامده و نشان داده نمی‌شود.`,
      country: (count: number) =>
        `${formatCountOf(count, LISTING)} دیگر با بقیه‌ی فیلترها می‌خواند، اما کشور سازنده در آگهی نیامده و نشان داده نمی‌شود.`,
      origin: (count: number) =>
        `${formatCountOf(count, LISTING)} دیگر با بقیه‌ی فیلترها می‌خواند، اما مبدأ در آگهی نیامده و نشان داده نمی‌شود.`,
    },
    shown: (shown: number, total: string) => `${formatCount(shown)} از ${total}`,
    more: 'نمایش بیشتر',
    loading: 'در حال بارگذاری آگهی‌ها…',
    loadingMore: 'در حال بارگذاری آگهی‌های بعدی…',
    added: (count: number) => `${formatCountOf(count, LISTING)} دیگر اضافه شد.`,
    moreFailed: 'آگهی‌های بعدی بارگذاری نشد.',
    retry: 'تلاش دوباره',
    reopen: 'بارگذاری دوباره‌ی فهرست',
    end: 'به آخر فهرست رسیدید.',
    endCapped: 'برای دیدن بقیه، فیلترها را محدودتر کنید.',
    limit: (count: number) =>
      `فقط ${formatCountOf(count, 'آگهی')} اول نشان داده می‌شود. برای دیدن بقیه، فیلتر بیشتری بگذارید.`,
  },
  words: {
    corrected: (from: string, to: string) => `نتایج برای «${to}» است. «${from}» در هیچ آگهی‌ای نبود.`,
    unknown: (word: string) => `«${word}» در هیچ آگهی‌ای نبود.`,
  },
  ignored: {
    lead: 'این بخش‌های لینک جست‌وجو را نشناختیم و کنار گذاشتیم:',
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
    onlyWords: 'عبارت کوتاه‌تر یا نام دیگری را امتحان کنید.',
  },
  emptyIndex: {
    title: 'آگهی تازه‌ای نیست',
    body: `فقط آگهی‌هایی را نشان می‌دهیم که در ${formatCountOf(SEARCH_FRESHNESS_HOURS, 'ساعت')} گذشته دیده شده‌اند. کمی بعد سر بزنید.`,
  },
  error: {
    title: 'آگهی‌ها بارگذاری نشد',
    body: 'کمی بعد دوباره امتحان کنید.',
    retry: 'تلاش دوباره',
  },
  sheet: {
    title: 'فیلترها',
    apply: (count: string) => `نمایش ${count}`,
    none: 'آگهی‌ای پیدا نشد',
    noneHint: 'یکی از فیلترها را بردارید.',
    countFailed: 'تعداد آگهی‌ها معلوم نشد، اما فیلترها را می‌توانید اعمال کنید.',
  },
  panel: {
    label: 'فیلترها',
    anyOption: 'بدون محدودیت',
    fromName: (label: string) => `حداقل ${label}`,
    toName: (label: string) => `حداکثر ${label}`,
    // The typed ends of a range (CS-102): the names are the fields', the units are said inside the field.
    unit: { toman: 'تومان', km: 'کیلومتر', year: 'سال', cc: 'سی‌سی' } as const,
    typedFrom: 'از',
    typedTo: 'تا',
    quickPicks: 'پیشنهاد سریع',
    pickAtMost: (end: string) => `تا ${end}`,
    pickAtLeast: (end: string) => `از ${end}`,
    problems: {
      not_a_number: 'فقط عدد بنویسید.',
      outside: (min: string, max: string) => `عدد باید بین ${min} و ${max} باشد.`,
      order: 'حداقل بیشتر از حداکثر است.',
    },
    showMore: 'نمایش بیشتر',
    showFewer: 'نمایش کمتر',
    searchWithin: (label: string) => `جست‌وجو در ${label}`,
    noMatch: 'موردی پیدا نشد',
    appliedInGroup: (count: number) => `${formatCount(count)} فعال`,
  },
  info: {
    /** The info button's name: «توضیح درباره‌ی «کارکرد»». */
    button: (label: string) => `توضیح درباره‌ی «${label}»`,
    close: 'بستن توضیح',
    rule: 'معیار',
    options: 'گزینه‌ها',
    conditions: 'فیلترها',
    order: 'ترتیب',
    bestToWorst: 'از بهترین به بدترین',
  },
  /** The line under the catalogue when the search is for one model (CS-67). */
  modelNotice: {
    lead: (name: string) => `ارزش بازار، محدوده‌ی قیمت و روند قیمت ${name}.`,
    /** For a model the filter options do not name yet (the worker has not counted it): the notice still stands. */
    thisModel: 'این مدل',
    link: 'دیدن صفحه‌ی مدل',
  },
  card: {
    unknownPrice: 'قیمت نامشخص',
    negotiable: 'توافقی',
    installment: 'فروش قسطی',
    unrated: 'بدون ارزیابی',
    unratedWithValue: 'قیمت این آگهی را با ارزش بازار نمی‌سنجیم.',
    unratedOutlier: 'قیمت با ارزش بازار خیلی فاصله دارد. شاید اشتباه تایپی یا قیمت نمایشی باشد.',
    unratedShowroom: 'قیمت خودروی صفر در نمایشگاه‌ها اغلب نمایشی است و ارزیابی نمی‌شود.',
    unratedNoValue: 'برای این خودرو ارزش بازار نداریم.',
    belowMarket: 'زیر ارزش بازار',
    aboveMarket: 'بالاتر از ارزش بازار',
    atMarket: 'نزدیک ارزش بازار',
    marketValue: 'ارزش بازار',
    noPhoto: 'بدون عکس',
    zeroKm: 'صفر کیلومتر',
    photos: (count: number) => formatCountOf(count, 'عکس'),
    viewOn: (source: string) => `رفتن به آگهی در ${source}`,
    /** The card's link leads to the listing's own page: its price analysis, comparables and the click-out. */
    viewPage: 'دیدن ارزیابی قیمت و جزئیات',
    opensInNewTab: 'در زبانه‌ی جدید باز می‌شود',
    /** The link to the model's page (CS-67), in the card's footer: the price, range and trend of the whole model. */
    modelPage: 'صفحه‌ی مدل',
    modelPageOf: (name: string) => `صفحه‌ی مدل ${name}`,
    thinHint: (source: string) => `قیمت و مشخصات را در آگهی ${source} ببینید.`,
    today: 'امروز منتشر شد',
    daysOnMarket: (days: number) => `${formatCountOf(days, 'روز')} روی بازار`,
    soundBoth: 'موتور و گیربکس سالم',
    paintedSomewhere: 'رنگ‌شدگی دارد',
    accident: 'تصادفی',
  },
} as const;
