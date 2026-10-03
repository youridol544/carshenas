import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { MAX_DECLINE_REASON_LENGTH } from '@/lib/crawl-requests-rules';

// The words of the superadmin's crawl-request screen (CS-71, ADR-0033). The states' own words are the buyer's
// (REQUEST_STATE_LABELS in @/lib/crawl-requests-copy), never written twice. Numbers go through the locale formatters.

export const FILTER_LABELS = {
  pending: 'در انتظار',
  approved: 'تأییدشده',
  declined: 'ردشده',
  fulfilled: 'خوانده‌شده',
  all: 'همه',
} as const;

export const CRAWL_REQUESTS_ADMIN_COPY = {
  title: 'درخواست‌های جست‌وجوی بیشتر',
  link: 'درخواست‌های جست‌وجوی بیشتر',
  linkBody: 'مدل‌هایی که خریداران می‌خواهند بیشتر خوانده شوند: تأیید یا رد، و تقاضا به تفکیک مدل.',
  lead: 'وقتی پرونده‌ی یک خریدار آگهی کمی دارد، می‌تواند بخواهد مدلش بیشتر خوانده شود. تأیید یا رد با شماست؛ ظرفیت روزانه‌ی خواندن محدود است (ADR-0017). تأیید فقط مدل را در صف می‌گذارد و خودش چیزی نمی‌خواند.',
  backToDashboard: 'بازگشت به پنل مدیریت',
  paused:
    'خواندن آگهی‌ها اکنون متوقف است. تأیید یک درخواست مدل را در صف می‌گذارد و هیچ درخواستی به هیچ سایتی نمی‌فرستد؛ نوبت مدل با از سرگرفتن خواندن می‌رسد.',
  filterLabel: 'وضعیت درخواست‌ها',
  filter: FILTER_LABELS,
  filterCount: (label: string, count: number) => `${label} (${formatCount(count)})`,
  demandHeading: 'تقاضا به تفکیک مدل',
  demandLead: 'هر مدل با تعداد خریداران و درخواست‌هایش، پرتقاضاترین اول.',
  demandRow: (buyers: number, requests: number) =>
    `${formatCountOf(buyers, 'خریدار')} · ${formatCountOf(requests, 'درخواست')}`,
  requestsHeading: 'درخواست‌ها',
  requestsOrder: 'به ترتیب تقاضا: پرتقاضاترین اول.',
  empty: {
    pending: 'درخواست در انتظاری نیست.',
    approved: 'درخواست تأییدشده‌ای نیست.',
    declined: 'درخواست ردشده‌ای نیست.',
    fulfilled: 'درخواست خوانده‌شده‌ای نیست.',
    all: 'هنوز هیچ خریداری درخواستی نداده است.',
  },
  demand: (buyers: number) => formatCountOf(buyers, 'خریدار'),
  filesOf: (files: number) => formatCountOf(files, 'پرونده'),
  asked: (date: string) => `اولین درخواست: ${date}`,
  decidedBy: (who: string, date: string) => `${who} · ${date}`,
  decidedLabel: 'تصمیم',
  reasonLabel: 'دلیل',
  filesLabel: 'پرونده‌های وابسته',
  moreFiles: (count: number) => `+${formatCount(count)} پرونده‌ی دیگر`,
  buyerLabel: 'خریدار',
  approve: 'تأیید',
  decline: 'رد با دلیل',
  reconsider: 'تأیید دوباره',
  reasonField: 'دلیل رد (برای خریدار نوشته می‌شود)',
  reasonHint: `تا ${formatCount(MAX_DECLINE_REASON_LENGTH)} نویسه؛ خریدار آن را در اعلانش می‌خواند.`,
  declineSubmit: 'رد کردن درخواست',
  cancel: 'انصراف',
  result: {
    changed: { approved: 'تأیید شد و خریداران خبردار شدند.', declined: 'رد شد و خریداران خبردار شدند.' },
    unchanged: { approved: 'پیش‌تر تأیید شده بود.', declined: 'پیش‌تر رد شده بود.' },
    stale: 'این درخواست بین دیدن و فشردن تغییر کرده است. صفحه تازه شد؛ دوباره بسنجید.',
    failed: 'ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.',
    invalid: 'فرم نامعتبر بود. اگر دلیل رد را ننوشته‌اید، بنویسید.',
  },
  trackedHeading: 'مدل‌هایی که اکنون خوانده می‌شوند',
  trackedLead:
    'هر مدل با اینکه چگونه به فهرست آمده است: با انتخاب مالک، یا از درخواست یک خریدار که تأیید شد.',
  trackedOwner: 'انتخاب مالک',
  trackedRequest: (who: string, date: string) => `از درخواست تأییدشده · ${who} · ${date}`,
  trackedEmpty: 'هنوز مدلی خوانده نمی‌شود.',
  stateOfFile: { watching: 'در حال پایش', paused: 'متوقف', closed: 'بسته' },
} as const;
