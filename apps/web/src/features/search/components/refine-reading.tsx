'use client';

import { LoaderCircle } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The model reading what the code could not (CS-111, ADR-0043, ADR-0029). Rendered only while the master switch
// SEARCH_UNDERSTANDING_AI is on, the code left words it could not settle, no model's answer is cached for the sentence
// and the address is still exactly what the code read; with the switch off it is never rendered, nothing is asked and
// nothing is said. The page has already shown the code's results: this asks the route in the background, once for the
// sentence in this tab, and when the model read more it replaces the address with the one that reading leads to (no step
// in the history), so the page upgrades by itself with no click. A buyer who changes anything meanwhile moves the
// address away from what the code read, the server stops rendering this, and the late answer is dropped: the buyer's
// own choices stand. The one quiet line has a reserved height so nothing moves when it goes.

const requests = new Map<string, Promise<string | null>>();

/** The address a route answer leads to, when it is one of the search page's own. */
function hrefOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('href' in body)) return null;
  const { href } = body;
  return typeof href === 'string' && /^\/search(\?|$)/.test(href) ? href : null;
}

/** One question per sentence per tab: a second render of the same sentence reuses the first one's answer. */
function askRoute(sentence: string): Promise<string | null> {
  const known = requests.get(sentence);
  if (known !== undefined) return known;
  const request = fetch('/api/search/understand', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q: sentence }),
  })
    .then(async (response) => (response.ok ? hrefOf(await response.json()) : null))
    .catch(() => null);
  requests.set(sentence, request);
  return request;
}

export function RefineReading({ sentence }: { sentence: string }) {
  const router = useRouter();
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void askRoute(sentence).then((href) => {
      if (!live) return;
      setAnswered(sentence);
      const here = `${window.location.pathname}${window.location.search}`;
      if (href !== null && href !== here) router.replace(href as Route, { scroll: false });
    });
    return () => {
      live = false;
    };
  }, [sentence, router]);

  return (
    <p role="status" className="flex min-h-lh items-center gap-2 text-secondary text-muted">
      {answered === sentence ? null : (
        <>
          <span aria-hidden="true" className="inline-flex motion-safe:animate-spin">
            <Icon icon={LoaderCircle} size={16} />
          </span>
          {SEARCH_COPY.sentence.reading}
        </>
      )}
    </p>
  );
}
