import { formatCountOf } from '@carshenas/locale/format-number';

// Every word the inbox says (docs/product/glossary.md: «اعلان», «خوانده‌نشده», «خاموش کردن اعلان»). What a single
// notification says comes from its kind (packages/notifications/src/kinds.ts). Tests import these instead of
// retyping Persian, which loses the zero-width non-joiner.

export const NOTIFICATIONS_COPY = {
  title: 'اعلان‌ها',
  allRead: 'اعلان خوانده‌نشده‌ای ندارید.',
  markAllRead: 'همه را خواندم',
  markRead: 'علامت خوانده‌شده',
  unread: 'خوانده‌نشده',
  previousPrice: 'قیمت قبلی:',
  older: 'اعلان‌های قدیمی‌تر',
  newest: 'برگشت به تازه‌ترین‌ها',
  loading: 'در حال بارگذاری اعلان‌ها…',
  today: 'امروز',
  yesterday: 'دیروز',
  unknownKind: 'این اعلان نمایش داده نمی‌شود.',
  empty: {
    heading: 'هنوز اعلانی ندارید',
    body: 'تغییر قیمت آگهی‌های نشان‌شده و آگهی‌های تازه‌ی پرونده‌های جست‌وجو را اینجا می‌بینید.',
    action: 'جست‌وجوی خودرو',
  },
  olderEmpty: 'اعلان قدیمی‌تری نیست.',
  error: {
    heading: 'اعلان‌ها بارگذاری نشد',
    body: 'اعلان‌هایتان سر جایشان هستند.',
    retry: 'تلاش دوباره',
  },
  settings: {
    heading: 'تنظیم اعلان‌ها',
    lead: 'اعلان خاموش‌شده دیگر نمی‌آید و اعلان‌های قبلی می‌مانند.',
  },
  failures: {
    signedOut: 'از حساب خارج شده‌اید. دوباره وارد شوید.',
    markRead: 'علامت خوانده‌شده ثبت نشد.',
    mute: 'تنظیم اعلان ذخیره نشد.',
  },
  retry: 'تلاش دوباره',
  dismiss: 'بستن',
  accountCard: {
    heading: 'اعلان‌ها',
    none: 'اعلان خوانده‌نشده‌ای ندارید.',
  },
} as const;

/** «۳ اعلان خوانده‌نشده». */
export function unreadCountText(count: number): string {
  return formatCountOf(count, 'اعلان خوانده‌نشده');
}
