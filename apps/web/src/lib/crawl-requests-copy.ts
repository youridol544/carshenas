import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import {
  FEW_MATCHES_BELOW,
  MAX_OPEN_REQUESTS_PER_ACCOUNT,
  MAX_REQUESTS_PER_FILE,
  type CrawlRequestState,
} from '@/lib/crawl-requests-rules';
import type { ScopeStatus } from '@/lib/crawl-requests-types';

// Every word crawl requests say (CS-71, ADR-0036), in the glossary's terms. The rule that offers the request is
// written once, in crawl-requests-rules.ts; numbers go through the locale formatters. Tests import these constants
// instead of retyping Persian, which loses the zero-width non-joiner.

export const REQUEST_STATE_LABELS = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شد',
  declined: 'رد شد',
  fulfilled: 'خوانده شد',
} as const satisfies Record<CrawlRequestState, string>;

export const SCOPE_STATUS_LABELS = {
  ...REQUEST_STATE_LABELS,
  none: 'درخواست نشده',
  tracked: 'از پیش خوانده می‌شود',
} as const satisfies Record<ScopeStatus, string>;

const MODEL = 'مدل';
const TITLE = 'درخواست جست‌وجوی بیشتر';

export const CRAWL_REQUESTS_COPY = {
  card: {
    title: TITLE,
    infoLabel: `توضیح درباره‌ی ${TITLE}`,
    infoClose: 'بستن',
    info: {
      what: `بعضی مدل‌ها را کامل نمی‌خوانیم. اگر کمتر از ${formatCount(FEW_MATCHES_BELOW)} آگهی مطابق پرونده‌ی شما باشد، درخواست بدهید تا مدیر تصمیم بگیرد.`,
      limits: `هر پرونده تا ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} و هر حساب تا ${formatCountOf(MAX_OPEN_REQUESTS_PER_ACCOUNT, 'درخواست')} در انتظار پاسخ دارد.`,
    },
    lead: (matches: number) =>
      matches === 0
        ? 'آگهی مطابق این پرونده نداریم.'
        : `فقط ${formatCountOf(matches, 'آگهی')} مطابق این پرونده داریم.`,
    submit: 'ثبت درخواست',
    notifies: 'وقتی مدیر تصمیم بگیرد، در اعلان‌ها خبردار می‌شوید.',
    submitMany: (count: number) => `ثبت درخواست برای ${formatCountOf(count, MODEL)}`,
    scopesLabel: 'مدل‌های این پرونده',
    addModel: 'انتخاب مدل در جست‌وجو',
    needsModel: 'برای درخواست، در جست‌وجو یک مدل یا تیپ را مشخص کنید.',
    tooMany: `این پرونده بیش از ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} دارد. برای درخواست، پرونده‌ای با مدل‌های کمتر بسازید.`,
    notes: {
      pendingJoin: 'کس دیگری پیش‌تر درخواست داده و منتظر پاسخ است. با ثبت درخواست، پاسخ را شما هم می‌گیرید.',
      pending: 'پاسخ را در اعلان‌ها می‌بینید.',
      approvedPaused: 'آگهی‌های این مدل با تأخیر در پرونده‌ی شما می‌آیند.',
      approved: 'آگهی‌های این مدل را می‌خوانیم تا در پرونده‌ی شما بیایند.',
      // A decline without a reason has nothing to add to its badge.
      declined: (reason: string | null) => (reason === null ? '' : `دلیل: ${reason}`),
      fulfilled: 'حالا آگهی‌های این مدل را در جست‌وجو می‌بینید.',
      tracked: 'برای این مدل درخواستی لازم نیست.',
    },
    errors: {
      declined: 'درخواست این مدل پیش‌تر رد شده است.',
      tooMany: `این پرونده بیش از ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} دارد.`,
      fileLimit: `هر پرونده تا ${formatCount(MAX_REQUESTS_PER_FILE)} مدل یا تیپ می‌تواند درخواست بدهد.`,
      accountLimit: `حداکثر ${formatCountOf(MAX_OPEN_REQUESTS_PER_ACCOUNT, 'درخواست')} در انتظار پاسخ دارید. درخواست تازه را بعد از پاسخ ثبت کنید.`,
      notNeeded: `این پرونده دست‌کم ${formatCount(FEW_MATCHES_BELOW)} آگهی دارد و نیازی به درخواست نیست.`,
      failed: 'درخواست ثبت نشد.',
      signedOut: 'از حساب خارج شده‌اید. دوباره وارد شوید.',
      gone: 'این پرونده دیگر وجود ندارد.',
    },
    dismiss: 'بستن پیام',
    retry: 'تلاش دوباره',
  },
  /** On the file's card in the list. */
  list: {
    label: TITLE,
    count: (count: number) => `برای ${formatCountOf(count, MODEL)}`,
  },
} as const;
