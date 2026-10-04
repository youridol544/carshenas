import 'server-only';
import { searchListings } from '@/features/search/server/search-queries';
import { currentLexicon } from '@/features/search-understanding/server/lexicon';
import { cachedModelStep } from '@/features/search-understanding/server/paid-step';
import {
  sentenceAddress,
  sentenceView,
  settleReading,
  type Counter,
  type Settled,
} from '@/features/search-understanding/server/sentence-search';
import { understandSentence } from '@/features/search-understanding/server/understand-search';
import type { SentenceView } from '@/lib/search-sentence';
import { env } from '@/server/env';
import { captureError } from '@/server/observability/logger';
import type { Search } from '@carshenas/search/search';
import type { Understanding } from '@carshenas/search/understand/types';
import type { UnderstandTrace } from '@carshenas/search/understand/understand';

// The sentence flow with its real parts (CS-111, ADR-0043): the lexicon, the model's cache when the master switch is on,
// and the search API's counts. The action that sends a buyer to the results, the route that asks a model in the
// background and the search page that says what became of the words all read a sentence through here, so they cannot
// read it three ways. Nothing in this file can spend: the model is reached only by the route, and only through the
// paid step.

/** Whether a search finds anything: the live count, stopped at the first listing found. Not logged as a buyer's search. */
export const countListings: Counter = async (search) => {
  const result = await searchListings({ search, limit: 0, countCap: 1, quiet: true });
  return result.status === 'ok' ? result.page.total.count : 0;
};

export type ReadSentence = {
  readonly understanding: Understanding;
  readonly trace: UnderstandTrace;
};

/**
 * A sentence read by code, and by a model's answer when the switch is on and the cache holds one. The switch is read for
 * every sentence, so turning it off stops the next one with no restart.
 */
export async function readSentence(typed: string): Promise<ReadSentence> {
  const { response, trace } = await understandSentence(typed, {
    lexicon: currentLexicon,
    ...(env.searchUnderstandingAi ? { model: cachedModelStep() } : {}),
  });
  return { understanding: response.understanding, trace };
}

export type SentenceDestination = ReadSentence & {
  readonly settled: Settled;
  /** The canonical address of the results, with the sentence kept in it. */
  readonly href: string;
};

/** Where a sentence leads: its reading settled against the counts, as an address. */
export async function destinationOfSentence(typed: string): Promise<SentenceDestination> {
  const read = await readSentence(typed);
  const settled = await settleReading(read.understanding, countListings);
  return { ...read, settled, href: sentenceAddress(settled, typed) };
}

/**
 * What the search page says about the sentence in its address, beside the search it shows. The lines about the sentence
 * are an addition to the results, never a condition of them: when reading the sentence fails, the failure is reported once
 * and the page shows its results without them.
 */
export async function readSentenceView(input: {
  readonly search: Search;
  readonly sentence: string;
}): Promise<SentenceView | undefined> {
  try {
    const { understanding, trace } = await readSentence(input.sentence);
    return await sentenceView({
      search: input.search,
      understanding,
      trace,
      modelAvailable: env.searchUnderstandingAi,
      count: countListings,
    });
  } catch (error) {
    captureError(error, { message: 'reading the sentence of a search failed' });
    return undefined;
  }
}
