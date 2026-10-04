import { formatCountOf } from '@carshenas/locale/format-number';
import type { InfoContent } from '@/components/ui/info-popover';
import { MAX_OPEN_REQUESTS_PER_ACCOUNT } from '@/lib/crawl-requests-rules';

// Every word the paste-a-link feature says (CS-65, CS-115), written to the voice guide (docs/design/product-voice.md,
// ADR-0042) in the glossary's terms (docs/product/glossary.md): «آگهی», «ارزش بازار», «ارزیابی». A limit is stated as a
// fact, with the way forward, and nothing here says or suggests that the feature is broken. What a rating means is never
// written here (the listing page's analysis says it, from the shared definitions); the numbers come from the database
// through the formatters. Tests import these constants instead of retyping Persian, which loses the zero-width non-joiner.

/** What an ad's link looks like, for the buyer who has not seen one: the title of the ad, then its code. */
export const EXAMPLE_LINK = 'divar.ir/v/پژو-۲۰۶-تیپ-۵/gX1mAYqN';

// Words two places use, written once.
const RATED_LISTINGS = 'دیدن آگهی‌های ارزیابی‌شده';
const RETRY = 'تلاش دوباره';
const COME_BACK = 'بعد از خوانده شدنش همین لینک را دوباره بچسبانید.';
const IF_COVERED = 'اگر آگهی از یکی از خودروهای زیر است،';

/** What is wrong with a pasted text: what happened, and what to do (none when what happened says it). */
export type LinkProblem = { readonly title: string; readonly body: string | null };

