import { formatCountOf } from '@carshenas/locale/format-number';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';
import type { MarkedFilter } from '@/features/marked-listings/marked-types';

// Every word the marked-listings page says (docs/product/glossary.md: «آگهی‌های نشان‌شده», «نشان کردن»). Tests import
// these instead of retyping Persian, which loses the zero-width non-joiner.

export const MARKED_COPY = {
  title: 'آگهی‌های نشان‌شده',
  count: (count: number) => formatCountOf(count, 'آگهی'),
  filtersLabel: 'فیلتر آگهی‌ها',
  filters: {
    all: 'همه',
    active: 'در بازار',
    dropped: 'قیمتشان کم شده',
    off: 'از بازار رفته',
  } satisfies Record<MarkedFilter, string>,
  price: {
    now: 'قیمت امروز',
    last: 'آخرین قیمت',
    whenMarked: 'قیمت روزی که نشان کردید',
  },
  change: {
    down: 'قیمت کم شد',
    up: 'قیمت بالا رفت',
    same: 'قیمت تغییر نکرده',
    detailDown: (amount: string, share: string) => `${amount} (${share}) ارزان‌تر شده است.`,
    detailUp: (amount: string, share: string) => `${amount} (${share}) گران‌تر شده است.`,
    detailSame: 'همان قیمت روزی که نشانش کردید.',
  },
  status: {
    sold: 'فروخته شد',
    expired: 'منقضی شد',
    gone: 'از دیوار برداشته شد',
    removed: 'از کارشناس برداشته شد',
    since: (date: string) => `از ${date}`,
  },
  unrated: 'بدون ارزیابی',
  markedOn: (date: string) => `نشان‌شده در ${date}`,
  unmarkedNotice: 'نشان برداشته شد.',
  empty: {
    heading: 'هنوز آگهی‌ای نشان نکرده‌اید',
    body: 'در جست‌وجو یا صفحه‌ی آگهی، «نشان کردن» را بزنید. اگر قیمت آگهی نشان‌شده کم شود یا فروخته شود، در اعلان‌ها خبرتان می‌کنیم.',
    action: 'جست‌وجوی خودرو',
  },
  emptyFilter: {
    heading: 'آگهی‌ای با این فیلتر ندارید',
    action: 'دیدن همه',
  },
  loading: 'در حال بارگذاری آگهی‌های نشان‌شده…',
  error: {
    heading: 'آگهی‌های نشان‌شده بارگذاری نشد',
    body: 'آگهی‌های نشان‌شده‌تان سر جایشان است.',
    retry: 'تلاش دوباره',
  },
  accountCard: {
    heading: 'آگهی‌های نشان‌شده',
    none: 'هنوز آگهی‌ای نشان نکرده‌اید.',
  },
  /** The rules the page lives by, in one place: the info control beside the title prints them. */
  info: {
    label: 'توضیح درباره‌ی آگهی‌های نشان‌شده',
    close: 'بستن',
    title: 'آگهی‌های نشان‌شده',
    rows: [
      { label: 'سقف', text: `${formatCountOf(MAX_MARKED_LISTINGS, 'آگهی')} برای هر حساب.` },
      {
        label: 'کاهش قیمت',
        text: 'قیمت امروز از قیمت روزی که نشان کردید کمتر است. توافقی یا قسطی شدن کاهش حساب نمی‌شود.',
      },
      { label: 'از بازار رفته', text: 'فروخته‌شده، منقضی‌شده یا برداشته‌شده.' },
    ],
  },
} as const;
