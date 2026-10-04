import { formatCountOf } from '@carshenas/locale/format-number';

// Every word the home page says (CS-63), in the glossary's terms (docs/product/glossary.md): «آگهی», «ارزش بازار»,
// «ارزیابی قیمت», «خودروی مشابه». What a catalogue means is never written here: it comes from the definitions in
// @carshenas/search (title, description, the info control's text); the numbers come from the database through the
// formatters in @carshenas/locale. Tests import these constants instead of retyping Persian, which loses the
// zero-width non-joiner.

const LISTING = 'آگهی';

export const HOME_COPY = {
  title: 'کارشناس',
  description:
    'آگهی‌های خودروی کارکرده از سایت‌های آگهی، با ارزش بازار هر خودرو و ارزیابی قیمت: بفهمید قیمت منصفانه است یا نه، و چرا.',
  hero: {
    motto: 'ماشین درست را با قیمت درست بخرید',
    intro:
      'آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، ارزش بازار هر ماشین را حساب می‌کنیم و می‌گوییم قیمتش منصفانه است یا نه، با دلیل.',
    searchLabel: 'چه ماشینی می‌خواهید؟ به زبان خودتان بنویسید',
    submit: 'جست‌وجو',
    examplesLabel: 'نمونه‌ی جمله',
    examples: [
      '۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون',
      'یک ماشین تمیز، کم‌کارکرد و بی‌دردسر',
      'خانوادگی زیر ۱ میلیارد',
    ],
    modes: { label: 'راه ورود به کارشناس', search: 'جست‌وجو', paste: 'ارزیابی لینک' },
    photoBy: 'عکس:',
    pause: 'توقف نمایش تصاویر',
    play: 'ادامه‌ی نمایش تصاویر',
  },
  bodyTypes: {
    title: 'بر اساس شکل خودرو',
    lead: 'یکی را بزنید تا آگهی‌های همان نوع را ببینید.',
    count: (count: number) => formatCountOf(count, LISTING),
    all: { label: 'همه', hint: 'همه‌ی آگهی‌ها' },
  },
  rows: {
    label: 'مجموعه‌های آماده',
    count: (count: number) => formatCountOf(count, LISTING),
    seeAll: 'دیدن همه',
    /** The row's last tile: «دیدن همه‌ی ۶۳۰ آگهی». */
    seeAllCount: (count: number) => `دیدن همه‌ی ${formatCountOf(count, LISTING)}`,
    /** The link's name, which says which row it opens. */
    seeAllOf: (title: string) => `دیدن همه‌ی آگهی‌های «${title}»`,
    previous: 'قبلی',
    next: 'بعدی',
  },
  more: { title: 'مجموعه‌های دیگر' },
  how: {
    title: 'کارشناس چطور کار می‌کند؟',
    steps: [
      {
        key: 'read',
        title: 'آگهی‌ها را می‌خوانیم',
        body: 'آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم، نام و تیپ هر خودرو را از میان نوشته‌های پراکنده درمی‌آوریم و آگهی‌ها را یک‌جا کنار هم می‌گذاریم.',
      },
      {
        key: 'value',
        title: 'ارزش بازار را حساب می‌کنیم',
        body: 'هر روز، از خودروهای مشابه همان روز، ارزش بازار هر خودرو را برآورد می‌کنیم؛ با تیپ، سال، کارکرد و وضعیت بدنه.',
      },
      {
        key: 'rate',
        title: 'قیمت را ارزیابی می‌کنیم و دلیلش را می‌گوییم',
        body: 'قیمت هر آگهی را با ارزش بازار می‌سنجیم، از «معامله‌ی عالی» تا «خیلی گران»، و کنارش می‌نویسیم چرا.',
      },
    ],
    trustTitle: 'اعداد این صفحه، از خود پایگاه داده',
    searchable: 'آگهی قابل‌جست‌وجو',
    valuedOn: 'ارزش‌های بازار برای',
    rated: 'آگهی ارزیابی قیمت گرفت',
    reading: 'واقعیت درست خوانده شد',
    of: 'از',
    readingHint: 'ارزیابی خواندن متن آگهی‌ها',
    status: 'همه‌ی اعداد و تازگی داده‌ها',
    unavailable: 'هنوز عددی برای نمایش نداریم.',
    errorTitle: 'عددها خوانده نشد',
    errorBody: 'پایگاه داده پاسخ نداد؛ کمی بعد دوباره امتحان کنید.',
    retry: 'تلاش دوباره',
  },
  cta: {
    title: 'ماشین بعدی‌تان را با اطمینان بخرید',
    body: 'همه‌ی آگهی‌ها را با ارزش بازار و ارزیابی قیمت ببینید و از بهترین معامله شروع کنید.',
    action: 'دیدن همه‌ی آگهی‌ها',
  },
  footer: {
    label: 'پایین صفحه',
    search: 'جست‌وجوی خودرو',
    status: 'تازگی داده‌ها',
    models: 'مدل‌های خودرو',
    credits: 'اعتبار عکس‌های صفحه‌ی اصلی',
    creditsLead:
      'عکس‌های بالای صفحه از تهران است و از همین سایت نمایش داده می‌شود. هر عکس این‌جا با پروانه‌ی خودش آمده است.',
    plates: 'پلاک‌ها محو شده‌اند',
    changes: 'برش و تغییر اندازه',
    requiresCredit: 'ذکر نام عکاس لازم است',
    by: 'عکس از',
    changed: 'تغییرها:',
    licence: 'پروانه:',
  },
} as const;