export const CHECK_COPY = {
  title: 'ارزیابی لینک آگهی',
  description: 'لینک آگهی دیوار را بچسبانید و ببینید قیمتش نسبت به ارزش بازار چطور است.',
  /** The box, on the home page, the search page and /check. */
  box: {
    label: 'لینک آگهی دیوار',
    placeholder: 'divar.ir/v/…',
    submit: 'ارزیابی',
    paste: 'چسباندن از حافظه',
    clear: 'پاک کردن لینک',
    busy: 'در حال ارزیابی…',
    pasteDenied: 'مرورگر اجازه‌ی خواندن لینک را نداد. آن را خودتان در کادر بچسبانید.',
  },
  info: {
    label: 'راهنمای لینک',
    close: 'بستن راهنما',
    content: {
      title: 'لینک آگهی دیوار',
      sections: [
        {
          id: 'which',
          paragraphs: [
            'لینک یک آگهی دیوار را از نوار آدرس مرورگر یا از «هم‌رسانی» در دیوار کپی کنید.',
            'لینکی که عنوان آگهی در آن است بهتر است. از روی عنوان، خودرو را می‌شناسیم.',
          ],
        },
      ],
    } satisfies InfoContent,
  },
  page: {
    h1: 'ارزیابی لینک آگهی',
    lead: 'قیمت آگهی را با ارزش بازار می‌سنجیم.',
    loading: 'در حال ارزیابی لینک…',
  },
  /** The cars Carshenas reads: the limit, stated before a buyer pastes and again in every answer that needs it. */
  covered: {
    title: 'خودروهایی که می‌خوانیم',
    moreModels: 'دیدن همه‌ی مدل‌ها',
  },
  /** What is wrong with the text itself, before anything is looked up. */
  problems: {
    empty: { title: 'لینک آگهی دیوار را بچسبانید', body: null },
    notALink: { title: 'این لینک نیست', body: 'لینک آگهی را کامل بچسبانید.' },
    otherSite: { title: 'فقط آگهی‌های دیوار را می‌خوانیم', body: null },
    notAnAd: {
      title: 'این لینک یک آگهی نیست',
      body: 'آگهی را در دیوار باز کنید و لینکش را بچسبانید.',
    },
    example: 'لینک آگهی این شکل است:',
    searchInstead: RATED_LISTINGS,
  } satisfies Record<string, LinkProblem | string>,
  /** The ad is not read yet, and Carshenas reads its car. */
  queued: {
    title: 'این آگهی هنوز خوانده نشده',
    running: (car: string) =>
      `${car} از خودروهایی است که می‌خوانیم. آگهی‌های تهران معمولاً ظرف چند ساعت خوانده می‌شوند. بعد از آن همین لینک را دوباره بچسبانید.`,
    paused: (car: string) =>
      `${car} از خودروهایی است که می‌خوانیم، اما خواندن آگهی‌ها فعلاً متوقف است. با شروع دوباره، آگهی‌های تهران خوانده می‌شوند. بعد از آن همین لینک را دوباره بچسبانید.`,
    granted: 'این مدل را به درخواست شما به فهرست افزودیم.',
    deals: (car: string) => `بهترین معامله‌های ${car}`,
    dealsHint: 'آگهی‌هایی که قیمتشان از ارزش بازار پایین‌تر است.',
    allOf: (car: string) => `دیدن همه‌ی آگهی‌های ${car}`,
  },
  /** The car is not one Carshenas reads: the limit first, then the way forward. */
  outside: {
    title: (car: string) => `آگهی‌های ${car} را نمی‌خوانیم`,
    ask: 'درخواست افزودن مدل',
    chooser: 'مدل',
    choosePlaceholder: 'یک مدل را انتخاب کنید',
    chooseFirst: 'مدل را انتخاب کنید.',
    answerComes: 'جواب را در اعلان‌ها می‌بینید.',
    signIn: {
      title: 'برای درخواست وارد شوید',
      body: 'بعد از ورود دوباره به همین‌جا می‌آیید و درخواست ثبت می‌شود.',
      signIn: 'ورود',
      signUp: 'ثبت‌نام',
    },
    request: {
      pending: 'درخواستتان ثبت شد. جواب را در اعلان‌ها می‌بینید.',
      approved: 'درخواستتان پذیرفته شد. آگهی‌های این مدل را می‌خوانیم.',
      declined: 'درخواست افزودن این مدل رد شده است.',
      reason: (reason: string) => `دلیل: ${reason}`,
      file: 'دیدن پرونده',
    },
    errors: {
      failed: 'درخواست ثبت نشد.',
      slow: 'چند درخواست پشت‌سرهم دادید. کمی صبر کنید.',
      unreadable: 'مدل این لینک را نشناختیم. لینک را دوباره بچسبانید.',
      noRoom: 'پرونده‌های شما پر است. یکی را پاک کنید و دوباره درخواست بدهید.',
      accountLimit: `${formatCountOf(MAX_OPEN_REQUESTS_PER_ACCOUNT, 'درخواست')} شما هنوز جواب نگرفته است. بعد از جواب می‌توانید درخواست تازه بدهید.`,
      covered: 'این مدل را از پیش می‌خوانیم.',
      retry: RETRY,
      dismiss: 'بستن پیام',
    },
  },
  /** The link is an ad's, but it does not say which car. Never «unsupported»: nothing is known to be outside. */
  unreadable: {
    no_title: {
      title: 'عنوان آگهی در این لینک نیست',
      body: 'خودرو را از عنوان آگهی می‌شناسیم. آگهی را در مرورگر باز کنید و لینکش را از نوار آدرس کپی کنید.',
    },
    no_car: {
      title: 'از عنوان این آگهی خودرو را نمی‌شناسیم',
      body: `${IF_COVERED} ${COME_BACK}`,
    },
    two_cars: {
      title: 'عنوان آگهی بیشتر از یک خودرو دارد',
      body: `${IF_COVERED} ${COME_BACK}`,
    },
    make_only: {
      title: (make: string) => `عنوان آگهی فقط ${make} را نام برده`,
      body: (make: string) => `از ${make} این مدل‌ها را می‌خوانیم. اگر آگهی از یکی از این‌هاست، ${COME_BACK}`,
    },
    searchInstead: RATED_LISTINGS,
  },
  /** The ad is not on the market any more. */
  off: {
    title: 'این آگهی دیگر روی بازار نیست',
    open: 'دیدن صفحه‌ی آگهی',
    similar: 'آگهی‌های مشابه',
  },
  /** The ad is rated: the numbers are the listing page's own. */
  result: {
    from: (source: string) => `از ${source}`,
    full: 'دیدن همه‌ی جزئیات',
    open: (source: string) => `رفتن به آگهی در ${source}`,
  },
  limited: {
    title: 'چند لینک پشت‌سرهم فرستادید',
    body: 'کمی صبر کنید و لینک بعدی را بچسبانید.',
  },
  error: {
    title: 'لینک بررسی نشد',
    body: 'لینک شما همین‌جا مانده است.',
    retry: RETRY,
  },
} as const;
