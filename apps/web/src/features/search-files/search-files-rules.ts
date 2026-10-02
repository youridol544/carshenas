// The numbers and states of a search file (CS-70, ADR-0031) that the database also holds, in one place. A test in
// src/server/db/schema-constraints.test.ts fails when the database and this file disagree.

/** At most this many files an account (the trigger search_file_limit refuses the next one). */
export const MAX_SEARCH_FILES = 30;

/** A name is 1 to this many characters (search_file_name_format). */
export const MAX_NAME_LENGTH = 80;

/** The three states of a file, in the order the list shows them (search_file_status_valid). */
export const SEARCH_FILE_STATES = ['watching', 'paused', 'closed'] as const;
export type SearchFileState = (typeof SEARCH_FILE_STATES)[number];

/** How many of a file's matches the page counts before saying «more than». */
export const MATCH_COUNT_CAP = 1_000;

/** How many matches a file's page lists; the rest are one link away, on the search page. */
export const FILE_PAGE_SIZE = 24;
