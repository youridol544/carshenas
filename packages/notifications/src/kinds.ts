import { isolate } from '@carshenas/locale/bidi';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatPercent } from '@carshenas/locale/format-number';
import { formatTomanInWords, MAX_TOMAN, toToman, type Toman } from '@carshenas/locale/toman';
import * as z from 'zod';

// Every kind of notification, declared once (ADR-0026 point 3). A kind is its payload's schema (the facts stored with
// the row when it is created), the event key built from them (with the account and the kind, unique: an event
// notifies a buyer once), what it is about (the row's typed link), the Farsi a buyer reads, built from the stored
// facts when shown, and the words of its mute switch. The table notification_kind lists the same ids; a test fails
// when the two differ. Adding a kind: a definition here with its test, a migration that inserts its id, and a producer
// that calls createNotification() in the transaction that records its event.

/** What a notification is about, which the inbox links to. Search files and crawl requests join with their tasks. */
export type NotificationSubject = 'listing';

/** What the inbox shows for one notification: all of it Farsi, all of it from the stored facts. */
export type NotificationText = {
  /** The headline, one sentence. */
  readonly title: string;
  /** A second sentence with the detail, or none. */
  readonly detail?: string;
  /** A price before and after, which the inbox shows in full digits, the old one struck through. */
  readonly priceChange?: { readonly fromToman: Toman; readonly toToman: Toman };
};

/** The glyph the inbox draws beside a kind; the web app maps each to its icon. */
export type NotificationIcon = 'price_drop';

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
const STANDALONE_NUMBER = /(?<![A-Za-z])[0-9]+(?![A-Za-z])/g;

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

export const NOTIFICATION_KINDS = {
  listing_price_drop: listingPriceDrop,
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
