'use client';

import { useState } from 'react';
import { formatCountOf } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';

// The latest failures, kept in the order the person first saw them (CS-41; the design review of 2026-09-30). The page
// refreshes every 15 seconds, and a failure that arrived meanwhile would push every row down under a finger about to
// press «تلاش دوباره», which then retries another job. So rows stay where they are: a job that left drops out, a job
// whose state changed keeps its place, and failures that arrived since wait behind a button in the card's heading
// line, whose room is always kept, and join the list only when the person asks.

type Item = { id: string; node: React.ReactNode };

export function StableFailureList({
  items,
  heading,
  empty,
}: {
  items: readonly Item[];
  heading: React.ReactNode;
  empty: string;
}) {
  // The ids on screen, in their order: what the person has seen, not a copy of the server's list.
  const [seenIds, setSeenIds] = useState<readonly string[]>(() => items.map((item) => item.id));
  const current = new Map(items.map((item) => [item.id, item.node]));
  const shown = seenIds.flatMap((id) => {
    const node = current.get(id);
    return node === undefined ? [] : [{ id, node }];
  });
  const arrived = items.filter((item) => !seenIds.includes(item.id)).length;
  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        {heading}
        {arrived === 0 ? null : (
          <button
            type="button"
            onClick={() => {
              setSeenIds(items.map((item) => item.id));
            }}
            className="inline-flex min-h-11 items-center rounded-full bg-action-subtle px-4 text-label font-medium text-on-action-subtle"
          >
            {formatCountOf(arrived, WORKER_COPY.newFailures)}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-secondary text-pretty text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 border-t border-divider pt-4 first:border-t-0 first:pt-0"
            >
              {item.node}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
