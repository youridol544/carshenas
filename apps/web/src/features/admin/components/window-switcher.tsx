'use client';

import Link, { useLinkStatus } from 'next/link';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import type { PipelineWindow } from '@/features/admin/admin-types';
import { Spinner } from '@/components/ui/spinner';

// The window the crawl and listing sections count over (CS-41; the owner's decision: one hour, 24 hours or seven
// days). Links, so the window is in the address and a reload keeps it; the chosen one is marked for screen readers
// with aria-current. The page is read at request time and not prefetched, so a slow answer shows the spinner in the
// pressed link's reserved slot after the pending delay, and nothing moves.

const WINDOWS = ['1h', '24h', '7d'] as const satisfies readonly PipelineWindow[];

function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span data-pending={pending ? '' : undefined} className="group inline-flex">
      <Spinner />
    </span>
  );
}

export function WindowSwitcher({ current }: { current: PipelineWindow }) {
  return (
    <nav aria-labelledby="window-label" className="flex flex-wrap items-center gap-3">
      <span id="window-label" className="text-label font-medium text-muted">
        {WORKER_COPY.window}
      </span>
      <ul className="flex flex-wrap gap-2">
        {WINDOWS.map((window) => (
          <li key={window}>
            <Link
              href={`/admin/worker?window=${window}`}
              prefetch={false}
              scroll={false}
              aria-current={window === current ? 'page' : undefined}
              className="inline-flex min-h-11 items-center gap-1 rounded-control border border-control px-3 text-label font-medium text-default transition-colors hover:bg-surface-hover aria-[current=page]:bg-action-subtle aria-[current=page]:text-on-action-subtle"
            >
              {WORKER_COPY.windows[window]}
              <PendingHint />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
