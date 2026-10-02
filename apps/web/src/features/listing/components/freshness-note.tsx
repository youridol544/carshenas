'use client';

import { useEffect, useState } from 'react';
import { requestRecheckAction } from '@/features/listing/listing-actions';
import { LISTING_COPY } from '@/features/listing/listing-copy';

// When the listing was last checked, and what the page did about it (CS-64 criterion 7, CS-35). The page opens with the
// time of the last read of the listing's own page. When that read is older than the freshness window and the listing is
// still on the market, opening the page asks the worker to read it again: a request recorded in the database (the web
// app never touches the queue, ADR-0018), idempotent, so reopening or a second tab asks once. The worker answers when
// the crawl runs; until then the page says plainly that the check is in the queue. The request is sent from the browser
// after hydration, never while the server renders, so a prefetch or a crawler's fetch of the page never asks. The second
// line is always mounted, so the answer replaces text in a reserved box.

const COPY = LISTING_COPY.freshness;

type Asked = 'asking' | 'queued' | 'failed';

type FreshnessNoteProps = {
  listingId: number;
  /** «آخرین بررسی: ۳ ساعت پیش», formatted on the server. */
  checked: string;
  /** The listing is on the market and its last read is older than the freshness window. */
  requestsRecheck: boolean;
};

export function FreshnessNote({ listingId, checked, requestsRecheck }: FreshnessNoteProps) {
  const [asked, setAsked] = useState<Asked>('asking');

  useEffect(() => {
    if (!requestsRecheck) return;
    let current = true;
    void requestRecheckAction({ id: listingId }).then((result) => {
      if (current) setAsked(result.status === 'queued' ? 'queued' : 'failed');
    });
    return () => {
      current = false;
    };
  }, [listingId, requestsRecheck]);

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-secondary text-muted">{checked}</p>
      {requestsRecheck ? (
        <p role="status" data-recheck={asked} className="min-h-2lh text-meta text-pretty text-muted">
          {asked === 'asking'
            ? COPY.requesting
            : asked === 'queued'
              ? `${COPY.queued}. ${COPY.queuedHint}`
              : COPY.failed}
        </p>
      ) : null}
    </div>
  );
}
