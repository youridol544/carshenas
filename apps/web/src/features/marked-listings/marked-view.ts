import { toPersianDigits } from '@carshenas/locale/digits';
import { formatDate } from '@carshenas/locale/format-date';
import { formatMileage, formatPercent } from '@carshenas/locale/format-number';
import { formatToman, formatTomanInWords, toToman } from '@carshenas/locale/toman';
import { deal as dealFilter, gearbox } from '@carshenas/search/filters';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import type {
  MarkedFilter,
  MarkedListing,
  MarkedPage,
  MarkedStatus,
  PriceChange,
} from '@/features/marked-listings/marked-types';
import { gapSentence } from '@/features/search/listing-card-view';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { nameOnScreen } from '@carshenas/locale/names';

// What one marked listing says (CS-69), made from the row the query read: its price now against its price when it was
// marked, its status, its rating. Pure, so a unit test reads it. Numbers are the database's, formatted here through
// @carshenas/locale; nothing is computed that the buyer could not check against the two prices on the screen.

const NO_BREAK_SPACE = '\u00A0';
const FILTERS: readonly MarkedFilter[] = ['all', 'active', 'dropped', 'off'];

export type MarkedRow = {
  readonly listingId: number;
  readonly markedAt: Date;
  readonly markedPriceToman: number | null;
  readonly status: MarkedStatus;
  readonly delistedAt: Date | null;
  readonly name: string | null;
  readonly title: string | null;
  readonly modelYearSh: number | null;
  readonly mileageKm: number | null;
  readonly gearbox: string | null;
  readonly cityName: string | null;
  readonly districtFa: string | null;
  readonly priceType: string | null;
  readonly askingPriceToman: number | null;
  readonly dealRating: 'great' | 'good' | 'fair' | 'high' | 'overpriced' | null;
  readonly priceGapPct: number | null;
  readonly photoUrl: string | null;
};

/** The filter in the address, or «همه»: anything else is as if it were not there. */
export function readMarkedFilter(value: unknown): MarkedFilter {
  return typeof value === 'string' && FILTERS.includes(value as MarkedFilter)
    ? (value as MarkedFilter)
    : 'all';
}

/** How the price now compares with the price when marked; null when either is not a stated asking price. */
export function priceChangeOf(markedToman: number | null, nowToman: number | null): PriceChange | null {
  if (markedToman === null || nowToman === null) return null;
  const difference = nowToman - markedToman;
  if (difference === 0) {
    return { kind: 'same', label: MARKED_COPY.change.same, detail: MARKED_COPY.change.detailSame };
  }
  const amount = formatTomanInWords(toToman(Math.abs(difference)));
  const share = formatPercent(Math.abs(difference) / markedToman);
  return difference < 0
    ? { kind: 'down', label: MARKED_COPY.change.down, detail: MARKED_COPY.change.detailDown(amount, share) }
    : { kind: 'up', label: MARKED_COPY.change.up, detail: MARKED_COPY.change.detailUp(amount, share) };
}

/** Only a change is news: an unchanged price gets no badge. */
function newsOf(change: PriceChange | null): PriceChange | null {
  return change?.kind === 'same' ? null : change;
}

function statusLabelOf(status: MarkedStatus): string | null {
  return status === 'active' ? null : MARKED_COPY.status[status];
}

function priceOf(row: MarkedRow): MarkedListing['price'] {
  if (row.priceType === 'asking' && row.askingPriceToman !== null) {
    return { kind: 'amount', text: formatToman(toToman(row.askingPriceToman)) };
  }
  const words =
    row.priceType === 'negotiable'
      ? SEARCH_COPY.card.negotiable
      : row.priceType === 'installment'
        ? SEARCH_COPY.card.installment
        : SEARCH_COPY.card.unknownPrice;
  return { kind: 'words', text: words };
}

function titleOf(row: MarkedRow): string {
  const name = row.name === null || row.name.trim() === '' ? (row.title ?? '') : nameOnScreen(row.name);
  return row.modelYearSh === null
    ? name
    : `${name}، مدل${NO_BREAK_SPACE}${toPersianDigits(String(row.modelYearSh))}`;
}

function dealOf(row: MarkedRow): MarkedListing['deal'] {
  // A listing off the market, or with no asking price, is not rated; the page says what it knows and nothing more.
  if (row.status !== 'active' || row.priceType !== 'asking') return null;
  const label =
    row.dealRating === null ? undefined : dealFilter.options.find((o) => o.value === row.dealRating)?.label;
  if (row.dealRating === null || label === undefined) {
    return { rating: 'none', label: MARKED_COPY.unrated, gap: null };
  }
  return {
    rating: row.dealRating,
    label,
    gap: row.priceGapPct === null ? null : gapSentence(row.priceGapPct),
  };
}

function factsOf(row: MarkedRow): string[] {
  const facts: string[] = [];
  if (row.mileageKm !== null) {
    facts.push(row.mileageKm === 0 ? SEARCH_COPY.card.zeroKm : formatMileage(row.mileageKm));
  }
  const box = gearbox.options?.find((option) => option.value === row.gearbox)?.label;
  if (box !== undefined) facts.push(box);
  return facts;
}

export function toMarkedListing(row: MarkedRow): MarkedListing {
  const nowToman = row.priceType === 'asking' ? row.askingPriceToman : null;
  const place = [row.cityName, row.districtFa].filter((part): part is string => part !== null);
  return {
    id: row.listingId,
    title: titleOf(row),
    href: `/listings/${String(row.listingId)}`,
    status: row.status,
    statusLabel: statusLabelOf(row.status),
    offSince: row.delistedAt === null ? null : MARKED_COPY.status.since(formatDate(row.delistedAt)),
    price: priceOf(row),
    markedPrice: row.markedPriceToman === null ? null : formatToman(toToman(row.markedPriceToman)),
    change: newsOf(priceChangeOf(row.markedPriceToman, nowToman)),
    deal: dealOf(row),
    facts: factsOf(row),
    place: place.length === 0 ? null : place.join('، '),
    photo: row.photoUrl,
    markedOn: formatDate(row.markedAt),
  };
}

/** Whether a listing belongs under a filter: «از بازار رفته» is everything that is not on the market. */
function belongsTo(listing: MarkedListing, filter: MarkedFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return listing.status === 'active';
    case 'dropped':
      return listing.change?.kind === 'down';
    case 'off':
      return listing.status !== 'active';
  }
}

export function markedPage(rows: readonly MarkedRow[], filter: MarkedFilter): MarkedPage {
  const all = rows.map(toMarkedListing);
  const counts = Object.fromEntries(
    FILTERS.map((name) => [name, all.filter((listing) => belongsTo(listing, name)).length]),
  ) as Record<MarkedFilter, number>;
  return { filter, total: all.length, counts, items: all.filter((listing) => belongsTo(listing, filter)) };
}
