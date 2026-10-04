import { formatCountOf } from '@carshenas/locale/format-number';

// Every word the home page says (CS-63), in the glossary's terms (docs/product/glossary.md): «آگهی», «ارزش بازار»,
// «ارزیابی قیمت», «خودروی مشابه». What a catalogue means is never written here: it comes from the definitions in
// @carshenas/search (title, description, the info control's text); the numbers come from the database through the
// formatters in @carshenas/locale. Tests import these constants instead of retyping Persian, which loses the
// zero-width non-joiner.

const LISTING = 'آگهی';

export const HOME_COPY = {
  title: 'کارشناس',
  description: 'آگهی‌های خودروی کارکرده با ارزش بازار و ارزیابی قیمت. ببینید قیمت منصفانه است یا نه.',
  hero: {
    motto: 'ماشین درست را با قیمت درست بخرید',
    intro: 'آگهی‌های خودروهای کارکرده را از سایت‌های آگهی می‌خوانیم و ارزش‌گذاری می‌کنیم.',
    searchLabel: 'چه ماشینی می‌خواهید؟',
    submit: 'جست‌وجو',
    examplesLabel: 'نمونه‌های جست‌وجو',
    examples: [
      'پژو ۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون',
      'یه ماشین تمیز و بی‌دردسر می‌خوام',
      'ماشین خانوادگی زیر یک میلیارد',
    ],
    modes: { label: 'شروع کار', search: 'جست‌وجو', paste: 'ارزیابی لینک' },
    photoBy: 'عکس از',
    pause: 'توقف نمایش عکس‌ها',
    play: 'ادامه‌ی نمایش عکس‌ها',
  },
  bodyTypes: {
    title: 'نوع بدنه',
    count: (count: number) => formatCountOf(count, LISTING),
    all: { label: 'همه', hint: 'همه‌ی آگهی‌ها' },
  },
  rows: {
    count: (count: number) => formatCountOf(count, LISTING),
    seeAll: 'دیدن همه',
    /** The row's last tile: «دیدن همه‌ی ۶۳۰ آگهی». */
    seeAllCount: (count: number) => `دیدن همه‌ی ${formatCountOf(count, LISTING)}`,
    /** The link's name, which says which row it opens. */
    seeAllOf: (title: string) => `دیدن همه‌ی آگهی‌های «${title}»`,
  },
  more: { title: 'مجموعه‌های دیگر' },
  how: {
    title: 'کارشناس چطور کار می‌کند؟',
    steps: [
      {
        key: 'read',
        title: 'آگهی‌ها را می‌خوانیم',
        body: 'نام، تیپ و وضعیت هر خودرو را از متن آگهی درمی‌آوریم.',
      },
      {
        key: 'value',
        title: 'ارزش بازار را حساب می‌کنیم',
        body: 'از روی آگهی‌های همان مدل حساب می‌شود، با توجه به تیپ، سال، کارکرد و وضعیت بدنه. هر روز تازه می‌شود.',
      },
      {
        key: 'rate',
        title: 'قیمت را ارزیابی می‌کنیم',
        body: 'از «معامله‌ی عالی» تا «خیلی گران». دلیل هر ارزیابی کنارش نوشته شده است.',
      },
    ],
    trustTitle: 'امروز در کارشناس',
    searchable: 'آگهی در جست‌وجو',
    valuedOn: 'ارزش‌های بازار برای',
    rated: 'آگهی ارزیابی‌شده',
    reading: 'مورد درست خوانده شد',
    of: 'از',
    readingHint: 'از متن آگهی‌ها',
    status: 'همه‌ی اعداد و تازگی داده‌ها',
    errorTitle: 'عددها بارگذاری نشد',
    retry: 'تلاش دوباره',
  },
  cta: {
    title: 'از بهترین معامله‌ها شروع کنید',
    action: 'دیدن همه‌ی آگهی‌ها',
  },
  footer: {
    label: 'پایین صفحه',
    search: 'جست‌وجوی خودرو',
    status: 'تازگی داده‌ها',
    models: 'مدل‌های خودرو',
    credits: 'منبع عکس‌های صفحه‌ی اصلی',
    plates: 'پلاک‌ها محو شده‌اند',
    changes: 'برش و تغییر اندازه',
    by: 'عکس از',
    changed: 'تغییرها:',
    licence: 'پروانه:',
  },
} as const;
