import type { ListingPageData, SimilarListing } from '@/features/listing/listing-types';

// What a pasted Divar link came to (CS-65, CS-115), as plain data. The problems a link can have by itself (no link, another
// site, not an ad) are decided by lib/pasted-link.ts before the database is asked; these are what our own data and the
// catalogue's names said. The answer has four states a buyer tells apart, none of which is a fault: the ad is known (its
// rating), the car is read but this ad is not yet (queued), the car is not one Carshenas reads (outside, with the one way
// forward), and the link does not say which car it is (unreadable). A car is «covered» when its model is read in depth
// now: a tracked model in the state tracking (ADR-0037, ADR-0046).

/** A car as the catalogue names it, for a sentence and a link. */
export type CarName = {
  readonly key: string;
  readonly name: string;
  /** The address of the model's page. */
  readonly href: string;
};

/** The cars Carshenas reads in depth: most listed first. */
export type CoveredCars = readonly CarName[];

/** Where the model of a link stands for the viewer: the request for it, and whether this viewer asked (CS-71, ADR-0036). */
export type ModelRequest = {
  /** `none`: nobody asked; the others are the request's states (crawl-requests-rules). */
  readonly status: 'none' | 'pending' | 'approved' | 'declined' | 'fulfilled';
  /** The signed-in viewer asked: one of their search files depends on the request. */
  readonly mine: boolean;
  /** A decline's reason, written for the buyers. */
  readonly reason: string | null;
  /** The viewer's own file for the model, when they asked. */
  readonly fileId: number | null;
  readonly signedIn: boolean;
};

/** Why the car cannot be told from the link. */
export type UnreadableReason =
  /** The short form of Divar's link: it has no title. */
  | 'no_title'
  /** The title names no car the catalogue knows. */
  | 'no_car'
  /** The title names more than one. */
  | 'two_cars'
  /** The title names a make, and Carshenas reads some of its models, so the title does not settle which one it is. */
  | 'make_only';

export type CheckAnswer =
  /** A listing on the market with its details read: the page's data, with the rating when it has one. */
  | { readonly kind: 'found'; readonly page: ListingPageData }
  /** A listing that has left the market. */
  | {
      readonly kind: 'off_market';
      readonly page: ListingPageData;
      readonly suggestions: readonly SimilarListing[];
    }
  /** This client address has asked too often for now (server/token-bucket.ts). */
  | { readonly kind: 'limited' }
  /**
   * The car is one Carshenas reads, and this ad is not read yet: either never seen (a pasted link is never fetched) or seen
   * on a list page only. `crawlPaused`: nothing is being read now, so the answer says so instead of promising a time.
   */
  | {
      readonly kind: 'queued';
      readonly car: CarName;
      readonly crawlPaused: boolean;
      /** The viewer asked for this model before and it was approved: the answer says that is why it is read. */
      readonly grantedToViewer: boolean;
      /** The ad is in our data (seen on a list page): its page is what is not read. */
      readonly seen: boolean;
      /** The listing's address on its source, for the click-out of a seen ad. */
      readonly sourceUrl: string | null;
      readonly suggestions: readonly SimilarListing[];
    }
  /**
   * The car is not one Carshenas reads. The limit comes first, with the cars it does read, and the one way forward: asking
   * for the model. `model`: the title (or the listing) names the model; `make`: only the make is told, so the buyer picks
   * the model among the make's.
   */
  | {
      readonly kind: 'outside';
      readonly car:
        | { readonly kind: 'model'; readonly model: CarName }
        | { readonly kind: 'make'; readonly name: string; readonly models: readonly ChoosableModel[] };
      readonly covered: CoveredCars;
      readonly request: ModelRequest;
      /** What the action is asked with: the canonical address of the link; the server reads the car from it again. */
      readonly link: string;
    }
  /** The link is a Divar ad's, but its car cannot be told; `make` is named when only the make is. */
  | {
      readonly kind: 'unreadable';
      readonly reason: UnreadableReason;
      readonly make: string | null;
      /** The covered models of that make, as the way forward when only the make is told. */
      readonly coveredOfMake: CoveredCars;
      readonly covered: CoveredCars;
    };

/** A model of a make, as the chooser offers it. */
export type ChoosableModel = { readonly key: string; readonly name: string };

/** What pressing «درخواست افزودن» came to (the action's result): the database decided the limits and a declined request. */
export type AskModelResult =
  /** The request is placed, and the buyer's file for the model holds it (made now, or the one they already kept). */
  | { readonly status: 'asked'; readonly fileId: number; readonly madeFile: boolean }
  /** The viewer is not signed in: they are asked to, and come back to this answer. */
  | { readonly status: 'signed_out' }
  /** The model is read now: there is nothing to ask. */
  | { readonly status: 'covered' }
  /** This viewer asked for the model before. */
  | { readonly status: 'already'; readonly fileId: number }
  /** The model was asked for and declined: it is not asked for again. */
  | { readonly status: 'declined'; readonly reason: string | null }
  /** The link says no car the ask can name (it changed, or it was never one). */
  | { readonly status: 'unreadable'; readonly message: string }
  /** A limit of the account (files, requests waiting) or a failure: the message says what to do. */
  | { readonly status: 'refused'; readonly message: string };
