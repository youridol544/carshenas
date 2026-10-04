import 'server-only';
import { buildLexicon, type Lexicon } from '@carshenas/search/understand/lexicon';
import { readLexiconRows } from '@carshenas/search/understand/lexicon-queries';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// The names plain-Farsi search matches (makes, models, trims with their aliases, cities, districts, body types,
// colours, and how many searchable listings each has), read once and kept for five minutes: nine small reads that
// change only when the catalogue or the search table is rebuilt, never per question. Once a lexicon is kept, a
// question never waits for the next read (CS-111: the one step of the smart search is as quick as the code that
// reads): a lexicon older than the five minutes is served as it is while the refresh runs in the background. A refresh
// that fails keeps serving the lexicon it has (and reports the error); only a process that has never read one waits
// for its first read, and fails its question when that fails.

export const LEXICON_TTL_MS = 5 * 60 * 1_000;

type Kept = { readonly lexicon: Lexicon; readonly readAt: number };

const globalForLexicon = globalThis as typeof globalThis & {
  carshenasLexicon?: { kept?: Kept; loading?: Promise<Lexicon> };
};

/** The lexicon, read when none is kept or the kept one is older than the TTL; one read at a time. */
export async function currentLexicon(now = Date.now()): Promise<Lexicon> {
  const state = (globalForLexicon.carshenasLexicon ??= {});
  if (state.kept !== undefined && now - state.kept.readAt < LEXICON_TTL_MS) return state.kept.lexicon;
  const refreshing = (state.loading ??= readLexiconRows(readDatabase())
    .then((rows) => {
      const lexicon = buildLexicon(rows);
      state.kept = { lexicon, readAt: now };
      return lexicon;
    })
    .catch((error: unknown) => {
      if (state.kept === undefined) throw error;
      captureError(error, { message: 'reading the search lexicon failed, serving the last one' });
      // Do not try again on every question: the stale one is kept for another TTL.
      state.kept = { lexicon: state.kept.lexicon, readAt: now };
      return state.kept.lexicon;
    })
    .finally(() => {
      state.loading = undefined;
    }));
  // A lexicon is kept: it answers now, and the refresh above (which cannot fail with one kept) finishes in the background.
  return state.kept === undefined ? refreshing : state.kept.lexicon;
}

/** For tests: forget what is kept. */
export function forgetLexicon(): void {
  globalForLexicon.carshenasLexicon = undefined;
}
