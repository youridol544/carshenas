import type { CrawlRequestState } from '@/lib/crawl-requests-rules';

// What the crawl-request pages, components and actions pass around (ADR-0033): plain data, text already Farsi,
// instants ISO-8601, so no client formats a date or a count.

/** Where one model or trim a file asks about stands. */
export type ScopeStatus = 'none' | 'tracked' | CrawlRequestState;

export type PanelScope = {
  readonly key: string;
  /** The car as the catalogue names it («پژو ۲۰۶ تیپ ۵»), in the digits the screen uses. */
  readonly carName: string;
  readonly status: ScopeStatus;
  /** This file is one of the request's files: its buyer is told when the request is answered. */
  readonly linked: boolean;
  /** A decline's reason, for the buyer. */
  readonly reason: string | null;
  readonly decidedAt: string | null;
};

/** What the file's page shows of crawl requests. */
export type CrawlPanel = {
  readonly scopes: readonly PanelScope[];
  /** The file names more models and trims than one file may ask for. */
  readonly tooMany: boolean;
  /** The file names no model or trim, so there is nothing to ask a crawl of. */
  readonly needsModel: boolean;
  /** Fewer cars match than the shared rule calls enough (crawl-requests-rules.ts). */
  readonly fewMatches: boolean;
  /** No source is being read now: an approved model waits in the queue and nothing is requested from any site. */
  readonly crawlPaused: boolean;
  /** Which scopes the buyer's press would ask for. */
  readonly askable: readonly string[];
};

/** A file's requests in one word for its card in the list: the one most worth the buyer's attention. */
export type FileCrawlSummary = {
  readonly state: 'pending' | 'approved' | 'declined' | 'fulfilled';
  readonly count: number;
};

export type AskResult =
  | { readonly status: 'asked'; readonly count: number }
  | { readonly status: 'nothing_to_ask' }
  | { readonly status: 'not_needed' }
  | { readonly status: 'declined' }
  | { readonly status: 'too_many' }
  | { readonly status: 'file_limit' }
  | { readonly status: 'account_limit' }
  | { readonly status: 'gone'; readonly message: string }
  | { readonly status: 'signed_out'; readonly message: string }
  | { readonly status: 'failed'; readonly message: string };
