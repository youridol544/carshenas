import type { ListingFacts, ListingPageData, SimilarListing } from '@/features/listing/listing-types';

// What a pasted Divar link came to (CS-65), as plain data. The problems a link can have by itself (no link, another site,
// not a listing) are decided by link-parse.ts before the database is asked; these are what the database said.

export type CheckAnswer =
  /** A listing on the market with its details read: the page's data, with the rating when it has one. */
  | { readonly kind: 'found'; readonly page: ListingPageData }
  /** A listing we know whose model we do not read in depth yet: seen on a list page only, so no price to rate. */
  | {
      readonly kind: 'unread';
      readonly listing: ListingFacts;
      /** The request was counted as demand for the listing's model (the superadmin's list of models buyers ask for). */
      readonly counted: boolean;
      readonly suggestions: readonly SimilarListing[];
    }
  /** A listing that has left the market. */
  | { readonly kind: 'off_market'; readonly page: ListingPageData }
  /** A token we have not seen, or a listing Carshenas took down. `recorded`: it became a wanted link. */
  | {
      readonly kind: 'not_found';
      readonly recorded: boolean;
      readonly suggestions: readonly SimilarListing[];
    };
