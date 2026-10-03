'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Spinner } from '@/components/ui/spinner';
import { ListingCard, ListingCardSkeleton } from '@/features/search/components/listing-card';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { SearchErrorBodySchema, SearchResponseSchema } from '@/features/search/search-schemas';
import type { ListingCard as ListingCardData, SearchTotal } from '@/features/search/search-types';

// The results, a page at a time. The first page arrives rendered by the server (children: it needs no script and no
// hydration, so it is there when the HTML is); «نمایش بیشتر» asks GET /api/search for the next page with the same
// parameters and the opaque keyset cursor (CS-59: no OFFSET, so a page costs the same however deep it is), and appends it.
//
// A button, not infinite scroll (listing-patterns.md: Baymard found it performs best on mobile, and a scroll that loads
// without being asked moves what the reader is looking at). Keyboard and screen-reader users are looked after: the
// pressed button is where the new cards arrive, so focus moves to the first new card, the added count is announced
// politely, and the skeleton rows reserve the space at once (nothing shifts after the press). A failure keeps what is
// shown, says why and offers a retry; it never disappears on a timer (ui-design craft.md, section 4).

type LoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly message: string; readonly reopen: boolean };

type ResultsListProps = {
  /** The search's own address parameters, canonical: the next pages ask for the same search. */
  query: string;
  /** The cursor of the page after the first, or null when the first page was the last. */
  initialCursor: string | null;
  /** The ids on the first page, so a page that overlaps it (a listing moved) never shows a card twice. */
  initialIds: readonly number[];
  total: SearchTotal;
  pageSize: number;
  /** The moment the page was made, for days on market. */
  now: string;
  /** The first page's cards as <li> elements, rendered by the server. */
  children: ReactNode;
};

const SKELETON_KEYS = ['more-1', 'more-2', 'more-3'] as const;

/**
 * The most cards one search shows. Past about a hundred, scanning a list stops being how anyone finds a car (the order
 * is the deal, so the best are first); the page gets heavy to read, to scroll and for assistive technology; and a
 * narrower search finds the rest. The list says so and points at the filters instead of offering more.
 */
export const MAX_SHOWN_RESULTS = 120;

export function ResultsList({
  query,
  initialCursor,
  initialIds,
  total,
  pageSize,
  now,
  children,
}: ResultsListProps) {
  const router = useRouter();
  const [added, setAdded] = useState<readonly ListingCardData[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [announcement, setAnnouncement] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const request = useRef<AbortController | null>(null);
  const focusIndex = useRef<number | null>(null);
  const shownCount = initialIds.length + added.length;

  // A search that changes remounts this list (the parent keys it by the query), so a request still on its way for
  // the old one is simply abandoned.
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  // After the new cards are in the document, focus goes to the first of them.
  useLayoutEffect(() => {
    const index = focusIndex.current;
    if (index === null) return;
    focusIndex.current = null;
    list.current
      ?.querySelectorAll(':scope > li:not([data-extra])')
      [index]?.querySelector<HTMLElement>('a')
      ?.focus();
  }, [added]);

  async function loadMore() {
    if (cursor === null || state.status === 'loading' || shownCount >= MAX_SHOWN_RESULTS) return;
    setState({ status: 'loading' });
    const controller = new AbortController();
    request.current = controller;
    const address = `/api/search?${query}${query === '' ? '' : '&'}cursor=${encodeURIComponent(cursor)}&limit=${String(pageSize)}`;
    try {
      const response = await fetch(address, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const refusal = SearchErrorBodySchema.safeParse(body);
        // The API refuses a cursor it can no longer use (the index moved on): asking again would be refused again,
        // so the way on is a fresh first page.
        setState({
          status: 'failed',
          message: refusal.success ? refusal.data.message : SEARCH_COPY.results.moreFailed,
          reopen: refusal.success && response.status === 400,
        });
        return;
      }
      const parsed = SearchResponseSchema.safeParse(body);
      if (!parsed.success) {
        setState({ status: 'failed', message: SEARCH_COPY.results.moreFailed, reopen: false });
        return;
      }
      const known = new Set([...initialIds, ...added.map((card) => card.id)]);
      const fresh = parsed.data.results.filter((card) => !known.has(card.id));
      focusIndex.current = shownCount;
      setAdded((current) => [...current, ...fresh]);
      setCursor(parsed.data.nextCursor);
      setState({ status: 'idle' });
      setAnnouncement(SEARCH_COPY.results.added(fresh.length));
    } catch {
      // A request abandoned on purpose says nothing; a lost connection or an unreadable answer is said.
      if (!controller.signal.aborted) {
        setState({ status: 'failed', message: SEARCH_COPY.results.moreFailed, reopen: false });
      }
    }
  }

  const loading = state.status === 'loading';
  return (
    <div className="flex flex-col gap-4">
      <ol
        ref={list}
        aria-label={SEARCH_COPY.results.listLabel}
        aria-busy={loading}
        className="grid gap-3 xl:grid-cols-2 [&>li>*]:h-full"
      >
        {children}
        {added.map((card) => (
          <li key={card.id}>
            <ListingCard card={card} now={now} />
          </li>
        ))}
        {loading
          ? SKELETON_KEYS.map((key) => (
              <li key={key} aria-hidden="true">
                <ListingCardSkeleton />
              </li>
            ))
          : null}
      </ol>
      <div role="status" className="sr-only">
        {loading ? SEARCH_COPY.results.loadingMore : announcement}
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-secondary text-muted">
          {SEARCH_COPY.results.shown(shownCount, SEARCH_COPY.results.count(total.count, total.exact))}
        </p>
        {state.status === 'failed' ? (
          <p role="alert" className="text-secondary text-pretty text-danger">
            {state.message}
          </p>
        ) : null}
        {cursor === null ? (
          <p className="text-secondary text-pretty text-muted">
            {total.exact
              ? SEARCH_COPY.results.end
              : `${SEARCH_COPY.results.end} ${SEARCH_COPY.results.endCapped}`}
          </p>
        ) : shownCount >= MAX_SHOWN_RESULTS ? (
          <p className="max-w-reading text-secondary text-pretty text-muted">
            {SEARCH_COPY.results.limit(MAX_SHOWN_RESULTS)}
          </p>
        ) : (
          <button
            type="button"
            aria-disabled={loading}
            data-pending={loading ? '' : undefined}
            onClick={() => {
              if (loading) return;
              if (state.status === 'failed' && state.reopen) router.refresh();
              else void loadMore();
            }}
            className={`group relative w-full lg:w-auto lg:min-w-64 ${actionClasses('secondary')}`}
          >
            {state.status !== 'failed'
              ? SEARCH_COPY.results.more
              : state.reopen
                ? SEARCH_COPY.results.reopen
                : SEARCH_COPY.results.retry}
            <span className="absolute inset-y-0 inset-e-4 flex items-center">
              <Spinner />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
