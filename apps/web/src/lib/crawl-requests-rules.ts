import { formatCount } from '@carshenas/locale/format-number';

// The numbers and states of a crawl request (CS-71, ADR-0033) in one place: the rule that decides when a search file
// is offered «از کارشناس بخواهید بیشتر بگردد», the limits the database also holds, and the words of that rule, so the
// info control beside the card and the code that decides cannot disagree (the owner's request of 2026-10-01). A test
// in src/server/db/crawl-request-constraints.test.ts fails when the limits and the migration differ.

/** The four states of a request, in the order the superadmin's filter lists them (crawl_request_state_valid). */
export const CRAWL_REQUEST_STATES = ['pending', 'approved', 'declined', 'fulfilled'] as const;
export type CrawlRequestState = (typeof CRAWL_REQUEST_STATES)[number];

/** A file asks for at most this many models or trims (crawl_request_per_file_limit). */
export const MAX_REQUESTS_PER_FILE = 3;

/** An account has at most this many requests waiting for an answer (crawl_request_per_account_limit). */
export const MAX_OPEN_REQUESTS_PER_ACCOUNT = 10;

/** A decline's reason is 1 to this many characters (crawl_request_decline_reason_format). */
export const MAX_DECLINE_REASON_LENGTH = 300;

/**
 * A search file is offered a deeper crawl when fewer than this many cars match it. Below it the buyer has little to
 * choose from; at or above it, the index already holds enough of what the file asks for.
 */
export const FEW_MATCHES_BELOW = 10;

/** What a file must hold to ask: a model or a trim, because a crawl is chosen by model. */
export const OFFER_RULE = {
  fewMatchesBelow: FEW_MATCHES_BELOW,
  /** The words of the rule, shown beside the card. Numbers through the locale formatters. */
  sentences: [
    `کمتر از ${formatCount(FEW_MATCHES_BELOW)} آگهی با این پرونده می‌خواند.`,
    'پرونده خودرو را تا مدل (یا تیپ) مشخص کرده است، چون خواندن آگهی‌ها مدل‌به‌مدل انتخاب می‌شود.',
    'کارشناس این مدل را هنوز به‌طور کامل نمی‌خواند.',
    'پیش‌تر درخواستی از شما برای آن مدل رد نشده است.',
  ],
} as const;

/** Whether a file with this many matches (counted up to its cap) is offered a deeper crawl. */
export function isFewMatches(count: number): boolean {
  return count < FEW_MATCHES_BELOW;
}
