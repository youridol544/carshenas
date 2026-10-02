'use client';

import { useEffect, useState } from 'react';
import { SearchResponseSchema } from '@/features/search/search-schemas';
import type { SearchFacets, SearchTotal } from '@/features/search/search-types';

// How many listings a search the buyer has not applied yet would show, and how many each option would give, asked of
// GET /api/search while they edit the filter sheet (CS-59: the same SQL as the page, so the number on «نمایش ۱۲۸ آگهی»
// is the number they will get). A request waits for the buyer to pause, a request for a search that has been replaced
// is abandoned, an answer already given is remembered (going back to a search shows its count at once), and while a new
// one is on its way the last count stays on screen. A failed count is said, never guessed; the buyer can still apply.

// The API answers a count and the options with at most this many results beside them.
const COUNT_ONLY_LIMIT = 1;
const PAUSE_MS = 250;

export type CountAnswer = {
  readonly query: string;
  readonly total: SearchTotal;
  readonly facets: SearchFacets;
};

export type LiveCount = {
  readonly status: 'ready' | 'loading' | 'failed';
  /** The answer to show: the search's own, or the last one while a new one is on its way. */
  readonly answer: CountAnswer;
};

export function useLiveCount(query: string, initial: CountAnswer): LiveCount {
  const [answers, setAnswers] = useState<ReadonlyMap<string, CountAnswer>>(
    () => new Map([[initial.query, initial]]),
  );
  const [last, setLast] = useState(initial);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (answers.has(query)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const address = `/api/search?${query}${query === '' ? '' : '&'}limit=${String(COUNT_ONLY_LIMIT)}&facets=1`;
          const response = await fetch(address, {
            signal: controller.signal,
            headers: { accept: 'application/json' },
          });
          const body: unknown = await response.json();
          const parsed = SearchResponseSchema.safeParse(body);
          if (!response.ok || !parsed.success || parsed.data.facets === undefined)
            throw new Error('no count');
          const answer = { query, total: parsed.data.total, facets: parsed.data.facets };
          setAnswers((current) => new Map(current).set(query, answer));
          setLast(answer);
          setFailed(null);
        } catch {
          if (!controller.signal.aborted) setFailed(query);
        }
      })();
    }, PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, answers]);

  const current = answers.get(query);
  if (current !== undefined) return { status: 'ready', answer: current };
  return { status: failed === query ? 'failed' : 'loading', answer: last };
}
