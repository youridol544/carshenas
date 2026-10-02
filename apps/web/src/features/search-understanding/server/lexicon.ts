import 'server-only';
import { buildLexicon, type Lexicon } from '@carshenas/search/understand/lexicon';
import { readLexiconRows } from '@carshenas/search/understand/lexicon-queries';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// The names plain-Farsi search matches (makes, models, trims with their aliases, cities, districts, body types,
// colours, and how many searchable listings each has), read once and kept for five minutes: nine small reads that
// change only when the catalogue or the search table is rebuilt, never per question. A refresh that fails keeps
// serving the lexicon it has (and reports the error); only a process that has never read one fails its question.

export const LEXICON_TTL_MS = 5 * 60 * 1_000;

type Kept = { readonly lexicon: Lexicon; readonly readAt: number };

const globalForLexicon = globalThis as typeof globalThis & {
  carshenasLexicon?: { kept?: Kept; loading?: Promise<Lexicon> };
};

/** The lexicon, read when none is kept or the kept one is older than the TTL; one read at a time. */
export async function currentLexicon(now = Date.now()): Promise<Lexicon> {
  const state = (globalForLexicon.carshenasLexicon ??= {});
  if (state.kept !== undefined && now - state.kept.readAt < LEXICON_TTL_MS) return state.kept.lexicon;
  state.loading ??= readLexiconRows(readDatabase())
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
    });
  return state.loading;
}

/** For tests: forget what is kept. */
export function forgetLexicon(): void {
  globalForLexicon.carshenasLexicon = undefined;
}
