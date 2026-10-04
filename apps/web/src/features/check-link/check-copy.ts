import { formatCountOf } from '@carshenas/locale/format-number';
import type { InfoContent } from '@/components/ui/info-popover';
import { MAX_OPEN_REQUESTS_PER_ACCOUNT } from '@/lib/crawl-requests-rules';

// Every word the paste-a-link feature says (CS-65, CS-115), in the glossary's terms (docs/product/glossary.md): «آگهی»,
// «ارزش بازار», «ارزیابی». The voice is short and plain: a limit is stated as a limit, with the way forward, and nothing
// here says or suggests that the feature is broken. What a rating means is never written here (the listing page's
// analysis says it, from the shared definitions); the numbers come from the database through the formatters. Tests import
// these constants instead of retyping Persian, which loses the zero-width non-joiner.

/** What an ad's link looks like, for the buyer who has not seen one: the title of the ad, then its code. */
export const EXAMPLE_LINK = 'divar.ir/v/پژو-۲۰۶-تیپ-۵/gX1mAYqN';

// Words two places use, written once.
const RATED_LISTINGS = 'دیدن آگهی‌های ارزیابی‌شده';
const RETRY = 'تلاش دوباره';

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
    busy: 'در حال بررسی…',
    pasteDenied: 'دستگاه اجازه‌ی خواندن حافظه را نداد؛ لینک را در کادر بچسبانید.',
  },
  info: {
    label: 'راهنمای لینک',
    close: 'بستن راهنما',
    content: {
      title: 'کدام لینک؟',
      sections: [
        {
          id: 'which',
          paragraphs: [
            'لینک یک آگهی دیوار را بچسبانید. لینکی که عنوان آگهی در آن است بهتر است؛ از روی عنوان می‌فهمیم آگهی از چه خودرویی است.',
            'فقط آگهی‌های دیوار را می‌خوانیم.',
          ],
        },
      ],
    } satisfies InfoContent,
  },
  page: {
    h1: 'ارزیابی لینک آگهی',
    lead: 'قیمت آگهی را با ارزش بازار می‌سنجیم و دلیلش را می‌گوییم.',
    stepsLabel: 'چطور؟',
    steps: ['آگهی را در دیوار باز کنید.', 'لینکش را از نوار آدرس کپی کنید.', 'اینجا بچسبانید.'],
    loading: 'در حال خواندن لینک…',
  },
  /** The cars Carshenas reads: the limit, stated before a buyer pastes and again in every answer that needs it. */
  covered: {
    title: 'خودروهایی که می‌خوانیم',
    lead: 'فقط آگهی این خودروها را می‌خوانیم و ارزیابی می‌کنیم:',
    moreModels: 'همه‌ی مدل‌ها',
  },
  /** What is wrong with the text itself, before anything is looked up. */
  problems: {
    empty: 'لینک آگهی دیوار را بچسبانید.',
    notALink: 'این لینک نیست. لینک آگهی را کامل بچسبانید.',
    otherSite: 'فعلاً فقط آگهی‌های دیوار را می‌خوانیم.',
    notAnAd: 'این لینک یک آگهی نیست. آگهی را باز کنید و لینکش را بچسبانید.',
    example: 'لینک آگهی دیوار این شکل است:',
    searchInstead: RATED_LISTINGS,
  },
  /** The ad is not read yet, and Carshenas reads its car. */
  queued: {
    title: 'این آگهی هنوز خوانده نشده',
    running: (car: string) =>
      `${car} از خودروهایی است که می‌خوانیم. آگهی‌های تهران معمولاً ظرف چند ساعت خوانده می‌شوند؛ بعد از آن همین لینک را دوباره بچسبانید.`,
    paused: (car: string) =>
      `${car} از خودروهایی است که می‌خوانیم، اما خواندن آگهی‌ها فعلاً متوقف است. با شروع دوباره، آگهی‌های تهران خوانده می‌شوند؛ بعد از آن همین لینک را دوباره بچسبانید.`,
    granted: 'این مدل را به درخواست شما به فهرست افزودیم.',
    deals: (car: string) => `در این فاصله، بهترین معامله‌های ${car}`,
    dealsHint: 'آگهی‌های ارزیابی‌شده‌ای که قیمتشان از ارزش بازار پایین‌تر است.',
    allOf: (car: string) => `دیدن همه‌ی آگهی‌های ${car}`,
  },
  /** The car is not one Carshenas reads: the limit first, then the way forward. */
  outside: {
    title: (car: string) => `${car} را هنوز نمی‌خوانیم`,
    ask: 'درخواست افزودن این مدل',
    askChosen: 'درخواست افزودن',
    chooser: 'کدام مدل؟',
    choosePlaceholder: 'یک مدل را انتخاب کنید',
    chooseFirst: 'مدل را انتخاب کنید.',
    answerComes: 'جواب را در اعلان‌هایتان می‌بینید.',
    signIn: {
      title: 'برای درخواست وارد شوید',
      body: 'درخواست در حساب شما می‌ماند و جوابش به شما می‌رسد. بعد از ورود به همین‌جا برمی‌گردید و درخواست ثبت می‌شود.',
      signIn: 'ورود',
      signUp: 'ثبت‌نام',
    },
    request: {
      pending: 'درخواستتان ثبت شد؛ جواب را در اعلان‌ها می‌بینید.',
      approved: 'درخواستتان پذیرفته شد؛ مدل در نوبت خواندن است.',
      declined: 'درخواست این مدل پیش‌تر رد شده است.',
      reason: (reason: string) => `دلیل: ${reason}`,
      file: 'دیدن پرونده',
    },
    errors: {
      failed: 'درخواست ثبت نشد. چند لحظه بعد دوباره امتحان کنید.',
      slow: 'چند لحظه صبر کنید و دوباره امتحان کنید.',
      unreadable: 'مدل این لینک را نشناختیم. صفحه را تازه کنید و دوباره امتحان کنید.',
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
      body: 'خودرو را از عنوان آگهی می‌شناسیم و این لینک کوتاه است. آگهی را در مرورگر باز کنید و لینکش را از نوار آدرس کپی کنید.',
    },
    no_car: {
      title: 'از عنوان این آگهی خودرو را نمی‌شناسیم',
      body: 'اگر آگهی از خودروهای زیر است، بعد از خوانده شدن همین لینک را دوباره بچسبانید.',
    },
    two_cars: {
      title: 'عنوان آگهی بیشتر از یک خودرو دارد',
      body: 'نمی‌دانیم آگهی از کدام است. اگر از خودروهای زیر است، بعد از خوانده شدن همین لینک را دوباره بچسبانید.',
    },
    make_only: {
      title: (make: string) => `عنوان آگهی فقط ${make} را نام برده`,
      body: (make: string) =>
        `مدلش را نمی‌دانیم. از ${make} این مدل‌ها را می‌خوانیم؛ اگر آگهی از این‌هاست، بعد از خوانده شدن همین لینک را دوباره بچسبانید.`,
    },
    searchInstead: RATED_LISTINGS,
  },
  /** The ad is not on the market any more. */
  off: {
    title: 'این آگهی دیگر روی بازار نیست',
    body: 'آخرین وضعیتش و آگهی‌های مشابه را در صفحه‌ی آگهی ببینید.',
    open: 'دیدن صفحه‌ی آگهی',
    similar: 'آگهی‌های مشابهی که هنوز روی بازارند',
  },
  /** The ad is rated: the numbers are the listing page's own. */
  result: {
    from: (source: string) => `از ${source}`,
    full: 'دیدن همه‌ی جزئیات',
    open: (source: string) => `رفتن به آگهی در ${source}`,
  },
  limited: {
    title: 'چند لینک پشت‌سرهم فرستادید',
    body: 'کمی صبر کنید و دوباره لینک را بچسبانید.',
  },
  error: {
    title: 'بررسی انجام نشد',
    body: 'کمی بعد دوباره امتحان کنید؛ لینکتان همین‌جا می‌ماند.',
    retry: RETRY,
  },
} as const;
