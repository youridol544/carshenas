import { isolate } from '@carshenas/locale/bidi';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { formatTomanInWords, MAX_TOMAN, toToman, type Toman } from '@carshenas/locale/toman';
import * as z from 'zod';

// Every kind of notification, declared once (ADR-0026 point 3). A kind is its payload's schema (the facts stored with
// the row when it is created), the event key built from them (with the account and the kind, unique: an event
// notifies a buyer once), what it is about (the row's typed link), the Farsi a buyer reads, built from the stored
// facts when shown, and the words of its mute switch. The table notification_kind lists the same ids; a test fails
// when the two differ. Adding a kind: a definition here with its test, a migration that inserts its id, and a producer
// that calls createNotification() in the transaction that records its event.

/** What a notification is about, which the inbox links to. Search files and crawl requests join with their tasks. */
export type NotificationSubject = 'listing' | 'search_file' | 'crawl_request';

/** What the inbox shows for one notification: all of it Farsi, all of it from the stored facts. */
export type NotificationText = {
  /** The headline, one sentence. */
  readonly title: string;
  /** A second sentence with the detail, or none. */
  readonly detail?: string;
  /** A price before and after, which the inbox shows in full digits, the old one struck through. */
  readonly priceChange?: { readonly fromToman: Toman; readonly toToman: Toman };
  /** Where the notification leads on Carshenas itself, when it is not about a listing (a path of this site). */
  readonly href?: string;
};

/** The glyph the inbox draws beside a kind; the web app maps each to its icon. */
export type NotificationIcon =
  | 'price_drop'
  | 'search_file'
  | 'off_market'
  | 'relisted'
  | 'crawl_request';

export type NotificationKindDefinition<Payload> = {
  readonly payload: z.ZodType<Payload>;
  readonly subject: NotificationSubject;
  readonly icon: NotificationIcon;
  // Methods, not function-valued properties, so a definition of one payload stands in for the registry's unknown one.
  eventKey(payload: Payload): string;
  render(payload: Payload): NotificationText;
  /** The mute switch: what the kind is, and when it arrives. */
  readonly setting: { readonly label: string; readonly description: string };
};

function defineKind<Payload>(
  definition: NotificationKindDefinition<Payload>,
): NotificationKindDefinition<Payload> {
  return definition;
}

const tomanAmount = z.int().min(1).max(MAX_TOMAN);

// A number standing alone in a car's name reads in Persian digits («پژو 206» becomes «پژو ۲۰۶»), as every number on
// screen does; one that is part of a Latin code («V8», «X3») stays as the code is written.
const STANDALONE_NUMBER = /(?<![0-9A-Za-z])[0-9]+(?![0-9A-Za-z])/g;

function carNameForReading(name: string): string {
  return name.replace(STANDALONE_NUMBER, (digits) => toPersianDigits(digits));
}

const listingPriceDropPayload = z
  .strictObject({
    /** The listing_price_event that announced the lower price: the event this notification is about. */
    priceEventId: z.int().positive(),
    /** The car as the catalogue names it when the event happens («پژو ۲۰۶ تیپ ۵»), or the listing's title. */
    carName: z.string().trim().min(1).max(120),
    /** The Solar Hijri model year, when the listing states one. */
    modelYearSh: z.int().min(1300).max(1500).optional(),
    previousPriceToman: tomanAmount,
    priceToman: tomanAmount,
  })
  .refine((payload) => payload.priceToman < payload.previousPriceToman, {
    error: 'a price drop asks less than before',
  });

export type ListingPriceDropPayload = z.infer<typeof listingPriceDropPayload>;

/** A listing the buyer follows asks less than before (CS-69 produces it from price events). */
const listingPriceDrop = defineKind<ListingPriceDropPayload>({
  payload: listingPriceDropPayload,
  eventKey: (payload) => `price_event:${String(payload.priceEventId)}`,
  subject: 'listing',
  icon: 'price_drop',
  render(payload) {
    const year =
      payload.modelYearSh === undefined ? '' : ` مدل ${toPersianDigits(String(payload.modelYearSh))}`;
    const drop = payload.previousPriceToman - payload.priceToman;
    return {
      title: `قیمت ${isolate(carNameForReading(payload.carName))}${year} کم شد`,
      detail: `${formatTomanInWords(toToman(drop))} (${formatPercent(drop / payload.previousPriceToman)}) ارزان‌تر از قیمت قبلی.`,
      priceChange: { fromToman: toToman(payload.previousPriceToman), toToman: toToman(payload.priceToman) },
    };
  },
  setting: {
    label: 'کاهش قیمت آگهی‌های نشان‌شده',
    description: 'وقتی آگهی‌ای که نشان کرده‌اید ارزان‌تر شود.',
  },
});

