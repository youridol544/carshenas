import type { SearchFileState } from '@/features/search-files/search-files-rules';

// What the search-file pages, components and actions pass around (ADR-0030): plain data, text already Farsi, instants
// ISO-8601, so no client formats a date or a count.

/** How many listings a file's search finds now, counted up to a cap. */
export type MatchCount = { readonly count: number; readonly exact: boolean };

export type SearchFileSummary = {
  readonly id: number;
  readonly name: string;
  readonly state: SearchFileState;
  readonly createdAt: string;
  readonly viewedAt: string;
  /** The search as the chips of the search page word it («پژو ۲۰۶», «تا ۷۰۰ میلیون تومان»); empty when unreadable. */
  readonly chips: readonly string[];
  /**
   * False when the stored search no longer fits the filters of this build: the file is listed and can be deleted, its
   * matches are not guessed.
   */
  readonly readable: boolean;
  /** Matches and new matches, or null when they could not be counted (shown as such, never as zero). */
  readonly counts: { readonly matches: MatchCount; readonly newCount: number } | null;
};

/** What the save dialog learns when it opens. */
export type PreparedSave =
  | { readonly status: 'signed_out' }
  | { readonly status: 'ready' }
  | { readonly status: 'exists'; readonly file: { id: number; name: string; state: SearchFileState } }
  | { readonly status: 'limit' };

export type CreateFileResult =
  | { readonly status: 'created'; readonly file: { id: number; name: string } }
  | { readonly status: 'exists'; readonly file: { id: number; name: string; state: SearchFileState } }
  | { readonly status: 'limit' }
  | { readonly status: 'signed_out' }
  | { readonly status: 'invalid'; readonly field: 'name' | 'search'; readonly message: string }
  | { readonly status: 'failed'; readonly message: string };

export type FileActionResult =
  | { readonly status: 'done' }
  | { readonly status: 'gone'; readonly message: string }
  | { readonly status: 'failed'; readonly message: string };
