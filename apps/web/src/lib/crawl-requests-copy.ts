import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import {
  FEW_MATCHES_BELOW,
  MAX_OPEN_REQUESTS_PER_ACCOUNT,
  MAX_REQUESTS_PER_FILE,
  OFFER_RULE,
  type CrawlRequestState,
} from '@/lib/crawl-requests-rules';
import type { ScopeStatus } from '@/lib/crawl-requests-types';

// Every word crawl requests say (CS-71, ADR-0032), in the glossary's terms. The rule that offers the request is
// written once, in crawl-requests-rules.ts, and only set out here; numbers go through the locale formatters. Tests
// import these constants instead of retyping Persian, which loses the zero-width non-joiner.

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

export const CRAWL_REQUESTS_COPY = {
  card: {
    title: 'از کارشناس بخواهید بیشتر بگردد',
    infoLabel: 'توضیح درباره‌ی «از کارشناس بخواهید بیشتر بگردد»',
    infoClose: 'بستن توضیح',
    info: {
      what: 'کارشناس آگهی‌ها را مدل‌به‌مدل و در اندازه‌ی ظرفیت روزانه‌ی خواندن می‌خواند. اگر مدل پرونده‌ی شما هنوز کامل خوانده نمی‌شود، می‌توانید درخواست بدهید و مدیر درباره‌اش تصمیم می‌گیرد.',
      whenHeading: 'این کارت چه وقت نشان داده می‌شود',
      when: OFFER_RULE.sentences,
      limitsHeading: 'محدودیت‌ها',
      limits: [
        `هر پرونده تا ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} (یا تیپ) می‌تواند بخواهد.`,
        `هر حساب تا ${formatCountOf(MAX_OPEN_REQUESTS_PER_ACCOUNT, 'درخواست')} در انتظار پاسخ دارد.`,
      ],
    },
    lead: (matches: number) =>
      matches === 0
        ? 'هیچ آگهی‌ای با این پرونده نمی‌خواند. اگر کارشناس این مدل را کامل‌تر بخواند، آگهی‌های بیشتری پیدا می‌شود.'
        : `فقط ${formatCountOf(matches, 'آگهی')} با این پرونده می‌خواند. اگر کارشناس این مدل را کامل‌تر بخواند، آگهی‌های بیشتری پیدا می‌شود.`,
    leadAnswered: 'درخواست شما برای این پرونده این‌طور پیش رفته است.',
    submit: 'ثبت درخواست',
    submitMany: (count: number) => `ثبت درخواست برای ${formatCountOf(count, MODEL)}`,
    asked: 'درخواست ثبت شد. وقتی مدیر تصمیم بگیرد، در اعلان‌ها به شما خبر می‌دهیم.',
    scopesLabel: 'مدل‌های این پرونده',
    needsModel:
      'برای درخواست، در جست‌وجو یک مدل یا تیپ را مشخص کنید. آگهی‌ها مدل‌به‌مدل خوانده می‌شوند، پس برای یک برند تنها نمی‌شود درخواست داد.',
    tooMany: `این پرونده بیش از ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} دارد. پرونده‌ای با مدل‌های کمتر بسازید تا بتوانید درخواست بدهید.`,
    notes: {
      none: 'هنوز درخواستی برای آن ثبت نشده است.',
      pendingJoin: 'کس دیگری پیش‌تر درخواست داده و منتظر پاسخ است؛ با ثبت درخواست، شما هم خبر می‌گیرید.',
      pending: 'مدیر هنوز تصمیم نگرفته است. پاسخ را در اعلان‌ها می‌بینید.',
      approvedPaused:
        'در صف خواندن است. خواندن آگهی‌ها اکنون متوقف است؛ تا از سر گرفته شود چیزی خوانده نمی‌شود و به محض شروع، نوبت این مدل می‌رسد.',
      approved: 'در صف خواندن آگهی‌هاست و آگهی‌هایش پس از خوانده شدن به پرونده‌ی شما می‌آید.',
      declined: (reason: string | null) => (reason === null ? 'مدیر آن را نپذیرفت.' : `دلیل: ${reason}`),
      fulfilled: 'خوانده شده است و آگهی‌هایش در جست‌وجو هست.',
      tracked: 'کارشناس این مدل را از پیش به‌طور کامل می‌خواند؛ برای آن درخواستی لازم نیست.',
    },
    errors: {
      declined: 'درخواست این مدل پیش‌تر رد شده است.',
      tooMany: 'این پرونده بیش از حد مجاز مدل دارد.',
      fileLimit: `هر پرونده تا ${formatCountOf(MAX_REQUESTS_PER_FILE, MODEL)} می‌تواند بخواهد.`,
      accountLimit: `تا ${formatCountOf(MAX_OPEN_REQUESTS_PER_ACCOUNT, 'درخواست')} در انتظار پاسخ دارید. پس از پاسخ، می‌توانید درخواست تازه بدهید.`,
      notNeeded: `این پرونده دست‌کم ${formatCount(FEW_MATCHES_BELOW)} آگهی دارد و نیازی به درخواست نیست.`,
      failed: 'درخواست ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید.',
      signedOut: 'نشست شما پایان یافته است. دوباره وارد شوید.',
      gone: 'این پرونده دیگر وجود ندارد.',
    },
    dismiss: 'بستن پیام',
    retry: 'تلاش دوباره',
  },
  /** On the file's card in the list. */
  list: {
    label: 'درخواست جست‌وجوی بیشتر',
    count: (count: number) => `· ${formatCountOf(count, 'درخواست')}`,
  },
} as const;
