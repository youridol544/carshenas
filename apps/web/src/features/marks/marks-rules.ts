// The rules of marking a listing (CS-69) that code and database both state: the database enforces the cap
// (listing_mark_account_cap, db/migrations/20261002232738), a test proves the two agree.

/** The most listings one account may mark. */
export const MAX_MARKED_LISTINGS = 200;

/** How long a visitor's wish to mark a listing waits while they sign in or sign up and come back, in milliseconds. */
export const PENDING_MARK_LIFETIME_MS = 30 * 60 * 1000;