const searchFileMatchesPayload = z
  .strictObject({
    /** The search file the digest is about: the notification opens its page. */
    searchFileId: z.int().positive(),
    /** The file's name when the digest was made (the buyer may rename it later); one line, no bidi controls. */
    fileName: z.string().trim().min(1).max(80),
    /** Listings that became searchable since the last alert and match the file. */
    newCount: z.int().min(0).max(100_000),
    /** Of those, rated «عالی» or «خوب» against their market value. */
    goodCount: z.int().min(0).max(100_000),
    /** Matches that were already searchable and now ask less than before. */
    dropCount: z.int().min(0).max(100_000),
    /**
     * Where the digest starts: the file's watermark, in microseconds since the epoch, as digits. A watermark only moves
     * forward, so with the file it names the digest, and a run repeated from the same watermark notifies once.
     */
    sinceKey: z.string().regex(/^[0-9]{1,20}$/),
  })
  .refine((payload) => payload.goodCount + payload.dropCount > 0, {
    error: 'a digest tells of at least one good deal or price drop',
  })
  .refine((payload) => payload.goodCount <= payload.newCount, {
    error: 'good listings are among the new ones',
  });

export type SearchFileMatchesPayload = z.infer<typeof searchFileMatchesPayload>;

/** A watching search file found new listings or price drops (CS-72): one digest per file per matching run. */
const searchFileMatches = defineKind<SearchFileMatchesPayload>({
  payload: searchFileMatchesPayload,
  eventKey: (payload) => `search_file:${String(payload.searchFileId)}:${payload.sinceKey}`,
  subject: 'search_file',
  icon: 'search_file',
  render(payload) {
    const name = `«${isolate(carNameForReading(payload.fileName))}»`;
    const parts: string[] = [];
    if (payload.goodCount > 0) {
      parts.push(
        payload.goodCount === payload.newCount
          ? 'همه‌شان قیمت خوب یا عالی دارند'
          : `${formatCountOf(payload.goodCount, 'آگهی')} از آن‌ها قیمت خوب یا عالی دارد`,
      );
    }
    if (payload.newCount > 0 && payload.dropCount > 0) {
      parts.push(`${formatCountOf(payload.dropCount, 'آگهی')} هم ارزان‌تر شده`);
    }
    return {
      title:
        payload.newCount > 0
          ? `${formatCountOf(payload.newCount, 'آگهی')} تازه برای ${name}`
          : `${formatCountOf(payload.dropCount, 'آگهی')} در ${name} ارزان‌تر شد`,
      ...(parts.length === 0 ? {} : { detail: `${parts.join('؛ ')}.` }),
    };
  },
  setting: {
    label: 'آگهی‌های تازه‌ی پرونده‌های جست‌وجو',
    description:
      'وقتی کارشناس برای پرونده‌ای که در حال پایش است آگهی تازه یا کاهش قیمت پیدا کند. هر پرونده را جداگانه هم می‌شود بی‌صدا کرد.',
  },
});

const crawlRequestDecidedPayload = z.strictObject({
  /** The crawl_request the superadmin decided: with the decision, the event. */
  requestId: z.int().positive(),
  /** The row of crawl_request_decision that recorded it: a request declined, approved and declined again is three events. */
  decisionId: z.int().positive(),
  decision: z.enum(['approved', 'declined']),
  /** The car as the catalogue names it («پژو ۲۰۶ تیپ ۵»). */
  carName: z.string().trim().min(1).max(120),
  /** The buyer's own search file that asked: the notification opens its page. */
  fileId: z.int().positive(),
  /** A decline's reason, in the superadmin's words (never personal data: it is about a car, not a person). */
  reason: z.string().trim().min(1).max(300).optional(),
});

export type CrawlRequestDecidedPayload = z.infer<typeof crawlRequestDecidedPayload>;

/** The superadmin answered a crawl request the buyer's search file raised (CS-71 produces it with the decision). */
const crawlRequestDecided = defineKind<CrawlRequestDecidedPayload>({
  payload: crawlRequestDecidedPayload,
  eventKey: (payload) => `crawl_request:${String(payload.requestId)}:${String(payload.decisionId)}`,
  subject: 'crawl_request',
  icon: 'crawl_request',
  render(payload) {
    const car = isolate(carNameForReading(payload.carName));
    const href = `/account/searches/${String(payload.fileId)}`;
    if (payload.decision === 'approved') {
      return {
        title: `درخواست شما برای ${car} تأیید شد`,
        detail: 'این مدل در صف خواندن آگهی‌ها قرار گرفت و آگهی‌هایش پس از خوانده شدن به پرونده‌ی شما می‌آید.',
        href,
      };
    }
    return {
      title: `درخواست شما برای ${car} پذیرفته نشد`,
      detail: payload.reason === undefined ? undefined : `دلیل: ${payload.reason}`,
      href,
    };
  },
  setting: {
    label: 'پاسخ به درخواست جست‌وجوی بیشتر',
    description: 'وقتی کارشناس درخواست شما برای خواندن بیشتر آگهی‌های یک مدل را تأیید یا رد کند.',
  },
});

/** The year a notification names a car with: « مدل ۱۴۰۰», or nothing when the listing states none. */
function yearForReading(modelYearSh: number | undefined): string {
  return modelYearSh === undefined ? '' : ` مدل ${toPersianDigits(String(modelYearSh))}`;
}

