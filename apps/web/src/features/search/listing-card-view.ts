import { formatDate, tehranIsoDate } from '@carshenas/locale/format-date';
import { formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { assumedNoteView, withAssumption, type MileageNoteView } from '@/lib/mileage-info';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatToman, formatTomanEstimate, toToman } from '@carshenas/locale/toman';
import {
  bodyCondition,
  chassis,
  deal,
  engineCondition,
  fuel,
  gearbox,
  gearboxCondition,
  paintFree,
  seller,
} from '@carshenas/search/filters';
import type { DealRating, ListingCard } from '@/features/search/search-types';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { nameOnScreen } from '@carshenas/locale/names';

// What a result card says, as plain strings and codes: the card's words and its numbers in one place that a unit
// test can read (listing-card-view.test.ts), so the component only lays them out. Every label of a code comes from
// the shared definitions (CS-58), never from a second list; every number is formatted by @carshenas/locale; every
// number a buyer sees was computed by the database (the valuation's gap and value, the listing's own price).

const COPY = SEARCH_COPY.card;
const NO_BREAK_SPACE = '\u00A0';
const DAY = 86_400_000;

export type DealTone = DealRating | 'none';

/** The asking price in full digits, or the words that stand where a price would be. */
export type PriceView =
  { readonly kind: 'amount'; readonly text: string } | { readonly kind: 'words'; readonly text: string };

export type DealView = {
  readonly rating: DealTone;
  /** «معامله‌ی عالی», or «بدون ارزیابی» for a priced listing the valuation did not rate. */
  readonly label: string;
  /** «۸٪ زیر ارزش بازار»; null when there is no gap to state. */
  readonly gap: string | null;
  /** «ارزش بازار: ۹۴۰٬۰۰۰٬۰۰۰ تومان، ۱۰ مهر ۱۴۰۵»: the value the gap is measured against, with its date. */
  readonly marketValue: string | null;
  /** Why a priced listing has no rating, in plain words; null when it is rated. */
  readonly reason: string | null;
};

export type ConditionTone = 'good' | 'warning' | 'neutral';
export type ConditionView = { readonly text: string; readonly tone: ConditionTone };

export type CardView = {
  readonly title: string;
  readonly price: PriceView;
  readonly deal: DealView | null;
  /** «۲۷۰٬۰۰۰ کیلومتر», «دنده‌ای»: the facts a buyer scans, in order of importance. */
  readonly facts: readonly string[];
  /** «تهران، خانی آباد نو»; null when the listing's page was never read for a place. */
  readonly place: string | null;
  /** At most three: the body or paint, the chassis, the engine and gearbox. */
  readonly condition: readonly ConditionView[];
  readonly source: string;
  readonly seller: string | null;
  readonly days: string;
  readonly photo: { readonly src: string; readonly count: number } | null;
  /** False for a listing only seen in a list: no price, year or mileage, so the card says where to read them. */
  readonly hasDetails: boolean;
  /** A mileage read in thousands, or really that low (CS-101): the sentence under the facts and its rule. */
  readonly mileageNote: MileageNoteView | null;
};

