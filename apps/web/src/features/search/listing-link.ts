import type { ListingCard } from '@/features/search/search-types';

// Where a result card leads: the listing's own page, /listings/[id] (CS-64), whose primary action is the click-out to the
// ad on its source. This one function decides, so the card, its tests and the pages that list listings (the home page's
// catalogues, CS-63) cannot disagree. A link that leaves the site has `external: true`, and the card's link then opens a
// new tab and says so (listing-card.tsx); none is used today.

export type ListingLink = {
  readonly href: string;
  /** True for another site: the link opens in a new tab and says so. */
  readonly external: boolean;
};

export function listingLink(card: Pick<ListingCard, 'id'>): ListingLink | null {
  return Number.isSafeInteger(card.id) && card.id > 0
    ? { href: `/listings/${String(card.id)}`, external: false }
    : null;
}
