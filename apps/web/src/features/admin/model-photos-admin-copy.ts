import { isolateLtr } from '@carshenas/locale/bidi';
import { formatCount } from '@carshenas/locale/format-number';
import { MAX_PHOTO_LINK_LENGTH, type PhotoLinkProblem } from '@/lib/model-photo-link-rules';

// The words of the superadmin's model-photo screen (CS-97, ADR-0038). Numbers go through the locale formatters.

export const MODEL_PHOTOS_COPY = {
  title: 'عکس مدل‌های پرطرفدار',
  link: 'مدیریت عکس‌ها',
  linkBody: 'لینک عکس هر مدل را برای صفحه‌ی اصلی و فهرست مدل‌ها بگذارید.',
  lead: 'تا لینک عکسی نگذارید، هر مدل در صفحه‌ی اصلی و فهرست مدل‌ها عکس نمونه‌ی نوع بدنه را نشان می‌دهد.',
  backToDashboard: 'پنل مدیریت',
  info: {
    label: 'توضیح درباره‌ی «عکس مدل»',
    close: 'بستن توضیح',
    title: 'عکس مدل',
    paragraphs: [
      'پیش‌نمایش زیر هر لینک همان چیزی است که بازدیدکننده می‌بیند. تا پیش‌نمایش بارگذاری نشود، لینک ذخیره نمی‌شود.',
      'خود عکس هرگز ذخیره نمی‌شود: مرورگر بازدیدکننده آن را از سایت خودش می‌گیرد.',
      'اگر عکس روزی از دسترس خارج شود، به‌جایش عکس نمونه‌ی نوع بدنه با برچسب «نمونه» نشان داده می‌شود.',
    ],
  },
  listHeading: 'مدل‌ها',
  onHome: 'صفحه‌ی اصلی',
  onIndexOnly: 'فهرست مدل‌ها',
  empty: 'مدل پرطرفداری نیست. وقتی آگهی مدل‌ها خوانده شود، اینجا می‌آیند.',
  field: 'لینک عکس',
  hint: `با ${isolateLtr('https')} شروع شود و حداکثر ${formatCount(MAX_PHOTO_LINK_LENGTH)} کاراکتر باشد.`,
  placeholder: 'https://example.com/photo.jpg',
  save: 'ذخیره‌ی عکس',
  replace: 'عوض کردن عکس',
  clear: 'برداشتن عکس',
  setByLabel: 'گذاشته‌شده توسط',
  notSet: 'عکسی گذاشته نشده است.',
  preview: {
    label: 'پیش‌نمایش',
    empty: 'لینک را بنویسید تا پیش‌نمایش بیاید.',
    invalid: 'پیش‌نمایشی نیست.',
    loading: 'در حال بارگذاری پیش‌نمایش…',
    loaded: 'پیش‌نمایش آماده است.',
    failed: 'عکس بارگذاری نشد. لینک را بررسی کنید.',
    savedFailed: 'این لینک دیگر بارگذاری نمی‌شود. بازدیدکنندگان عکس نمونه را می‌بینند.',
  },
  problems: {
    scheme: `لینک باید با ${isolateLtr('https://')} شروع شود.`,
    host: `لینک باید به یک سایت واقعی برسد، نه به ${isolateLtr('localhost')} یا ${isolateLtr('IP')}، و نام کاربری نداشته باشد.`,
    plain: 'لینک نباید فاصله، نقل‌قول، علامت <> یا کاراکتر نامرئی داشته باشد.',
    length: `لینک باید از ۱۲ تا ${formatCount(MAX_PHOTO_LINK_LENGTH)} کاراکتر باشد.`,
  } satisfies Record<PhotoLinkProblem, string>,
  result: {
    changed: {
      set: 'ذخیره شد. صفحه‌ی اصلی و فهرست مدل‌ها آن را نشان می‌دهند.',
      clear: 'برداشته شد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این مدل دیگر در فهرست نیست. صفحه تازه شد.',
    failed: 'ذخیره نشد. دوباره امتحان کنید.',
    invalid: 'ذخیره نشد. صفحه را تازه کنید.',
  },
  loading: 'در حال بارگذاری مدل‌ها…',
  errorTitle: 'مدل‌ها بارگذاری نشد',
  errorBody: 'چیزی تغییر نکرده است.',
  retry: 'تلاش دوباره',
} as const;
