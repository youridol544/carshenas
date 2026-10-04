import { formatCount } from '@carshenas/locale/format-number';
import { MAX_MARKED_LISTINGS } from '@/features/marks/marks-rules';

// Every word the mark control says (docs/product/glossary.md: «نشان کردن», «آگهی‌های نشان‌شده»). Tests import these
// instead of retyping Persian, which loses the zero-width non-joiner.

export const MARKS_COPY = {
  mark: 'نشان کردن',
  marked: 'نشان‌شده',
  unmarkRow: 'برداشتن نشان',
  /** The control's name for a screen reader; whether it is on is aria-pressed's job. */
  markNamed: (title: string) => `نشان کردن آگهی ${title}`,
  announced: { marked: 'آگهی نشان شد.', unmarked: 'نشان آگهی برداشته شد.' },
  announcedBack: 'آگهی برایتان نشان شد.',
  visitor: {
    heading: 'برای نشان کردن وارد شوید',
    body: 'آگهی‌های نشان‌شده در حساب شما می‌مانند. اگر قیمتشان کم شود یا فروخته شوند، در اعلان‌ها خبرتان می‌کنیم.',
    signIn: 'ورود',
    signUp: 'ثبت‌نام',
    close: 'بستن',
    returnNote: 'بعد از ورود به همین صفحه برمی‌گردید و آگهی نشان‌شده است.',
  },
  failures: {
    mark: 'آگهی نشان نشد.',
    unmark: 'نشان آگهی برداشته نشد.',
    signedOut: 'از حساب خارج شده‌اید. دوباره وارد شوید.',
    full: `به سقف ${formatCount(MAX_MARKED_LISTINGS)} آگهی نشان‌شده رسیده‌اید. نشان چند آگهی را بردارید و دوباره امتحان کنید.`,
    missing: 'این آگهی دیگر وجود ندارد.',
  },
  retry: 'تلاش دوباره',
  dismiss: 'بستن',
} as const;
