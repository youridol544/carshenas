import type { SearchFileState } from '@/features/search-files/search-files-rules';

// What the search-file pages, components and actions pass around (ADR-0031): plain data, text already Farsi, instants
// ISO-8601, so no client formats a date or a count.

export type SearchFileSummary = {
  readonly id: number;
  readonly name: string;
  readonly state: SearchFileState;
  readonly createdAt: string;
  readonly viewedAt: string;
  /** The buyer turned this file's alerts off (CS-72): it still matches and shows what is new. */
  readonly alertsMuted: boolean;
  /** When Karshenas last notified the buyer about this file, ISO-8601, or null if never. */
  readonly lastAlertAt: string | null;
  /** The search as the chips of the search page word it («پژو ۲۰۶», «تا ۷۰۰ میلیون تومان»); empty when unreadable. */
  readonly chips: readonly string[];
  /**
   * False when the stored search no longer fits the filters of this build: the file is listed and can be deleted, its
   * matches are not guessed.
   */
  readonly readable: boolean;
  /** Matches and new matches, or null when they could not be counted (shown as such, never as zero). */
  readonly counts: {
    readonly matches: { readonly count: number; readonly exact: boolean };
    readonly newCount: number;
  } | null;
  /**
   * What the list card shows of the matches (only where the list asks): the newest match's photo, from the source's own
   * address (ADR-0025), and the best deal among them; null where it was not read.
   */
  readonly highlight: {
    readonly photoUrl: string | null;
    readonly best: {
      readonly price: string;
      readonly rating: string | null;
      readonly label: string | null;
    } | null;
  } | null;
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
