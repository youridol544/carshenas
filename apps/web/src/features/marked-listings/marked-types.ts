import type { DealTone } from '@/features/search/listing-card-view';

// What the marked-listings page shows (CS-69), as plain data with the words already made on the server: every number
// is the database's (the listing's price now, its price when marked, the valuation's rating), formatted by
// @carshenas/locale, so the client never computes or formats one.

export type MarkedStatus = 'active' | 'sold' | 'expired' | 'gone' | 'removed';

/** Which marked listings the page lists. */
export type MarkedFilter = 'all' | 'active' | 'dropped' | 'off';

export type PriceChange = {
  /** A fall is good news for a buyer, a rise is not, and an unchanged price says so. */
  readonly kind: 'down' | 'up' | 'same';
  /** «قیمت کم شد»: the badge. */
  readonly label: string;
  /** «۴۰ میلیون تومان ارزان‌تر از وقتی نشانش کردید (۴٪)». */
  readonly detail: string;
};

export type MarkedListing = {
  readonly id: number;
  /** The car as the catalogue names it, its model year after it. */
  readonly title: string;
  readonly href: string;
  readonly status: MarkedStatus;
  /** «فروخته شد», «منقضی شد»: null while it is on the market. */
  readonly statusLabel: string | null;
  /** «از ۱۰ مهر ۱۴۰۵», when it left the market. */
  readonly offSince: string | null;
  /** The price now, in full digits, or the words that stand where a price would be. */
  readonly price: { readonly kind: 'amount' | 'words'; readonly text: string };
  /** The price when the buyer marked it, in full digits; null when it had none then or has none now. */
  readonly markedPrice: string | null;
  readonly change: PriceChange | null;
  readonly deal: { readonly rating: DealTone; readonly label: string; readonly gap: string | null } | null;
  readonly facts: readonly string[];
  readonly place: string | null;
  readonly photo: string | null;
  /** «۱۰ مهر ۱۴۰۵». */
  readonly markedOn: string;
};

export type MarkedPage = {
  readonly filter: MarkedFilter;
  /** Every marked listing, newest mark first, whatever the filter. */
  readonly total: number;
  readonly counts: Readonly<Record<MarkedFilter, number>>;
  /** The listings the filter keeps. */
  readonly items: readonly MarkedListing[];
};
