// The numbers and states of a crawl request (CS-71, ADR-0036) in one place: the rule that decides when a search file
// is offered «درخواست جست‌وجوی بیشتر» and the limits the database also holds, so the card, its info control and the
// code that decides cannot disagree (the owner's request of 2026-10-01). A test in
// src/server/db/crawl-request-constraints.test.ts fails when the limits and the migration differ.

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
} as const;

/** Whether a file with this many matches (counted up to its cap) is offered a deeper crawl. */
export function isFewMatches(count: number): boolean {
  return count < FEW_MATCHES_BELOW;
}