// A choice filter built from the database has no options of its own (`undefined`): none of the filters read here is.
function labelOf(
  options: readonly { readonly value: string; readonly label: string }[] | undefined,
  value: string | null,
): string | null {
  if (value === null || options === undefined) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

/** Whole Tehran days from the day the listing went on the market to today: 0 on the day itself. */
export function daysOnMarket(listedAt: string, now: string): number {
  const days = (Date.parse(tehranIsoDate(now)) - Date.parse(tehranIsoDate(listedAt))) / DAY;
  return Math.max(0, Math.round(days));
}

/** «۸٪ زیر ارزش بازار»; the gap of a few tenths of a percent reads as being at the market value. */
export function gapSentence(gapPct: number): string {
  const rounded = Math.round(Math.abs(gapPct));
  if (rounded === 0) return COPY.atMarket;
  return `${formatPercent(rounded / 100)} ${gapPct < 0 ? COPY.belowMarket : COPY.aboveMarket}`;
}

function titleOf(card: ListingCard): string {
  const name = card.name.trim() === '' ? (card.title ?? '') : nameOnScreen(card.name);
  if (card.modelYearSh === null) return name;
  return `${name}، مدل${NO_BREAK_SPACE}${toPersianDigits(String(card.modelYearSh))}`;
}

function priceOf(card: ListingCard): PriceView {
  switch (card.priceType) {
    case 'asking':
      return card.askingPriceToman === null
        ? { kind: 'words', text: COPY.unknownPrice }
        : { kind: 'amount', text: formatToman(toToman(card.askingPriceToman)) };
    case 'negotiable':
      return { kind: 'words', text: COPY.negotiable };
    case 'installment':
      return { kind: 'words', text: COPY.installment };
    default:
      return { kind: 'words', text: COPY.unknownPrice };
  }
}

/**
 * Why a listing that has a market value has no rating, from what the card knows: the valuation's own rules (S01, rules 7
 * and 8) are a price more than three times (or under a third of) the model's market value, and a dealer's zero-km post.
 * The API does not carry the stored reason code, so this repeats the two rules that matter on a page; anything else
 * gets the general sentence.
 */
function unratedReason(card: ListingCard, marketValueToman: number): string {
  const asking = card.askingPriceToman ?? 0;
  if (marketValueToman > 0 && (asking > marketValueToman * 3 || asking < marketValueToman / 3)) {
    return COPY.unratedOutlier;
  }
  if (card.sellerType === 'dealer' && card.mileageKm !== null && card.mileageKm < 1000) {
    return COPY.unratedShowroom;
  }
  return COPY.unratedWithValue;
}

function dealOf(card: ListingCard): DealView | null {
  // A negotiable, instalment or unpriced listing has nothing to rate, and gets no badge.
  if (card.priceType !== 'asking' || card.askingPriceToman === null) return null;
  const { valuation } = card;
  if (valuation === null) {
    return { rating: 'none', label: COPY.unrated, gap: null, marketValue: null, reason: COPY.unratedNoValue };
  }
  const label = valuation.dealRating === null ? null : labelOf(deal.options, valuation.dealRating);
  const marketValue = `${COPY.marketValue}: ${formatTomanEstimate(toToman(valuation.marketValueToman))}، ${formatDate(valuation.valuedOn)}`;
  if (valuation.dealRating === null || label === null) {
    return {
      rating: 'none',
      label: COPY.unrated,
      gap: null,
      marketValue,
      reason: unratedReason(card, valuation.marketValueToman),
    };
  }
  return {
    rating: valuation.dealRating,
    label,
    gap: valuation.priceGapPct === null ? null : gapSentence(valuation.priceGapPct),
    marketValue,
    reason: null,
  };
}

function factsOf(card: ListingCard): string[] {
  const facts: string[] = [];
  if (card.mileageKm !== null) {
    const mileage = card.mileageKm === 0 ? COPY.zeroKm : formatMileage(card.mileageKm);
    facts.push(withAssumption(mileage, card.mileageReading));
  }
  const gearboxLabel = labelOf(gearbox.options, card.gearbox);
  if (gearboxLabel !== null) facts.push(gearboxLabel);
  // Petrol is what a car runs on unless it says otherwise; only the others are worth a word.
  const fuelLabel = card.fuel === 'petrol' ? null : labelOf(fuel.options, card.fuel);
  if (fuelLabel !== null) facts.push(fuelLabel);
  return facts;
}

const BODY_WITH_PAINT = new Set(['partly_repainted', 'repainted_around', 'fully_repainted']);

/**
 * The condition summary: what the seller declared and the text says, read by the valuation's own extraction (CS-52),
 * as short phrases in the definitions' words. Silence says nothing: a listing that does not state its engine shows no
 * engine phrase, and a stated problem is shown in preference to a stated virtue.
 */
export function conditionOf(card: ListingCard): ConditionView[] {
  const { condition } = card;
  const items: ConditionView[] = [];

  const accidentLabel = labelOf(bodyCondition.options, 'accident_damaged') ?? COPY.accident;
  if (condition.body === 'salvage') {
    items.push({ text: labelOf(bodyCondition.options, 'salvage') ?? COPY.accident, tone: 'warning' });
  } else if (condition.body === 'accident_damaged' || condition.accident === 'had_accident') {
    items.push({ text: accidentLabel, tone: 'warning' });
  } else if (condition.paintFree === true) {
    items.push({ text: paintFree.label, tone: 'good' });
  } else if (condition.paintFree === false) {
    const painted = condition.body === null ? null : labelOf(bodyCondition.options, condition.body);
    items.push({
      text:
        condition.body !== null && BODY_WITH_PAINT.has(condition.body) && painted !== null
          ? painted
          : COPY.paintedSomewhere,
      tone: 'warning',
    });
  } else if (condition.body !== null) {
    const body = labelOf(bodyCondition.options, condition.body);
    if (body !== null) items.push({ text: body, tone: 'neutral' });
  }

  const chassisLabel = labelOf(chassis.options, condition.chassis);
  if (chassisLabel !== null) {
    items.push({ text: chassisLabel, tone: condition.chassis === 'intact' ? 'good' : 'warning' });
  }

  if (condition.engine === 'sound' && condition.gearbox === 'sound') {
    items.push({ text: COPY.soundBoth, tone: 'good' });
  } else {
    for (const [value, options] of [
      [condition.engine, engineCondition.options],
      [condition.gearbox, gearboxCondition.options],
    ] as const) {
      const label = labelOf(options, value);
      if (label !== null) items.push({ text: label, tone: value === 'sound' ? 'good' : 'warning' });
    }
  }
  return items.slice(0, 3);
}

/** Everything a result card shows, read from the DTO the search API returned and the moment the page was made. */
export function cardView(card: ListingCard, now: string): CardView {
  const place = [card.city?.name, card.district].filter(
    (part): part is string => part !== undefined && part !== null,
  );
  const days = daysOnMarket(card.listedAt, now);
  return {
    title: titleOf(card),
    price: priceOf(card),
    deal: dealOf(card),
    facts: factsOf(card),
    // Only an assumed mileage is worth a line on a card; the sentence for a really low one is the listing page's.
    mileageNote: assumedNoteView(card),
    place: place.length === 0 ? null : place.join('، '),
    condition: conditionOf(card),
    source: card.source.name,
    seller: labelOf(seller.options, card.sellerType),
    days: days === 0 ? COPY.today : COPY.daysOnMarket(days),
    photo:
      card.photo === null
        ? null
        : { src: card.photo.thumbnailUrl ?? card.photo.url, count: card.photo.count },
    hasDetails: card.priceType !== null || card.modelYearSh !== null || card.mileageKm !== null,
  };
}
