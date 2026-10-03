import { formatCountOf } from '@carshenas/locale/format-number';

// Every word the inbox says (docs/product/glossary.md: «اعلان», «خوانده‌نشده», «خاموش کردن اعلان»). What a single
// notification says comes from its kind (packages/notifications/src/kinds.ts). Tests import these instead of
// retyping Persian, which loses the zero-width non-joiner.

export const NOTIFICATIONS_COPY = {
  title: 'اعلان‌ها',
  lead: 'هر تغییری در آگهی‌هایی که دنبال می‌کنید، اینجا خبرتان می‌کنیم.',
  allRead: 'همه‌ی اعلان‌ها خوانده شده‌اند.',
  markAllRead: 'همه را خواندم',
  markRead: 'علامت خوانده‌شده',
  unread: 'خوانده‌نشده',
  previousPrice: 'قیمت قبلی:',
  older: 'اعلان‌های قدیمی‌تر',
  newest: 'برگشت به تازه‌ترین‌ها',
  loading: 'در حال بارگذاری اعلان‌ها…',
  today: 'امروز',
  yesterday: 'دیروز',
  unknownKind: 'اعلانی که این نسخه‌ی کارشناس نمی‌تواند نشانش دهد.',
  empty: {
    heading: 'هنوز اعلانی ندارید',
    body: 'وقتی قیمت آگهی‌ای که نشان کرده‌اید پایین بیاید، همین‌جا خبرتان می‌کنیم؛ بدون اینکه دوباره جست‌وجو کنید.',
    action: 'جست‌وجوی خودرو',
  },
  olderEmpty: 'اعلان قدیمی‌تری نیست.',
  error: {
    heading: 'اعلان‌ها بارگذاری نشد',
    body: 'اتصال را بررسی کنید و دوباره امتحان کنید. اعلان‌هایتان سر جایشان هستند.',
    retry: 'دوباره امتحان کنید',
  },
  settings: {
    heading: 'کدام اعلان‌ها را بگیرید',
    lead: 'اعلانی که خاموش کنید دیگر ساخته نمی‌شود؛ اعلان‌هایی که گرفته‌اید می‌مانند.',
  },
  failures: {
    signedOut: 'از حساب خارج شده‌اید؛ دوباره وارد شوید.',
    markRead: 'علامت خوانده‌شده ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
    mute: 'تنظیم اعلان ذخیره نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
  },
  retry: 'تلاش دوباره',
  dismiss: 'بستن',
  menuItem: 'اعلان‌ها',
  accountCard: {
    heading: 'اعلان‌ها',
    none: 'اعلان خوانده‌نشده‌ای ندارید.',
    open: 'دیدن اعلان‌ها',
  },
} as const;

/** «۳ اعلان خوانده‌نشده». */
export function unreadCountText(count: number): string {
  return formatCountOf(count, 'اعلان خوانده‌نشده');
}
