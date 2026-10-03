import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import type { MarkedFilter } from '@/features/marked-listings/marked-types';

// Every word the marked-listings page says (docs/product/glossary.md: «آگهی‌های نشان‌شده», «نشان کردن»). Tests import
// these instead of retyping Persian, which loses the zero-width non-joiner.

export const MARKED_COPY = {
  title: 'آگهی‌های نشان‌شده',
  lead: 'آگهی‌هایی که نشان کرده‌اید، با قیمت امروزشان کنار قیمت روزی که نشانشان کردید. اگر قیمتی کم شود یا آگهی‌ای فروخته شود، در اعلان‌ها خبرتان می‌کنیم.',
  count: (count: number) => formatCountOf(count, 'آگهی نشان‌شده'),
  filtersLabel: 'کدام آگهی‌ها را ببینم',
  filters: {
    all: 'همه',
    active: 'در بازار',
    dropped: 'قیمتشان کم شده',
    off: 'از بازار رفته',
  } satisfies Record<MarkedFilter, string>,
  price: {
    now: 'قیمت امروز',
    last: 'آخرین قیمت',
    whenMarked: 'روز نشان کردن',
  },
  change: {
    down: 'قیمت کم شد',
    up: 'قیمت بالا رفت',
    same: 'قیمت تغییر نکرده',
    detailDown: (amount: string, share: string) => `${amount} ارزان‌تر از روزی که نشانش کردید (${share})`,
    detailUp: (amount: string, share: string) => `${amount} گران‌تر از روزی که نشانش کردید (${share})`,
    detailSame: 'همان قیمت روزی که نشانش کردید.',
  },
  status: {
    sold: 'فروخته شد',
    expired: 'منقضی شد',
    gone: 'از سایت منبع برداشته شد',
    removed: 'از کارشناس برداشته شد',
    since: (date: string) => `از ${date}`,
  },
  unrated: 'بدون ارزیابی',
  markedOn: (date: string) => `نشان‌شده در ${date}`,
  noPhoto: 'بدون عکس',
  view: 'دیدن آگهی',
  unmarkedNotice: 'نشان برداشته شد.',
  undo: 'بازگرداندن',
  empty: {
    heading: 'هنوز آگهی‌ای نشان نکرده‌اید',
    body: 'در جست‌وجو یا صفحه‌ی هر آگهی، «نشان کردن» را بزنید تا اینجا جمع شود. اگر قیمتش کم شود یا فروخته شود، خبرتان می‌کنیم.',
    action: 'جست‌وجوی خودرو',
  },
  emptyFilter: {
    heading: 'آگهی‌ای با این فیلتر ندارید',
    action: 'دیدن همه',
  },
  loading: 'در حال بارگذاری آگهی‌های نشان‌شده…',
  error: {
    heading: 'آگهی‌های نشان‌شده بارگذاری نشد',
    body: 'اتصال را بررسی کنید و دوباره امتحان کنید. آگهی‌های نشان‌شده‌تان سر جایشان هستند.',
    retry: 'دوباره امتحان کنید',
  },
  accountCard: {
    heading: 'آگهی‌های نشان‌شده',
    none: 'هنوز آگهی‌ای نشان نکرده‌اید.',
  },
  /** The rules the page lives by, in one place: the info control beside the title prints them. */
  info: {
    label: 'توضیح درباره‌ی آگهی‌های نشان‌شده',
    close: 'بستن',
    title: 'نشان‌کردن چطور کار می‌کند',
    rows: [
      {
        label: 'سقف',
        text: `هر حساب تا ${formatCount(MAX_MARKED_LISTINGS)} آگهی را می‌تواند نشان کند؛ برای نشان‌کردن بیشتر، نشان چند آگهی را بردارید.`,
      },
      {
        label: 'کاهش قیمت',
        text: 'وقتی قیمت اعلام‌شده‌ی آگهی از آخرین قیمت اعلام‌شده‌اش کمتر شود؛ توافقی شدن یا قسطی شدن کاهش حساب نمی‌شود.',
      },
      {
        label: 'از بازار رفته',
        text: 'آگهی فروخته شده، منقضی شده یا دیگر در سایت منبع نیست. اگر برگردد، دوباره خبرتان می‌کنیم.',
      },
      { label: 'زمان اعلان', text: 'هر تغییر یک‌بار در اعلان‌ها می‌آید، تا چند دقیقه بعد از دیده‌شدنش.' },
    ],
  },
  menuItem: 'آگهی‌های نشان‌شده',
  back: 'حساب من',
} as const;
