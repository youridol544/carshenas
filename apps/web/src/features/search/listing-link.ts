import type { ListingCard } from '@/features/search/search-types';

// Where a result card leads. The listing page (CS-64) does not exist yet, so until it does a card leads to the ad on its
// own source, in a new tab: this one function decides, and CS-64 changes it to its own route (an internal link has
// `external: false`, so the card's link loses its new-tab attributes and its "opens in a new tab" note by itself). A
// card whose address is missing or is not an https address is not a link at all, never a dead one.

export type ListingLink = {
  readonly href: string;
  /** True for another site: the link opens in a new tab and says so. */
  readonly external: boolean;
};

export function listingLink(card: Pick<ListingCard, 'id' | 'url'>): ListingLink | null {
  if (!URL.canParse(card.url)) return null;
  const address = new URL(card.url);
  return address.protocol === 'https:' ? { href: address.href, external: true } : null;
}
