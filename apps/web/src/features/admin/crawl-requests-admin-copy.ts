import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { MAX_DECLINE_REASON_LENGTH } from '@/lib/crawl-requests-rules';
import { PASTE_DAYS } from '@/lib/crawl-requests-demand';

// The words of the superadmin's crawl-request screen (CS-71, ADR-0036). The states' own words are the buyer's
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
  link: 'تأیید یا رد درخواست‌ها',
  linkBody: 'مدل‌هایی که خریداران می‌خواهند بیشتر خوانده شوند، به ترتیب تقاضا.',
  lead: 'خریدار وقتی پرونده‌اش آگهی کمی دارد، می‌تواند درخواست کند مدلش بیشتر خوانده شود. تأیید فقط مدل را در صف می‌گذارد و چیزی نمی‌خواند.',
  backToDashboard: 'پنل مدیریت',
  paused: 'خزش متوقف است. تا ازسرگیری آن، مدل‌های تأییدشده در صف می‌مانند و درخواستی به سایت‌ها نمی‌رود.',
  filterLabel: 'وضعیت درخواست‌ها',
  filter: FILTER_LABELS,
  filterCount: (label: string, count: number) => `${label} (${formatCount(count)})`,
  demandHeading: 'تقاضا برای هر مدل',
  demandLead: `پرتقاضاترین مدل اول. لینک‌های چسبانده‌شده در ${formatCountOf(PASTE_DAYS, 'روز')} گذشته شمرده می‌شوند.`,
  demandRow: (buyers: number, requests: number, pasted: number) =>
    [
      buyers === 0 ? null : formatCountOf(buyers, 'خریدار'),
      requests === 0 ? null : formatCountOf(requests, 'درخواست'),
      pasted === 0 ? null : `${formatCountOf(pasted, 'لینک')} چسبانده‌شده`,
    ]
      .filter((part) => part !== null)
      .join('، '),
  demandRead: 'از پیش خوانده می‌شود',
  pasted: (pasted: number) =>
    `${formatCountOf(pasted, 'لینک')} چسبانده‌شده در ${formatCountOf(PASTE_DAYS, 'روز')} گذشته`,
  requestsHeading: 'درخواست‌ها',
  requestsOrder: 'به ترتیب تقاضا. تصمیم جای درخواست را عوض نمی‌کند.',
  empty: {
    pending: 'درخواست در انتظاری نیست.',
    approved: 'درخواست تأییدشده‌ای نیست.',
    declined: 'درخواست ردشده‌ای نیست.',
    fulfilled: 'درخواست خوانده‌شده‌ای نیست.',
    all: 'هیچ خریداری درخواستی نداده است.',
  },
  demand: (buyers: number) => formatCountOf(buyers, 'خریدار'),
  filesOf: (files: number) => formatCountOf(files, 'پرونده'),
  asked: (date: string) => `اولین درخواست: ${date}`,
  decidedBy: (who: string, date: string) => `${who}، ${date}`,
  decidedLabel: 'تصمیم',
  reasonLabel: 'دلیل',
  filesLabel: 'پرونده‌های وابسته',
  moreFiles: (count: number) => `+${formatCount(count)} پرونده‌ی دیگر`,
  approve: 'تأیید',
  approveNotifies: 'خریداران خبردار می‌شوند.',
  reasonEmpty: 'دلیل رد را بنویسید.',
  shownOf: (shown: number, total: number) => `نمایش ${formatCount(shown)} از ${formatCount(total)}`,
  loading: 'در حال بارگذاری درخواست‌ها…',
  errorTitle: 'درخواست‌ها بارگذاری نشد',
  errorBody: 'چیزی تغییر نکرده است.',
  retry: 'تلاش دوباره',
  decline: 'رد با دلیل',
  reconsider: 'تأیید دوباره',
  reasonField: 'دلیل رد',
  reasonHint: `تا ${formatCount(MAX_DECLINE_REASON_LENGTH)} کاراکتر. خریدار آن را در اعلانش می‌خواند.`,
  declineSubmit: 'رد کردن درخواست',
  cancel: 'انصراف',
  result: {
    changed: { approved: 'تأیید شد و خریداران خبردار شدند.', declined: 'رد شد و خریداران خبردار شدند.' },
    unchanged: { approved: 'پیش‌تر تأیید شده بود.', declined: 'پیش‌تر رد شده بود.' },
    stale: 'این درخواست در این فاصله تغییر کرده است. صفحه تازه شد. دوباره تصمیم بگیرید.',
    failed: 'تصمیم ثبت نشد. دوباره امتحان کنید.',
    invalid: 'تصمیم ثبت نشد. اگر دلیل رد را ننوشته‌اید، بنویسید.',
  },
  trackedHeading: 'مدل‌های پوشش‌داده‌شده',
  trackedLead: 'هر مدل با چگونگی ورودش به فهرست: انتخاب مالک یا درخواست تأییدشده‌ی خریدار.',
  trackedManage: 'مدیریت مدل‌ها',
  trackedOwner: 'انتخاب مالک',
  trackedRequest: (who: string, date: string) => `از درخواست تأییدشده، ${who}، ${date}`,
  trackedEmpty: 'مدلی خوانده نمی‌شود.',
  stateOfFile: { watching: 'در حال پایش', paused: 'متوقف', closed: 'بسته' },
} as const;