const modelYearSh = z.int().min(1300).max(1500).optional();

const listingOffMarketPayload = z.strictObject({
  /** The listing, with the version, names the event: the same listing can leave the market again after a return. */
  listingId: z.int().positive(),
  /** How many status changes the mark had announced, counting this one. */
  version: z.int().positive(),
  /** Why it left, as the listing's status says. */
  status: z.enum(['sold', 'expired', 'gone']),
  carName: z.string().trim().min(1).max(120),
  modelYearSh,
});

export type ListingOffMarketPayload = z.infer<typeof listingOffMarketPayload>;

const OFF_MARKET_TEXT = {
  sold: {
    title: (car: string) => `آگهی ${car} فروخته شد`,
    detail: 'فروشنده آن را فروخته‌شده اعلام کرده است. چند خودروی مشابه را ببینید.',
  },
  expired: {
    title: (car: string) => `آگهی ${car} منقضی شد`,
    detail: 'مهلت آگهی تمام شده است. اگر فروشنده دوباره آن را بگذارد، خبرتان می‌کنیم.',
  },
  gone: {
    title: (car: string) => `آگهی ${car} دیگر در سایت منبع نیست`,
    detail: 'یا فروخته شده یا فروشنده آن را برداشته است. اگر برگردد، خبرتان می‌کنیم.',
  },
} as const;

/** A listing the buyer follows is sold, expired or gone from its source (CS-69 produces it from status changes). */
const listingOffMarket = defineKind<ListingOffMarketPayload>({
  payload: listingOffMarketPayload,
  eventKey: (payload) => `listing_status:${String(payload.listingId)}:${String(payload.version)}`,
  subject: 'listing',
  icon: 'off_market',
  render(payload) {
    const car = `${isolate(carNameForReading(payload.carName))}${yearForReading(payload.modelYearSh)}`;
    const text = OFF_MARKET_TEXT[payload.status];
    return { title: text.title(car), detail: text.detail };
  },
  setting: {
    label: 'فروش یا برداشته‌شدن آگهی‌های نشان‌شده',
    description: 'وقتی آگهی‌ای که نشان کرده‌اید فروخته شود، منقضی شود یا از سایت منبع برداشته شود.',
  },
});

const listingRelistedPayload = z.strictObject({
  listingId: z.int().positive(),
  version: z.int().positive(),
  carName: z.string().trim().min(1).max(120),
  modelYearSh,
  /** The asking price it came back with, when it has one. */
  priceToman: tomanAmount.optional(),
});

export type ListingRelistedPayload = z.infer<typeof listingRelistedPayload>;

/** A listing the buyer follows that had left the market is on it again (CS-69). */
const listingRelisted = defineKind<ListingRelistedPayload>({
  payload: listingRelistedPayload,
  eventKey: (payload) => `listing_status:${String(payload.listingId)}:${String(payload.version)}`,
  subject: 'listing',
  icon: 'relisted',
  render(payload) {
    const car = `${isolate(carNameForReading(payload.carName))}${yearForReading(payload.modelYearSh)}`;
    return {
      title: `آگهی ${car} دوباره آمد`,
      detail:
        payload.priceToman === undefined
          ? 'دوباره در فهرست است.'
          : `دوباره در فهرست است؛ قیمت: ${formatTomanInWords(toToman(payload.priceToman))}.`,
    };
  },
  setting: {
    label: 'بازگشت آگهی‌های نشان‌شده',
    description: 'وقتی آگهی‌ای که نشان کرده‌اید و از بازار رفته بود، دوباره بیاید.',
  },
});

export const NOTIFICATION_KINDS = {
  listing_price_drop: listingPriceDrop,
  search_file_matches: searchFileMatches,
  crawl_request_decided: crawlRequestDecided,
  listing_off_market: listingOffMarket,
  listing_relisted: listingRelisted,
} as const;

export type NotificationKind = keyof typeof NOTIFICATION_KINDS;

/** Each kind's payload, by kind. */
export type NotificationPayload = {
  [Kind in NotificationKind]: (typeof NOTIFICATION_KINDS)[Kind] extends NotificationKindDefinition<
    infer Payload
  >
    ? Payload
    : never;
};

export function isNotificationKind(value: string): value is NotificationKind {
  return Object.hasOwn(NOTIFICATION_KINDS, value);
}

/** Every kind, in the order the settings list them. */
export const NOTIFICATION_KIND_IDS = Object.keys(NOTIFICATION_KINDS) as readonly NotificationKind[];

/**
 * A stored notification as the inbox shows it, or undefined when its kind is unknown to this build or its payload no
 * longer fits the kind's schema: the caller shows a plain line and reports it, never a half-built sentence.
 */
export function renderNotification(kind: string, payload: unknown): NotificationText | undefined {
  if (!isNotificationKind(kind)) return undefined;
  const definition: NotificationKindDefinition<unknown> = NOTIFICATION_KINDS[kind];
  const parsed = definition.payload.safeParse(payload);
  return parsed.success ? definition.render(parsed.data) : undefined;
}
