import { toPersianDigits } from '@carshenas/locale/digits';
import { formatDate, formatTimeAgo } from '@carshenas/locale/format-date';
import { formatCount, formatCountOf, formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { formatToman, formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import {
  bodyCondition,
  chassis,
  colour,
  engineCondition,
  fuel,
  gearbox,
  gearboxCondition,
  seller,
} from '@carshenas/search/filters';
import { FRESHNESS_WINDOW_HOURS, INSTALLMENT_GUARD_GAP_PCT } from '@/features/listing/listing-rules';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type {
  Comparable,
  FactEvidence,
  ListingFacts,
  ListingPageData,
  PriceEvent,
} from '@/features/listing/listing-types';
import { daysOnMarket } from '@/features/search/listing-card-view';
import { nameOnScreen } from '@carshenas/locale/names';

// What the listing page says, as plain strings and codes (CS-64): the title, the facts, the price, the condition the
// seller declared and the text states with its quotes, the risks, the price history, the comparables and how fresh
// the page is. Every label of a code comes from the shared definitions (CS-58), every number is formatted by
// @carshenas/locale, and every number was stored by the database; a unit test reads this file
// (listing-view.test.ts) and the components only lay it out.

const NO_BREAK_SPACE = '\u00A0';
const HOUR = 3_600_000;

type Option = { readonly value: string; readonly label: string };

// A choice filter built from the database has no options of its own (`undefined`); none of the ones read here is.
function labelOf(options: readonly Option[] | undefined, value: string | null): string | null {
  if (value === null || options === undefined) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

/** «پژو ۲۰۶ تیپ ۵، مدل ۱۳۹۵»: the catalogue's name, else the seller's title, with the model year. */
export function listingTitle(listing: ListingFacts): string {
  const name = listing.name.trim() === '' ? (listing.title ?? '') : nameOnScreen(listing.name);
  if (listing.modelYearSh === null) return name;
  return `${name}، مدل${NO_BREAK_SPACE}${toPersianDigits(String(listing.modelYearSh))}`;
}

/** A comparable's or a similar listing's title, the same way. */
export function nameWithYear(name: string, modelYearSh: number | null): string {
  const shown = nameOnScreen(name);
  return modelYearSh === null
    ? shown
    : `${shown}، مدل${NO_BREAK_SPACE}${toPersianDigits(String(modelYearSh))}`;
}

export type PriceView =
  | { readonly kind: 'amount'; readonly text: string; readonly caption: string }
  | { readonly kind: 'words'; readonly text: string; readonly caption: string | null }
  /** An instalment sale: the shown amount is a down payment, not the car's price. */
  | { readonly kind: 'down_payment'; readonly text: string; readonly caption: string };

/** The price block: the asking price in full digits, or the words that stand where a price would be. */
export function priceView(listing: ListingFacts): PriceView {
  const COPY = LISTING_COPY.price;
  const off = listing.status !== 'active';
  switch (listing.priceType) {
    case 'asking':
      return listing.askingPriceToman === null
        ? { kind: 'words', text: COPY.unknown, caption: null }
        : {
            kind: 'amount',
            text: formatToman(toToman(listing.askingPriceToman)),
            caption: off ? COPY.lastAsking : COPY.asking,
          };
    case 'negotiable':
      return { kind: 'words', text: COPY.negotiable, caption: null };
    case 'installment':
      return listing.downPaymentToman === null
        ? { kind: 'words', text: COPY.installment, caption: null }
        : {
            kind: 'down_payment',
            text: formatToman(toToman(listing.downPaymentToman)),
            caption: COPY.downPayment,
          };
    default:
      return { kind: 'words', text: COPY.unknown, caption: null };
  }
}

export type FactRow = { readonly label: string; readonly value: string };

/** «۲۷۰٬۰۰۰ کیلومتر · دنده‌ای · تهران»: the line under the title. */
export function summaryLine(listing: ListingFacts): readonly string[] {
  const parts: string[] = [];
  if (listing.mileageKm !== null) {
    parts.push(listing.mileageKm === 0 ? LISTING_COPY.facts.zeroKm : formatMileage(listing.mileageKm));
  }
  const gearboxLabel = labelOf(gearbox.options, listing.gearbox);
  if (gearboxLabel !== null) parts.push(gearboxLabel);
  const fuelLabel = listing.fuel === 'petrol' ? null : labelOf(fuel.options, listing.fuel);
  if (fuelLabel !== null) parts.push(fuelLabel);
  const place = [listing.city, listing.district].filter((part): part is string => part !== null);
  if (place.length > 0) parts.push(place.join('، '));
  return parts;
}

/** The facts table: label and value, only for what the listing states. */
export function factRows(listing: ListingFacts, now: string): readonly FactRow[] {
  const COPY = LISTING_COPY.facts;
  const rows: FactRow[] = [];
  if (listing.modelYearSh !== null) {
    rows.push({ label: COPY.year, value: toPersianDigits(String(listing.modelYearSh)) });
  }
  if (listing.mileageKm !== null) {
    rows.push({
      label: COPY.mileage,
      value: listing.mileageKm === 0 ? COPY.zeroKm : formatMileage(listing.mileageKm),
    });
  }
  const gearboxLabel = labelOf(gearbox.options, listing.gearbox);
  if (gearboxLabel !== null) rows.push({ label: COPY.gearbox, value: gearboxLabel });
  const fuelLabel = labelOf(fuel.options, listing.fuel);
  if (fuelLabel !== null) rows.push({ label: COPY.fuel, value: fuelLabel });
  const colourLabel = labelOf(colour.options, listing.colourFamily);
  if (colourLabel !== null) rows.push({ label: COPY.colour, value: colourLabel });
  const place = [listing.city, listing.district].filter((part): part is string => part !== null);
  if (place.length > 0) rows.push({ label: COPY.city, value: place.join('، ') });
  const sellerLabel = labelOf(seller.options, listing.sellerType);
  if (sellerLabel !== null) rows.push({ label: COPY.seller, value: sellerLabel });
  rows.push({ label: COPY.source, value: listing.source.name });
  rows.push({ label: COPY.listed, value: formatDate(listing.listedAt) });
  const days = daysOnMarket(listing.listedAt, listing.delistedAt ?? now);
  rows.push({ label: COPY.daysOnMarket, value: formatCountOf(days, 'روز') });
  return rows;
}

export type ConditionTone = 'good' | 'warning' | 'neutral';
export type ConditionRow = {
  readonly id: string;
  readonly text: string;
  readonly tone: ConditionTone;
  /** The phrase of the listing's text it was read from; null for what the seller declared, or a long phrase. */
  readonly quote: string | null;
};

const ENGINE_LABELS = [...(engineCondition.options ?? []), { value: 'repaired', label: 'موتور تعمیرشده' }];
const GEARBOX_LABELS = [...(gearboxCondition.options ?? []), { value: 'repaired', label: 'گیربکس تعمیرشده' }];

/** What the seller declared in the listing's own fields: the body, the chassis, the engine and the gearbox. */
export function declaredRows(listing: ListingFacts): readonly ConditionRow[] {
  const { declared } = listing;
  const rows: ConditionRow[] = [];
  const body = labelOf(bodyCondition.options, declared.body);
  if (body !== null && declared.body !== null) {
    const bad = ['partly_repainted', 'repainted_around', 'fully_repainted', 'accident_damaged', 'salvage'];
    rows.push({
      id: 'body',
      text: `بدنه: ${body}`,
      tone: bad.includes(declared.body) ? 'warning' : declared.body === 'intact' ? 'good' : 'neutral',
      quote: null,
    });
  }
  for (const [id, side, value] of [
    ['front_chassis', 'شاسی جلو', declared.frontChassis],
    ['rear_chassis', 'شاسی عقب', declared.rearChassis],
  ] as const) {
    const label = labelOf(chassis.options, value);
    if (label !== null && value !== null) {
      rows.push({
        id,
        text: `${side}: ${label.replace(/^شاسی\s+/, '')}`,
        tone: value === 'intact' ? 'good' : 'warning',
        quote: null,
      });
    }
  }
  const engine = labelOf(ENGINE_LABELS, declared.engine);
  if (engine !== null) {
    rows.push({
      id: 'engine',
      text: engine,
      tone: declared.engine === 'sound' ? 'good' : 'warning',
      quote: null,
    });
  }
  const gear = labelOf(GEARBOX_LABELS, declared.gearbox);
  if (gear !== null) {
    rows.push({
      id: 'gearbox',
      text: gear,
      tone: declared.gearbox === 'sound' ? 'good' : 'warning',
      quote: null,
    });
  }
  if (listing.insuranceMonthsLeft !== null) {
    rows.push({
      id: 'insurance',
      text: LISTING_COPY.condition.insurance(listing.insuranceMonthsLeft),
      tone: 'neutral',
      quote: null,
    });
  }
  return rows;
}

// What each accepted fact of the text says, in the glossary's words. «panels» is never shown as a number (glossary:
// panel count); «price_meaning», «installment», «swap» and «negotiable» are about the sale, so they are risks or
// terms, not condition, and are listed under their own heading.
const FACT_TEXT: Readonly<Record<string, Readonly<Record<string, { text: string; tone: ConditionTone }>>>> = {
  paint: {
    none: { text: 'بدون رنگ', tone: 'good' },
    spots: { text: 'لکه‌ی رنگ', tone: 'warning' },
    partial: { text: 'رنگ‌شدگی چند قطعه', tone: 'warning' },
    around: { text: 'دوررنگ', tone: 'warning' },
    full: { text: 'تمام رنگ', tone: 'warning' },
  },
  replaced: {
    none: { text: 'بدون قطعه‌ی تعویضی', tone: 'good' },
    some: { text: 'قطعه‌ی بدنه تعویض شده', tone: 'warning' },
  },
  chassis: {
    intact: { text: 'شاسی سالم', tone: 'good' },
    damaged: { text: 'شاسی آسیب‌دیده', tone: 'warning' },
  },
  accident: {
    none: { text: 'بدون تصادف', tone: 'good' },
    had_accident: { text: 'تصادف کرده', tone: 'warning' },
  },
  ride_hailing: {
    used: { text: 'در تاکسی اینترنتی کار کرده', tone: 'warning' },
    not_used: { text: 'در تاکسی اینترنتی کار نکرده', tone: 'good' },
  },
  plate: {
    national: { text: 'پلاک ملی', tone: 'good' },
    free_zone: { text: 'پلاک منطقه‌ی آزاد', tone: 'warning' },
  },
  swap: {
    yes: { text: 'معاوضه می‌کند', tone: 'neutral' },
    no: { text: 'معاوضه ندارد', tone: 'neutral' },
  },
  installment: {
    yes: { text: 'فروش قسطی دارد', tone: 'warning' },
    no: { text: 'فروش قسطی ندارد', tone: 'neutral' },
  },
  negotiable: {
    yes: { text: 'قیمت توافقی است', tone: 'neutral' },
    no: { text: 'قیمت قطعی است', tone: 'neutral' },
  },
  price_meaning: {
    full_price: { text: 'مبلغ آگهی قیمت کامل است', tone: 'good' },
    down_payment: { text: 'مبلغ آگهی پیش‌پرداخت است', tone: 'warning' },
    starting_from: { text: 'مبلغ آگهی «از ...» است', tone: 'warning' },
  },
};

const CONDITION_FIELDS = ['paint', 'replaced', 'chassis', 'accident', 'ride_hailing', 'plate'] as const;
const TERMS_FIELDS = ['price_meaning', 'installment', 'negotiable', 'swap'] as const;

function evidenceRows(evidence: readonly FactEvidence[], fields: readonly string[]): readonly ConditionRow[] {
  return fields.flatMap((field) =>
    evidence
      .filter((fact) => fact.field === field)
      .flatMap((fact) => {
        const shown = FACT_TEXT[field]?.[fact.value];
        return shown === undefined
          ? []
          : [{ id: `${field}:${fact.value}`, text: shown.text, tone: shown.tone, quote: fact.evidence }];
      }),
  );
}

/** The facts the text states about the car's condition, each with the phrase it was read from. */
export function textConditionRows(evidence: readonly FactEvidence[]): readonly ConditionRow[] {
  return evidenceRows(evidence, CONDITION_FIELDS);
}

/** The facts the text states about the sale: what the price is, instalments, negotiation, swaps. */
export function textTermRows(evidence: readonly FactEvidence[]): readonly ConditionRow[] {
  return evidenceRows(evidence, TERMS_FIELDS);
}

export type RiskFlag = { readonly id: string; readonly tone: 'warning' | 'info'; readonly text: string };

const CLEAN_BODY = new Set(['intact', 'minor_scratches', 'paintless_dent_repair']);
const PAINT_STATED = new Set(['spots', 'partial', 'around', 'full']);

/**
 * The sentences of caution, in the order a buyer should read them: a price that may not be the price, a missing
 * reading that stops the rating, the seller's fields disagreeing with the text, and what the rating cannot see.
 */
export function riskFlags(page: ListingPageData): readonly RiskFlag[] {
  const { listing, valuation, evidence } = page;
  const has = (field: string, value: string) =>
    evidence.some((fact) => fact.field === field && fact.value === value);
  const flags: RiskFlag[] = [];

  if (listing.priceType === 'installment' || has('price_meaning', 'down_payment')) {
    flags.push({
      id: 'down_payment',
      tone: 'warning',
      text: 'مبلغ نمایش‌داده‌شده ممکن است پیش‌پرداخت باشد، نه قیمت خودرو؛ قیمت کامل را در آگهی ببینید.',
    });
  } else if (has('price_meaning', 'starting_from')) {
    flags.push({
      id: 'starting_from',
      tone: 'warning',
      text: 'مبلغ نمایش‌داده‌شده «از ...» است؛ خودروی همین آگهی ممکن است گران‌تر باشد.',
    });
  } else if (listing.acceptsInstallments === true || has('installment', 'yes')) {
    flags.push({
      id: 'installments',
      tone: 'info',
      text: 'این آگهی فروش قسطی هم دارد؛ قیمت نقد را از فروشنده بپرسید.',
    });
  }
  if (
    valuation?.noRatingReason === 'installment_price' &&
    listing.priceType !== 'installment' &&
    listing.acceptsInstallments === true
  ) {
    flags.push({
      id: 'installment_guard',
      tone: 'warning',
      text: `قیمت این آگهی ${formatPercent(INSTALLMENT_GUARD_GAP_PCT / 100)} یا بیشتر زیر ارزش بازار است و آگهی قسطی هم دارد؛ ارزیابی‌اش نکرده‌ایم، چون چنین قیمتی اغلب پیش‌پرداخت است.`,
    });
  }
  if (listing.mileageKm === null) {
    flags.push({
      id: 'mileage_unread',
      tone: 'warning',
      text: 'کارکرد در آگهی نیامده یا قابل‌اعتماد نیست (مثلاً به هزار نوشته شده)؛ بدون آن ارزش بازار حساب نمی‌شود. کارکرد را از فروشنده بپرسید.',
    });
  }
  const bodyDeclaredClean = listing.declared.body !== null && CLEAN_BODY.has(listing.declared.body);
  const paintStated = evidence.find((fact) => fact.field === 'paint' && PAINT_STATED.has(fact.value));
  if (bodyDeclaredClean && paintStated !== undefined) {
    flags.push({
      id: 'paint_conflict',
      tone: 'warning',
      text: 'فروشنده بدنه را بدون رنگ‌شدگی ثبت کرده، اما متن آگهی از رنگ حرف می‌زند؛ پیش از خرید بدنه را بازدید کنید.',
    });
  }
  const chassisDeclaredIntact =
    listing.declared.frontChassis === 'intact' || listing.declared.rearChassis === 'intact';
  if (chassisDeclaredIntact && has('chassis', 'damaged')) {
    flags.push({
      id: 'chassis_conflict',
      tone: 'warning',
      text: 'فروشنده شاسی را سالم ثبت کرده، اما متن آگهی از آسیب شاسی می‌گوید؛ این ناهمخوانی را از فروشنده بپرسید.',
    });
  }
  if (has('accident', 'had_accident') && listing.declared.body === 'intact') {
    flags.push({
      id: 'accident_conflict',
      tone: 'warning',
      text: 'متن آگهی از تصادف می‌گوید، اما بدنه سالم ثبت شده است.',
    });
  }
  if (has('plate', 'free_zone')) {
    flags.push({
      id: 'free_zone',
      tone: 'warning',
      text: 'پلاک منطقه‌ی آزاد است و بازارش جداست؛ ارزش بازار ما این را از پلاک ملی جدا حساب نمی‌کند، پس گران‌تر از واقع نشان می‌دهد.',
    });
  }
  if (has('ride_hailing', 'used')) {
    flags.push({
      id: 'ride_hailing',
      tone: 'info',
      text: 'خودرو در تاکسی اینترنتی کار کرده؛ کارکرد روزانه‌اش بیشتر از معمول است.',
    });
  }
  if (valuation?.noRatingReason === 'price_outlier') {
    flags.push({
      id: 'price_outlier',
      tone: 'warning',
      text: 'قیمت آگهی با قیمت‌های بازار فاصله‌ی غیرعادی دارد؛ اشتباه تایپی یا قیمت طعمه را در نظر بگیرید.',
    });
  }
  return flags;
}

export type FreshnessState = 'fresh' | 'stale' | 'off_market';

export type FreshnessView = {
  readonly state: FreshnessState;
  /** «آخرین بررسی: ۳ ساعت پیش» */
  readonly checked: string;
  /** Whether the page asks the worker to read the listing again: it is on the market and its last read is old. */
  readonly requestsRecheck: boolean;
};

/** How fresh the listing's page is: its last own-page read against the freshness window (ADR-0017 point 3). */
export function freshnessView(listing: ListingFacts, now: string): FreshnessView {
  const COPY = LISTING_COPY.freshness;
  const checkedAt = listing.lastCheckedAt;
  const checked =
    checkedAt === null
      ? COPY.seen(formatTimeAgo(listing.lastSeenAt, now))
      : COPY.checked(formatTimeAgo(checkedAt, now));
  if (listing.status !== 'active') return { state: 'off_market', checked, requestsRecheck: false };
  const stale = checkedAt === null || Date.parse(now) - Date.parse(checkedAt) > FRESHNESS_WINDOW_HOURS * HOUR;
  return { state: stale ? 'stale' : 'fresh', checked, requestsRecheck: stale };
}

export type HistoryRow = {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  /** The price after the change, in full digits or in words. */
  readonly price: string;
  /** The price before it, shown struck through. */
  readonly previous: string | null;
  /** «۵٪ کمتر»: the change in whole percent for a change between two asking prices. */
  readonly change: string | null;
};

export type HistoryView = {
  /** Newest first; the last row is the day the listing went up. */
  readonly rows: readonly HistoryRow[];
  readonly daysOnMarket: string;
  /** «۵۰٬۰۰۰٬۰۰۰ تومان کمتر از قیمت اول»; null when it cannot be said. */
  readonly totalChange: string | null;
  /** No change of price was ever seen, so the price is the one the listing started with. */
  readonly unchanged: boolean;
};

function priceWords(type: string | null, amount: number | null): string {
  if (type === 'asking' && amount !== null) return formatToman(toToman(amount));
  if (type === 'negotiable') return LISTING_COPY.price.negotiable;
  if (type === 'installment') return LISTING_COPY.price.installment;
  return LISTING_COPY.price.unknown;
}

/**
 * The price timeline of one listing, built on one anchor: the day it was listed. Days on market count from the same
 * day the first row shows, so the two cannot disagree (the teardown's pattern 31). The first price is what the first
 * change replaced; a listing that never changed has had its current price all along.
 */
export function historyView(page: ListingPageData): HistoryView {
  const COPY = LISTING_COPY.history;
  const { listing, priceHistory, now } = page;
  // A listing whose own page was never read has no price of its own (the header says «قیمت نامشخص»): a price seen in a list
  // row is not claimed here, so the history never contradicts the header.
  const known = listing.priceType !== null;
  const observed = (known ? [...priceHistory] : []).sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  );
  // The first event of a listing is its price when we first read it, not a change (previous_price_type is null); every
  // later one is a change from the one before.
  const first: PriceEvent | undefined = observed[0];
  const firstIsStart = first?.previousPriceType === null;
  const events = firstIsStart ? observed.slice(1) : observed;
  let startType = listing.priceType;
  let startAmount = listing.askingPriceToman;
  if (first !== undefined) {
    startType = firstIsStart ? first.priceType : first.previousPriceType;
    startAmount = firstIsStart ? first.askingPriceToman : first.previousPriceToman;
  }
  const rows: HistoryRow[] = [];
  let before = { type: startType, amount: startAmount };
  for (const [index, event] of events.entries()) {
    let change: string | null = null;
    let label: string = COPY.priceRemoved;
    if (event.priceType === 'asking' && event.askingPriceToman !== null) {
      label = COPY.priceSet;
      if (before.type === 'asking' && before.amount !== null) {
        const ratio = (event.askingPriceToman - before.amount) / before.amount;
        const whole = Math.round(Math.abs(ratio) * 100);
        label = ratio < 0 ? COPY.dropped : COPY.raised;
        change = whole === 0 ? null : `${formatPercent(whole / 100)} ${ratio < 0 ? COPY.lower : COPY.higher}`;
      }
    }
    rows.push({
      id: `event-${String(index)}`,
      date: formatDate(event.observedAt),
      label,
      price: priceWords(event.priceType, event.askingPriceToman),
      previous: before.type === null ? null : priceWords(before.type, before.amount),
      change,
    });
    before = { type: event.priceType, amount: event.askingPriceToman };
  }
  rows.reverse();
  rows.push({
    id: 'listed',
    date: formatDate(listing.listedAt),
    label: COPY.published,
    price: startType === null ? COPY.firstPriceUnknown : priceWords(startType, startAmount),
    previous: null,
    change: null,
  });
  const last = events.at(-1);
  const startAsking = startType === 'asking' ? startAmount : null;
  const endAsking = last === undefined ? null : last.priceType === 'asking' ? last.askingPriceToman : null;
  let totalChange: string | null = null;
  if (startAsking !== null && endAsking !== null && startAsking !== endAsking) {
    const difference = Math.abs(endAsking - startAsking);
    totalChange = `${formatToman(toToman(difference))} ${endAsking < startAsking ? COPY.lower : COPY.higher} از قیمت اول`;
  }
  const days = daysOnMarket(listing.listedAt, listing.delistedAt ?? now);
  return { rows, daysOnMarket: formatCount(days), totalChange, unchanged: known && events.length === 0 };
}

export type ComparableRow = {
  readonly id: number;
  readonly href: string;
  readonly title: string;
  readonly facts: string;
  readonly asking: string;
  readonly adjusted: string;
  readonly offMarket: boolean;
  readonly photoUrl: string | null;
};

/** The comparables behind the value, each leading to its own page. */
export function comparableRows(comparables: readonly Comparable[]): readonly ComparableRow[] {
  return comparables.map((item) => ({
    id: item.listingId,
    href: `/listings/${String(item.listingId)}`,
    title: nameWithYear(item.name, item.modelYearSh),
    facts: item.mileageKm === null ? '' : formatMileage(item.mileageKm),
    asking: formatToman(toToman(item.askingPriceToman)),
    adjusted: formatTomanEstimate(toToman(item.adjustedPriceToman)),
    offMarket: item.status !== 'active',
    photoUrl: item.photoUrl,
  }));
}
